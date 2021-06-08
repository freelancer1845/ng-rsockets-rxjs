package rsocketrxjstester.springtester;

import java.io.BufferedInputStream;
import java.io.IOException;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import org.reactivestreams.Publisher;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.rsocket.messaging.RSocketStrategiesCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.ResolvableType;
import org.springframework.core.codec.Decoder;
import org.springframework.core.codec.Encoder;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.core.io.buffer.DataBufferFactory;
import org.springframework.util.MimeType;

import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@SpringBootApplication
@Configuration
public class SpringTesterApplication {

	public static void main(String[] args) {
		SpringApplication.run(SpringTesterApplication.class, args);
	}

	@Bean
	public RSocketStrategiesCustomizer rSocketStrategiesCustomizer() {
		return strategies -> {
			strategies.encoder(new Encoder<String>() {	

				@Override
				public boolean canEncode(ResolvableType elementType, MimeType mimeType) {
					return mimeType.toString().equals("application/stringreverse");
				}

				@Override
				public Flux<DataBuffer> encode(Publisher<? extends String> inputStream, DataBufferFactory bufferFactory,
						ResolvableType elementType, MimeType mimeType, Map<String, Object> hints) {
					return Flux.from(inputStream).map(text -> {
						var buffer = bufferFactory.allocateBuffer();
						var bytes = text.getBytes();
						for (int i = 0; i < text.length(); i++) {
							buffer.write(bytes[bytes.length - i - 1]);
						}
						return buffer;
					});
				}

				@Override
				public List<MimeType> getEncodableMimeTypes() {
					return Collections.singletonList(new MimeType("application","stringreverse"));
				}

			});

			strategies.decoder(new Decoder<String>() {

				@Override
				public boolean canDecode(ResolvableType elementType, MimeType mimeType) {
					return mimeType.toString().equals("application/stringreverse");
				}

				@Override
				public Flux<String> decode(Publisher<DataBuffer> inputStream, ResolvableType elementType,
						MimeType mimeType, Map<String, Object> hints) {
					return Flux.from(inputStream).map(buffer -> {
						byte[] data;
						try {
							data = new BufferedInputStream(buffer.asInputStream(true)).readAllBytes();
						} catch (IOException e) {
							throw new RuntimeException(e);
						}
						for (int i = 0; i < data.length / 2; i++) {
							var temp = data[i];
							data[i] = data[data.length - i - 1];
							data[data.length - i - 1] = temp;
						}
						return new String(data);
					});
				}

				@Override
				public Mono<String> decodeToMono(Publisher<DataBuffer> inputStream, ResolvableType elementType,
						MimeType mimeType, Map<String, Object> hints) {
					return Mono.from(inputStream).map(buffer -> {
						byte[] data;
						try {
							data = new BufferedInputStream(buffer.asInputStream(true)).readAllBytes();
						} catch (IOException e) {
							throw new RuntimeException(e);
						}
						for (int i = 0; i < data.length / 2; i++) {
							var temp = data[i];
							data[i] = data[data.length - i - 1];
							data[data.length - i - 1] = temp;
						}
						return new String(data);
					});
				}

				@Override
				public List<MimeType> getDecodableMimeTypes() {
					return Collections.singletonList(new MimeType("application","stringreverse"));
				}

			});
		};
	}

}
