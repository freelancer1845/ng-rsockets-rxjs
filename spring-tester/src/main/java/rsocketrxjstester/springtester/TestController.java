package rsocketrxjstester.springtester;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicBoolean;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.rsocket.RSocketRequester;
import org.springframework.stereotype.Controller;

import lombok.Data;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Controller
public class TestController {

    @MessageMapping("/basic/request-response")
    public Mono<String> basicRequestResponse(String request) {
        return Mono.just(request);
    }

    @MessageMapping("/error/request-response")
    public Mono<String> errorRequestResponse(String request) {
        return Mono.error(new IllegalStateException(request));
    }

    @MessageMapping("/basic/request-stream")
    public Flux<Integer> basicRequestStream(Integer requestElements) {
        return Flux.range(0, requestElements);
    }

    private AtomicBoolean isStreamCanceled = new AtomicBoolean();

    @MessageMapping("/basic/request-stream/is-canceled")
    public Mono<Boolean> isCanceled() {
        return Mono.just(isStreamCanceled.get());
    }

    @MessageMapping("/basic/request-stream/unending")
    public Flux<Long> unendingStream() {
        return Flux.defer(() -> {
            this.isStreamCanceled.set(false);
            return Flux.interval(Duration.ofSeconds(1)).doOnCancel(() -> this.isStreamCanceled.set(true));
        });
    }

    private volatile String fnfCommand = "";

    @MessageMapping("/basic/request-fnf")
    public void fnfHandler(String command) {
        this.fnfCommand = command;
    }

    @MessageMapping("/basic/request-fnf/check")
    public Mono<String> fnfCheck() {
        return Mono.just(this.fnfCommand);
    }

    @MessageMapping("/basic/request-reverse-response")
    public Mono<String> reverseRequestResponse(Request request, RSocketRequester requester) {
        return requester.route(request.topic).data("\"" + request.data + "\"").retrieveMono(String.class);
    }

    @MessageMapping("/basic/request-reverse-stream")
    public Mono<Integer> reverseRequestStream(Request request, RSocketRequester requester) {
        return requester.route(request.topic).data(request.data).retrieveFlux(Integer.class).limitRate(5).reduce(0,
                (a, v) -> {
                    return Integer.valueOf(a + v);
                });
    }

    @MessageMapping("/basic/disconnect")
    public void requestDisconnect(RSocketRequester requester) {
        requester.rsocket().dispose();
    }


    @Data
    public static final class Request {
        String topic;
        String data;
    }
}
