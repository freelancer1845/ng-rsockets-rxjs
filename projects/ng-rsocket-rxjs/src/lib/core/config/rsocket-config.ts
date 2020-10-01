import { Payload } from "../protocol/payload";



export interface RSocketConfig {
    majorVersion: number;
    minorVersion: number,
    metadataMimeType: Uint8Array;
    dataMimeType: Uint8Array;
    keepaliveTime: number;
    maxLifetime: number;
    resumeIdentificationToken?: Uint8Array;
    honorsLease: boolean;
    setupPayload?: Payload;
}