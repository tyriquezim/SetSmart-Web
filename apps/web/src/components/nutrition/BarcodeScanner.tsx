import { useEffect, useRef, useState } from 'react'
import { cameraAvailable, getBarcodeDetector, normaliseBarcode } from '../../lib/barcode'
import { Button, ErrorText, Input, Modal, Spinner } from '../ui'

type CameraState = 'starting' | 'scanning' | 'unavailable' | 'denied' | 'error'

/** Camera view that reports the first barcode it reads, with manual entry as a fallback. */
export function BarcodeScannerModal({
  open,
  onClose,
  onDetected,
}: {
  open: boolean
  onClose: () => void
  onDetected: (barcode: string) => void
}) {
  return (
    <Modal open={open} onClose={onClose} title="Scan barcode">
      {open && <Scanner onDetected={onDetected} />}
    </Modal>
  )
}

function Scanner({ onDetected }: { onDetected: (barcode: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [state, setState] = useState<CameraState>(() => (cameraAvailable() ? 'starting' : 'unavailable'))
  const [manual, setManual] = useState('')
  const [manualError, setManualError] = useState<string | null>(null)
  const detectedRef = useRef(onDetected)
  useEffect(() => {
    detectedRef.current = onDetected
  })

  useEffect(() => {
    if (!cameraAvailable()) return
    let stream: MediaStream | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    let stopped = false

    const stop = () => {
      stopped = true
      clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }

    ;(async () => {
      try {
        const [s, detector] = await Promise.all([
          navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          }),
          getBarcodeDetector(),
        ])
        stream = s
        if (stopped) return stop()
        const video = videoRef.current!
        video.srcObject = s
        await video.play()
        setState('scanning')

        // Same barcode on two consecutive frames before accepting, to avoid misreads.
        let last: string | null = null
        const tick = async () => {
          if (stopped) return
          try {
            if (video.readyState >= 2) {
              const codes = await detector.detect(video)
              const code = codes.map((c) => normaliseBarcode(c.rawValue)).find(Boolean) ?? null
              if (code && code === last) {
                navigator.vibrate?.(60)
                stop()
                detectedRef.current(code)
                return
              }
              last = code
            }
          } catch {
            // a dropped frame; keep going
          }
          timer = setTimeout(tick, 150)
        }
        void tick()
      } catch (e) {
        if (stopped) return
        const name = e instanceof DOMException ? e.name : ''
        setState(name === 'NotAllowedError' ? 'denied' : name === 'NotFoundError' ? 'unavailable' : 'error')
        stop()
      }
    })()

    return stop
  }, [])

  const message =
    state === 'denied'
      ? 'Camera access was blocked. Allow it in your browser settings, or type the number below.'
      : state === 'unavailable'
        ? window.isSecureContext
          ? 'No camera is available here. Type the number below instead.'
          : 'The camera only works over HTTPS (or on localhost). Type the number below instead.'
        : state === 'error'
          ? 'The camera could not be started. Type the number below instead.'
          : null

  return (
    <div className="space-y-4">
      {!message && (
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-black">
          <video ref={videoRef} className="size-full object-cover" playsInline muted />
          {/* aiming guide */}
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-xl border-2 border-accent/80" />
          {state === 'starting' && (
            <div className="absolute inset-0 grid place-items-center text-zinc-400">
              <Spinner />
            </div>
          )}
          {state === 'scanning' && (
            <p className="absolute bottom-3 inset-x-0 text-center text-xs text-zinc-200">Hold the barcode inside the box</p>
          )}
        </div>
      )}
      {message && <p className="text-sm text-zinc-300 bg-zinc-950 rounded-xl px-3 py-3">{message}</p>}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const code = normaliseBarcode(manual)
          if (!code) return setManualError('Barcodes are 8, 12 or 13 digits.')
          setManualError(null)
          onDetected(code)
        }}
      >
        <Input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          inputMode="numeric"
          placeholder="Or type the barcode number"
          aria-label="Barcode number"
        />
        <Button type="submit">Look up</Button>
      </form>
      {manualError && <ErrorText error={manualError} />}
    </div>
  )
}
