export type Crop = {x: number; y: number; width: number; height: number};

function positive(...values: number[]) {
  if (values.some(value => !Number.isFinite(value) || value <= 0)) {
    throw new Error('The camera picture is not ready yet. Please try again.');
  }
}

/** The centred source crop used by CSS object-fit: cover, without mirroring. */
export function coverCrop(sourceWidth: number, sourceHeight: number, viewWidth: number, viewHeight: number): Crop {
  positive(sourceWidth, sourceHeight, viewWidth, viewHeight);
  const ratio = Math.max(viewWidth / sourceWidth, viewHeight / sourceHeight);
  const width = viewWidth / ratio, height = viewHeight / ratio;
  return {x: (sourceWidth - width) / 2, y: (sourceHeight - height) / 2, width, height};
}

/** Never upscale the camera, and limit the long edge to keep iPad memory modest. */
export function photoDimensions(width: number, height: number, maxEdge = 1600) {
  positive(width, height, maxEdge);
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale))};
}

export function containRect(sourceWidth: number, sourceHeight: number, boxSize: number): Crop {
  positive(sourceWidth, sourceHeight, boxSize);
  const scale = Math.min(boxSize / sourceWidth, boxSize / sourceHeight);
  const width = sourceWidth * scale, height = sourceHeight * scale;
  return {x: -width / 2, y: -height / 2, width, height};
}

export type PhotoCreature = {
  image: CanvasImageSource;
  naturalWidth: number;
  naturalHeight: number;
  /** Centre and square size in the displayed camera viewport's CSS pixels. */
  x: number;
  y: number;
  size: number;
  featureSvg?: string;
  transform?: {a: number; b: number; c: number; d: number; e: number; f: number};
};

type PhotoScene = {
  frame: CanvasImageSource;
  sourceWidth: number;
  sourceHeight: number;
  viewWidth: number;
  viewHeight: number;
  creatures: PhotoCreature[];
};
type LoadedFeature = {image: CanvasImageSource; release: () => void};
type PhotoPlatform = {
  createCanvas: () => HTMLCanvasElement;
  loadFeature: (svg: string, signal: AbortSignal) => Promise<LoadedFeature>;
  encode: (canvas: HTMLCanvasElement) => Promise<Blob>;
};

function checkCancelled(signal: AbortSignal) {
  if (signal.aborted) throw new DOMException('Photo cancelled', 'AbortError');
}

function loadFeature(svg: string, signal: AbortSignal): Promise<LoadedFeature> {
  checkCancelled(signal);
  const url = URL.createObjectURL(new Blob([svg], {type: 'image/svg+xml'}));
  return new Promise((resolve, reject) => {
    const image = new Image();
    let released = false;
    const release = () => {if (!released) {released = true; URL.revokeObjectURL(url);}};
    const tidy = () => {image.onload = null; image.onerror = null; signal.removeEventListener('abort', cancel);};
    const cancel = () => {
      tidy();
      image.src = '';
      release();
      reject(new DOMException('Photo cancelled', 'AbortError'));
    };
    image.onload = () => {tidy(); resolve({image, release});};
    image.onerror = () => {tidy(); release(); reject(new Error('A creature’s markings could not load. Please try taking the photo again.'));};
    signal.addEventListener('abort', cancel, {once: true});
    image.src = url;
  });
}

const browserPlatform: PhotoPlatform = {
  createCanvas: () => document.createElement('canvas'),
  loadFeature,
  encode: canvas => new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('The photo could not be made. Please try again.')), 'image/png');
  }),
};

