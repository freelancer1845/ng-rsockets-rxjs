import { defer, Observable, of } from "rxjs";
import { map } from "rxjs/operators";
import { MimeType, MimeTypes } from '../api/rsocket-mime.types';
import { BackpressureStrategy, RequestResponseHandler, RequestStreamHandler, RSocket } from '../api/rsocket.api';
import { factory } from '../core/config-log4j';
import { Payload } from '../core/protocol/payload';
import { arrayBufferToUtf8String, stringToUtf8ArrayBuffer } from '../utlities/conversions';

const log = factory.getLogger('rsocket.MessageClient');

interface TopicMapping {
    topic: string;
}


export class RequestResponseMapping implements TopicMapping {
    constructor(
        public readonly topic: string,
        public readonly handler: (payload: any) => Observable<any> | any,
        public readonly incomingMimeType: MimeType = MimeTypes.APPLICATION_JSON,
        public readonly outgoingMimeType: MimeType = MimeTypes.APPLICATION_JSON,
    ) { }
}

export class RequestStreamMapping implements TopicMapping {
    constructor(
        public readonly topic: string,
        public readonly handler: (payload: any) => Observable<any> | any,
        public readonly incomingMimeType: MimeType = MimeTypes.APPLICATION_JSON,
        public readonly outgoingMimeType: MimeType = MimeTypes.APPLICATION_JSON,
        public readonly backpressureStrategy: BackpressureStrategy = BackpressureStrategy.BufferDelay,
    ) { }
}


export class MessageRoutingRSocket {


    private _requestResponseMappers: RequestResponseMapping[] = [];
    private _requestStreamMappers: RequestStreamMapping[] = [];


    constructor(private readonly rsocket: RSocket) {
        rsocket.setRequestResponseHandler(this._requestResponseHandler);
        rsocket.setRequestStreamHandler(this._requestStreamHandler);
    }


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
                log.debug('Received request response answer');
                log.debug(arrayBufferToUtf8String(ans.data));
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
            const _payload = new Payload(payloadMimeType.mapToBuffer(payload), stringToUtf8ArrayBuffer(metaDataString));
            return this.rsocket.requestStream(_payload).pipe(map(ans => {
                return streamMimeType.mapFromBuffer(ans.data);
            }));
        });
    }

    public requestFNF(route: string, payload: any = {}, payloadMimeType: MimeType = MimeTypes.APPLICATION_JSON): void {
        const metaDataString = String.fromCharCode(route.length) + route;
        const _payload = new Payload(payloadMimeType.mapToBuffer(payload), stringToUtf8ArrayBuffer(metaDataString));
        this.rsocket.requestFNF(_payload);
    }

    public addRequestResponseHandler(
        topic: string,
        handler: (payload: any) => Observable<any> | any,
        incomingMimeType: MimeType = MimeTypes.APPLICATION_JSON,
        outgoingMimeType: MimeType = MimeTypes.APPLICATION_JSON,
    ): void {
        this.addMapping(new RequestResponseMapping(
            topic,
            handler,
            incomingMimeType,
            outgoingMimeType,
        ), this._requestResponseMappers);
    }

    private _requestResponseHandler: RequestResponseHandler = (payload: Payload) => {
        return defer(() => {
            const mapper = this.getMapping(this.getTopic(payload), this._requestResponseMappers);
            log.debug("Executing Request Response Handler for: " + mapper.topic);
            const _payload = mapper.incomingMimeType.mapFromBuffer(payload.data);

            const result = mapper.handler(_payload);
            let obs: Observable<any>;
            if (result instanceof Observable) {
                obs = result;
            } else {
                obs = of(result);
            }
            return obs.pipe(map(answer => {
                return new Payload(mapper.outgoingMimeType.mapToBuffer(answer));
            }));
        });
    }

    public addRequestStreamHandler(
        topic: string,
        handler: (payload: any) => Observable<any> | any,
        incomingMimeType: MimeType = MimeTypes.APPLICATION_JSON,
        outgoingMimeType: MimeType = MimeTypes.APPLICATION_JSON,
        backpressureStrategy: BackpressureStrategy = BackpressureStrategy.BufferDelay,
    ): void {
        this.addMapping(new RequestStreamMapping(
            topic,
            handler,
            incomingMimeType,
            outgoingMimeType,
            backpressureStrategy
        ), this._requestStreamMappers);
    }

    private _requestStreamHandler: RequestStreamHandler = (payload: Payload) => {
        const mapper = this.getMapping(this.getTopic(payload), this._requestStreamMappers);
        const stream = defer(() => {
            log.debug("Executing Request Stream Handler for: " + mapper.topic);
            const _payload = mapper.incomingMimeType.mapFromBuffer(payload.data);

            const result = mapper.handler(_payload);
            let obs: Observable<any>;
            if (result instanceof Observable) {
                obs = result;
            } else {
                obs = of(result);
            }
            return obs.pipe(map(answer => {
                return new Payload(mapper.outgoingMimeType.mapToBuffer(answer));
            }));
        });
        return {
            stream: stream,
            backpressureStrategy: mapper.backpressureStrategy
        };
    }


    private addMapping(mapping: TopicMapping, target: TopicMapping[]) {
        if (target.findIndex(m => m.topic == mapping.topic) == -1) {
            target.push(mapping);
        } else {
            throw new Error(`Mapping for topic ${mapping} already registered`);
        }
    }

    private getTopic(payload: Payload) {
        const view = new Uint8Array(payload.metadata);
        const topicLength = view[0];
        return arrayBufferToUtf8String(payload.metadata.slice(1, 1 + topicLength));
    }

    private getMapping<T extends TopicMapping>(topic: string, target: T[]) {
        const mapping = target.find(m => m.topic == topic);
        if (mapping == undefined) {
            throw Error(`No handler registered for ${topic}`)
        }
        return mapping;
    }

}