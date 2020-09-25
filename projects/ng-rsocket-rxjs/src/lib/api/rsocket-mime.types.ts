
const WellKnownMimeTypes = {
    "application/json": 0x05,
    "message/x.rsocket.routing.v0": 0x7E,
}



export class MimeType {

    public readonly isWellKnown: boolean;
    public readonly wellKnownId: number;

    constructor(public readonly name: string) {
        if (name in WellKnownMimeTypes) {
            this.isWellKnown = true;
            this.wellKnownId = WellKnownMimeTypes[name];
        } else {
            this.isWellKnown = false;
            this.wellKnownId = 0xFF;
        }
    }

    toBuffer(): ArrayBuffer {
        var buf = new ArrayBuffer(this.name.length);
        var bufView = new Uint8Array(buf);
        for (var i = 0, strLen = this.name.length; i < strLen; i++) {
            bufView[i] = this.name.charCodeAt(i);
        }
        return buf;
    }

    equals(other: MimeType) {
        return this.name == other.name;
    }
}

export const MimeTypes = {
    MESSAGE_X_RSOCKET_ROUTING: new MimeType("message/x.rsocket.routing.v0"),
    APPLICATION_JSON: new MimeType("application/json"),
}
