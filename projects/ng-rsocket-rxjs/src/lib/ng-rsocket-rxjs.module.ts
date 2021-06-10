import { ModuleWithProviders, NgModule, NgZone } from '@angular/core';
import { SpringRSocketMessagingBuilder } from 'rsocket-rxjs';
import { RSocketService } from './services/rsocket.service';

export interface RSocketRxjsModuleConfig {
  /**
   * Either provide a full RSocketConfiguration or just provide an url which should work nicely with spring boot RSocket (in websocket mode)
   */
  url: string;
  reconnectTimeout?: number;
  connectMappingData?: any,
  connectMappingRoute?: any,
  dataMimeType?: string,
  maxLifetime?: number,
  keepaliveTime?: number,
  builderCustomizer?: (builder: SpringRSocketMessagingBuilder) => void
}


@NgModule({

})
export class RSocketRxjsModule {


  static forRoot(config: RSocketRxjsModuleConfig): ModuleWithProviders<RSocketRxjsModule> {

    const serviceFactory = (zone: NgZone) => {
      const s = new RSocketService(zone);
      s.connect(config);
      return s;
    }
    return {
      ngModule: RSocketRxjsModule,
      providers: [
        {
          provide: RSocketService,
          useFactory: serviceFactory,
          deps: [NgZone],
        }
      ]
    }
  }
}
