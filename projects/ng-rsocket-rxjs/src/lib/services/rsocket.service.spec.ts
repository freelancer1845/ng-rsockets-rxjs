import { TestBed } from '@angular/core/testing';
import { RSocketRxjsModule } from 'ng-rsocket-rxjs';
import { MimeTypes } from '../api/rsocket-mime.types';

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
          metadataMimeType: MimeTypes.MESSAGE_X_RSOCKET_COMPOSITE_METADATA.toBuffer(),
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
  it('Uses authentication on request-response', done => {
    service.route('/secure/request-response').data('ServiceTest').authentication({
      type: "simple",
      username: "user",
      password: "pass"
    }).requestResponse().subscribe(ans => {
      expect(ans).toEqual('ServiceTest');
      done();
    })
  });
  it('Uses authentication on request-stream', done => {
    service.route('/secure/request-stream').data('ServiceTest').authentication({
      type: "simple",
      username: "user",
      password: "pass"
    }).requestStream().subscribe(ans => {
      expect(ans).toEqual('ServiceTest');
      done();
    })
  });
});
