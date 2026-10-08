'use client';

import {useEffect, useRef, useState, type PointerEvent, type KeyboardEvent} from 'react';
import {Camera, CameraOff, Download, Move, RotateCcw, Share2} from 'lucide-react';
import {createCameraSession, type CameraStatus} from './camera-session';
import {canSharePhoto, captureCameraPhoto, createPhotoPreviewSession, serializeCreatureFeature, sharePhoto, type PhotoCreature} from './camera-photo';
import {CreatureAppearance} from './creature-appearance';
import type {Playmate} from './playmates';
import './camera-view.css';

function cameraError(error: unknown) {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Camera access was not allowed. A grown-up can allow it in the browser’s website settings, then try again.';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'There is no camera available on this device. You can still move and tap your friends here.';
  if (name === 'NotReadableError' || name === 'TrackStartError') return 'The camera is busy. Close any other app using it, then try again.';
  return 'The camera could not start. You can try again, or move and tap your friends here.';
}

type Placement = {x: number; y: number; size: number};
type Preview = {url: string; file: File; width: number; height: number; shareable: boolean};
const mainId = 'camera-main';
const initialPlacement = (index: number): Placement => ({x: index === 0 ? 50 : index === 1 ? 25 : 75, y: index === 0 ? 54 : 69, size: index === 0 ? 140 : 115});

