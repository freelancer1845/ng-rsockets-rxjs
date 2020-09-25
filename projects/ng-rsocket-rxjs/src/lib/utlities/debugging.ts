import { factory } from '../core/config-log4j';
import { Frame, FrameType } from '../core/protocol/frame';
import { arrayBufferToUtf8String } from "./conversions";

const log = factory.getLogger("protocol.FrameLogger")


export function frameToString(frame: Frame): string {


    let frameType: string;
    switch (frame.type()) {
        case FrameType.SETUP:
            frameType = "SETUP";
            break;
        case FrameType.ERROR:
            frameType = "ERROR";
            break;
        case FrameType.CANCEL:
            frameType = "CANCEL";
            break;
        case FrameType.PAYLOAD:
            frameType = "PAYLOAD";
            break;
        case FrameType.KEEPALIVE:
            frameType = "KEEPALIVE";
            break;
        case FrameType.REQUEST_RESPONSE:
            frameType = "REQUEST_RESPONSE";
            break;
        case FrameType.REQUEST_STREAM:
            frameType = "REQUEST_STREAM";
            break;
        case FrameType.REQUEST_FNF:
            frameType = "REQUEST_FNF";
            break;
        default:
            frameType = "Unmapped: " + frame.type();
            break;
    }

    if (frame.type() == FrameType.SETUP) {
        return `Frame Type: ${frameType}\n| Stream Id = ${frame.streamId()} ----|\n| Major Version = ${frame.majorVersion()} | Minor Version = ${frame.minorVersion()} ---\n| Keepalive Time = ${frame.timeBetweenKeeaplive()}---\n| Max Lifetime = ${frame.maxLifetime()} ---\n| MetaData Mime Type = ${arrayBufferToUtf8String(frame.metadataMimeType())} ----\n| Data Mime Type = ${arrayBufferToUtf8String(frame.dataMimeType())}`;
    } else {
        return `Frame Type: ${frameType} - Length ${frame.buffer.byteLength}----\n| Stream Id = ${frame.streamId()}`
    }


}

export function logFrame(frame: Frame) {
    log.debug(frameToString(frame));
}