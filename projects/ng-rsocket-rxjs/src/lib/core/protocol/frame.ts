import { getUint64 } from '../../utlities/conversions';
import { Payload } from './payload';

export enum FrameType {
    SETUP = 0x01,
    LEASE = 0x02,
    KEEPALIVE = 0x03,
    REQUEST_RESPONSE = 0x4,
    REQUEST_FNF = 0x5,
    REQUEST_STREAM = 0x6,
    REQUEST_CHANNEL = 0x7,
    REQUEST_N = 0x08,
    CANCEL = 0x09,
    PAYLOAD = 0x0A,
    ERROR = 0x0B,
    METADATA_PUSH = 0x0C,
    RESUME = 0x0D,
    RESUME_OK = 0x0E,
    EXT = 0x3F,
}

export enum ErrorCode {
    RESERVED = 0x00000000,
    INVALID_SETUP = 0x00000001,
    UNSUPPORTED_SETUP = 0x00000002,
    REJECTED_SETUP = 0x00000003,
    REJECTED_RESUME = 0x00000004,
    CONNECTION_ERROR = 0x00000101,
    CONNECTION_CLOSE = 0x00000102,
    APPLICATION_ERROR = 0x00000201,
    REJECTED = 0x00000202,
    CANCELED = 0x00000203,
    INVALID = 0x00000204,
    RESERVED_EXT = 0xFFFFFFFF,
}


/**
 * Flyweight around a buffer that gives access to frame type etc...
 */
export class Frame {

    private view: DataView;

    /**
     * 
     * @param buffer Containing frame data
     */
    constructor(public readonly buffer: ArrayBuffer) {
        this.view = new DataView(buffer);
    }

    public streamId(): number {
        return this.view.getUint32(0);
    }

    public type(): FrameType {
        return this.view.getUint16(4) >> 10;
    }

    public metadataPresent(): boolean {
        return ((this.view.getUint16(4) >> 8) & 1) == 1;
    }

    public resumeEnable(): boolean {
        return ((this.view.getUint16(4)) & 7) == 1;
    }

    public willHonorLease(): boolean {
        return ((this.view.getUint16(4) >> 6) & 1) == 1;
    }

    public majorVersion(): number {
        return this.view.getUint16(6);
    }

    public minorVersion(): number {
        return this.view.getUint16(8);
    }

    public timeBetweenKeeaplive(): number {
        return this.view.getUint32(10);
    }

    public maxLifetime(): number {
        return this.view.getUint32(14);
    }

    /**
     * Only meaningful if resume enabled!
     */
    public tokenLength(): number {
        return this.view.getUint16(18);
    }

    /**
     * Only meaningful if resume enabled!
     */
    public resumeIdentificationToken(): ArrayBuffer {
        return this.buffer.slice(20, this.tokenLength());
    }

    private getResumeEnableOffset(): number {
        if (this.resumeEnable()) {
            return 20 + this.tokenLength();
        } else {
            return 18;
        }
    }

    public metadataMimeLength(): number {
        return this.view.getUint8(this.getResumeEnableOffset());
    }

    public metadataMimeType(): ArrayBuffer {
        const start = this.getResumeEnableOffset() + 1
        return this.buffer.slice(start, start + this.metadataMimeLength());
    }

    public dataMimeLength(): number {
        return this.view.getUint8(this.getResumeEnableOffset() + 1 + this.metadataMimeLength());
    }

    public dataMimeType(): ArrayBuffer {
        const start = this.getResumeEnableOffset() + 1 + this.metadataMimeLength() + 1;
        return this.buffer.slice(start, start + this.dataMimeLength());
    }

    public errorCode(): ErrorCode {
        return this.view.getInt32(6);
    }

    public timeToLive(): number {
        return this.view.getUint32(6);
    }

    public numberOfRequest(): number {
        return this.view.getUint32(10);
    }

    public respondWithKeepalive(): boolean {
        return (((this.view.getUint16(4)) >> 7) & 1) == 1;
    }

    public lastReceivedPosition(): number {
        return getUint64(this.view, 6);
    }

    public fragmentFollows(): boolean {
        return (((this.view.getUint16(4)) >> 7) & 1) == 1;
    }

    public initialRequests(): number {
        return this.view.getUint32(6);
    }

    public isStreamComplete(): boolean {
        return (((this.view.getUint16(4)) >> 6) & 1) == 1;
    }

    public requests(): number {
        return this.initialRequests();
    }

    public isNext(): boolean {
        return (((this.view.getUint16(4)) >> 5) & 1) == 1;
    }

    public metadataPushData(): ArrayBuffer {
        return this.buffer.slice(6);
    }

    public canBeIgnored(): boolean {
        return ((this.view.getUint8(4) >> 6) & 1) == 1
    }

    public extendedType(): number {
        return this.view.getUint32(6);
    }

    public metadataLength(offset: number): number {
        if (this.metadataPresent() == false) {
            return 0;
        } else {
            return (this.view.getUint8(offset + 2) | (this.view.getUint8(offset + 1) << 8) | (this.view.getUint8(offset) << 16));
        }
    }

    public payload(): Payload | undefined {
        switch (this.type()) {
            case FrameType.SETUP:
                const offset = this.getResumeEnableOffset() + 1 + this.metadataMimeLength() + 1 + this.dataMimeLength();
                if (this.metadataPresent()) {
                    return new Payload(this.buffer.slice(offset + 3 + this.metadataLength(offset)), this.buffer.slice(offset + 3, offset + 3 + this.metadataLength(offset)));
                } else {
                    return new Payload(this.buffer.slice(offset));
                }
            case FrameType.ERROR:
                return new Payload(this.buffer.slice(10));
            case FrameType.LEASE:
                if (this.metadataPresent()) {
                    return new Payload(this.buffer.slice(14 + 3 + this.metadataLength(14)), this.buffer.slice(14 + 3, 14 + 3 + this.metadataLength(3)));
                } else {
                    return new Payload(this.buffer.slice(14));
                }
            case FrameType.KEEPALIVE:
                return new Payload(this.buffer.slice(14));
            case FrameType.REQUEST_RESPONSE:
            case FrameType.REQUEST_FNF:
            case FrameType.PAYLOAD:
                if (this.metadataPresent()) {
                    return new Payload(this.buffer.slice(6 + 3 + this.metadataLength(6)), this.buffer.slice(6 + 3, 6 + 3 + this.metadataLength(6)));
                } else {
                    return new Payload(this.buffer.slice(6));
                }
            case FrameType.REQUEST_STREAM:
            case FrameType.REQUEST_CHANNEL:
                if (this.metadataPresent()) {
                    return new Payload(this.buffer.slice(10 + 3 + this.metadataLength(10)), this.buffer.slice(10 + 3, 10 + 3 + this.metadataLength(10)));
                } else {
                    return new Payload(this.buffer.slice(10));
                }
            case FrameType.REQUEST_N:
                throw new Error('Frame Type REQUEST_N does not have payload attached!');
            case FrameType.CANCEL:
                throw new Error('Frame Type CANCEL does not have payload attached!');
            case FrameType.METADATA_PUSH:
                throw new Error('Frame Type METADATA_PUSH has no payload attached. Get using metadataPushData()')
            case FrameType.EXT:
                // TODO : As I never used this feature I don't understand it... Probably needs work
                if (this.metadataPresent()) {
                    return new Payload(this.buffer.slice(10 + 3 + this.metadataLength(10)), this.buffer.slice(10 + 3, 10 + 3 + this.metadataLength(10)));
                } else {
                    return new Payload(this.buffer.slice(10));
                }
        }
    }

}
