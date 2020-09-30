import { arrayBufferToUtf8String, stringToUtf8ArrayBuffer } from '../utlities/conversions';

export interface CompositeMetaData {
    type: MimeTypes<any>;
    data: any;
}

export type AuthType = 'simple' | 'bearer' | 'unknown';

export interface Authentication {
    type: AuthType;
    typeString?: string;
    token?: string;
    username?: string;
    password?: string;
    customData?: ArrayBuffer;
}


export class MimeTypes<T> {

    public readonly isWellKnown: boolean;
    public readonly wellKnownId: number;

    private static readonly WellKnownMimeTypes = {
        "application/json": 0x05,
        "application/octet-stream": 0x06,
        "message/x.rsocket.authentication.v0": 0x7C,
        "message/x.rsocket.routing.v0": 0x7E,
        "message/x.rsocket.composite-metadata.v0": 0x7F,
    }

    public static readonly MESSAGE_X_RSOCKET_ROUTING = new MimeTypes("message/x.rsocket.routing.v0");
    public static readonly MESSAGE_X_RSOCKET_COMPOSITE_METADATA = new MimeTypes<CompositeMetaData[]>("message/x.rsocket.composite-metadata.v0");
    public static readonly MESSAGE_X_RSOCKET_AUTHENTICATION = new MimeTypes<Authentication>("message/x.rsocket.authentication.v0");
    public static readonly APPLICATION_JSON = new MimeTypes<any>("application/json");
    public static readonly APPLICATION_OCTET_STREAM = new MimeTypes<ArrayBuffer>("application/octet-stream");


    constructor(public readonly name: string) {
        if (name in MimeTypes.WellKnownMimeTypes) {
            this.isWellKnown = true;
            this.wellKnownId = MimeTypes.WellKnownMimeTypes[name];
        } else {
            this.isWellKnown = false;
            this.wellKnownId = 0xFF;
        }
    }

    public static getByWellKnownId<T>(id: number): MimeTypes<T> | null {
        for (let wellKnownMapping of Object.entries(MimeTypes.WellKnownMimeTypes)) {
            if (wellKnownMapping[1] == id) {
                return new MimeTypes(wellKnownMapping[0]);
            }
        }
        return null;
    }

    toBuffer(): ArrayBuffer {
        return stringToUtf8ArrayBuffer(this.name);
    }

    equals(other: MimeTypes<any>) {
        return this.name == other.name;
    }

    mapFromBuffer(buffer: ArrayBuffer): T {
        return mapToTypeByMimeType(this, buffer);
    }

    mapToBuffer(object?: T): ArrayBuffer {
        if (object == undefined) {
            return new ArrayBuffer(0);
        }
        return mapToBufferByMimeType(this, object);
    }


}





function deserializeCompositeMetadata(buffer: ArrayBuffer): CompositeMetaData[] {
    const view = new DataView(buffer);
    let idx = 0;
    const metadataPayloads: CompositeMetaData[] = [];
    while (idx < buffer.byteLength) {
        const idOrLength = view.getUint8(idx++);
        let type = null;
        if ((idOrLength >> 7 & 1) == 1) {
            const id = idOrLength & 0x7F;
            type = MimeTypes.getByWellKnownId(id);
            if (type == null) {
                throw new Error('Trying to resolve WellKnownMimeType that is not implemented yet. Id: ' + id.toString(16));
            }
        } else {
            const nameLength = idOrLength & 0x7F;
            const name = arrayBufferToUtf8String(buffer.slice(idx, idx + nameLength));
            idx += nameLength;
            type = new MimeTypes(name);
        }
        const payloadLength = view.getUint32(idx - 1) & 0xFFFFFF;
        idx += 3;
        metadataPayloads.push({
            type: type,
            data: type.mapFromBuffer(buffer.slice(idx, idx + payloadLength))
        });
        idx += payloadLength;
    }
    return metadataPayloads;
}

