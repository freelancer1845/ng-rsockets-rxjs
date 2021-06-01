import { arrayBufferToUtf8String, stringToUtf8ArrayBuffer } from '../utlities/conversions';




export interface CompositeMetaData {
    type: MimeType;
    data: any;
}

export type AuthType = 'simple' | 'bearer' | 'unknown';

export interface Authentication {
    type: AuthType;
    typeString?: string;
    token?: string;
    username?: string;
    password?: string;
    customData?: Uint8Array;
}

export interface MimeTypeCoding<T> {
    encoder: (data: T, registry: MimeTypeRegistry) => Uint8Array;
    decoder: (buffer: Uint8Array, registry: MimeTypeRegistry) => T;
}

const NOOP_MIME_TYPE_CODER: MimeTypeCoding<Uint8Array> = {
    encoder: a => a,
    decoder: a => a,
}

const COMPOSITE_METADATA_CODER: MimeTypeCoding<CompositeMetaData[]> = {
    encoder: serializeCompositeMetadata,
    decoder: deserializeCompositeMetadata
}

const X_RSOCKET_AUTHENTICATION_CODER: MimeTypeCoding<Authentication> = {
    encoder: serializeAuthentication,
    decoder: deserializeAuthentication
}

const APPLICATION_JSON_CODER: MimeTypeCoding<any> = {
    encoder: obj => stringToUtf8ArrayBuffer(JSON.stringify(obj)),
    decoder: buffer => JSON.parse(arrayBufferToUtf8String(buffer))
}
const X_RSOCKET_ROUTING_CODER: MimeTypeCoding<String> = {
    encoder: serializeMessageRoute,
    decoder: deserializeMessageRoute
}

const X_RSOCKET_MIME_TYPE_CODER: MimeTypeCoding<MimeType<any>> = {
    decoder: (buffer, registry) => {
        const mimeIdOrLength = buffer[0];
        if ((mimeIdOrLength >> 7 & 0x1) == 1) {
            const wellKnownId = mimeIdOrLength & 0x7F;
            return registry.getByWellKnown(wellKnownId);
        } else {
            const mimeTypeName = arrayBufferToUtf8String(buffer.slice(1, 1 + mimeIdOrLength));
            return registry.getByName(mimeTypeName);
        }
    },
    encoder: (obj, registry) => {
        if (obj.isWellKnown == true) {
            let buf = new Uint8Array(1);
            buf[0] = obj.wellKnownId | (1 << 7);
            return buf;
        } else {
            let mimeTypeBuffer = stringToUtf8ArrayBuffer(obj.name);
            let buf = new Uint8Array(mimeTypeBuffer.length + 1);
            buf[0] = mimeTypeBuffer.length;
            buf.set(mimeTypeBuffer, 1);
            return buf;
        }
    }
}

const X_RSOCKET_ACCEPT_MIME_TYPES_CODER: MimeTypeCoding<MimeType<any>[]> = {
    decoder: (buffer, registry) => {
        let idx = 0;
        let types: MimeType<any>[] = [];
        while (idx < buffer.length) {
            const mimeIdOrLength = buffer[0];
            if ((mimeIdOrLength >> 7 & 0x1) == 1) {
                idx += 1;
                const wellKnownId = mimeIdOrLength & 0x7F;
                types.push(registry.getByWellKnown(wellKnownId));
            } else {
                idx += 1 + mimeIdOrLength;
                const mimeTypeName = arrayBufferToUtf8String(buffer.slice(1, 1 + mimeIdOrLength));
                types.push(registry.getByName(mimeTypeName));
            }

        }
        return types;
    },
    encoder: (objs, registry) => {
        let buffers: Uint8Array[] = [];
        for (let obj of objs) {
            if (obj.isWellKnown == true) {
                let buf = new Uint8Array(1);
                buf[0] = obj.wellKnownId | (1 << 7);
                buffers.push(buf);
            } else {
                let mimeTypeBuffer = stringToUtf8ArrayBuffer(obj.name);
                let buf = new Uint8Array(mimeTypeBuffer.length + 1);
                buf[0] = mimeTypeBuffer.length;
                buf.set(mimeTypeBuffer, 1);
                buffers.push(buf);
            }
        }
        let finalSize = buffers.reduce((acc, next) => acc + next.length, 0);
        let buffer = new Uint8Array(finalSize);
        let idx = 0;
        for (let buf of buffers) {
            buffer.set(buf, idx);
            idx += buf.length;
        }
        return buffer;
    }
}


