import { factory } from '../config-log4j';
import { Payload } from './payload';

const log = factory.getLogger("protocol.FragmentsContext");

export class FragmentContext {

    private fragments: Payload[] = [];

    public add(payload: Payload) {
        this.fragments.push(payload);
    }

    /**
     * Returns aggregated payload
     */
    public get(): Payload {
        if (this.fragments.length == 1) {
            log.trace("Returning Single Fragment Payload");
            const payload = this.fragments[0];
            this.fragments = [];
            return payload;
        } else {
            log.trace("Returning Multi Fragment Payload");
            let metdataLength = 0;
            let dataLength = 0;
            for (let fragment of this.fragments) {
                if (fragment.hasMetadata()) {
                    metdataLength += fragment.metadata.byteLength;
                }
                dataLength += fragment.data.byteLength;
            }
            let metadataBuffer = new ArrayBuffer(metdataLength);
            let dataBuffer = new ArrayBuffer(dataLength);
            let metadataBufferView = new Uint8Array(metadataBuffer);
            let dataBufferView = new Uint8Array(dataBuffer);
            let position = 0;
            for (let fragment of this.fragments) {
                metadataBufferView.set(new Uint8Array(fragment.metadata), position);
                position += fragment.metadata.byteLength;
                dataBufferView.set(new Uint8Array(fragment.data), position);
                position += fragment.data.byteLength;
            }
            this.fragments = [];
            return new Payload(dataBuffer, metadataBuffer);
        }
    }


}
