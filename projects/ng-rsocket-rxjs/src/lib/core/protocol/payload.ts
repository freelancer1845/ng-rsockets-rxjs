



export class Payload {


    constructor(public readonly data: Uint8Array, public readonly metadata: Uint8Array = new Uint8Array(0)) {
    }

    public hasMetadata(): boolean {
        return this.metadata.byteLength > 0;
    }

}
