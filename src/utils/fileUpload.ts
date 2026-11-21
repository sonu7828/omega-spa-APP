import { Platform } from 'react-native';

/**
 * Helper to decode base64 strings to Uint8Array safely across all JS engines
 */
function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof atob === 'function') {
    const binStr = atob(base64);
    const len = binStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binStr.charCodeAt(i);
    }
    return bytes;
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const len = clean.length;
  const bytes = new Uint8Array(Math.floor(len * 0.75));
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const enc1 = chars.indexOf(clean[i]);
    const enc2 = chars.indexOf(clean[i + 1]);
    const enc3 = chars.indexOf(clean[i + 2]);
    const enc4 = chars.indexOf(clean[i + 3]);
    bytes[p++] = (enc1 << 2) | (enc2 >> 4);
    if (enc3 !== -1 && enc3 !== 64) bytes[p++] = ((enc2 & 15) << 4) | (enc3 >> 2);
    if (enc4 !== -1 && enc4 !== 64) bytes[p++] = ((enc3 & 3) << 6) | enc4;
  }
  return bytes.subarray(0, p);
}

/**
 * Convert dataURL directly to a standard browser File object (web safe)
 */
export function dataUrlToFile(
  dataUrl: string,
  filename: string = `photo_${Date.now()}.jpg`,
  mimeType: string = 'image/jpeg'
): any {
  try {
    if (typeof File === 'undefined') return null;
    const parts = dataUrl.split(',');
    const mime = parts[0]?.match(/:(.*?);/)?.[1] || mimeType;
    const b64 = parts[1] || parts[0];
    const binStr = atob(b64);
    const len = binStr.length;
    const u8arr = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      u8arr[i] = binStr.charCodeAt(i);
    }
    return new File([u8arr], filename, { type: mime });
  } catch (err) {
    console.warn('[fileUpload] dataUrlToFile error:', err);
    return null;
  }
}

/**
 * Creates a valid FormData file entry that works across:
 * 1. Web (Expo Web / Browser) -> returns real File or Blob
 * 2. Mobile (Expo SDK 52-58+ on Android & iOS) -> returns an object with `.bytes()` method,
 *    `name`, `type`, and `uri` that satisfies Expo's WinterCG convertFormData parser
 *    and classic React Native networking without throwing "Unsupported FormDataPart implementation".
 */
export async function createFormDataFile(
  uri: string,
  filename: string = `photo_${Date.now()}.jpg`,
  mimeType: string = 'image/jpeg'
): Promise<any> {
  if (!uri) return null;

  // 1. Web browser: standard File / Blob
  if (Platform.OS === 'web') {
    if (uri.startsWith('data:')) {
      const directFile = dataUrlToFile(uri, filename, mimeType);
      if (directFile) return directFile;
    }
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      if (typeof File !== 'undefined') {
        return new File([blob], filename, { type: blob.type || mimeType });
      }
      return blob;
    } catch (err) {
      console.warn('[fileUpload] Web blob conversion note:', err);
    }
  }

  // 2. Data URI (base64) on mobile or web
  if (uri.startsWith('data:')) {
    try {
      const commaIdx = uri.indexOf(',');
      const base64Str = commaIdx !== -1 ? uri.slice(commaIdx + 1) : uri;
      const bytes = base64ToUint8Array(base64Str);
      return {
        name: filename,
        type: mimeType,
        uri,
        bytes: async () => bytes,
      };
    } catch (err) {
      console.warn('[fileUpload] Data URI decode note:', err);
    }
  }

  // 3. Local file URI (file:// or content://) or remote URL on Android / iOS
  try {
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    return {
      name: filename,
      type: mimeType,
      uri,
      bytes: async () => bytes,
    };
  } catch (err) {
    console.warn('[fileUpload] Local file fetch to bytes note, fallback to lazy fetch:', err);
  }

  // 4. Fallback: Lazy bytes getter
  return {
    name: filename,
    type: mimeType,
    uri,
    bytes: async () => {
      const res = await fetch(uri);
      return new Uint8Array(await res.arrayBuffer());
    },
  };
}