export function CameraView({name, spriteSrc, appearance, companions = [], onLaugh}: {
  name: string;
  spriteSrc: string;
  appearance?: {egg: number; stage: number; variant: number};
  companions?: Playmate[];
  onLaugh: () => void;
}) {
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [notice, setNotice] = useState('');
  const [playBlocked, setPlayBlocked] = useState(false);
  const [frameReady, setFrameReady] = useState(false);
  const [placements, setPlacements] = useState<Record<string, Placement>>({});
  const [selectedId, setSelectedId] = useState(mainId);
  const [laughingId, setLaughingId] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [sharing, setSharing] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const petElements = useRef(new Map<string, HTMLButtonElement>());
  const session = useRef<ReturnType<typeof createCameraSession<MediaStream>> | null>(null);
  const photos = useRef<ReturnType<typeof createPhotoPreviewSession> | null>(null);
  const mounted = useRef(false);
  const previewExists = useRef(false);
  const captureBusy = useRef(false);
  const shareGeneration = useRef(0);
  const shareBusy = useRef(false);
  const laughTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drag = useRef<{pointerId: number; petId: string; x: number; y: number; origin: Placement; moved: boolean} | null>(null);
  const supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  const friends: Playmate[] = [{id: mainId, name, spriteSrc, appearance: appearance ?? {egg: 0, stage: 1, variant: 0}}, ...companions.filter((friend, index, all) => friend.id !== mainId && all.findIndex(other => other.id === friend.id) === index).slice(0, 2)];
  const selected = friends.find(friend => friend.id === selectedId) ?? friends[0];
  const placementFor = (id: string) => placements[id] ?? initialPlacement(Math.max(0, friends.findIndex(friend => friend.id === id)));
  const selectedPlacement = placementFor(selected.id);

  useEffect(() => {
    mounted.current = true;
    const photoSession = createPhotoPreviewSession();
    photos.current = photoSession;
    const current = createCameraSession<MediaStream>({
      request: () => navigator.mediaDevices.getUserMedia({audio: false, video: {facingMode: {ideal: 'environment'}, width: {ideal: 1280}, height: {ideal: 960}}}),
      onStream: setStream,
      onStatus: setStatus,
      onError: error => setNotice(cameraError(error)),
    });
    session.current = current;
    const pause = () => {
      current.stop();
      photoSession.cancelPending();
      captureBusy.current = false;
      setCapturing(false);
      if (!previewExists.current) setNotice('Camera stopped. Tap Start camera when you’re ready.');
    };
    const hidden = () => {if (document.visibilityState === 'hidden') pause();};
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', pause);
    return () => {
      mounted.current = false;
      ++shareGeneration.current;
      current.dispose();
      photoSession.dispose();
      session.current = null;
      photos.current = null;
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('pagehide', pause);
      if (laughTimer.current) clearTimeout(laughTimer.current);
    };
  }, []);

  useEffect(() => {
    setFrameReady(false);
    const element = video.current;
    if (!element || !stream) return;
    let cancelled = false;
    element.srcObject = stream;
    setPlayBlocked(false);
    void element.play().catch(() => {if (!cancelled) setPlayBlocked(true);});
    const ended = () => {session.current?.stop(); setNotice('The camera stopped. You can start it again.');};
    for (const track of stream.getTracks()) track.addEventListener('ended', ended);
    return () => {
      cancelled = true;
      for (const track of stream.getTracks()) track.removeEventListener('ended', ended);
      element.pause();
      element.srcObject = null;
    };
  }, [stream]);

  function start() {
    setNotice('');
    setPlayBlocked(false);
    if (!supported) {setNotice('This browser cannot open a camera. Try Safari on your iPad, or play with your friends here.'); return;}
    void session.current?.start();
  }
  function stop() {
    photos.current?.cancelPending();
    captureBusy.current = false;
    setCapturing(false);
    session.current?.stop();
    setNotice('Camera stopped.');
  }
  function laugh(id: string) {
    if (laughTimer.current) clearTimeout(laughTimer.current);
    setLaughingId(id);
    laughTimer.current = setTimeout(() => setLaughingId(''), 1200);
    onLaugh();
  }
  function bounded(x: number, y: number, size: number): Placement {
    const rect = stage.current?.getBoundingClientRect();
    const marginX = rect ? Math.min(50, (size / 2 + 12) / rect.width * 100) : 30;
    const marginY = rect ? Math.min(50, (size / 2 + 12) / rect.height * 100) : 35;
    return {x: Math.max(marginX, Math.min(100 - marginX, x)), y: Math.max(marginY, Math.min(100 - marginY, y)), size};
  }
  function pointerDown(event: PointerEvent<HTMLButtonElement>, id: string) {
    if (event.button !== 0 || capturing) return;
    setSelectedId(id);
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {pointerId: event.pointerId, petId: id, x: event.clientX, y: event.clientY, origin: placementFor(id), moved: false};
  }
  function pointerMove(event: PointerEvent<HTMLButtonElement>) {
    const gesture = drag.current, element = stage.current;
    if (!gesture || gesture.pointerId !== event.pointerId || !element) return;
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    if (Math.hypot(dx, dy) > 8) gesture.moved = true;
    if (gesture.moved) setPlacements(current => ({...current, [gesture.petId]: bounded(gesture.origin.x + dx / element.clientWidth * 100, gesture.origin.y + dy / element.clientHeight * 100, gesture.origin.size)}));
  }
  function pointerUp(event: PointerEvent<HTMLButtonElement>) {
    const gesture = drag.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!gesture.moved) laugh(gesture.petId);
  }
  function moveWithKeys(event: KeyboardEvent<HTMLButtonElement>, id: string) {
    const offset: Record<string, [number, number]> = {ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, -5], ArrowDown: [0, 5]};
    if (!offset[event.key]) return;
    event.preventDefault();
    const [dx, dy] = offset[event.key], current = placementFor(id);
    setSelectedId(id);
    setPlacements(all => ({...all, [id]: bounded(current.x + dx, current.y + dy, current.size)}));
  }

  async function takePhoto() {
    const frame = video.current, viewport = stage.current, owner = photos.current;
    if (captureBusy.current || !frame || !viewport || !owner || frame.readyState < 2 || !frame.videoWidth || !frame.videoHeight) {
      setNotice('Wait until the camera picture appears, then take your photo.');
      return;
    }
    const request = owner.begin();
    if (!request) return;
    captureBusy.current = true;
    setCapturing(true);
    setNotice('');
    try {
      const creatures: PhotoCreature[] = friends.map(friend => {
        const element = petElements.current.get(friend.id);
        const visual = element?.querySelector<HTMLElement>('.camera-view__appearance');
        const image = visual?.querySelector('img');
        if (!element || !visual || !image?.complete || !image.naturalWidth) throw new Error('A creature is still loading. Wait a moment, then try again.');
        const feature = visual.querySelector<SVGSVGElement>('svg');
        const transform = getComputedStyle(visual).transform;
        const matrix = transform === 'none' ? undefined : new DOMMatrixReadOnly(transform);
        return {image, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, x: element.offsetLeft, y: element.offsetTop, size: element.offsetWidth, featureSvg: feature ? serializeCreatureFeature(feature) : undefined, transform: matrix};
      });
      const result = await captureCameraPhoto({frame, sourceWidth: frame.videoWidth, sourceHeight: frame.videoHeight, viewWidth: viewport.clientWidth, viewHeight: viewport.clientHeight, creatures}, request.signal);
      if (!mounted.current || request.signal.aborted) return;
      const filename = `remybot-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
      const file = new File([result.blob], filename, {type: 'image/png'});
      const url = owner.publish(request, result.blob);
      if (!url) return;
      previewExists.current = true;
      setPreviewFailed(false);
      setPreview({url, file, width: result.width, height: result.height, shareable: canSharePhoto(file)});
      session.current?.stop();
      setNotice('Photo ready. Choose how to keep it.');
    } catch (error) {
      if (mounted.current && !request.signal.aborted) setNotice(error instanceof Error ? error.message : 'The photo could not be made. Please try again.');
    } finally {
      if (mounted.current && !request.signal.aborted) {captureBusy.current = false; setCapturing(false);}
    }
  }
  function retake() {
    ++shareGeneration.current;
    shareBusy.current = false;
    setSharing(false);
    photos.current?.clear();
    previewExists.current = false;
    setPreview(null);
    setPreviewFailed(false);
    setNotice('Photo removed. Start camera to take another.');
  }
  function savePhoto() {
    if (!preview || shareBusy.current) return;
    const generation = ++shareGeneration.current;
    // sharePhoto invokes navigator.share synchronously, before any await or render.
    const result = sharePhoto(preview.file);
    shareBusy.current = true;
    setSharing(true);
    setNotice('In the share menu, choose Save Image if available to add the photo to Photos.');
    void result.then(outcome => {
      if (!mounted.current || generation !== shareGeneration.current) return;
      if (outcome === 'cancelled') setNotice('Your photo is still here. You can share or download it when you’re ready.');
      else if (outcome === 'unavailable') setNotice('This browser cannot share image files. Download the PNG, or press and hold the photo to save it.');
    }).catch(() => {
      if (mounted.current && generation === shareGeneration.current) setNotice('The share menu could not open. Download the PNG, or press and hold the photo to save it.');
    }).finally(() => {
      if (mounted.current && generation === shareGeneration.current) {shareBusy.current = false; setSharing(false);}
    });
  }

  return <section className="camera-view" aria-label={`${name} camera view`}>
    {preview ? <>
      <div className="camera-view__photo-preview">
        <img src={preview.url} width={preview.width} height={preview.height} alt={`Your camera photo with ${friends.map(friend => friend.name).join(', ')}`} onError={() => {setPreviewFailed(true); setNotice('The photo preview could not load. Try downloading the PNG, or retake it.');}}/>
        <span className="camera-view__photo-label">PHOTO PREVIEW · CAMERA OFF</span>
      </div>
      <div className="camera-view__photo-actions">
        {preview.shareable && <button className="primary-button" disabled={sharing} onClick={savePhoto}><Share2 size={18}/>{sharing ? 'Share menu open…' : 'Share / save photo'}</button>}
        <a className="secondary-button" href={preview.url} download={preview.file.name} onClick={() => setNotice('Download requested. Check your browser’s downloads; the photo is still available here.')}><Download size={18}/>Download PNG</a>
        <button className="secondary-button" onClick={retake} disabled={sharing}><RotateCcw size={18}/>Retake</button>
      </div>
      <p className="camera-view__save-hint">{previewFailed ? 'Download the PNG to open the picture on your device.' : preview.shareable ? 'On iPad, press and hold the photo and choose Save Image if available. You can also use Share / save photo, or download the PNG.' : 'On iPad, press and hold the photo and choose Save Image if available. Or download the PNG and open it from your browser’s downloads.'}</p>
    </> : <>
      <div className={`camera-view__stage ${stream ? 'camera-view__stage--live' : ''}`} ref={stage}>
        {stream && <video className="camera-view__video" ref={video} autoPlay muted playsInline aria-label="Live camera preview" onLoadedData={() => setFrameReady(true)} onPlaying={() => {setFrameReady(true); setPlayBlocked(false);}}/>}
        <span className="camera-view__badge">{stream ? <Camera size={14}/> : <CameraOff size={14}/>} {stream ? 'CAMERA ON' : 'CAMERA OFF'}</span>
        {!stream && <p className="camera-view__invitation">{status === 'requesting' ? 'Waiting for camera permission…' : `${name}, meet the real world.`}</p>}
        {playBlocked && <button className="camera-view__resume" onClick={() => {void video.current?.play().then(() => setPlayBlocked(false)).catch(() => setNotice('The preview could not play. Stop the camera, then try again.'));}}>Show camera preview</button>}
        {friends.map(friend => {
          const placement = placementFor(friend.id);
          return <button key={friend.id} ref={element => {if (element) petElements.current.set(friend.id, element); else petElements.current.delete(friend.id);}}
            className={`camera-view__pet ${laughingId === friend.id ? 'camera-view__pet--laughing' : ''}`} style={{left: `${placement.x}%`, top: `${placement.y}%`, width: placement.size, height: placement.size}}
            onPointerDown={event => pointerDown(event, friend.id)} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => {drag.current = null;}} onLostPointerCapture={() => {drag.current = null;}}
            onKeyDown={event => moveWithKeys(event, friend.id)} onFocus={() => setSelectedId(friend.id)} onClick={event => {if (event.detail === 0) laugh(friend.id);}} disabled={capturing}
            aria-label={`Make ${friend.name} laugh. Drag or use arrow keys to move him.`}>
            <CreatureAppearance {...friend.appearance} className="camera-view__appearance"><img src={friend.spriteSrc} alt="" draggable={false}/></CreatureAppearance>
            {laughingId === friend.id && <span className="camera-view__giggle" aria-hidden="true">HEE HEE!</span>}
          </button>;
        })}
        <span className="camera-view__ground" aria-hidden="true"/>
      </div>
      <p className="camera-view__hint"><Move size={15}/> Drag each friend. Tap for a giggle.</p>
      {friends.length > 1 && <div className="camera-view__friend-tabs" role="group" aria-label="Choose a creature to resize">{friends.map(friend => <button key={friend.id} type="button" aria-pressed={selected.id === friend.id} onClick={() => setSelectedId(friend.id)} disabled={capturing}>{friend.name}</button>)}</div>}
      <div className="camera-view__adjustments">
        <label htmlFor="camera-pet-size"><span>{selected.name}’s size</span><input id="camera-pet-size" type="range" min="90" max="190" step="5" value={selectedPlacement.size} disabled={capturing} onChange={event => {const nextSize = Number(event.target.value); setPlacements(current => ({...current, [selected.id]: bounded(selectedPlacement.x, selectedPlacement.y, nextSize)}));}}/></label>
        <button type="button" aria-label={`Centre ${selected.name}`} disabled={capturing} onClick={() => setPlacements(current => ({...current, [selected.id]: {x: 50, y: 59, size: selectedPlacement.size}}))}><RotateCcw size={18}/><span>Centre</span></button>
      </div>
      <div className="camera-view__actions">
        {status === 'live' && <button className="primary-button camera-view__shutter" onClick={() => void takePhoto()} disabled={!frameReady || playBlocked || capturing}><Camera size={20}/>{capturing ? 'Making photo…' : 'Take photo'}</button>}
        {status === 'live' || status === 'requesting'
          ? <button className="secondary-button" onClick={stop}><CameraOff size={18}/>{status === 'requesting' ? 'Cancel camera' : 'Stop camera'}</button>
          : <button className="primary-button" onClick={start} disabled={!supported}><Camera size={18}/>{status === 'error' ? 'Try camera again' : 'Start camera'}</button>}
      </div>
    </>}
    <p className="camera-view__notice" role="status" aria-live="polite">{notice || (!supported && !preview ? 'Camera unavailable in this browser. You can still move and tap your friends.' : status === 'requesting' ? 'Your browser will ask to use the camera. Ask a grown-up to help.' : laughingId ? `${friends.find(friend => friend.id === laughingId)?.name ?? name}: hee hee!` : '')}</p>
    <p className="camera-view__privacy">A camera overlay; it does not track floors or surfaces. Photos are made on this device only when you tap Take photo. Nothing is uploaded by Remybot.</p>
  </section>;
}
