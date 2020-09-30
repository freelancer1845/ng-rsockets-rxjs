import { async } from '@angular/core/testing';
import { RSocket } from 'dist/ng-rsocket-rxjs/lib/api/rsocket.api';
import { RSocketClient } from "ng-rsocket-rxjs";
import { MessageRoutingRSocket } from "ng-rsocket-rxjs";
import { WebsocketTransport } from "ng-rsocket-rxjs"
import { MimeTypes } from "ng-rsocket-rxjs";
import { BehaviorSubject, range, ReplaySubject, Subject, timer } from "rxjs";
import { flatMap, reduce } from 'rxjs/operators';
import { arrayBufferToUtf8String } from '../utlities/conversions';




describe("request_patterns", () => {
    let socket: MessageRoutingRSocket;
    beforeAll(() => {

        const transport = new WebsocketTransport("ws://localhost:8080/rsocket");
        const client = new RSocketClient(transport);
        socket = new MessageRoutingRSocket(client);
        client.establish({
            dataMimeType: MimeTypes.APPLICATION_JSON.toBuffer(),
            metadataMimeType: MimeTypes.MESSAGE_X_RSOCKET_COMPOSITE_METADATA.toBuffer(),
            honorsLease: false,
            keepaliveTime: 30000,
            majorVersion: 1,
            minorVersion: 0,
            maxLifetime: 100000,
        });
    })
    it("Returns Request Response payload", done => {
        socket.requestResponse('/basic/request-response', 'Hello World').subscribe(ans => {
            expect(ans).toEqual("Hello World");
            done();
        });
    });
    it("Maps Error", done => {
        socket.requestResponse('/error/request-response', 'Hello World').subscribe(ans => {
        }, (err: Error) => {
            expect(err.message.match(/Error: (\d+)\. Message: "(.+)"$/)[1]).toEqual("513");
            expect(err.message.match(/Error: (\d+)\. Message: "(.+)"$/)[2]).toEqual("Hello World");
            done()
        });
    })
    it("Subscribes Using Request Stream", done => {
        let counter = 0;
        socket.requestStream('/basic/request-stream', 42).subscribe(ans => {
            expect(ans).toEqual(counter++);
        }, err => { }, () => {
            expect(counter).toEqual(42);
            done();
        });
    });
    it("Respects Backpressure Requester", done => {
        let counter = 0;
        const requester = new BehaviorSubject<number>(1);
        socket.requestStream('/basic/request-stream', 42, undefined, undefined, undefined, requester).subscribe(ans => {
            expect(ans).toEqual(counter++);
            requester.next(1);
        }, err => { }, () => {
            expect(counter).toEqual(42);
            done();
        });
    });
    it("Request Stream sends cancel signal", done => {
        let counter = 0;
        const sub = socket.requestStream('/basic/request-stream/unending').subscribe(ans => {
            expect(ans).toEqual(counter++);
        });
        timer(200).subscribe(a => sub.unsubscribe());
        timer(400).pipe(flatMap(s => socket.requestResponse('/basic/request-stream/is-canceled'))).subscribe(n => {
            expect(n).toBeTruthy();
            done();
        });
    });
    it("Request FNF reaches server", done => {
        socket.requestFNF('/basic/request-fnf', 'Must be 42');

        timer(200).pipe(flatMap(s => socket.requestResponse('/basic/request-fnf/check'))).subscribe(n => {
            expect(n).toEqual('Must be 42');
            done();
        });
    });
    it("Handles Request Response", done => {
        socket.addRequestResponseHandler(
            '/basic/request-response',
            data => data + "-hello"
        );
        socket.requestResponse('/basic/request-reverse-response', {
            topic: '/basic/request-response',
            data: "world"
        }).subscribe(ans => {
            expect(ans).toEqual("world-hello");
            done();
        })
    });
    it("Handles Request Stream", done => {
        socket.addRequestStreamHandler(
            '/basic/request-response',
            data => range(0, Number(data))
        );
        socket.requestResponse('/basic/request-reverse-stream', {
            topic: '/basic/request-response',
            data: 42
        }).subscribe(ans => {
            range(0, 42).pipe(reduce((a, b) => a + b, 0)).subscribe(result => expect(ans).toEqual(result), null, () => done());
        })
    });
    afterAll(() => {
        socket.rsocket.close();
    })
});