

export function stringToUtf8ArrayBuffer(_string: string) {
    return new TextEncoder().encode(_string);
}

export function arrayBufferToUtf8String(buffer: Uint8Array) {
    return new TextDecoder('utf-8').decode(buffer);
}

export function getUint64(view: DataView, byteOffset, littleEndian = false) {
    // split 64-bit number into two 32-bit parts
    const left = view.getUint32(byteOffset, littleEndian);
    const right = view.getUint32(byteOffset + 4, littleEndian);

    // combine the two 32-bit values
    const combined = littleEndian ? left + 2 ** 32 * right : 2 ** 32 * left + right;

    if (!Number.isSafeInteger(combined))
        console.warn(combined, 'exceeds MAX_SAFE_INTEGER. Precision may be lost');
    return combined;
}