export class MimeType<T = any> {

    public readonly isWellKnown: boolean;
    public readonly wellKnownId: number;

    private static readonly WellKnownMimeTypes = {
        "application/json": 0x05,
        "application/octet-stream": 0x06,
        "message/x.rsocket.authentication.v0": 0x7C,
        "message/x.rsocket.routing.v0": 0x7E,
        "message/x.rsocket.composite-metadata.v0": 0x7F,
        'message/x.rsocket.accept-mime-types.v0': 0x7B,
        'message/x.rsocket.mime-type.v0': 0x7A,
    }

    public static readonly MESSAGE_X_RSOCKET_ROUTING = new MimeType("message/x.rsocket.routing.v0", X_RSOCKET_ROUTING_CODER);
    public static readonly MESSAGE_X_RSOCKET_COMPOSITE_METADATA = new MimeType("message/x.rsocket.composite-metadata.v0", COMPOSITE_METADATA_CODER);
    public static readonly MESSAGE_X_RSOCKET_AUTHENTICATION = new MimeType("message/x.rsocket.authentication.v0", X_RSOCKET_AUTHENTICATION_CODER);
    public static readonly APPLICATION_JSON = new MimeType("application/json", APPLICATION_JSON_CODER);
    public static readonly APPLICATION_OCTET_STREAM = new MimeType("application/octet-stream", NOOP_MIME_TYPE_CODER);
    public static readonly MESSAGE_X_RSOCKET_ACCEPT_MIME_TYPES = new MimeType('message/x.rsocket.accept-mime-types.v0', X_RSOCKET_ACCEPT_MIME_TYPES_CODER);
    public static readonly MESSAGE_X_RSOCKET_MIME_TYPE = new MimeType('message/x.rsocket.mime-type.v0', X_RSOCKET_MIME_TYPE_CODER);


    constructor(
        public readonly name: string,
        public readonly coder: MimeTypeCoding<T> = NOOP_MIME_TYPE_CODER as any
    ) {
        if (name in MimeType.WellKnownMimeTypes) {
            this.isWellKnown = true;
            this.wellKnownId = MimeType.WellKnownMimeTypes[name];
        } else {
            this.isWellKnown = false;
            this.wellKnownId = 0xFF;
        }
    }

    public static getByWellKnownId<T>(id: number): MimeType<T> | null {
        for (let wellKnownMapping of Object.entries(MimeType.WellKnownMimeTypes)) {
            if (wellKnownMapping[1] == id) {
                return new MimeType(wellKnownMapping[0]);
            }
        }
        return null;
    }

    toBuffer(): Uint8Array {
        return stringToUtf8ArrayBuffer(this.name);
    }

    equals(other: MimeType<any>) {
        return this.name == other.name;
    }

    // mapFromBuffer(buffer: Uint8Array): T {
    //     return this.coder.decoder(buffer);
    // }

    // mapToBuffer(object?: T): Uint8Array {
    //     if (object == undefined) {
    //         return new Uint8Array(0);
    //     }
    //     return this.coder.encoder(object);
    // }

}


export class MimeTypeRegistry {

    private _registry: Map<string, MimeType<any>> = new Map();
    private _wellKnownRegistry: Map<number, MimeType<any>> = new Map();

    public registerMimeType(mimeType: MimeType<any>) {
        this._registry.set(mimeType.name, mimeType);
        if (mimeType.isWellKnown == true) {
            this._wellKnownRegistry.set(mimeType.wellKnownId, mimeType);
        }
    }

    public getByName(name: string) {
        return this._registry.get(name);
    }
    public getByWellKnown(id: number) {
        return this._wellKnownRegistry.get(id);
    }

