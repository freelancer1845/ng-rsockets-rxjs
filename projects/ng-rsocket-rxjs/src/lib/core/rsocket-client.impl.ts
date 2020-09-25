import { BehaviorSubject, from, interval, merge, Observable, of, race, Subject, throwError, timer } from "rxjs";
import { delay, dematerialize, filter, flatMap, materialize, repeatWhen, take, takeUntil, takeWhile, tap, timeout } from "rxjs/operators";
import { RSocket, RSocketState } from '../api/rsocket.api';
import { logFrame } from '../utlities/debugging';
import { factory } from "./config-log4j";
import { RSocketConfig } from "./config/rsocket-config";
import { FragmentContext } from './protocol/fragments';
import { Frame, FrameType } from "./protocol/frame";
import { createCancelFrame, createKeepaliveFrame, createRequestFNFFrame, createRequestResponseFrame, createRequestStreamFrame, createSetupFrame } from "./protocol/frame-factory";
import { Payload } from "./protocol/payload";
import { Transport } from "./transport/transport.api";

const protocolLog = factory.getLogger('protocol.RSocketClient');
const log = factory.getLogger('.RSocketClient');

export class RSocketClient implements RSocket {

    private _state: BehaviorSubject<RSocketState> = new BehaviorSubject<RSocketState>(RSocketState.Disconnected);
    private _incoming: Subject<Frame> = new Subject();
    private _config: RSocketConfig | undefined;

    private streamIdsHolder: number[] = [];
    private streamIdCounter = 0;

    private $destroy = new Subject();

    constructor(private readonly transport: Transport) {
        this.incomingHandlerSetup();
    }

    public establish(config: RSocketConfig): void {
        this._config = config;
        this.transport.incoming().subscribe({
            next: n => this._incoming.next(n),
            error: err => protocolLog.error("Websocket signaled error: " + JSON.stringify(err)),
            complete: () => protocolLog.debug("Websocket completed")
        });
        const setupFrame = createSetupFrame(config);
        if (config.honorsLease == false) {
            protocolLog.debug('Sending Setup frame without honoring lease...');
            this.transport.send(setupFrame);
            this._state.next(RSocketState.Connected);
        }
        this.setupKeepaliveSupport();
    }


    private incomingHandlerSetup() {
        this._incoming.subscribe(f => logFrame(f));
    }

    public requestResponse(payload: Payload): Observable<Payload> {
        const obs = new Observable<Payload>(emitter => {
            protocolLog.debug(() => "Executing Request Response");
            const streamId = this.getNewStreamId();
            const fragmentsContext = new FragmentContext();
            const subscription = this._incoming.pipe(
                filter(f => f.streamId() == streamId),
            ).subscribe(f => {
                if (f.type() == FrameType.PAYLOAD) {
                    if (f.isNext()) {
                        fragmentsContext.add(f.payload());
                        if (f.fragmentFollows() == false) {
                            emitter.next(fragmentsContext.get());
                        }
                    }
                    if (f.isStreamComplete()) {
                        subscription.unsubscribe();
                        emitter.complete();
                    }
                } else if (f.type() == FrameType.ERROR) {
                    let message = "No Error message given.";
                    let messagePayload = f.payload();
                    if (messagePayload != undefined) {
                        if (messagePayload.data.byteLength > 0) {
                            message = String.fromCharCode.apply(null, new Uint8Array(messagePayload.data) as unknown as number[]);
                        }
                    }

                    subscription.unsubscribe();
                    emitter.error(new Error(`Error: ${f.errorCode()}. Message: ${message}`))
                } else {
                    subscription.unsubscribe();
                    emitter.error(new Error('Unexpected frame type in request response interaction: ' + f.type()));
                }

            }, error => {
                emitter.error(new Error('Unexpected error form transport. ' + error.message));
                subscription.unsubscribe();
            }, () => {
                emitter.complete();
                subscription.unsubscribe();
            });

            this.transport.send(createRequestResponseFrame(streamId, payload));
            return () => {
                if (subscription.closed == false) {
                    subscription.unsubscribe();
                    this.transport.send(createCancelFrame(streamId));
                }
            }
        });

        return this._state.pipe(
            filter(s => s == RSocketState.Connected),
            take(1),
            flatMap(s => race(obs, this.connectionFailedObservable())));
    }

