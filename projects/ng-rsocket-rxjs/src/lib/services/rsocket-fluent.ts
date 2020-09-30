import { Observable } from 'rxjs';
import { flatMap, take } from 'rxjs/operators';
import { Authentication, MimeTypes } from '../api/rsocket-mime.types';
import { MessageRoutingRSocket } from '../messages/message-routing-rsocket';


export class FluentRequest<O, I> {

    constructor(
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
        return new FluentRequest(this.socketHolder, this._route, this._data, this._outgoingMimeType, this._incomingMimeType, this._authentication, this._requester);
    }

    public requestMimetype<L>(type: MimeTypes<L>): FluentRequest<L, I> {
        return new FluentRequest(this.socketHolder, this._route, this._data, type, this._incomingMimeType, this._authentication, this._requester);
    }

    public answerMimetype<L>(type: MimeTypes<L>): FluentRequest<O, L> {
        return new FluentRequest(this.socketHolder, this._route, this._data, this._outgoingMimeType, type, this._authentication, this._requester);
    }

    public requester(requester: Observable<number>) {
        this._requester = requester;
        return this.copy();
    }

    public requestResponse(): Observable<I> {
        return this.socketHolder.pipe(take(1), flatMap(socket => socket.requestResponse(this._route, this._data, this._outgoingMimeType, this._incomingMimeType, this._authentication)));
    }

    public requestStream(): Observable<I> {
        return this.socketHolder.pipe(
            take(1),
            flatMap(socket => socket.requestStream(this._route, this._data, this._outgoingMimeType, this._incomingMimeType, this._authentication, this._requester)));
    }

    public fireAndForget(): void {
        this.socketHolder.pipe(take(1)).subscribe(socket => socket.requestFNF(this._route, this._data, this._outgoingMimeType, this._authentication));
    }



}
