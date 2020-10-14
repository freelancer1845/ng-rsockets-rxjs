import { stringToUtf8ArrayBuffer } from '../../utlities/conversions';
import { RSocketConfig } from '../config/rsocket-config';
import { ErrorCode, Frame, FrameType } from "./frame";
import { Payload } from "./payload";


export class FrameBuilder {

    protected buffer: ArrayBuffer;
    protected view: DataView;
    protected writerIndex: number;

    protected constructor(initialBufferSize: number = 128) {
        this.buffer = new ArrayBuffer(initialBufferSize);
        this.view = new DataView(this.buffer);
    }


    public streamId(streamId: number) {
        this.view.setUint32(0, streamId);
        return this;
    }


    public static setup() {
        return new SetupFrameBuilder();
    }

    public static keepalive() {
        return new KeepaliveFrameBuilder();
    }

    public static cancel() {
        return new CancelFrameBuilder();
    }

    public static requestResponse() {
        return new RequestResponseFrameBuilder();
    }

    public static requestStream() {
        return new RequestStreamFrameBuilder();
    }

    public static requestFNF() {
        return new RequestFNFFrameBuilder();
    }

    public static payload() {
        return new PayloadFrameBuilder();
    }

    public static error() {
        return new ErrorFrameBuilder();
    }

    public static requestN() {
        return new RequestNFrameBuilder();
    }

    public build(): Frame {
        return new Frame(new Uint8Array(this.buffer, 0, this.writerIndex));
    }

    protected setFrameType(type: FrameType) {
        this.view.setUint16(4, this.view.getUint16(4) | type << 10);
    }

    protected requireMinFreeBytes(bytes: number) {
        let targetLength = this.buffer.byteLength;
        while (this.writerIndex + bytes >= targetLength) {
            targetLength = 2 * targetLength;
        }
        if (targetLength > this.buffer.byteLength) {
            const newBuffer = new ArrayBuffer(targetLength);
            new Uint8Array(newBuffer).set(new Uint8Array(this.buffer));
            this.buffer = newBuffer;
        }
    }

    protected flagMetadataPresent(): FrameBuilder {
        this.view.setUint16(4, this.view.getUint16(4) | (1 << 8));
        return this;
    }


    protected setRequests(requests: number) {
        this.view.setUint32(6, requests);
    }
}

export class SetupFrameBuilder extends FrameBuilder {

    constructor() {
        super(32)
        this.setFrameType(FrameType.SETUP);
        this.writerIndex = 18; // First 18 bytes are reserved
    }

    public buildFromConfig(config: RSocketConfig<any, any>): Frame {
        this.streamId(0);


        if (config.metaData != undefined) {
            this.flagMetadataPresent();
        }
        if (config.honorsLease) {
            this.flagHonorsLease();
        }
        this.majorVersion(config.majorVersion);
        this.minorVersion(config.minorVersion);
        this.keepaliveTime(config.keepaliveTime);
        this.maxLifetime(config.maxLifetime);
        if (config.resumeIdentificationToken != undefined) {
            this.flagResumeEnable();
            this.resumeToken(config.resumeIdentificationToken);
            this.writerIndex = 2 + config.resumeIdentificationToken.byteLength;
        }

        this.mimeType(config.metadataMimeType.toBuffer());
        this.mimeType(config.dataMimeType.toBuffer());
        if (config.data != undefined && config.metaData != undefined) {
            this.payload(new Payload(config.dataMimeType.mapToBuffer(config.data), config.metadataMimeType.mapToBuffer(config.metaData)));
        } else if (config.data == undefined && config.metaData != undefined) {
            this.payload(new Payload(new Uint8Array(0), config.metadataMimeType.mapToBuffer(config.metaData)));
        } else if (config.data != undefined && config.metaData == undefined) {
            this.payload(new Payload(config.dataMimeType.mapToBuffer(config.data)));
        }
        return new Frame(new Uint8Array(this.buffer, 0, this.writerIndex));
    }

    flagMetadataPresent(): FrameBuilder {
        this.view.setUint16(4, this.view.getUint16(4) | (1 << 8));
        return this;
    }

    flagResumeEnable(): FrameBuilder {
        this.view.setUint16(4, this.view.getUint16(4) | (1 << 7));
        return this;
    }

    flagHonorsLease(): FrameBuilder {
        this.view.setUint16(4, this.view.getUint16(4) | (1 << 6));
        return this;
    }

    majorVersion(version: number): FrameBuilder {
        this.view.setUint16(6, version);
        return this;
    }

    minorVersion(version: number): FrameBuilder {
        this.view.setUint16(8, version);
        return this;
    }

    keepaliveTime(time: number) {
        this.view.setUint32(10, time);
        return this;
    }

    maxLifetime(time: number) {
        this.view.setUint32(14, time);
        return this;
    }

    resumeToken(token: Uint8Array) {
        this.requireMinFreeBytes(token.byteLength + 2);
        this.view.setUint16(18, token.byteLength);
        new Uint8Array(this.buffer, 20).set(new Uint8Array(token));
        this.writerIndex += 2 + token.byteLength;
        return this;
    }


    mimeType(mimeType: Uint8Array) {
        this.requireMinFreeBytes(mimeType.byteLength + 1);
        const int8View = new Uint8Array(this.buffer, this.writerIndex);
        int8View[0] = mimeType.byteLength;
        int8View.set(new Uint8Array(mimeType), 1);
        this.writerIndex += 1 + mimeType.byteLength;
    }

