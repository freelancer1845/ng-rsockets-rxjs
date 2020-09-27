import { ModuleWithProviders, NgModule } from '@angular/core';
import { RSocketConfig } from './core/config/rsocket-config';
import { RSocketService, RSocketServiceOptions } from './services/rsocket.service';

export interface RSocketRxjsModuleConfig {
  /**
   * Either provide a full RSocketConfiguration or just provide an url which should work nicely with spring boot RSocket (in websocket mode)
   */
  url: string;
  rsocketConfig?: Partial<RSocketConfig>;
  reconnectTimeout?: number;
}

@NgModule({
  declarations: [],
  imports: [
  ],
  exports: []
})
export class RSocketRxjsModule {
  static forRoot(config: RSocketRxjsModuleConfig): ModuleWithProviders<RSocketRxjsModule> {
    return {
      ngModule: RSocketRxjsModule,
      providers: [
        {
          provide: RSocketServiceOptions,
          useValue: new RSocketServiceOptions(config.rsocketConfig, config.url, config.reconnectTimeout)
        }
      ]
    }
  }
}
