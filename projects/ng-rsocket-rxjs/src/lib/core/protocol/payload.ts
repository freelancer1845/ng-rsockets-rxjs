



export class Payload {


    constructor(public readonly data: ArrayBuffer, public readonly metadata: ArrayBuffer = new ArrayBuffer(0)) {
    }

    public hasMetadata(): boolean {
        return this.metadata.byteLength > 0;
    }

}
