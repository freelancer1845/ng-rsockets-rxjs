import { defer, Observable } from "rxjs";
import { map } from "rxjs/operators";
import { MimeType, MimeTypes } from '../api/rsocket-mime.types';
import { RSocket } from '../api/rsocket.api';
import { Payload } from '../core/protocol/payload';
import { arrayBufferToUtf8String, stringToUtf8ArrayBuffer } from '../utlities/conversions';



export class MessageRoutingRSocket {


    constructor(private readonly rsocket: RSocket) { }

    public requestResponse<T>(route: string, payload: any = {}, jsonSerialize = true, jsonDeserialize = true): Observable<T> {
        return defer(() => {
            const metaDataString = String.fromCharCode(route.length) + route;
            let _payload: Payload;
            if (jsonSerialize) {
                _payload = new Payload(stringToUtf8ArrayBuffer(JSON.stringify(payload)), stringToUtf8ArrayBuffer(metaDataString));
            } else {
                _payload = new Payload(payload as unknown as ArrayBuffer, stringToUtf8ArrayBuffer(metaDataString));
            }
            return this.rsocket.requestResponse(_payload).pipe(map(ans => {
                if (jsonDeserialize) {
                    return JSON.parse(arrayBufferToUtf8String(ans.data));
                } else {
                    return payload.data;
                }
            }));
        });
    }

    public requestStream<T>(route: string, payload: any = {}, payloadMimeType: MimeType = MimeTypes.APPLICATION_JSON, streamMimeType: MimeType = MimeTypes.APPLICATION_JSON): Observable<T> {
        return defer(() => {
            const metaDataString = String.fromCharCode(route.length) + route;
            let _payload: Payload;
            if (payloadMimeType.equals(MimeTypes.APPLICATION_JSON)) {
                _payload = new Payload(stringToUtf8ArrayBuffer(JSON.stringify(payload)), stringToUtf8ArrayBuffer(metaDataString));
            } else {
                _payload = new Payload(payload as unknown as ArrayBuffer, stringToUtf8ArrayBuffer(metaDataString));
            }
            return this.rsocket.requestStream(_payload).pipe(map(ans => {
                if (streamMimeType.equals(MimeTypes.APPLICATION_JSON)) {
                    return JSON.parse(arrayBufferToUtf8String(ans.data));
                } else {
                    return ans.data;
                }
            }));
        });
    }

    public requestFNF(route: string, payload: any = {}, payloadMimeType: MimeType = MimeTypes.APPLICATION_JSON): void {
        const metaDataString = String.fromCharCode(route.length) + route;
        let _payload: Payload;
        if (payloadMimeType.equals(MimeTypes.APPLICATION_JSON)) {
            _payload = new Payload(stringToUtf8ArrayBuffer(JSON.stringify(payload)), stringToUtf8ArrayBuffer(metaDataString));
        } else {
            _payload = new Payload(payload as unknown as ArrayBuffer, stringToUtf8ArrayBuffer(metaDataString));
        }
        this.rsocket.requestFNF(_payload);
    }

}