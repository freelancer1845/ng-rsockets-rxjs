import { Observable } from "rxjs";
import { Payload } from '../core/protocol/payload';


export enum RSocketState {
    Disconnected = 'Disconnected',
    Connected = 'Connected',
    Error = 'Error',
    Reconnecting = 'Reconnecting'
}

export interface RSocket {

    requestResponse(payload: Payload): Observable<Payload>;
    requestStream(payload: Payload): Observable<Payload>;
    requestFNF(payload: Payload): void;
}