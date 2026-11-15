// Barcode detection: the browser's built-in BarcodeDetector where it exists
// (Chrome on Android, Safari 17+ on some devices), otherwise a WebAssembly
// port of ZXing. The fallback is loaded on first use and its .wasm file is
// served by this app (not a CDN).

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'] as const

export interface Detector {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>
}

interface NativeDetectorCtor {
  new (opts: { formats: readonly string[] }): Detector
  getSupportedFormats(): Promise<string[]>
}

let detectorPromise: Promise<Detector> | null = null

async function createDetector(): Promise<Detector> {
  const Native = (globalThis as { BarcodeDetector?: NativeDetectorCtor }).BarcodeDetector
  if (Native) {
    try {
      const supported = await Native.getSupportedFormats()
      if (supported.includes('ean_13')) return new Native({ formats: FORMATS.filter((f) => supported.includes(f)) })
    } catch {
      // fall through to the WebAssembly detector
    }
  }
  const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
    import('barcode-detector/ponyfill'),
    import('zxing-wasm/reader/zxing_reader.wasm?url'),
  ])
  prepareZXingModule({
    overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) },
  })
  return new BarcodeDetector({ formats: [...FORMATS] })
}

export function getBarcodeDetector(): Promise<Detector> {
  detectorPromise ??= createDetector().catch((e) => {
    detectorPromise = null
    throw e
  })
  return detectorPromise
}

/** Camera access needs HTTPS (or localhost) and a browser that supports it. */
export function cameraAvailable(): boolean {
  return window.isSecureContext && !!navigator.mediaDevices?.getUserMedia
}

/** EAN/UPC barcodes are 8, 12 or 13 digits (14 for some outer cartons). */
export function normaliseBarcode(input: string): string | null {
  const digits = input.replace(/\D/g, '')
  return /^(\d{8}|\d{12,14})$/.test(digits) ? digits : null
}
