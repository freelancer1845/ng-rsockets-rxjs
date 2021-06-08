import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { Observable, ReplaySubject, Subject } from 'rxjs';
import { startWith, switchMap, takeUntil } from 'rxjs/operators';
import { RSocketBuilder } from '../api/rsocket-factory';
import { MimeType } from '../api/rsocket-mime.types';
import { RSocketState } from '../api/rsocket.api';
import { factory } from '../core/config-log4j';
import { RSocketConfig } from '../core/config/rsocket-config';
import { MessageRoutingRSocket } from '../messages/message-routing-rsocket';
import { FluentRequest } from './rsocket-fluent';

const log = factory.getLogger("rsocket.RSocketService");


export class RSocketServiceOptions {
  constructor(public readonly config: Partial<RSocketConfig<any, any>>,
    public readonly url: string,
    public readonly reconnectTimeout?: number) { }
}


@Injectable()
export class RSocketService implements OnDestroy {
  private $destroy = new Subject();
  private _socket: ReplaySubject<MessageRoutingRSocket> = new ReplaySubject(1);

  private _defaultIncomingMimeType = MimeType.APPLICATION_JSON;
  private _defaultOutgoingMimeType = MimeType.APPLICATION_JSON;

  constructor(private ngZone: NgZone) {
  }

  public connect(options: RSocketServiceOptions) {
    let builder = new RSocketBuilder();
    if (options.config != undefined) {
      const config = options.config;

      if (config.dataMimeType != undefined) {
        builder = builder.dataMimeType(config.dataMimeType);
        this._defaultIncomingMimeType = config.dataMimeType;
        this._defaultOutgoingMimeType = config.dataMimeType;
      }
      if (config.metadataMimeType != undefined) {
        builder = builder.metaDataMimeType(config.metadataMimeType);
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
      if (config.data != undefined) {
        builder = builder.setupData(config.data);
      }
      if (config.metaData != undefined) {
        builder = builder.setupMetadata(config.metaData);
      }
    }
    if (options.reconnectTimeout !== undefined) {
      builder = builder.automaticReconnect(options.reconnectTimeout);
    } else {
      builder = builder.automaticReconnect();
    }
    builder.connectionString(options.url).messageRSocket().pipe(takeUntil(this.$destroy)).subscribe((socket) => {
      this._socket.next(socket);
    });
  }

  ngOnDestroy(): void {
    this.$destroy.next(1);
  }

  public state(): Observable<RSocketState> {
    return this._socket.pipe(
      switchMap(v => v.rsocket.state()),
      startWith(RSocketState.Disconnected),
    );
  }

  public route(route: string): FluentRequest<any, any> {
    return new FluentRequest(this.ngZone, this._socket, route, null, this._defaultOutgoingMimeType, this._defaultIncomingMimeType);
  }


}