interface CompositeMetadataPart {
    idOrLength: number;
    metadataString?: ArrayBuffer;
    data: ArrayBuffer;
}

function serializeCompositeMetadata(data: CompositeMetaData[]) {

    const metadataParts: CompositeMetadataPart[] = [];

    for (let metaData of data) {
        if (metaData.type.isWellKnown) {
            metadataParts.push({
                idOrLength: ((1 << 7) | metaData.type.wellKnownId) & 0xFF,
                data: metaData.type.mapToBuffer(metaData.data)
            });
        } else {
            const metadataString = metaData.type.toBuffer();
            metadataParts.push({
                idOrLength: metadataString.byteLength & 0x7F,
                metadataString: metadataString,
                data: metaData.type.mapToBuffer(metaData.data)
            });
        }
    }
    let requiredBufferSize = 0;
    for (let part of metadataParts) {
        if (part.metadataString == undefined) {
            requiredBufferSize += 1 + part.data.byteLength + 3;
        } else {
            requiredBufferSize += 1 + part.metadataString.byteLength + part.data.byteLength + 3;
        }
    }
    const buffer = new ArrayBuffer(requiredBufferSize);
    const view = new DataView(buffer);
    const uint8View = new Uint8Array(buffer);
    let idx = 0;
    for (let part of metadataParts) {
        if (part.metadataString == undefined) {
            view.setUint8(idx++, part.idOrLength);
        } else {
            view.setUint8(idx++, part.idOrLength);
            uint8View.set(new Uint8Array(part.metadataString), idx);
            idx += part.metadataString.byteLength;
        }
        view.setUint8(idx++, part.data.byteLength >> 16);
        view.setUint8(idx++, part.data.byteLength >> 8);
        view.setUint8(idx++, part.data.byteLength);
        uint8View.set(new Uint8Array(part.data), idx);
        idx += part.data.byteLength;
    }

    return buffer;
}

function deserializeAuthentication(buffer: ArrayBuffer): Authentication {
    const view = new DataView(buffer);
    let idx = 0;
    const authIdOrLength = view.getUint8(idx++);
    let authentication: Authentication;
    if ((authIdOrLength >> 7 & 1) == 1) {
        if ((authIdOrLength & 0x7F) == 0x00) {
            authentication = { type: 'simple' };
        } else if ((authIdOrLength & 0x7F) == 0x01) {
            authentication = { type: 'bearer' };
        } else {
            throw new Error('Auth type not implemented');
        }
    } else {
        authentication = { type: 'unknown' };
        const customType = arrayBufferToUtf8String(buffer.slice(idx, authIdOrLength & 0x7F + idx));
        idx += (authIdOrLength & 0x7F);
        authentication.typeString = customType;
    }
    if (authentication.type == "unknown") {
        authentication.customData = buffer.slice(idx);
    } else if (authentication.type == "bearer") {
        authentication.token = arrayBufferToUtf8String(buffer.slice(idx));
    } else if (authentication.type == "simple") {
        const usernameLength = view.getUint16(idx);
        idx += 2;
        authentication.username = arrayBufferToUtf8String(buffer.slice(idx, idx + usernameLength));
        idx += usernameLength;
        authentication.password = arrayBufferToUtf8String(buffer.slice(idx));
    }
    return authentication;
}

