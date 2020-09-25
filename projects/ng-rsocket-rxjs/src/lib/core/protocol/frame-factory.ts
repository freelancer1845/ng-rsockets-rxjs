import { RSocketConfig } from '../config/rsocket-config';
import { Frame, FrameType } from "./frame";
import { Payload } from "./payload";


function setStreamId(view: DataView, streamId: number) {
    view.setUint32(0, streamId);
}

function setFrameType(view: DataView, type: FrameType) {
    view.setUint16(4, view.getUint16(4) | type << 10);
}

function setMetaDataPresent(view: DataView) {
    view.setUint16(4, view.getUint16(4) | (1 << 8));
}

function setResumeEnable(view: DataView) {
    view.setUint16(4, view.getUint16(4) | (1 << 7));
}

function setHonorsLease(view: DataView) {
    view.setUint16(4, view.getUint16(4) | (1 << 6));
}

function setRespondFlag(view: DataView) {
    view.setUint16(4, view.getUint16(4) | (1 << 7));
}

function setMajorVersion(view: DataView, version: number) {
    view.setUint16(6, version);
}

function setMinorVersion(view: DataView, version: number) {
    view.setUint16(8, version);
}

function setKeeapliveTime(view: DataView, time: number) {
    view.setUint32(10, time);
}

function setMaxLifetime(view: DataView, time: number) {
    view.setUint32(14, time);
}

function setToken(view: DataView, token: ArrayBuffer) {
    view.setUint16(18, token.byteLength);
    const tokenView = new Uint8Array(token);
    for (let i = 0; i < token.byteLength; i++) {
        view.setUint8(20 + i, tokenView[i]);
    }
}

function setLastReceivedPosition(view: DataView, position: number) {
    view.setUint32(6, position >> 32);
    view.setUint32(7, position);
}

function setMimeType(view: DataView, offset: number, mimeType: ArrayBuffer) {
    const int8View = new Uint8Array(view.buffer, offset);
    int8View[0] = mimeType.byteLength;
    int8View.set(new Uint8Array(mimeType), 1);
}

function setInitialRequests(view: DataView, requests: number) {
    view.setUint32(6, requests);
}

function setPayload(buffer: ArrayBuffer, payload: Payload, offset: number) {
    const uint8View = new Uint8Array(buffer, offset);
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

export function createSetupFrame(config: RSocketConfig): Frame {

    let length = 18; // up until resume token

    if (config.resumeIdentificationToken != undefined) {
        length += 2 + config.resumeIdentificationToken.byteLength;
    }
    length += 1 + config.metadataMimeType.byteLength;
    length += 1 + config.dataMimeType.byteLength;
    if (config.setupPayload != undefined) {
        length += config.setupPayload.metadata.byteLength + config.setupPayload.data.byteLength;
    }

    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);

    setStreamId(view, 0);
    setFrameType(view, FrameType.SETUP);
    if (config.setupPayload != undefined) {
        if (config.setupPayload.hasMetadata()) {
            setMetaDataPresent(view);
        }
    }
    let tokenOffset = 0;
    if (config.resumeIdentificationToken != undefined) {
        setResumeEnable(view);
        setToken(view, config.resumeIdentificationToken);
        tokenOffset = 2 + config.resumeIdentificationToken.byteLength;
    }
    if (config.honorsLease) {
        setHonorsLease(view);
    }

    setMajorVersion(view, config.majorVersion);
    setMinorVersion(view, config.minorVersion);
    setKeeapliveTime(view, config.keepaliveTime);
    setMaxLifetime(view, config.maxLifetime);
    setMimeType(view, 18 + tokenOffset, config.metadataMimeType);
    setMimeType(view, 18 + tokenOffset + 1 + config.metadataMimeType.byteLength, config.dataMimeType);

    let position = 18 + tokenOffset + 1 + config.metadataMimeType.byteLength + 1 + config.dataMimeType.byteLength;
    if (config.setupPayload != undefined) {
        setPayload(buffer, config.setupPayload, position);
    }

    return new Frame(buffer);
}


export function createCancelFrame(streamId: number): Frame {
    const buffer = new ArrayBuffer(6);
    const view = new DataView(buffer);
    setStreamId(view, streamId);
    setFrameType(view, FrameType.CANCEL);
    return new Frame(buffer);
}

export function createKeepaliveFrame(respondFlag: boolean, lastReceivedPosition: number, data: Payload) {
    const buffer = new ArrayBuffer(6 + 8 + data.data.byteLength);
    const view = new DataView(buffer);
    setStreamId(view, 0);
    setFrameType(view, FrameType.KEEPALIVE);
    setLastReceivedPosition(view, lastReceivedPosition);
    if (respondFlag == true) {
        setRespondFlag(view);
    }

    const uint8View = new Uint8Array(buffer);
    const dataView = new Uint8Array(data.data);
    uint8View.set(dataView, 14);
    return new Frame(buffer);
}


export function createRequestResponseFrame(streamId: number, data: Payload) {
    let length = 6 + data.data.byteLength;
    if (data.hasMetadata()) {
        length += 3 + data.metadata.byteLength;
    }
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    setStreamId(view, streamId);
    setFrameType(view, FrameType.REQUEST_RESPONSE);
    if (data.hasMetadata()) {
        setMetaDataPresent(view);
    }

    setPayload(buffer, data, 6);
    return new Frame(buffer);
}

export function createRequestStreamFrame(streamId: number, data: Payload, initialRequest: number) {
    let length = 10 + data.data.byteLength;
    if (data.hasMetadata()) {
        length += 3 + data.metadata.byteLength;
    }
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    setStreamId(view, streamId);
    setFrameType(view, FrameType.REQUEST_STREAM);
    setInitialRequests(view, initialRequest);
    if (data.hasMetadata()) {
        setMetaDataPresent(view);
    }
    setPayload(buffer, data, 10);
    return new Frame(buffer);
}

export function createRequestFNFFrame(streamId: number, data: Payload) {
    let length = 6 + data.data.byteLength;
    if (data.hasMetadata()) {
        length += 3 + data.metadata.byteLength;
    }
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    setStreamId(view, streamId);
    setFrameType(view, FrameType.REQUEST_FNF);
    if (data.hasMetadata()) {
        setMetaDataPresent(view);
    }

    setPayload(buffer, data, 6);
    return new Frame(buffer);
}