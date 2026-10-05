/** The barcode formats the warehouse labels use. */
export type BarcodeFormat =
  'code_128' | 'code_39' | 'ean_13' | 'ean_8' | 'upc_a' | 'qr_code';

export const DEFAULT_FORMATS: BarcodeFormat[] = [
  'code_128',
  'code_39',
  'ean_13',
  'ean_8',
  'upc_a',
  'qr_code',
];

/** Reads the codes in the video's current frame (none is an empty list, never an error). */
export interface BarcodeSource {
  detect: (video: HTMLVideoElement) => Promise<string[]>;
}

export type DetectorFactory = (
  formats: BarcodeFormat[],
) => Promise<BarcodeSource>;

interface NativeDetector {
  detect: (source: CanvasImageSource) => Promise<{rawValue: string}[]>;
}
interface NativeDetectorClass {
  new (options: {formats: string[]}): NativeDetector;
  getSupportedFormats: () => Promise<string[]>;
}

/**
 * The browser's BarcodeDetector when it reads every format (Chrome on Android), otherwise ZXing, loaded only now
 * (its own chunk). Nothing leaves the phone: frames are decoded in the page.
 */
export const createDetector: DetectorFactory = async (formats) => {
  const Native = (window as unknown as {BarcodeDetector?: NativeDetectorClass})
    .BarcodeDetector;
  if (Native) {
    try {
      const supported = await Native.getSupportedFormats();
      if (formats.every((format) => supported.includes(format))) {
        const detector = new Native({formats});
        return {
          detect: async (video) => {
            try {
              return (await detector.detect(video)).map((c) => c.rawValue);
            } catch {
              return [];
            }
          },
        };
      }
    } catch {
      // Fall back to ZXing.
    }
  }
  return zxingDetector(formats);
};

async function zxingDetector(formats: BarcodeFormat[]): Promise<BarcodeSource> {
  const [{BrowserMultiFormatReader}, {BarcodeFormat: Z, DecodeHintType}] =
    await Promise.all([import('@zxing/browser'), import('@zxing/library')]);
  const names: Record<BarcodeFormat, number> = {
    code_128: Z.CODE_128,
    code_39: Z.CODE_39,
    ean_13: Z.EAN_13,
    ean_8: Z.EAN_8,
    upc_a: Z.UPC_A,
    qr_code: Z.QR_CODE,
  };
  const hints = new Map();
  hints.set(
    DecodeHintType.POSSIBLE_FORMATS,
    formats.map((format) => names[format]),
  );
  const reader = new BrowserMultiFormatReader(hints);
  const canvas = document.createElement('canvas');
  return {
    detect: async (video) => {
      if (!video.videoWidth || !video.videoHeight) return [];
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')?.drawImage(video, 0, 0);
      try {
        return [reader.decodeFromCanvas(canvas).getText()];
      } catch {
        return [];
      }
    },
  };
}