    payload(payload: Payload) {
        const uint8View = new Uint8Array(this.buffer, this.writerIndex);
        if (payload.hasMetadata()) {
            this.requireMinFreeBytes(3 + payload.metadata.byteLength + payload.data.byteLength);
            this.writerIndex += 3 + payload.metadata.byteLength + payload.data.byteLength;
        } else {
            this.requireMinFreeBytes(payload.data.byteLength);
            this.writerIndex += payload.data.byteLength;
        }
        let position = 0;
        if (payload.hasMetadata()) {
            const length = payload.metadata.byteLength;
            uint8View[position++] = length >> 16 & 0xFF;
            uint8View[position++] = length >> 8 & 0xFF;
            uint8View[position++] = length & 0xFF;
            uint8View.set(new Uint8Array(payload.metadata), position);
            position += payload.metadata.byteLength;
        }
        uint8View.set(new Uint8Array(payload.data), position);

    }


}

export class RequestOrPayloadBuilder extends FrameBuilder {

    constructor(initialSize?: number) {
        super(initialSize);
    }


    payload(data: Payload) {
        if (data.hasMetadata()) {
            this.flagMetadataPresent();
            this.requireMinFreeBytes(data.metadata.byteLength + 3 + data.data.byteLength);
            this.directMetadataWrite(data.metadata.byteLength, buffer => {
                buffer.set(new Uint8Array(data.metadata));
                return data.metadata.byteLength;
            });
        } else {
            this.requireMinFreeBytes(data.data.byteLength);
        }
        this.directDataWrite(data.data.byteLength, buffer => {
            buffer.set(new Uint8Array(data.data));
            return data.data.byteLength;
        });
        return this;
    }

    directMetadataWrite(requiredSize: number, writeCall: (buffer: Uint8Array) => number) {
        this.flagMetadataPresent();
        this.requireMinFreeBytes(requiredSize + 3);
        const view = new Uint8Array(this.buffer, this.writerIndex);
        const metadataLength = writeCall(new Uint8Array(this.buffer, this.writerIndex + 3));
        view[0] = metadataLength >> 16 & 0xFF;
        view[1] = metadataLength >> 8 & 0xFF;
        view[2] = metadataLength & 0xFF;
        this.writerIndex += metadataLength + 3;
        return this;
    }

    directDataWrite(requiredSize: number, writeCall: (buffer: Uint8Array) => number) {
        this.requireMinFreeBytes(requiredSize);
        const bytesWritten = writeCall(new Uint8Array(this.buffer, this.writerIndex));
        this.writerIndex += bytesWritten;
        return this;
    }


}

export class KeepaliveFrameBuilder extends FrameBuilder {
    constructor() {
        super()
        this.setFrameType(FrameType.KEEPALIVE);
        this.writerIndex = 14;
    }

    public lastReceivedPosition(position: number) {
        this.view.setUint32(6, position >> 32);
        this.view.setUint32(10, position);
        return this;
    }

    public flagRespond() {
        this.view.setUint16(4, this.view.getUint16(4) | (1 << 7));
        return this;
    }

    public data(data: Uint8Array) {
        this.requireMinFreeBytes(data.byteLength);
        new Uint8Array(this.buffer, this.writerIndex, data.byteLength).set(data);
        this.writerIndex += data.byteLength;
        return this;
    }



}

export class CancelFrameBuilder extends FrameBuilder {
    constructor() {
        super(6)
        this.setFrameType(FrameType.CANCEL);
        this.writerIndex = 6;
    }


}


export class RequestResponseFrameBuilder extends RequestOrPayloadBuilder {
    constructor() {
        super(128)
        this.setFrameType(FrameType.REQUEST_RESPONSE);
        this.writerIndex = 6;
    }


}

export class RequestStreamFrameBuilder extends RequestOrPayloadBuilder {


    constructor() {
        super(128)
        this.setFrameType(FrameType.REQUEST_STREAM);
        this.writerIndex = 10;
    }

    public requests(requests: number) {
        this.setRequests(requests);
        return this;
    }

}

export class RequestFNFFrameBuilder extends RequestOrPayloadBuilder {

    constructor() {
        super(128)
        this.setFrameType(FrameType.REQUEST_FNF);
        this.writerIndex = 6;
    }

}

export class PayloadFrameBuilder extends RequestOrPayloadBuilder {

    constructor() {
        super(128)
        this.setFrameType(FrameType.PAYLOAD);
        this.writerIndex = 6;

    }

    public flagComplete() {
        this.view.setUint8(5, this.view.getUint8(5) | (1 << 6));
        return this;
    }

    public flagNext() {
        this.view.setUint8(5, this.view.getUint8(5) | (1 << 5));
        return this;
    }

}

export class ErrorFrameBuilder extends FrameBuilder {

    constructor() {
        super(128)
        this.setFrameType(FrameType.ERROR);
        this.writerIndex = 10;
    }

    public message(msg: string) {
        const codedMsg = stringToUtf8ArrayBuffer(msg);
        this.requireMinFreeBytes(codedMsg.byteLength);
        new Uint8Array(this.buffer, this.writerIndex).set(codedMsg);
        this.writerIndex += codedMsg.length;
        return this;
    }


    public errorCode(code: ErrorCode) {
        this.view.setInt32(6, code);
        return this;
    }
}

export class RequestNFrameBuilder extends FrameBuilder {

    constructor() {
        super(10)
        this.setFrameType(FrameType.REQUEST_N);
        this.writerIndex = 10;
    }

    requests(n: number) {
        this.setRequests(n);
        return this;
    }


}