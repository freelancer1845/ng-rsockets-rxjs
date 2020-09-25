import { Component, OnInit } from '@angular/core';
import { WebsocketTransport, RSocketClient, MessageRoutingRSocket, MimeTypes } from 'ng-rsocket-rxjs';
import { interval } from 'rxjs';

import { repeatWhen } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'angular-tester';

  ngOnInit(): void {
    const transport = new WebsocketTransport("ws://localhost:8080/rsocket");
    const client = new RSocketClient(transport);
    const socket = new MessageRoutingRSocket(client);
    client.establish({
      dataMimeType: MimeTypes.APPLICATION_JSON.toBuffer(),
      metadataMimeType: MimeTypes.MESSAGE_X_RSOCKET_ROUTING.toBuffer(),
      honorsLease: false,
      keepaliveTime: 30000,
      majorVersion: 1,
      minorVersion: 0,
      maxLifetime: 100000,
    });

    socket.requestResponse('/basic/request-response', 'Hello World').pipe(repeatWhen(() => interval(50))).subscribe(console.log);
  }
}
