import { Component, OnInit } from '@angular/core';
import { RSocketService } from 'ng-rsocket-rxjs';

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
