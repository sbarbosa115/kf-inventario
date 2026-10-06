import {act, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {DetectorFactory} from '@/shared/lib';
import {CameraScanner, SAME_CODE_MS} from './CameraScanner';

/** A camera whose frames hold the codes queued in `frames`, one list per frame. */
function fakeCamera({fail}: {fail?: string} = {}) {
  const frames: string[][] = [];
  const track = {
    stop: vi.fn(),
    getCapabilities: () => ({torch: true}),
    applyConstraints: vi.fn(async () => undefined),
  };
  const getUserMedia = vi.fn(async () => {
    if (fail) throw Object.assign(new Error(fail), {name: fail});
    return {getTracks: () => [track], getVideoTracks: () => [track]};
  });
  vi.stubGlobal('navigator', {
    ...navigator,
    mediaDevices: {getUserMedia},
    vibrate: vi.fn(),
  });
  const detector: DetectorFactory = async () => ({
    detect: async () => frames.shift() ?? [],
  });
  return {frames, track, getUserMedia, detector};
}

const beeps = vi.fn();
class FakeAudio {
  currentTime = 0;
  destination = {};
  createOscillator = () => ({
    type: '',
    frequency: {value: 0},
    connect: vi.fn(),
    start: beeps,
    stop: vi.fn(),
  });
  createGain = () => ({gain: {value: 0}, connect: vi.fn()});
}

describe('CameraScanner', () => {
  beforeEach(() => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      configurable: true,
    });
    vi.stubGlobal('AudioContext', FakeAudio);
    HTMLMediaElement.prototype.play = vi.fn(async () => undefined);
    beeps.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('asks for the camera only after the tap, then reads codes with a vibration and a tone', async () => {
    const camera = fakeCamera();
    const onScan = vi.fn();
    render(<CameraScanner onScan={onScan} detector={camera.detector} />);

    expect(camera.getUserMedia).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', {name: 'Start camera'}));
    expect(camera.getUserMedia).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText('Point the camera at a barcode.'),
    ).toBeInTheDocument();

    camera.frames.push(['KF-01']);
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(onScan).toHaveBeenCalledWith('KF-01');
    expect(navigator.vibrate).toHaveBeenCalledWith(60);
    expect(beeps).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Read KF-01')).toBeInTheDocument();
  });

  it('counts a label held still once, and again once it was away', async () => {
    const camera = fakeCamera();
    const onScan = vi.fn();
    render(<CameraScanner onScan={onScan} detector={camera.detector} />);
    await userEvent.click(screen.getByRole('button', {name: 'Start camera'}));
    await screen.findByText('Point the camera at a barcode.');

    camera.frames.push(['KF-01'], ['KF-01'], ['KF-01']);
    await act(() => vi.advanceTimersByTimeAsync(600));
    expect(onScan).toHaveBeenCalledTimes(1);

    await act(() => vi.advanceTimersByTimeAsync(SAME_CODE_MS + 200));
    camera.frames.push(['KF-01']);
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(onScan).toHaveBeenCalledTimes(2);

    camera.frames.push(['KF-02']);
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(onScan).toHaveBeenLastCalledWith('KF-02');
  });

  it('offers the light where the camera has one, and stops the camera', async () => {
    const camera = fakeCamera();
    render(<CameraScanner onScan={vi.fn()} detector={camera.detector} />);
    await userEvent.click(screen.getByRole('button', {name: 'Start camera'}));

    await userEvent.click(
      await screen.findByRole('button', {name: 'Turn the light on'}),
    );
    expect(camera.track.applyConstraints).toHaveBeenCalledWith({
      advanced: [{torch: true}],
    });
    await userEvent.click(screen.getByRole('button', {name: 'Stop camera'}));
    expect(camera.track.stop).toHaveBeenCalled();
  });

  it('does not read while paused', async () => {
    const camera = fakeCamera();
    const onScan = vi.fn();
    render(<CameraScanner onScan={onScan} detector={camera.detector} paused />);
    await userEvent.click(screen.getByRole('button', {name: 'Start camera'}));
    await screen.findByText('Point the camera at a barcode.');

    camera.frames.push(['KF-01']);
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(onScan).not.toHaveBeenCalled();
  });

  it('says so when the camera is refused, and lets the person try again', async () => {
    const camera = fakeCamera({fail: 'NotAllowedError'});
    render(<CameraScanner onScan={vi.fn()} detector={camera.detector} />);

    await userEvent.click(screen.getByRole('button', {name: 'Start camera'}));
    expect(
      await screen.findByText(/The camera was not allowed/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Start camera'})).toBeVisible();
  });

  it('on an address that is not secure explains why there is no camera', () => {
    fakeCamera();
    Object.defineProperty(window, 'isSecureContext', {
      value: false,
      configurable: true,
    });
    render(<CameraScanner onScan={vi.fn()} />);

    expect(
      screen.getByText(/The camera needs a secure address/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Start camera'}),
    ).not.toBeInTheDocument();
  });
});
