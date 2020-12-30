import { defer, Observable, of } from "rxjs";
import { map } from "rxjs/operators";
import { Authentication, CompositeMetaData, MimeTypes } from '../api/rsocket-mime.types';
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
        public readonly incomingMimeType = MimeTypes.APPLICATION_JSON,
        public readonly outgoingMimeType = MimeTypes.APPLICATION_JSON,
    ) { }
}

export class RequestStreamMapping implements RouteMapping {
    constructor(
        public readonly route: string,
        public readonly handler: (payload: any) => Observable<any> | any,
        public readonly incomingMimeType = MimeTypes.APPLICATION_JSON,
        public readonly outgoingMimeType = MimeTypes.APPLICATION_JSON,
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
        outgoingMimeType: MimeTypes<O> = MimeTypes.APPLICATION_JSON,
        incomingMimeType: MimeTypes<I> = MimeTypes.APPLICATION_JSON,
        authentication?: Authentication): Observable<I> {
        return defer(() => {
            const metaData: CompositeMetaData[] = this.standardMetadataConstructor(route, authentication);
            const _payload = new Payload(outgoingMimeType.mapToBuffer(payload), MimeTypes.MESSAGE_X_RSOCKET_COMPOSITE_METADATA.mapToBuffer(metaData));
            return this.rsocket.requestResponse(_payload).pipe(map(ans => {
                if (ans.hasMetadata()) {
                    const composite = MimeTypes.MESSAGE_X_RSOCKET_COMPOSITE_METADATA.mapFromBuffer(ans.metadata);
                }
                return incomingMimeType.mapFromBuffer(ans.data);
            }));
        });
    }

    public requestStream<O, I>(
        route: string, payload?: O,
        outgoingMimeType: MimeTypes<O> = MimeTypes.APPLICATION_JSON,
        incomingMimeType: MimeTypes<I> = MimeTypes.APPLICATION_JSON,
        authentication?: Authentication,
        requester?: Observable<number>): Observable<I> {
        return defer(() => {
            const metaData: CompositeMetaData[] = this.standardMetadataConstructor(route, authentication);
            let _payload = new Payload(outgoingMimeType.mapToBuffer(payload), MimeTypes.MESSAGE_X_RSOCKET_COMPOSITE_METADATA.mapToBuffer(metaData));
            return this.rsocket.requestStream(_payload, requester).pipe(map(ans => {
                return incomingMimeType.mapFromBuffer(ans.data);
            }));
        });
    }

    public requestFNF<O>(
        route: string,
        payload?: O,
        payloadMimeType: MimeTypes<O> = MimeTypes.APPLICATION_JSON,
        authentication?: Authentication
    ): void {
        const metaData: CompositeMetaData[] = this.standardMetadataConstructor(route, authentication);
        const _payload = new Payload(payloadMimeType.mapToBuffer(payload), MimeTypes.MESSAGE_X_RSOCKET_COMPOSITE_METADATA.mapToBuffer(metaData));
        this.rsocket.requestFNF(_payload);

    }

    public addRequestResponseHandler(
        topic: string,
        handler: (payload: any) => Observable<any> | any,
        incomingMimeType = MimeTypes.APPLICATION_JSON,
        outgoingMimeType = MimeTypes.APPLICATION_JSON,
    ): void {
        this.addMapping(new RequestResponseMapping(
            topic,
            handler,
            incomingMimeType,
            outgoingMimeType,
        ), this._requestResponseMappers);
    }

    private standardMetadataConstructor(route: string, auth?: Authentication): CompositeMetaData[] {
        const metaData: CompositeMetaData[] = [];
        metaData.push({
            type: MimeTypes.MESSAGE_X_RSOCKET_ROUTING,
            data: route
        });
        if (auth != undefined) {
            metaData.push({
                type: MimeTypes.MESSAGE_X_RSOCKET_AUTHENTICATION,
                data: auth
            })
        }
        return metaData;
    }

    private _requestResponseHandler: RequestResponseHandler = (payload: Payload) => {
        return defer(() => {
            const mapper = this.getMapping(this.getTopic(payload), this._requestResponseMappers);
            log.debug("Executing Request Response Handler for: " + mapper.route);
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
        incomingMimeType = MimeTypes.APPLICATION_JSON,
        outgoingMimeType = MimeTypes.APPLICATION_JSON,
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


    private addMapping(mapping: RouteMapping, target: RouteMapping[]) {
        if (target.findIndex(m => m.route == mapping.route) == -1) {
            target.push(mapping);
        } else {
            throw new Error(`Mapping for topic ${mapping} already registered`);
        }
    }

    private getTopic(payload: Payload) {
        return MimeTypes.MESSAGE_X_RSOCKET_COMPOSITE_METADATA.mapFromBuffer(payload.metadata).filter(c => c.type.equals(MimeTypes.MESSAGE_X_RSOCKET_ROUTING))[0].data;
    }

    private getMapping<T extends RouteMapping>(route: string, target: T[]) {
        const mapping = target.find(m => m.route == route);
        if (mapping == undefined) {
            throw Error(`No handler registered for ${route}`)
        }
        return mapping;
    }

}