package rsocketrxjstester.springtester;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Controller;

import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Controller
public class SecureController {

    @PreAuthorize("hasRole('USER')")
    @MessageMapping("/secure/request-response")
    public Mono<String> securedRequestResponse(String request, @AuthenticationPrincipal UserDetails user) {
        return Mono.just(request);
    }

    @PreAuthorize("hasRole('USER')")
    @MessageMapping("/secure/request-stream")
    public Flux<String> securedRequestStream(String request) {
        return Flux.just(request);
    }

    private volatile double fnfNumber;

    @PreAuthorize("hasRole('USER')")
    @MessageMapping("/secure/fnf")
    public Mono<Void> secureFnf(Double number) {
        return Mono.fromRunnable(() -> this.fnfNumber = number);
    }

    @PreAuthorize("hasRole('USER')")
    @MessageMapping("/secure/fnf/verify")
    public Mono<Double> secureFnfVerify() {
        return Mono.just(this.fnfNumber);
    }

}
