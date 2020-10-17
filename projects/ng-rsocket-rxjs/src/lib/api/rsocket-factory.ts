import { Observable } from 'rxjs';
import { delay, filter, map, retryWhen, take } from 'rxjs/operators';
import { RSocketConfig } from '../core/config/rsocket-config';
import { Payload } from '../core/protocol/payload';
import { RSocketClient } from '../core/rsocket-client.impl';
import { Transport } from '../core/transport/transport.api';
import { WebsocketTransport } from '../core/transport/websocket-transport.impl';
import { MessageRoutingRSocket } from '../messages/message-routing-rsocket';
import { MimeTypes } from './rsocket-mime.types';
import { RSocketState } from './rsocket.api';

export class RSocketBuilder {

    private _config: RSocketConfig<any, any> = {
        majorVersion: 1,
        minorVersion: 0,
        honorsLease: false,
        keepaliveTime: 30000,
        maxLifetime: 100000,
        dataMimeType: MimeTypes.APPLICATION_JSON,
        metadataMimeType: MimeTypes.MESSAGE_X_RSOCKET_COMPOSITE_METADATA,
    }

    private _connectionString: string;
    private _automaticReconnect = false;
    private _reconnectWaitTime = 5000;

    public keepaliveTime(time: number) {
        this._config.keepaliveTime = time;
        return this;
    }

    public resumeIdentificationToken(token: Uint8Array): RSocketBuilder {
        throw new Error('Resume not Implemented');
    }

    public honorsLease(): RSocketBuilder {
        throw new Error('Lease Honoring not Implemented');
    }

    public maxLifetime(time: number) {
        this._config.maxLifetime = time;
        return this;
    }

    public dataMimeType(type: MimeTypes<any>) {
        this._config.dataMimeType = type;
        return this;
    }


    public metaDataMimeType(type: MimeTypes<any>) {
        this._config.metadataMimeType = type;
        return this;
    }


    public connectionString(str: string) {
        this._connectionString = str;
        return this;
    }

    public automaticReconnect(waitTime: number = 5000) {
        this._automaticReconnect = true;
        this._reconnectWaitTime = waitTime;
        return this;
    }

    public setupData(data: any) {
        this._config.data = data;
        return this;
    }

    public setupMetadata(data: any) {
        this._config.metaData = data;
        return this;
    }

    public messageRSocket(): Observable<MessageRoutingRSocket> {
        if (this._config.metadataMimeType.equals(MimeTypes.MESSAGE_X_RSOCKET_AUTHENTICATION)) {
            this._config.metadataMimeType = MimeTypes.MESSAGE_X_RSOCKET_COMPOSITE_METADATA;
            this._config.metaData = [{
                type: MimeTypes.MESSAGE_X_RSOCKET_AUTHENTICATION,
                data: this._config.metaData
            }]
        }
        return this.buildClient().pipe(map(client => {
            return new MessageRoutingRSocket(client);
        }));
    }


    private buildClient(): Observable<RSocketClient> {
        const obs: Observable<RSocketClient> = new Observable<RSocketClient>(emitter => {
            const transport = this.buildTransport();
            const client = new RSocketClient(transport);
            emitter.next(client);
            client.establish(this._config);
            const stateSub = client.state().pipe(filter(s => s == RSocketState.Error)).subscribe(s => emitter.error(new Error("RSocket failed")));
            return () => {
                client.close();
                stateSub.unsubscribe();
            };
        });

        if (this._automaticReconnect) {
            return obs.pipe(retryWhen(delay(this._reconnectWaitTime)));
        } else {
            return obs;
        }
    }

    private buildTransport(): Transport {
        if (this._connectionString.match("^(ws:)|(wss:)\/\/.*$") != null) {
            const transport = new WebsocketTransport(this._connectionString);
            return transport;
        } else {
            throw new Error("Currently only supports websocket. Connection string must be 'ws://...'");
        }
    }


}


export class RSocketFactory {



}