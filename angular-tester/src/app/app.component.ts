import { Component, OnInit } from '@angular/core';
import { RSocketService } from 'ng-rsocket-rxjs';
import { repeat, tap } from 'rxjs/operators';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'angular-tester';
  counter = 0;

  constructor(private service: RSocketService) {
  }

  ngOnInit(): void {
    this.service.route('/basic/request-response').data("Hello World").requestResponse().subscribe(ans => this.title = ans);
    this.service.route('/basic/request-stream/unending').requestStream()
      .pipe(
        tap({
          next: n => console.log("Next Unending", n),
          error: err => console.log("Error in Unending", err),
          complete: () => console.log("Unending completed")
        }),
        repeat()
      )
      .subscribe(ans => this.counter++);
  }

  closeConnectionByRemote() {
    this.service.route('/basic/disconnect').fireAndForget();
  }
}
