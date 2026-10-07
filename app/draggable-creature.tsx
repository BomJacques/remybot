'use client';

import {useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode} from 'react';
import './draggable-creature.css';

type Position = {x: number; y: number};
type Gesture = {id: number; x: number; y: number; origin: Position; moved: boolean};

/** Wrap the existing Sprite inside its .creature-stage; the sprite keeps its own animations. */
export function DraggableCreature({name, children, onTap, disabled = false, resetKey}: {
  name: string;
  children: ReactNode;
  onTap: () => void;
  disabled?: boolean;
  /** Change on adoption, form change, cocoon/egg transitions, or nap to centre the creature. */
  resetKey: string | number;
}) {
  const [position, setPosition] = useState<Position>({x: 0, y: 0});
  const [dragging, setDragging] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const suppressClick = useRef(false);
  const instructionsId = useId();

  function bounded(next: Position): Position {
    const element = anchor.current;
    const stage = element?.closest('.creature-stage') ?? element?.parentElement;
    if (!element || !stage) return {x: 0, y: 0};
    // The anchor never moves, so every gesture uses the same untransformed centre.
    const origin = element.getBoundingClientRect();
    const area = stage.getBoundingClientRect();
    const clampAxis = (value: number, min: number, max: number) => min > max
      ? (min + max) / 2
      : Math.max(min, Math.min(max, value));
    const margin = 8;
    return {
      x: clampAxis(next.x, area.left + margin - origin.left, area.right - margin - origin.right),
      y: clampAxis(next.y, area.top + margin - origin.top, area.bottom - margin - origin.bottom),
    };
  }

  function releaseCapture(id: number) {
    const element = button.current;
    if (element?.hasPointerCapture(id)) element.releasePointerCapture(id);
  }

  function cancelGesture() {
    const active = gesture.current;
    gesture.current = null;
    if (active) {
      suppressClick.current = true;
      releaseCapture(active.id);
    }
    setDragging(false);
  }

  useLayoutEffect(() => {
    cancelGesture();
    setPosition(bounded({x: 0, y: 0}));
  }, [resetKey]);

  useLayoutEffect(() => {
    if (disabled) cancelGesture();
  }, [disabled]);

  useLayoutEffect(() => {
    const element = anchor.current;
    const stage = element?.closest('.creature-stage') ?? element?.parentElement;
    if (!element || !stage) return;
    const resize = () => {
      cancelGesture();
      setPosition(previous => {
        const next = bounded(previous);
        return next.x === previous.x && next.y === previous.y ? previous : next;
      });
    };
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    observer?.observe(stage);
    observer?.observe(element);
    window.addEventListener('resize', resize);
    window.addEventListener('blur', cancelGesture);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('blur', cancelGesture);
    };
  }, []);

  function pointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (disabled || !event.isPrimary || event.button !== 0) return;
    suppressClick.current = false;
    gesture.current = {id: event.pointerId, x: event.clientX, y: event.clientY, origin: position, moved: false};
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function pointerMove(event: PointerEvent<HTMLButtonElement>) {
    const active = gesture.current;
    if (disabled || !active || active.id !== event.pointerId) return;
    const dx = event.clientX - active.x;
    const dy = event.clientY - active.y;
    if (Math.hypot(dx, dy) > 7) active.moved = true;
    if (!active.moved) return;
    suppressClick.current = true;
    setPosition(bounded({x: active.origin.x + dx, y: active.origin.y + dy}));
  }

  function pointerUp(event: PointerEvent<HTMLButtonElement>) {
    const active = gesture.current;
    if (!active || active.id !== event.pointerId) return;
    // A captured pointer still emits a click after being dragged. Consume that click.
    suppressClick.current = active.moved;
    gesture.current = null;
    setDragging(false);
    releaseCapture(event.pointerId);
  }

  function moveWithKeys(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    const step = event.shiftKey ? 32 : 16;
    const directions: Record<string, Position> = {
      ArrowLeft: {x: -step, y: 0}, ArrowRight: {x: step, y: 0},
      ArrowUp: {x: 0, y: -step}, ArrowDown: {x: 0, y: step},
    };
    if (event.key === 'Home') {
      event.preventDefault();
      cancelGesture();
      setPosition(bounded({x: 0, y: 0}));
    } else if (directions[event.key]) {
      event.preventDefault();
      cancelGesture();
      const direction = directions[event.key];
      setPosition(previous => bounded({x: previous.x + direction.x, y: previous.y + direction.y}));
    }
  }

  return <div className="draggable-creature-anchor" ref={anchor}>
    <button
      type="button"
      className={`draggable-creature ${dragging ? 'is-dragging' : ''}`}
      ref={button}
      style={{transform: `translate(${position.x}px, ${position.y}px)`}}
      disabled={disabled}
      aria-label={`Make ${name} laugh`}
      aria-describedby={instructionsId}
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerCancel={cancelGesture}
      onLostPointerCapture={() => {if (gesture.current) cancelGesture();}}
      onKeyDown={moveWithKeys}
      onClick={event => {
        if (disabled) return;
        if (event.detail !== 0 && suppressClick.current) {
          suppressClick.current = false;
          event.preventDefault();
          return;
        }
        onTap();
      }}
    >{children}</button>
    <span id={instructionsId} className="draggable-creature-instructions">Drag to move. Use arrow keys to move, Home to return to the centre, or Enter to make him laugh.</span>
  </div>;
}
