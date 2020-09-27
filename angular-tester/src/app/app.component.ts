import { Component, OnInit } from '@angular/core';
import { WebsocketTransport, RSocketClient, MessageRoutingRSocket, MimeTypes, RSocketService } from 'ng-rsocket-rxjs';
import { interval } from 'rxjs';

import { repeatWhen } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'angular-tester';

  constructor(private service: RSocketService) {

  }

  ngOnInit(): void {
    this.service.route('/basic/request-response').data("Hello World").requestResponse().subscribe(ans => this.title = ans);
  }
}
