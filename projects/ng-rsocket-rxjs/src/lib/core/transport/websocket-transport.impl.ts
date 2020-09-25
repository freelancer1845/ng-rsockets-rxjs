import { Transport } from "./transport.api";
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { Observable, Subject } from "rxjs";
import { Frame } from "../protocol/frame";
import { map, tap } from 'rxjs/operators';
import { logFrame } from '../../utlities/debugging';
import { factory } from '../config-log4j';

const log = factory.getLogger('.transport.Websocket');


export class WebsocketTransport implements Transport {


    private _sendPosition = 0;
    private _recvPosition = 0;

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

        return this.subject.pipe(tap({
            next: data => {
                log.debug("Recieved message")
                this._recvPosition += data.byteLength;

            }
        }), map(data => new Frame(data)));
    }
    public send(frame: Frame): void {
        log.debug(`Sending Frame`);
        logFrame(frame);
        this._sendPosition += frame.buffer.byteLength;
        this.subject.next(frame.buffer);
    }

    public sendPosition(): number {
        return this._sendPosition;
    }
    public recvPosition(): number {
        return this._recvPosition;
    }

}