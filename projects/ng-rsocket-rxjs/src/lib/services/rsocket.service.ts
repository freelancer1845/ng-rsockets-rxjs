import { Injectable } from '@angular/core';
import { ReplaySubject } from 'rxjs';
import { RSocketBuilder } from '../api/rsocket-factory';
import { factory } from '../core/config-log4j';
import { RSocketConfig } from '../core/config/rsocket-config';
import { MessageRoutingRSocket } from '../messages/message-routing-rsocket';
import { FluentRequest } from './rsocket-fluent';

const log = factory.getLogger("rsocket.RSocketService");


export class RSocketServiceOptions {
  constructor(public readonly config: Partial<RSocketConfig>,
    public readonly url: string,
    public readonly reconnectTimeout?: number) { }
}


@Injectable({
  providedIn: 'root'
})
export class RSocketService {

  private _socket: ReplaySubject<MessageRoutingRSocket> = new ReplaySubject(1);

  constructor(options: RSocketServiceOptions) {
    let builder = new RSocketBuilder();
    const config = options.config;
    if (config.dataMimeType != undefined) {
      builder = builder.dataMimeTypeDirect(config.dataMimeType);
    }
    if (config.metadataMimeType != undefined) {
      builder = builder.metaDatamimeTypeDirect(config.metadataMimeType);
    }
    if (config.maxLifetime != undefined) {
      builder = builder.maxLifetime(config.maxLifetime);
    }
    if (config.keepaliveTime != undefined) {
      builder = builder.keepaliveTime(config.keepaliveTime);
    }
    if (config.resumeIdentificationToken) {
      builder = builder.resumeIdentificationToken(config.resumeIdentificationToken);
    }
    if (config.honorsLease) {
      if (config.honorsLease == true) {
        builder = builder.honorsLease();
      }
    }
    if (options.reconnectTimeout !== undefined) {
      builder = builder.automaticReconnect(options.reconnectTimeout);
    } else {
      builder = builder.automaticReconnect();
    }
    builder.connectionString(options.url).messageRSocket().subscribe((socket) => {
      log.debug('Successfully opened socket');
      this._socket.next(socket);
    });
  }


  public route(route: string): FluentRequest {
    return new FluentRequest(this._socket, route);
  }


}
