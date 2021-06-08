import { async } from '@angular/core/testing';
import { RSocket } from 'dist/ng-rsocket-rxjs/lib/api/rsocket.api';
import { RSocketClient, MimeTypeRegistry } from "ng-rsocket-rxjs";
import { MessageRoutingRSocket } from "ng-rsocket-rxjs";
import { WebsocketTransport } from "ng-rsocket-rxjs"
import { MimeType } from "ng-rsocket-rxjs";
import { BehaviorSubject, of, range, ReplaySubject, Subject, timer } from "rxjs";
import { flatMap, reduce } from 'rxjs/operators';
import { arrayBufferToUtf8String } from '../utlities/conversions';




describe("request_patterns", () => {
    let socket: MessageRoutingRSocket;
    beforeAll(done => {

        const transport = new WebsocketTransport("ws://localhost:8080/rsocket");
        const client = new RSocketClient(transport, MimeTypeRegistry.defaultRegistry());
        socket = new MessageRoutingRSocket(client);
        socket.addRequestResponseHandler('/basic/setup-payload', ans => {
            expect(ans).toEqual('Test-Client');
            done();
            return ans;
        })
        client.establish({
            data: 'Test-Client',
            dataMimeType: MimeType.APPLICATION_JSON,
            metadataMimeType: MimeType.MESSAGE_X_RSOCKET_COMPOSITE_METADATA,
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
    it("Handles Empty Request Response", done => {
        socket.addRequestResponseHandler(
            '/basic/empty-request-response',
            data => {
                expect(data).toBeUndefined();
                return 'hello';
            }
        );
        socket.requestResponse('/basic/empty-request-reverse-response', {
            topic: '/basic/empty-request-response',
            data: "\"empty\""
        }).subscribe(ans => {
            expect(ans).toEqual("hello");
            done();
        })
    })
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
    it("Authenticates using simple authentication on request-response", done => {
        socket.requestResponse('/secure/request-response',
            'DoSthUnallowed',
            undefined,
            undefined,
            {
                type: 'simple',
                username: 'user',
                password: 'pass'
            }
        ).subscribe(ans => {
            expect(ans).toEqual('DoSthUnallowed');
            done();
        });
    });
    it("Authenticates using simple authentication on request-stream", done => {
        socket.requestStream('/secure/request-stream',
            'DoSthUnallowed',
            undefined,
            undefined,
            {
                type: 'simple',
                username: 'user',
                password: 'pass'
            }
        ).subscribe(ans => {
            expect(ans).toEqual('DoSthUnallowed');
            done();
        });
    });
    it("Authenticates using fire and forget", done => {
        const number = Math.random();
        socket.requestFNF('/secure/fnf', number, undefined, {
            type: 'simple',
            username: 'user',
            password: 'pass'
        });
        timer(200).pipe(flatMap(t => {
            return socket.requestResponse('/secure/fnf/verify', undefined, undefined, undefined, {
                type: 'simple',
                username: 'user',
                password: 'pass'
            });
        }))
            .subscribe(ans => {
                expect(Number(ans)).toEqual(number);
                done();
            })
    })
    it("Fails  unauthenticated", done => {
        socket.requestResponse('/secure/request-response',
            'DoSthUnallowed',
            undefined,
            undefined,
        ).subscribe(ans => {
            expect(ans).toBe("Error: 513. Message: Access Denied");
            done();
        }, err => {
            expect(err.message).toMatch(/^Error: 513.+$/);
            done();
        });
    });
    it("Fails with wrong credentials", done => {
        socket.requestResponse('/secure/request-response',
            'DoSthUnallowed',
            undefined,
            undefined,
            {
                type: 'simple',
                username: 'user',
                password: 'passgweg'
            }
        ).subscribe(ans => {
            expect(ans).toBe("Error: 513. Message: Access Denied");
            done();
        }, err => {
            expect(err.message).toMatch(/^Error: 513.+$/);
            done();
        });
    });
    it("Fails with unallowed role", done => {
        socket.requestResponse('/secure/request-response',
            'DoSthUnallowed',
            undefined,
            undefined,
            {
                type: 'simple',
                username: 'test',
                password: 'pass'
            }
        ).subscribe(ans => {
            expect(ans).toBe("Error: 513. Message: Access Denied");
            done();
        }, err => {
            expect(err.message).toMatch(/^Error: 513.+$/);
            done();
        });
    });
    it("Accepts application/octet-stream mime type", done => {
        socket.requestResponse('/binary/request-response', new TextEncoder().encode("Hello World").buffer, MimeType.APPLICATION_OCTET_STREAM, MimeType.APPLICATION_OCTET_STREAM).subscribe(ans => {
            expect(new TextDecoder().decode(ans)).toEqual('Hello World To You Too!');
            done();
        });
    })
    afterAll(() => {
        socket.rsocket.close();
    })
});

describe("mimetypes", () => {
    let socket: MessageRoutingRSocket;
    let stringReverseMime: MimeType<string>;
    let textPlainMime: MimeType<string>;
    beforeAll(() => {

        const transport = new WebsocketTransport("ws://localhost:8080/rsocket");
        const client = new RSocketClient(transport, MimeTypeRegistry.defaultRegistry());
        stringReverseMime = new MimeType('application/stringreverse',
            {
                encoder: (text: string) => new TextEncoder().encode(text.split("").reverse().join("")),
                decoder: (buffer) => new TextDecoder().decode(buffer).split("").reverse().join("")
            }
        );
        client.mimeTypeRegistry.registerMimeType(stringReverseMime);
        textPlainMime = new MimeType('text/plain', {
            encoder: text => new TextEncoder().encode(text),
            decoder: buffer => new TextDecoder().decode(buffer)
        });
        client.mimeTypeRegistry.registerMimeType(textPlainMime);
        socket = new MessageRoutingRSocket(client);
        client.establish({
            dataMimeType: MimeType.APPLICATION_OCTET_STREAM,
            metadataMimeType: MimeType.MESSAGE_X_RSOCKET_COMPOSITE_METADATA,
            honorsLease: false,
            keepaliveTime: 30000,
            majorVersion: 1,
            minorVersion: 0,
            maxLifetime: 100000,
        });
    });
    // it("Correctly submits stringreverse mime type", done => {

    //     socket.requestResponse('/basic/mime/stringreverse', "Hello World", stringReverseMime, stringReverseMime).subscribe(value => {
    //         expect(value).toEqual("Hello World");
    //         done();
    //     });
    // });
    // it("Distinguishes between input and output mime type", done => {

    //     socket.requestResponse('/basic/mime/stringreverse', "Hello World", stringReverseMime, textPlainMime).subscribe(value => {
    //         expect(value).toEqual("Hello World");
    //         done();
    //     });
    // });


    afterAll(() => {
        socket.rsocket.close();
    });
});