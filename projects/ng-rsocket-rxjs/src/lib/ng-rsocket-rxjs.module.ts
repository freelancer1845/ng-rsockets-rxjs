import { ModuleWithProviders, NgModule, NgZone } from '@angular/core';
import { RSocketConfig } from './core/config/rsocket-config';
import { RSocketService } from './services/rsocket.service';

export interface RSocketRxjsModuleConfig {
  /**
   * Either provide a full RSocketConfiguration or just provide an url which should work nicely with spring boot RSocket (in websocket mode)
   */
  url: string;
  rsocketConfig?: Partial<RSocketConfig<any, any>>;
  reconnectTimeout?: number;
}


@NgModule({

})
export class RSocketRxjsModule {


  static forRoot(config: RSocketRxjsModuleConfig): ModuleWithProviders<RSocketRxjsModule> {

    const serviceFactory = (zone: NgZone) => {
      const s = new RSocketService(zone);
      s.connect({
        url: config.url,
        config: config.rsocketConfig,
        reconnectTimeout: config.reconnectTimeout
      });
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
