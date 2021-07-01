import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { MessageRoutingRSocket, RSocketConfig, SpringRSocketMessagingBuilder, WellKnownMimeTypes } from 'rsocket-rxjs';
import { RSocketState } from 'rsocket-rxjs/dist/lib/api/rsocket.api';
import { Observable, ReplaySubject, Subject, Subscription } from 'rxjs';
import { startWith, switchMap } from 'rxjs/operators';
import { RSocketRxjsModuleConfig } from '../ng-rsocket-rxjs.module';
import { FluentRequest } from './rsocket-fluent';



export class RSocketServiceOptions {
  constructor(public readonly config: Partial<RSocketConfig>,
    public readonly url: string,
    public readonly reconnectTimeout?: number) { }
}


@Injectable()
export class RSocketService implements OnDestroy {
  private $destroy = new Subject();
  private _socket: ReplaySubject<MessageRoutingRSocket> = new ReplaySubject(1);

  private _defaultIncomingMimeType = WellKnownMimeTypes.APPLICATION_JSON.name;
  private _defaultOutgoingMimeType = WellKnownMimeTypes.APPLICATION_JSON.name;

  private _subscription: Subscription;

  constructor(private ngZone: NgZone) {
  }

  public connect(config: RSocketRxjsModuleConfig) {
    let builder = new SpringRSocketMessagingBuilder();

    if (config.dataMimeType != undefined) {
      builder = builder.dataMimeType(config.dataMimeType);
      this._defaultIncomingMimeType = config.dataMimeType;
      this._defaultOutgoingMimeType = config.dataMimeType;
    }
    if (config.maxLifetime != undefined) {
      builder = builder.maxLifetime(config.maxLifetime);
    }
    if (config.keepaliveTime != undefined) {
      builder = builder.keepaliveTime(config.keepaliveTime);
    }
    if (config.connectMappingData != undefined) {
      builder = builder.connectMappingData(config.connectMappingData);
    }
    if (config.connectMappingRoute != undefined) {
      builder = builder.connectMappingRoute(config.connectMappingRoute);
    }
    if (config.reconnectTimeout !== undefined) {
      builder = builder.automaticReconnect(config.reconnectTimeout);
    } else {
      builder = builder.automaticReconnect();
    }
    builder = builder.connectionString(config.url);
    if (config.builderCustomizer) {
      config.builderCustomizer(builder);
    }
    this._subscription = builder.build().subscribe((socket) => {
      this._socket.next(socket);
    }) as unknown as Subscription;
  }

  ngOnDestroy(): void {
    this._subscription.unsubscribe();
  }

  public state(): Observable<RSocketState> {
    return this._socket.pipe(
      switchMap(v => {
        return v.state();
      }),
      startWith(RSocketState.Disconnected),
    );
  }

  public route(route: string): FluentRequest {
    return new FluentRequest(this.ngZone, this._socket, route, null, this._defaultOutgoingMimeType, this._defaultIncomingMimeType);
  }


}
