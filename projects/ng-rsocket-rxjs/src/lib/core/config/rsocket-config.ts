import { MimeTypes } from '../../api/rsocket-mime.types';
import { Payload } from "../protocol/payload";



export interface RSocketConfig<M, D> {
    majorVersion: number;
    minorVersion: number,
    metadataMimeType: MimeTypes<M>;
    dataMimeType: MimeTypes<D>;
    keepaliveTime: number;
    maxLifetime: number;
    resumeIdentificationToken?: Uint8Array;
    honorsLease: boolean;
    metaData?: M;
    data?: D;
}