import { defer, Observable, of } from "rxjs";
import { map } from "rxjs/operators";
import { Authentication, CompositeMetaData, MimeType } from '../api/rsocket-mime.types';
import { BackpressureStrategy, RequestResponseHandler, RequestStreamHandler, RSocket } from '../api/rsocket.api';
import { factory } from '../core/config-log4j';
import { Payload } from '../core/protocol/payload';
import { arrayBufferToUtf8String, stringToUtf8ArrayBuffer } from '../utlities/conversions';

const log = factory.getLogger('rsocket.MessageClient');

interface RouteMapping {
    route: string;
}


export class RequestResponseMapping implements RouteMapping {
    constructor(
        public readonly route: string,
        public readonly handler: (payload: any) => Observable<any> | any,
        public readonly incomingMimeType = MimeType.APPLICATION_JSON,
        public readonly outgoingMimeType = MimeType.APPLICATION_JSON,
    ) { }
}

export class RequestStreamMapping implements RouteMapping {
    constructor(
        public readonly route: string,
        public readonly handler: (payload: any) => Observable<any> | any,
        public readonly incomingMimeType = MimeType.APPLICATION_JSON,
        public readonly outgoingMimeType = MimeType.APPLICATION_JSON,
        public readonly backpressureStrategy: BackpressureStrategy = BackpressureStrategy.BufferDelay,
    ) { }
}


export class MessageRoutingRSocket {


    private _requestResponseMappers: RequestResponseMapping[] = [];
    private _requestStreamMappers: RequestStreamMapping[] = [];


    constructor(public readonly rsocket: RSocket) {
        rsocket.setRequestResponseHandler(this._requestResponseHandler);
        rsocket.setRequestStreamHandler(this._requestStreamHandler);
    }


    public requestResponse<O, I>(
        route: string,
        payload?: O,
        outgoingMimeType: MimeType<O> = MimeType.APPLICATION_JSON,
        incomingMimeType: MimeType<I> = MimeType.APPLICATION_JSON,
        authentication?: Authentication): Observable<I> {
        return defer(() => {
            const metaData: CompositeMetaData[] = this.standardMetadataConstructor(route, authentication, outgoingMimeType);
            const dataBuffer = outgoingMimeType.coder.encoder(payload, this.rsocket.mimeTypeRegistry);
            const metadataBuffer = MimeType.MESSAGE_X_RSOCKET_COMPOSITE_METADATA.coder.encoder(metaData, this.rsocket.mimeTypeRegistry);

            const _payload = new Payload(dataBuffer, metadataBuffer);
            return this.rsocket.requestResponse(_payload).pipe(map(ans => {
                if (ans.hasMetadata()) {
                    const composite = MimeType.MESSAGE_X_RSOCKET_COMPOSITE_METADATA.coder.decoder(ans.metadata, this.rsocket.mimeTypeRegistry);
                }
                return incomingMimeType.coder.decoder(ans.data, this.rsocket.mimeTypeRegistry);
            }));
        });
    }

    public requestStream<O, I>(
        route: string, payload?: O,
        outgoingMimeType: MimeType<O> = MimeType.APPLICATION_JSON,
        incomingMimeType: MimeType<I> = MimeType.APPLICATION_JSON,
        authentication?: Authentication,
        requester?: Observable<number>): Observable<I> {
        return defer(() => {
            const metaData: CompositeMetaData[] = this.standardMetadataConstructor(route, authentication, outgoingMimeType);
            const dataBuffer = outgoingMimeType.coder.encoder(payload, this.rsocket.mimeTypeRegistry);
            const metadataBuffer = MimeType.MESSAGE_X_RSOCKET_COMPOSITE_METADATA.coder.encoder(metaData, this.rsocket.mimeTypeRegistry);

            const _payload = new Payload(dataBuffer, metadataBuffer);
            return this.rsocket.requestStream(_payload, requester).pipe(map(ans => {
                return incomingMimeType.coder.decoder(ans.data, this.rsocket.mimeTypeRegistry);
            }));
        });
    }

