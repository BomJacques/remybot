'use client';

import {useEffect, useRef, useState, type PointerEvent, type KeyboardEvent} from 'react';
import {Camera, CameraOff, Move, RotateCcw} from 'lucide-react';
import {createCameraSession, type CameraStatus} from './camera-session';
import './camera-view.css';

function cameraError(error: unknown) {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Camera access was not allowed. A grown-up can allow it in the browser’s website settings, then try again.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'There is no camera available on this device. You can still move and tap your friend here.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'The camera is busy. Close any other app using it, then try again.';
  }
  return 'The camera could not start. You can try again, or move and tap your friend here.';
}

export function CameraView({name, spriteSrc, onLaugh}: {
  name: string;
  spriteSrc: string;
  onLaugh: () => void;
}) {
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [notice, setNotice] = useState('');
  const [playBlocked, setPlayBlocked] = useState(false);
  const [position, setPosition] = useState({x: 50, y: 59});
  const [size, setSize] = useState(140);
  const [laughing, setLaughing] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const session = useRef<ReturnType<typeof createCameraSession<MediaStream>> | null>(null);
  const laughTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drag = useRef<{id: number; x: number; y: number; originX: number; originY: number; moved: boolean} | null>(null);
  const supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  useEffect(() => {
    const current = createCameraSession<MediaStream>({
      request: () => navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {facingMode: {ideal: 'environment'}, width: {ideal: 1280}, height: {ideal: 960}},
      }),
      onStream: setStream,
      onStatus: setStatus,
      onError: error => setNotice(cameraError(error)),
    });
    session.current = current;
    const pause = () => {
      current.stop();
      setNotice('Camera stopped. Tap Start camera when you’re ready.');
    };
    const hidden = () => { if (document.visibilityState === 'hidden') pause(); };
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', pause);
    return () => {
      current.dispose();
      session.current = null;
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('pagehide', pause);
      if (laughTimer.current) clearTimeout(laughTimer.current);
    };
  }, []);

  useEffect(() => {
    const element = video.current;
    if (!element || !stream) return;
    let cancelled = false;
    element.srcObject = stream;
    setPlayBlocked(false);
    void element.play().catch(() => { if (!cancelled) setPlayBlocked(true); });
    const ended = () => {
      session.current?.stop();
      setNotice('The camera stopped. You can start it again.');
    };
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
    if (!supported) {
      setNotice('This browser cannot open a camera. Try Safari on your iPad, or play with your friend here.');
      return;
    }
    void session.current?.start();
  }
  function stop() {
    session.current?.stop();
    setNotice('Camera stopped.');
  }
  function laugh() {
    if (laughTimer.current) clearTimeout(laughTimer.current);
    setLaughing(true);
    laughTimer.current = setTimeout(() => setLaughing(false), 1200);
    onLaugh();
  }
  function bounded(x: number, y: number, nextSize = size) {
    const rect = stage.current?.getBoundingClientRect();
    const marginX = rect ? Math.min(50, (nextSize / 2 + 12) / rect.width * 100) : 30;
    const marginY = rect ? Math.min(50, (nextSize / 2 + 12) / rect.height * 100) : 35;
    return {x: Math.max(marginX, Math.min(100 - marginX, x)), y: Math.max(marginY, Math.min(100 - marginY, y))};
  }
  function pointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {id: event.pointerId, x: event.clientX, y: event.clientY, originX: position.x, originY: position.y, moved: false};
  }
  function pointerMove(event: PointerEvent<HTMLButtonElement>) {
    const gesture = drag.current;
    const rect = stage.current?.getBoundingClientRect();
    if (!gesture || gesture.id !== event.pointerId || !rect) return;
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    if (Math.hypot(dx, dy) > 8) gesture.moved = true;
    if (gesture.moved) setPosition(bounded(gesture.originX + dx / rect.width * 100, gesture.originY + dy / rect.height * 100));
  }
  function pointerUp(event: PointerEvent<HTMLButtonElement>) {
    const gesture = drag.current;
    if (!gesture || gesture.id !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!gesture.moved) laugh();
  }
  function moveWithKeys(event: KeyboardEvent<HTMLButtonElement>) {
    const offset: Record<string, [number, number]> = {ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, -5], ArrowDown: [0, 5]};
    if (!offset[event.key]) return;
    event.preventDefault();
    const [dx, dy] = offset[event.key];
    setPosition(current => bounded(current.x + dx, current.y + dy));
  }

  return <section className="camera-view" aria-label={`${name} camera view`}>
    <div className={`camera-view__stage ${stream ? 'camera-view__stage--live' : ''}`} ref={stage}>
      {stream && <video className="camera-view__video" ref={video} autoPlay muted playsInline aria-label="Live camera preview"/>}
      <span className="camera-view__badge">{stream ? <Camera size={14}/> : <CameraOff size={14}/>} {stream ? 'CAMERA ON' : 'CAMERA OFF'}</span>
      {!stream && <p className="camera-view__invitation">{status === 'requesting' ? 'Waiting for camera permission…' : `${name}, meet the real world.`}</p>}
      {playBlocked && <button className="camera-view__resume" onClick={() => {
        void video.current?.play().then(() => setPlayBlocked(false)).catch(() => setNotice('The preview could not play. Stop the camera, then try again.'));
      }}>Show camera preview</button>}
      <button className={`camera-view__pet ${laughing ? 'camera-view__pet--laughing' : ''}`} style={{left: `${position.x}%`, top: `${position.y}%`, width: size, height: size}}
        onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => {drag.current = null;}}
        onLostPointerCapture={() => {drag.current = null;}} onKeyDown={moveWithKeys} onClick={event => {if (event.detail === 0) laugh();}}
        aria-label={`Make ${name} laugh. Drag or use arrow keys to move him.`}>
        <img src={spriteSrc} alt="" draggable={false}/>
        {laughing && <span className="camera-view__giggle" aria-hidden="true">HEE HEE!</span>}
      </button>
      <span className="camera-view__ground" aria-hidden="true"/>
    </div>
    <p className="camera-view__hint"><Move size={15}/> Drag to move him. Tap for a giggle.</p>
    <div className="camera-view__adjustments">
      <label htmlFor="camera-pet-size">Creature size<input id="camera-pet-size" type="range" min="90" max="190" step="10" value={size} onChange={event => {
        const nextSize = Number(event.target.value);
        setSize(nextSize);
        setPosition(current => bounded(current.x, current.y, nextSize));
      }}/></label>
      <button type="button" aria-label="Centre creature" onClick={() => setPosition({x: 50, y: 59})}><RotateCcw size={18}/><span>Centre</span></button>
    </div>
    <div className="camera-view__actions">
      {status === 'live' || status === 'requesting'
        ? <button className="secondary-button" onClick={stop}><CameraOff size={18}/>{status === 'requesting' ? 'Cancel camera' : 'Stop camera'}</button>
        : <button className="primary-button" onClick={start} disabled={!supported}><Camera size={18}/>{status === 'error' ? 'Try camera again' : 'Start camera'}</button>}
    </div>
    <p className="camera-view__notice" role="status" aria-live="polite">{notice || (!supported ? 'Camera unavailable in this browser. You can still move and tap your friend.' : status === 'requesting' ? 'Your browser will ask to use the camera. Ask a grown-up to help.' : laughing ? `${name}: hee hee!` : '')}</p>
    <p className="camera-view__privacy">A camera overlay: move your friend into place. It does not track floors or surfaces. Camera stays on this device; nothing is recorded or uploaded.</p>
  </section>;
}
