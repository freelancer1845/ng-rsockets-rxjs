import { Observable } from 'rxjs';
import { flatMap, take } from 'rxjs/operators';
import { MimeType } from '../api/rsocket-mime.types';
import { MessageRoutingRSocket } from '../messages/message-routing-rsocket';


export class FluentRequest {

    private _data;
    private _outgoingMimeType: MimeType;
    private _incomingMimeType: MimeType;
    private _requester: Observable<number>;

    constructor(private socketHolder: Observable<MessageRoutingRSocket>, private route: string) {
    }


    public data(data: any) {
        this._data = data;
        return this;
    }

    public requestMimetype(type: MimeType) {
        this._outgoingMimeType = type;
        return this;
    }
    
    public answerMimetype(type: MimeType) {
        this._incomingMimeType = type;
        return this;
    }
    
    public requester(requester: Observable<number>) {
        this._requester = requester;
        return this;
    }

    public requestResponse(): Observable<any> {
        return this.socketHolder.pipe(take(1), flatMap(socket => socket.requestResponse(this.route, this._data, this._outgoingMimeType, this._incomingMimeType)));
    }

    public requestStream(): Observable<any> {
        return this.socketHolder.pipe(take(1), flatMap(socket => socket.requestStream(this.route, this._data, this._outgoingMimeType, this._incomingMimeType, this._requester)));
    }

    public fireAndForget(): void {
        this.socketHolder.pipe(take(1)).subscribe(socket => socket.requestFNF(this.route, this._data, this._outgoingMimeType));
    }



}
