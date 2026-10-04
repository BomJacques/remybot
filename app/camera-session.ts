/** Owns camera tracks, including streams returned after the view has closed. */
type CameraStream = {getTracks(): Array<{stop(): void}>};
export type CameraStatus = 'idle' | 'requesting' | 'live' | 'error';

export function createCameraSession<T extends CameraStream>({
  request,
  onStream,
  onStatus,
  onError,
}: {
  request: () => Promise<T>;
  onStream: (stream: T | null) => void;
  onStatus: (status: CameraStatus) => void;
  onError: (error: unknown) => void;
}) {
  let generation = 0;
  let active: T | null = null;
  let disposed = false;
  const stopTracks = (stream: T | null) => {
    for (const track of stream?.getTracks() ?? []) track.stop();
  };
  const release = () => {
    stopTracks(active);
    active = null;
  };
  return {
    async start() {
      if (disposed) return;
      const current = ++generation;
      release();
      onStream(null);
      onStatus('requesting');
      try {
        const stream = await request();
        if (disposed || current !== generation) {
          stopTracks(stream);
          return;
        }
        active = stream;
        onStream(stream);
        onStatus('live');
      } catch (error) {
        if (!disposed && current === generation) {
          onError(error);
          onStatus('error');
        }
      }
    },
    stop() {
      ++generation;
      release();
      if (!disposed) {
        onStream(null);
        onStatus('idle');
      }
    },
    dispose() {
      disposed = true;
      ++generation;
      release();
    },
  };
}
