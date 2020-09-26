import { Transport } from "./transport.api";
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { Observable, Subject } from "rxjs";
import { Frame, FrameType } from "../protocol/frame";
import { map, tap } from 'rxjs/operators';
import { logFrame } from '../../utlities/debugging';
import { factory } from '../config-log4j';

const log = factory.getLogger('.transport.Websocket');


export class WebsocketTransport implements Transport {


    private _sendPosition = 0;
    private _recvPosition = 0;
    private _foreignRecvPosition = 0;

    private subject: WebSocketSubject<ArrayBuffer>;

    constructor(private readonly url: string) {
        log.debug(`Constructing websocket with target url ${url}`);
        this.subject = webSocket({
            url: this.url,
            binaryType: "arraybuffer",
            serializer: (a: ArrayBuffer) => {
                return a;
            },
            deserializer: a => {
                return a.data
            },
            openObserver: {
                next: event => log.debug('Websocket opened'),
                error: err => log.error('Error', err)
            },
            closeObserver: {
                next: event => log.debug('Websocket closed. ' + JSON.stringify(event)),
                error: err => log.error('Error', err)
            },
            closingObserver: {
                next: event => log.debug('Closing Websocket due to unsubscribe'),
                error: err => log.error('Error', err)
            }
        });
    }


    public incoming(): Observable<Frame> {

        return this.subject.pipe(map(data => {
            const frame = new Frame(data);
            logFrame(frame, false);
            this._recvPosition += data.byteLength;
            if (frame.type() == FrameType.KEEPALIVE) {
                this._foreignRecvPosition = frame.lastReceivedPosition();
            }
            return frame;
        }));
    }
    public send(frame: Frame): void {
        logFrame(frame, true);
        this._sendPosition += frame.buffer.byteLength;
        this.subject.next(frame.buffer);
    }

    public sendPosition(): number {
        return this._sendPosition;
    }
    public recvPosition(): number {
        return this._recvPosition;
    }

    public foreignRecvPosition(): number {
        return this._foreignRecvPosition;
    }

}