import { Observable, Subject } from 'rxjs';
import { Frame } from '../protocol/frame';


export interface Transport {

    incoming(): Observable<Frame>;
    send(frame: Frame): void;
    sendPosition(): number;
    recvPosition(): number;
}