    public requestFNF<O>(
        route: string,
        payload?: O,
        payloadMimeType: MimeType<O> = MimeType.APPLICATION_JSON,
        authentication?: Authentication
    ): void {
        const metaData: CompositeMetaData[] = this.standardMetadataConstructor(route, authentication, payloadMimeType);
        const dataBuffer = payloadMimeType.coder.encoder(payload, this.rsocket.mimeTypeRegistry);
        const metadataBuffer = MimeType.MESSAGE_X_RSOCKET_COMPOSITE_METADATA.coder.encoder(metaData, this.rsocket.mimeTypeRegistry);

        const _payload = new Payload(dataBuffer, metadataBuffer);
        this.rsocket.requestFNF(_payload);

    }

    public addRequestResponseHandler(
        topic: string,
        handler: (payload: any) => Observable<any> | any,
        incomingMimeType = MimeType.APPLICATION_JSON,
        outgoingMimeType = MimeType.APPLICATION_JSON,
    ): void {
        this.addMapping(new RequestResponseMapping(
            topic,
            handler,
            incomingMimeType,
            outgoingMimeType,
        ), this._requestResponseMappers);
    }

    private standardMetadataConstructor(route: string, auth?: Authentication, dataMimeTypes?: MimeType): CompositeMetaData[] {
        const metaData: CompositeMetaData[] = [];
        metaData.push({
            type: MimeType.MESSAGE_X_RSOCKET_ROUTING,
            data: route
        });
        if (auth != undefined) {
            metaData.push({
                type: MimeType.MESSAGE_X_RSOCKET_AUTHENTICATION,
                data: auth
            })
        }
        if (dataMimeTypes != undefined) {
            metaData.push({
                type: MimeType.MESSAGE_X_RSOCKET_MIME_TYPE,
                data: dataMimeTypes
            })
        }
        return metaData;
    }

    private _requestResponseHandler: RequestResponseHandler = (payload: Payload) => {
        return defer(() => {
            const mapper = this.getMapping(this.getTopic(payload), this._requestResponseMappers);
            log.debug("Executing Request Response Handler for: " + mapper.route);
            const _payload = mapper.incomingMimeType.coder.decoder(payload.data, this.rsocket.mimeTypeRegistry);

            const result = mapper.handler(_payload);
            let obs: Observable<any>;
            if (result instanceof Observable) {
                obs = result;
            } else {
                obs = of(result);
            }
            return obs.pipe(map(answer => {
                return new Payload(mapper.outgoingMimeType.coder.encoder(answer, this.rsocket.mimeTypeRegistry));
            }));
        });
    }

    public addRequestStreamHandler(
        topic: string,
        handler: (payload: any) => Observable<any> | any,
        incomingMimeType = MimeType.APPLICATION_JSON,
        outgoingMimeType = MimeType.APPLICATION_JSON,
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
            log.debug("Executing Request Stream Handler for: " + mapper.route);
            const _payload = mapper.incomingMimeType.coder.decoder(payload.data, this.rsocket.mimeTypeRegistry);

            const result = mapper.handler(_payload);
            let obs: Observable<any>;
            if (result instanceof Observable) {
                obs = result;
            } else {
                obs = of(result);
            }
            return obs.pipe(map(answer => {
                return new Payload(mapper.outgoingMimeType.coder.encoder(answer, this.rsocket.mimeTypeRegistry));
            }));
        });
        return {
            stream: stream,
            backpressureStrategy: mapper.backpressureStrategy
        };
    }


    private addMapping(mapping: RouteMapping, target: RouteMapping[]) {
        if (target.findIndex(m => m.route == mapping.route) == -1) {
            target.push(mapping);
        } else {
            throw new Error(`Mapping for topic ${mapping} already registered`);
        }
    }

    private getTopic(payload: Payload) {
        return MimeType.MESSAGE_X_RSOCKET_COMPOSITE_METADATA.coder.decoder(payload.metadata, this.rsocket.mimeTypeRegistry).filter(c => c.type.equals(MimeType.MESSAGE_X_RSOCKET_ROUTING))[0].data;
    }

    private getMapping<T extends RouteMapping>(route: string, target: T[]) {
        const mapping = target.find(m => m.route == route);
        if (mapping == undefined) {
            throw Error(`No handler registered for ${route}`)
        }
        return mapping;
    }

}