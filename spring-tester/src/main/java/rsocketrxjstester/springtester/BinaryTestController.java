package rsocketrxjstester.springtester;

import java.nio.ByteBuffer;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;

import reactor.core.publisher.Mono;

@Controller
public class BinaryTestController {
    

    @MessageMapping("/binary/request-response")
    public Mono<ByteBuffer> requestResponse(ByteBuffer req) {
        return Mono.fromCallable(() -> {
            String txt = new String(req.array());
            return ByteBuffer.wrap((txt + " To You Too!").getBytes());
        });
    }

}
