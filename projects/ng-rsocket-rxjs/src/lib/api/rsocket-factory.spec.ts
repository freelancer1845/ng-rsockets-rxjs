import { async } from '@angular/core/testing';
import { RSocket } from 'dist/ng-rsocket-rxjs/lib/api/rsocket.api';
import { RSocketClient } from "ng-rsocket-rxjs";
import { MessageRoutingRSocket } from "ng-rsocket-rxjs";
import { WebsocketTransport } from "ng-rsocket-rxjs"
import { MimeTypes } from "ng-rsocket-rxjs";
import { range, timer } from "rxjs";
import { flatMap, reduce } from 'rxjs/operators';
import { RSocketBuilder } from './rsocket-factory';




describe("RSocketBuilder", () => {
    // beforeAll(() => {

    //     const transport = new WebsocketTransport("ws://localhost:8080/rsocket");
    //     const client = new RSocketClient(transport);
    //     socket = new MessageRoutingRSocket(client);
    //     client.establish({
    //         dataMimeType: MimeTypes.APPLICATION_JSON.toBuffer(),
    //         metadataMimeType: MimeTypes.MESSAGE_X_RSOCKET_ROUTING.toBuffer(),
    //         honorsLease: false,
    //         keepaliveTime: 30000,
    //         majorVersion: 1,
    //         minorVersion: 0,
    //         maxLifetime: 100000,
    //     });
    // })

    it("Should create an rsocket connection", done => {
        new RSocketBuilder().connectionString('ws://localhost:8080/rsocket').messageRSocket().pipe(flatMap(socket => {
            return socket.requestResponse('/basic/request-response', 'Hello World');
        })).subscribe(ans => {
            expect(ans).toEqual("Hello World");
            done();
        });
    });
    it("Should automatically reconnect", done => {
        let counter = 0;
        new RSocketBuilder().connectionString('ws://localhost:8080/rsocket').automaticReconnect(500).messageRSocket().subscribe(socket => {
            counter++;
            if (counter == 1) {
                socket.requestFNF('/basic/disconnect');
            } else {
                socket.requestResponse('/basic/request-response', 'Hello World').subscribe(ans => {
                    expect(ans).toEqual("Hello World");
                    done();
                });
            }
        });
    })
});