    public requestStream(payload: Payload): Observable<Payload> {
        const obs = new Observable<Payload>(emitter => {
            protocolLog.debug(() => "Executing Request Stream");
            const streamId = this.getNewStreamId();
            // const fragmentsContext: Payload[] = [];
            const fragmentsContext = new FragmentContext();
            const subscription = this._incoming.pipe(
                filter(f => f.streamId() == streamId),
            ).subscribe(f => {
                if (f.type() == FrameType.PAYLOAD) {
                    if (f.isNext()) {
                        fragmentsContext.add(f.payload());
                        if (f.fragmentFollows() == false) {
                            emitter.next(fragmentsContext.get());
                        }
                    }
                    if (f.isStreamComplete()) {
                        subscription.unsubscribe();
                        emitter.complete();
                    }
                } else if (f.type() == FrameType.ERROR) {
                    let message = "No Error message given.";
                    let messagePayload = f.payload();
                    if (messagePayload != undefined) {
                        if (messagePayload.data.byteLength > 0) {
                            message = String.fromCharCode.apply(null, new Uint8Array(messagePayload.data) as unknown as number[]);
                        }
                    }
                    subscription.unsubscribe();
                    emitter.error(new Error(`Error: ${f.errorCode()}. Message: ${message}`))
                } else {
                    subscription.unsubscribe();
                    emitter.error(new Error('Unexpected frame type in request response interaction: ' + f.type()));
                }

            }, error => {
                emitter.error(new Error('Unexpected error form transport. ' + error.message));
                subscription.unsubscribe();
            }, () => {
                emitter.complete();
                subscription.unsubscribe();
            });

            this.transport.send(createRequestStreamFrame(streamId, payload, 2 ** 31 - 1));
            return () => {
                if (subscription.closed == false) {
                    subscription.unsubscribe();
                    this.transport.send(createCancelFrame(streamId));
                }
            }
        });

        return this._state.pipe(
            filter(s => s == RSocketState.Connected),
            take(1),
            flatMap(s => merge(obs.pipe(materialize()), this.connectionFailedObservable().pipe(materialize()))),
            takeWhile(notification => notification.hasValue),
            dematerialize()
        );
    }

    public requestFNF(payload: Payload): void {

        this._state.pipe(filter(s => s == RSocketState.Connected), take(1)).subscribe(s => {
            protocolLog.debug(() => "Executing Request FNF");
            const streamId = this.getNewStreamId();
            this.transport.send(createRequestFNFFrame(streamId, payload));
        });
    }

    private getNewStreamId(): number {
        const i = this.streamIdCounter;
        this.streamIdCounter++;
        const id = i * 2 + 1;
        this.streamIdsHolder.push(id);
        return id;
    }

    private connectionFailedObservable(): Observable<never> {
        return this._state.pipe(filter(s => s != RSocketState.Connected), flatMap(s => throwError(new Error("RSocket connection closed"))));
    }

    private setupKeepaliveSupport(): void {
        new Observable(emitter => {
            console.log("Sending Keepalive")
            const data = new Uint8Array(20);
            for (let i = 0; i < 20; i++) {
                data[i] = Math.floor(Math.random() * 100);
            }
            const sub = this._incoming.pipe(filter(p => p.type() == FrameType.KEEPALIVE && p.respondWithKeepalive() == false), filter(p => {
                const returnData = new Uint8Array(p.payload().data);
                if (returnData.length != data.length) {
                    protocolLog.warn("Keepalive answer length did not match");
                    return false;
                } else {
                    for (let i = 0; i < 20; i++) {
                        if (data[i] != returnData[i]) {
                            protocolLog.warn("Keepalive answer length data did not match");
                            return false;
                        }
                    }
                    protocolLog.debug("Keepalive answer received");
                    return true;
                }
            }), take(1), timeout(this._config.maxLifetime)).subscribe({
                next: n => emitter.complete(),
                error: error => emitter.error(error),
            });
            const keepaliveFrame = createKeepaliveFrame(true, this.transport.recvPosition(), new Payload(data));
            this.transport.send(keepaliveFrame);
            return () => sub.unsubscribe()
        }).pipe(takeUntil(this.$destroy), repeatWhen(() => interval(this._config.keepaliveTime))).subscribe();

        this._incoming.pipe(takeUntil(this.$destroy), filter(p => p.type() == FrameType.KEEPALIVE && p.respondWithKeepalive() == true)).subscribe(p => {
            const keepaliveAnswer = createKeepaliveFrame(false, this.transport.recvPosition(), p.payload());
            this.transport.send(keepaliveAnswer);
        });
    }

}