import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import { RSocketRxjsModule } from 'ng-rsocket-rxjs';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    RSocketRxjsModule.forRoot({
      url: "ws://localhost:8080/rsocket"
    })
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
