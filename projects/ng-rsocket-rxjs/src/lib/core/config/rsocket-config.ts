import { Payload } from "../protocol/payload";



export interface RSocketConfig {
    majorVersion: number;
    minorVersion: number,
    metadataMimeType: ArrayBuffer;
    dataMimeType: ArrayBuffer;
    keepaliveTime: number;
    maxLifetime: number;
    resumeIdentificationToken?: ArrayBuffer;
    honorsLease: boolean;
    setupPayload?: Payload;
}