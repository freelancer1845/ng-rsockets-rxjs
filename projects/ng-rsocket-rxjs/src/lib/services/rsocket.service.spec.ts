import { TestBed } from '@angular/core/testing';
import { RSocketRxjsModule } from 'ng-rsocket-rxjs';

import { RSocketService, RSocketServiceOptions } from './rsocket.service';

describe('RSocketService', () => {
  let service: RSocketService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RSocketRxjsModule.forRoot({
        url: "ws://localhost:8080/rsocket",
        rsocketConfig: {
          keepaliveTime: 30000,
          maxLifetime: 100000,
        },
        reconnectTimeout: 5000
      })],
      providers: [
        {
          provide: RSocketServiceOptions,
          useFactory: () => {
            return new RSocketServiceOptions({}, "ws://localhost:8080/rsocket", 5000);
          }
        }
      ]
    });
    service = TestBed.inject(RSocketService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
  it('Should route request response', done => {
    service.route('/basic/request-response').data('Hello World').requestResponse().subscribe(ans => {
      expect(ans).toEqual("Hello World");
      done();
    });
  });
  it('Should route request stream', done => {
    let counter = 0;
    service.route('/basic/request-stream').data(42).requestStream().subscribe(ans => {
      expect(ans).toEqual(counter++);
    }, err => { }, () => {
      expect(counter).toEqual(42);
      done();
    });
  });
});