function serializeAuthentication(authentication: Authentication): ArrayBuffer {

    let usernameBuffer: ArrayBuffer;
    let passwordBuffer: ArrayBuffer;
    let tokenBuffer: ArrayBuffer;
    let typeBuffer: ArrayBuffer;
    let length = 0;
    if (authentication.type == "simple") {
        length++;
        usernameBuffer = stringToUtf8ArrayBuffer(authentication.username);
        passwordBuffer = stringToUtf8ArrayBuffer(authentication.password);
        // length += 2; // TODO : Replace when spring updates rsocket security. Current spec requires 16bit
        length += 1;
        length += usernameBuffer.byteLength;
        length += passwordBuffer.byteLength;
    } else if (authentication.type == "bearer") {
        length++;
        tokenBuffer = stringToUtf8ArrayBuffer(authentication.token);
        length += tokenBuffer.byteLength;
    } else if (authentication.type == "unknown") {
        length++;
        typeBuffer = stringToUtf8ArrayBuffer(authentication.typeString);
        length += typeBuffer.byteLength;
        length += authentication.customData.byteLength;
    }
    const buffer = new ArrayBuffer(length);
    const uint8View = new Uint8Array(buffer);
    const view = new DataView(buffer);
    let idx = 0;
    if (authentication.type == "simple") {
        view.setUint8(idx++, (1 << 7) | 0x00);
        length++;
        view.setUint8(idx++, usernameBuffer.byteLength); // TODO : Replace when spring updates rsocket security. Current spec requires 16bit
        // view.setUint16(idx, usernameBuffer.byteLength);
        // idx += 2;
        uint8View.set(new Uint8Array(usernameBuffer), idx);
        idx += usernameBuffer.byteLength;
        uint8View.set(new Uint8Array(passwordBuffer), idx);
    } else if (authentication.type == "bearer") {
        view.setUint8(idx++, (1 << 7) | 0x01);
        uint8View.set(new Uint8Array(tokenBuffer), idx);
    } else if (authentication.type == "unknown") {
        view.setUint8(idx++, typeBuffer.byteLength & 0x7F);
        uint8View.set(new Uint8Array(typeBuffer), idx);
        idx += typeBuffer.byteLength;
        uint8View.set(new Uint8Array(authentication.customData), idx);
    }
    return buffer;
}

function serializeMessageRoute(route: string): ArrayBuffer {
    return stringToUtf8ArrayBuffer(String.fromCharCode(route.length) + route);
}

function deserializeMessageRoute(data: ArrayBuffer): string {
    const view = new Uint8Array(data);
    const routeLength = view[0];
    return arrayBufferToUtf8String(data.slice(1, 1 + routeLength));
}

function mapToTypeByMimeType<T>(type: MimeTypes<T>, buffer: ArrayBuffer): T {
    if (type.equals(MimeTypes.APPLICATION_JSON)) {
        return JSON.parse(arrayBufferToUtf8String(buffer));
    } else if (type.equals(MimeTypes.APPLICATION_OCTET_STREAM)) {
        return buffer as unknown as T;
    } else if (type.equals(MimeTypes.MESSAGE_X_RSOCKET_COMPOSITE_METADATA)) {
        return deserializeCompositeMetadata(buffer) as unknown as T;
    } else if (type.equals(MimeTypes.MESSAGE_X_RSOCKET_AUTHENTICATION)) {
        return deserializeAuthentication(buffer) as unknown as T;
    } else if (type.equals(MimeTypes.MESSAGE_X_RSOCKET_ROUTING)) {
        return deserializeMessageRoute(buffer) as unknown as T;
    }
}

function mapToBufferByMimeType<T>(type: MimeTypes<T>, data: T): ArrayBuffer {
    if (type.equals(MimeTypes.APPLICATION_JSON)) {
        return stringToUtf8ArrayBuffer(JSON.stringify(data));
    } else if (type.equals(MimeTypes.APPLICATION_OCTET_STREAM)) {
        return data as unknown as ArrayBuffer;
    } else if (type.equals(MimeTypes.MESSAGE_X_RSOCKET_COMPOSITE_METADATA)) {
        return serializeCompositeMetadata(data as unknown as CompositeMetaData[]);
    } else if (type.equals(MimeTypes.MESSAGE_X_RSOCKET_AUTHENTICATION)) {
        return serializeAuthentication(data as unknown as Authentication);
    } else if (type.equals(MimeTypes.MESSAGE_X_RSOCKET_ROUTING)) {
        return serializeMessageRoute(data as unknown as string);
    }
}




