import { NgZone } from '@angular/core';
import { Observable, OperatorFunction } from 'rxjs';
import { flatMap, take } from 'rxjs/operators';
import { Authentication, MimeTypes } from '../api/rsocket-mime.types';
import { MessageRoutingRSocket } from '../messages/message-routing-rsocket';

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

export class FluentRequest<O, I> {

    constructor(
        private _zone: NgZone,
        private socketHolder: Observable<MessageRoutingRSocket>,
        private _route: string,
        private _data?: any,
        private _outgoingMimeType?: MimeTypes<O>,
        private _incomingMimeType?: MimeTypes<I>,
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

    public requestMimetype<L>(type: MimeTypes<L>): FluentRequest<L, I> {
        return new FluentRequest(this._zone, this.socketHolder, this._route, this._data, type, this._incomingMimeType, this._authentication, this._requester);
    }

    public answerMimetype<L>(type: MimeTypes<L>): FluentRequest<O, L> {
        return new FluentRequest(this._zone, this.socketHolder, this._route, this._data, this._outgoingMimeType, type, this._authentication, this._requester);
    }

    public authentication(auth: Authentication): FluentRequest<O, I> {
        return new FluentRequest(this._zone, this.socketHolder, this._route, this._data, this._outgoingMimeType, this._incomingMimeType, auth, this._requester);
    }

    public requester(requester: Observable<number>) {
        this._requester = requester;
        return this.copy();
    }

    public requestResponse(): Observable<I> {
        return this.socketHolder.pipe(
            take(1),
            flatMap(socket => socket.requestResponse(this._route, this._data, this._outgoingMimeType, this._incomingMimeType, this._authentication)),
            zoneFix(this._zone)
        );
    }

    public requestStream(): Observable<I> {
        return this.socketHolder.pipe(
            take(1),
            flatMap(socket => socket.requestStream(this._route, this._data, this._outgoingMimeType, this._incomingMimeType, this._authentication, this._requester)),
            zoneFix(this._zone),
        );
    }

    public fireAndForget(): void {
        this.socketHolder.pipe(take(1)).subscribe(socket => socket.requestFNF(this._route, this._data, this._outgoingMimeType, this._authentication));
    }



}