    public static defaultRegistry(): MimeTypeRegistry {
        let registry = new MimeTypeRegistry();
        registry.registerMimeType(MimeType.MESSAGE_X_RSOCKET_ROUTING);
        registry.registerMimeType(MimeType.MESSAGE_X_RSOCKET_COMPOSITE_METADATA);
        registry.registerMimeType(MimeType.APPLICATION_JSON);
        registry.registerMimeType(MimeType.APPLICATION_OCTET_STREAM);
        registry.registerMimeType(MimeType.MESSAGE_X_RSOCKET_ACCEPT_MIME_TYPES);
        registry.registerMimeType(MimeType.MESSAGE_X_RSOCKET_ACCEPT_MIME_TYPES);
        registry.registerMimeType(MimeType.MESSAGE_X_RSOCKET_MIME_TYPE);

        return registry;
    }

}




function deserializeCompositeMetadata(buffer: Uint8Array, registry: MimeTypeRegistry): CompositeMetaData[] {
    const view = new DataView(buffer.buffer, buffer.byteOffset);
    let idx = 0;
    const metadataPayloads: CompositeMetaData[] = [];
    while (idx < buffer.byteLength) {
        const idOrLength = view.getUint8(idx++);
        let type: MimeType<any> = null;
        if ((idOrLength >> 7 & 1) == 1) {
            const id = idOrLength & 0x7F;
            type = registry.getByWellKnown(id);
            if (type == null) {
                throw new Error('Trying to resolve WellKnownMimeType that is not implemented yet. Id: ' + id.toString(16));
            }
        } else {
            const nameLength = idOrLength & 0x7F;
            const name = arrayBufferToUtf8String(buffer.slice(idx, idx + nameLength));
            idx += nameLength;
            type = registry.getByName(name);
        }
        const payloadLength = view.getUint32(idx - 1) & 0xFFFFFF;
        idx += 3;
        metadataPayloads.push({
            type: type,
            data: type.coder.decoder(buffer.slice(idx, idx + payloadLength), registry)
        });
        idx += payloadLength;
    }
    return metadataPayloads;
}

interface CompositeMetadataPart {
    idOrLength: number;
    metadataString?: Uint8Array;
    data: Uint8Array;
}

function serializeCompositeMetadata(data: CompositeMetaData[], registry: MimeTypeRegistry) {

    const metadataParts: CompositeMetadataPart[] = [];

    for (let metaData of data) {
        if (metaData.type.isWellKnown) {
            metadataParts.push({
                idOrLength: ((1 << 7) | metaData.type.wellKnownId) & 0xFF,
                data: metaData.type.coder.encoder(metaData.data, registry)
            });
        } else {
            const metadataString = metaData.type.toBuffer();
            metadataParts.push({
                idOrLength: metadataString.byteLength & 0x7F,
                metadataString: metadataString,
                data: metaData.type.coder.encoder(metaData.data, registry)
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
    const uint8View = new Uint8Array(requiredBufferSize);
    const view = new DataView(uint8View.buffer);
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

    return uint8View;
}



function deserializeAuthentication(buffer: Uint8Array): Authentication {
    const view = new DataView(buffer.buffer, buffer.byteOffset);
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

function serializeAuthentication(authentication: Authentication): Uint8Array {

    let usernameBuffer: Uint8Array;
    let passwordBuffer: Uint8Array;
    let tokenBuffer: Uint8Array;
    let typeBuffer: Uint8Array;
    let length = 0;
    if (authentication.type == "simple") {
        length++;
        usernameBuffer = stringToUtf8ArrayBuffer(authentication.username);
        passwordBuffer = stringToUtf8ArrayBuffer(authentication.password);
        length += 2;
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

    const uint8View = new Uint8Array(length);
    const view = new DataView(uint8View.buffer);
    let idx = 0;
    if (authentication.type == "simple") {
        view.setUint8(idx++, (1 << 7) | 0x00);
        view.setUint16(idx, usernameBuffer.byteLength);
        idx += 2;
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
    return uint8View;
}

function serializeMessageRoute(route: string): Uint8Array {
    return stringToUtf8ArrayBuffer(String.fromCharCode(route.length) + route);
}

function deserializeMessageRoute(data: Uint8Array): string {
    const routeLength = data[0];
    return arrayBufferToUtf8String(data.slice(1, 1 + routeLength));
}




