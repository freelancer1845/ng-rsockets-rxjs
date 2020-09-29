# NgRsocketRxjs

Basic library implementing RSockets RC 1 (Version 1.0).

## What this is:

### This library provides a basic RSocket client implementing the following features:

* Request FNF - Both directions
* Request Response - Both directions
* Request Stream - Both direction + Backpressure support
* Websocket Transport

### Additional features

* MimeTypes:
  * application/json using JSON.stringify/parse
  * application/octet-stream giving and using raw ArrayBuffers
  * 'MESSAGE_X_RSOCKET_ROUTING' to  work with spring-boot rsocket MessageMapping etc.
* Automatic reconnect when using RSocketBuilder
* A service that can be used in your Angular Project to ease establishing of the connection (works well with Spring Boot RSocket)


## What this isn't:

* A full implementation of the RSocket Spec. Missing:
  * Lease Handling
  * Server Setup
  * Resume Support
  * Request Channel
  * Metadata Push
  * Most MimeTypes
* A library that can be used in any javascript project
  * In Theory the code is split up into Angular dependent code and raw Typescript code. Sadly I have no experience in writing JS/TS libraries and have no idea how to setup the build system correctly...
* The library is also not deeply tested, but works well for my projects (which is always a Spring Boot - Angular Stack)


## How to use in Angular

### Import module using forRoot()

```typescript
RSocketRxjsModule.forRoot({
        url: "ws://<host>:8080/<endpoint>",
        rsocketConfig: {
        },
        reconnectTimeout: 5000
      })
```

Now simply have **RSocketService** injected and us the fluent api to construct calls.

```typescript
service.route(<route>).data(<data>).requestStream().subscribe(ans => {
      // handle answer
    });
service.route(<route>).data(<data>).requestResponse().subscribe(ans => {
      // handle answer
    });
service.route(<route>).data(<data>).fireAndForget();
```
