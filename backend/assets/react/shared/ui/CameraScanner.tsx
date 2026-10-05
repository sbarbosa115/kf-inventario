import {useEffect, useRef, useState} from 'react';
import {useTranslation} from '@/shared/i18n';
import {
  beep,
  createDetector,
  DEFAULT_FORMATS,
  type BarcodeFormat,
  type BarcodeSource,
  type DetectorFactory,
} from '@/shared/lib';
import {Button} from './Button';

/** The same code read again this soon is the same label held in front of the camera. */
export const SAME_CODE_MS = 1500;
const FRAME_MS = 150;

type State =
  | 'idle'
  | 'asking'
  | 'scanning'
  | 'denied'
  | 'noCamera'
  | 'insecure'
  | 'failed';

function initialState(): State {
  if (window.isSecureContext === false) return 'insecure';
  if (!navigator.mediaDevices?.getUserMedia) return 'noCamera';
  return 'idle';
}

/**
 * The phone's camera as a barcode reader. The permission is asked only after "Start camera" is tapped; then each
 * code read calls onScan, with a vibration and a tone, and the camera stays open for the next one. A label held
 * still counts once. Every way it cannot work is said in words (the typed input next to it always works).
 */
export function CameraScanner({
  onScan,
  formats = DEFAULT_FORMATS,
  paused = false,
  detector = createDetector,
}: {
  onScan: (code: string) => void;
  formats?: BarcodeFormat[];
  /** Reading stops (the camera stays open), e.g. while a dialog is up. */
  paused?: boolean;
  /** How frames are decoded; tests pass a fake. */
  detector?: DetectorFactory;
}) {
  const {t} = useTranslation();
  const [state, setState] = useState<State>(initialState);
  const [torch, setTorch] = useState<boolean | null>(null);
  const [lastRead, setLastRead] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const last = useRef<{code: string; at: number} | null>(null);
  const latest = useRef({onScan, paused});
  useEffect(() => {
    latest.current = {onScan, paused};
  });

  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    setTorch(null);
  };
  useEffect(() => stop, []);

  const read = (codes: string[]) => {
    const now = Date.now();
    for (const code of codes) {
      const seen = last.current;
      last.current = {code, at: now};
      if (seen && seen.code === code && now - seen.at < SAME_CODE_MS) continue;
      navigator.vibrate?.(60);
      beep();
      setLastRead(code);
      latest.current.onScan(code);
    }
  };

  const loop = (source: BarcodeSource) => {
    timer.current = setTimeout(async () => {
      if (!stream.current) return;
      if (!latest.current.paused && video.current) {
        read(await source.detect(video.current));
      }
      if (stream.current) loop(source);
    }, FRAME_MS);
  };

  const start = async () => {
    setState('asking');
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: {facingMode: {ideal: 'environment'}},
        audio: false,
      });
      stream.current = media;
      if (video.current) {
        video.current.srcObject = media;
        await video.current.play().catch(() => undefined);
      }
      const track = media.getVideoTracks()[0];
      const capabilities = (track?.getCapabilities?.() ?? {}) as {
        torch?: boolean;
      };
      setTorch(capabilities.torch ? false : null);
      const source = await detector(formats);
      setState('scanning');
      loop(source);
    } catch (failure) {
      stop();
      const name = (failure as {name?: string} | null)?.name;
      setState(
        name === 'NotAllowedError' || name === 'SecurityError'
          ? 'denied'
          : name === 'NotFoundError' || name === 'OverconstrainedError'
            ? 'noCamera'
            : 'failed',
      );
    }
  };

  const toggleTorch = async () => {
    const track = stream.current?.getVideoTracks()[0];
    if (!track || torch === null) return;
    try {
      await track.applyConstraints({
        advanced: [{torch: !torch} as MediaTrackConstraintSet],
      });
      setTorch(!torch);
    } catch {
      setTorch(null);
    }
  };

  const open = state === 'asking' || state === 'scanning';
  const message =
    state === 'scanning'
      ? lastRead
        ? t('common.camera.read', {code: lastRead})
        : t('common.camera.scanning')
      : state === 'idle'
        ? null
        : t(`common.camera.${state}`);

  return (
    <div className={`kf-camera${open ? ' is-open' : ''}`}>
      <div className="kf-camera__viewport" hidden={!open}>
        <video
          ref={video}
          className="kf-camera__video"
          aria-label={t('common.camera.label')}
          playsInline
          muted
          autoPlay
        />
        <div className="kf-camera__guide" aria-hidden="true" />
      </div>
      <div className="kf-camera__bar">
        {(state === 'idle' || state === 'denied' || state === 'failed') && (
          <Button
            variant="secondary"
            size="lg"
            icon="fa-camera"
            onClick={start}
          >
            {t('common.camera.start')}
          </Button>
        )}
        {open && (
          <Button
            variant="secondary"
            icon="fa-stop"
            onClick={() => {
              stop();
              setState('idle');
              setLastRead(null);
            }}
          >
            {t('common.camera.stop')}
          </Button>
        )}
        {torch !== null && (
          <Button
            variant="ghost"
            icon="fa-lightbulb"
            aria-pressed={torch}
            aria-label={
              torch ? t('common.camera.torchOff') : t('common.camera.torchOn')
            }
            onClick={toggleTorch}
          />
        )}
      </div>
      <p
        className={`kf-camera__status${state === 'scanning' || state === 'asking' ? '' : ' kf-camera__status--note'}`}
        aria-live="polite"
      >
        {message}
      </p>
    </div>
  );
}