/** Freeze the video immediately, then add sprites and the same SVG markings as the preview. */
export async function captureCameraPhoto(scene: PhotoScene, signal: AbortSignal, platform: PhotoPlatform = browserPlatform) {
  checkCancelled(signal);
  const crop = coverCrop(scene.sourceWidth, scene.sourceHeight, scene.viewWidth, scene.viewHeight);
  const dimensions = photoDimensions(crop.width, crop.height);
  const canvas = platform.createCanvas();
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  try {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser cannot make the photo. Try Safari or another browser.');
    // This runs before the first await, so all later image loading uses the shutter frame.
    context.drawImage(scene.frame, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
    const scaleX = canvas.width / scene.viewWidth, scaleY = canvas.height / scene.viewHeight;
    context.scale(scaleX, scaleY);
    context.imageSmoothingEnabled = false;
    for (const creature of scene.creatures) {
      checkCancelled(signal);
      const image = containRect(creature.naturalWidth, creature.naturalHeight, creature.size);
      context.save();
      context.translate(creature.x, creature.y);
      if (creature.transform) {
        const {a, b, c, d, e, f} = creature.transform;
        context.transform(a, b, c, d, e, f);
      }
      context.drawImage(creature.image, image.x, image.y, image.width, image.height);
      if (creature.featureSvg) {
        const feature = await platform.loadFeature(creature.featureSvg, signal);
        try {
          checkCancelled(signal);
          context.drawImage(feature.image, -creature.size / 2, -creature.size / 2, creature.size, creature.size);
        } finally {feature.release();}
      }
      context.restore();
    }
    checkCancelled(signal);
    const blob = await platform.encode(canvas);
    checkCancelled(signal);
    return {blob, ...dimensions};
  } finally {
    // Release the temporary pixel buffer after encoding, failure, or cancellation.
    canvas.width = 0;
    canvas.height = 0;
  }
}

/** SVG image decoding cannot inherit the page's CSS, so copy the rendered fills. */
export function serializeCreatureFeature(svg: SVGSVGElement) {
  const copy = svg.cloneNode(true) as SVGSVGElement;
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  copy.setAttribute('width', '226');
  copy.setAttribute('height', '226');
  const sourcePaths = svg.querySelectorAll('path');
  copy.querySelectorAll('path').forEach((path, index) => {
    const original = sourcePaths[index];
    path.setAttribute('fill', getComputedStyle(original).fill);
  });
  return new XMLSerializer().serializeToString(copy);
}

/** Prevent late encodes from publishing a preview after retake or close. */
export function createPhotoPreviewSession({
  createURL = (blob: Blob) => URL.createObjectURL(blob),
  revokeURL = (url: string) => URL.revokeObjectURL(url),
} = {}) {
  let controller: AbortController | null = null;
  let url: string | null = null;
  let disposed = false;
  const clear = () => {
    controller?.abort();
    controller = null;
    if (url) revokeURL(url);
    url = null;
  };
  return {
    begin() {
      if (disposed) return null;
      controller?.abort();
      controller = new AbortController();
      return controller;
    },
    publish(request: AbortController, blob: Blob) {
      if (disposed || controller !== request || request.signal.aborted) return null;
      const next = createURL(blob);
      if (url) revokeURL(url);
      url = next;
      controller = null;
      return url;
    },
    cancelPending() {controller?.abort(); controller = null;},
    clear,
    dispose() {disposed = true; clear();},
  };
}

type ShareTarget = Pick<Navigator, 'canShare' | 'share'>;
export function canSharePhoto(file: File, target: Partial<ShareTarget> = navigator) {
  try {return typeof target.share === 'function' && target.canShare?.({files: [file]}) === true;}
  catch {return false;}
}

/** Call directly from a button event: there is deliberately no await before share(). */
export function sharePhoto(file: File, target: Partial<ShareTarget> = navigator): Promise<'opened' | 'cancelled' | 'unavailable'> {
  if (!canSharePhoto(file, target)) return Promise.resolve('unavailable');
  try {
    return target.share!({files: [file], title: 'Remybot photo'}).then(() => 'opened' as const, error => {
      if (error && typeof error === 'object' && error.name === 'AbortError') return 'cancelled' as const;
      throw error;
    });
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') return Promise.resolve('cancelled');
    return Promise.reject(error);
  }
}
