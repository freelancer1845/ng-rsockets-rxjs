import { Observable, Subject } from "rxjs";
import { RSocketConfig } from '../core/config/rsocket-config';
import { Payload } from '../core/protocol/payload';


export enum RSocketState {
    Disconnected = 'Disconnected',
    Connected = 'Connected',
    Error = 'Error',
    Reconnecting = 'Reconnecting'
}

export enum BackpressureStrategy {
    BufferDelay,
    Drop,
}

export type RequestResponseHandler = (payload: Payload) => Observable<Payload>;
/**
 * Use the requester to pull elements from the stream => "backpressure" support
 */
export type RequestStreamHandler = (payload: Payload) => { stream: Observable<Payload>, backpressureStrategy: BackpressureStrategy };
export type RequestFNFHandler = (payload: Payload) => void;

export interface RSocket {

    establish(config: RSocketConfig): void;
    close(): void;

    requestResponse(payload: Payload): Observable<Payload>;
    requestStream(payload: Payload): Observable<Payload>;
    requestFNF(payload: Payload): void;
    setRequestResponseHandler(handler: RequestResponseHandler);
    setRequestStreamHandler(handler: RequestStreamHandler);
    setRequestFNFHandler(handler: RequestFNFHandler);
}