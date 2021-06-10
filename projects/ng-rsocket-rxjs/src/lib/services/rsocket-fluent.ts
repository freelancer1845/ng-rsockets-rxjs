import { NgZone } from '@angular/core';
import { MessageRoutingRSocket, Authentication } from 'rsocket-rxjs';
import { pipe } from 'rxjs';
import { Observable, OperatorFunction } from 'rxjs';
import { concatMap, flatMap, map, take } from 'rxjs/operators';

function zoneFix<T>(zone: NgZone): OperatorFunction<T, T> {
    return (source) => {
        return new Observable(observer => {
            const onNext = (value: T) => zone.run(() => observer.next(value));
            const onError = (e: any) => zone.run(() => observer.error(e));
            const onComplete = () => zone.run(() => observer.complete());
            return source.subscribe(onNext, onError, onComplete);
        });
    };
}

export class FluentRequest {

    constructor(
        private _zone: NgZone,
        private socketHolder: Observable<MessageRoutingRSocket>,
        private _route: string,
        private _data?: any,
        private _outgoingMimeType?: string,
        private _incomingMimeType?: string,
        private _authentication?: Authentication,
        private _requester?: Observable<number>,
    ) {
    }


    public data(data: any) {
        this._data = data;
        return this.copy();
    }

    private copy() {
        return new FluentRequest(this._zone, this.socketHolder, this._route, this._data, this._outgoingMimeType, this._incomingMimeType, this._authentication, this._requester);
    }

    public requestMimetype<L>(type: string): FluentRequest {
        return new FluentRequest(this._zone, this.socketHolder, this._route, this._data, type, this._incomingMimeType, this._authentication, this._requester);
    }

    public answerMimetype<L>(type: string): FluentRequest {
        return new FluentRequest(this._zone, this.socketHolder, this._route, this._data, this._outgoingMimeType, type, this._authentication, this._requester);
    }

    public authentication(auth: Authentication): FluentRequest {
        return new FluentRequest(this._zone, this.socketHolder, this._route, this._data, this._outgoingMimeType, this._incomingMimeType, auth, this._requester);
    }

    public requester(requester: Observable<number>) {
        this._requester = requester;
        return this.copy();
    }

    public requestResponse<T>(): Observable<T> {
        return this.socketHolder.pipe(
            take(1),
            concatMap(
                socket => socket.requestResponse({
                    route: this._route,
                    authentication: this._authentication,
                    data: this._data,
                    dataMimeType: this._outgoingMimeType,
                }, {
                    responseDataMimeType: this._incomingMimeType
                })
            ),
            map(payload => payload.data as T)
        );
    }

    public requestStream<T>(): Observable<T> {
        return this.socketHolder.pipe(
            take(1),
            concatMap(
                socket => socket.requestStream({
                    route: this._route,
                    data: this._data,
                    dataMimeType: this._outgoingMimeType,
                    authentication: this._authentication,
                },
                    undefined,
                    {
                        responseDataMimeType: this._incomingMimeType
                    })
            ),
            map(payload => payload.data as T)
        );

    }

    public fireAndForget(): void {
        this.socketHolder.pipe(
            take(1)
        ).subscribe({
            next: socket => {
                socket.requestFNF({
                    route: this._route,
                    data: this._data,
                    dataMimeType: this._outgoingMimeType
                })
            }
        });
    }



}
