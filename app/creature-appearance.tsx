import type {ReactNode} from 'react';
import './creature-appearance.css';

// Coordinates use the same square frame as the sprites. Each family keeps its
// silhouette; inherited pixels attach to the head, not to the surrounding LCD.
const HEADS = [
  [[112, 117], [123, 96], [105, 102], [65, 90], [62, 99]],
  [[95, 122], [112, 107], [116, 100], [102, 102], [111, 92]],
  [[84, 104], [75, 101], [71, 92], [54, 74], [54, 91]],
  [[111, 104], [107, 100], [92, 105], [61, 92], [65, 105]],
  [[126, 101], [127, 90], [128, 88], [114, 73], [113, 72]],
  [[75, 130], [73, 123], [70, 111], [74, 126], [61, 123]],
  [[80, 91], [64, 89], [61, 99], [63, 101], [78, 100]],
  [[62, 118], [58, 110], [56, 126], [58, 124], [56, 129]],
] as const;

export const appearanceNames = ['Original markings', 'A small head tuft', 'Tiny twin feelers', 'A stepped crest'] as const;

/** Put the original image sizing/animation class on this wrapper, not its img. */
export function CreatureAppearance({variant = 0, egg, stage, cocoon = false, className = '', children}: {
  variant?: number;
  egg: number;
  stage: number;
  cocoon?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const visibleVariant = !cocoon && stage > 0 && variant >= 1 && variant <= 3 ? variant : 0;
  const [x, y] = HEADS[egg]?.[Math.max(0, Math.min(4, stage - 1))] ?? HEADS[0][0];
  return <span className={`creature-appearance ${className}`} data-variant={visibleVariant}>
    {children}
    {!!visibleVariant && <svg className="creature-inherited-pixels" viewBox="0 0 226 226" aria-hidden="true" focusable="false" shapeRendering="crispEdges">
      <g transform={`translate(${x} ${y})`}>
        {visibleVariant === 1 && <path d="M-15 2V-6H-21V-14H-14V-10H-7V-23H0V-10H7V-17H14V-7H21V0H10V6H-7V2Z"/>}
        {visibleVariant === 2 && <><path d="M-14 3V-16H-20V-22H-8V-15H-7V3ZM8 3V-15H9V-22H21V-16H15V3Z"/><path className="inherited-highlight" d="M-19-21H-14V-17H-19ZM10-21H15V-17H10Z"/></>}
        {visibleVariant === 3 && <><path d="M-21 5V-5H-14V-14H-7V-23H0V-16H7V-9H14V-2H21V5Z"/><path className="inherited-highlight" d="M-6-15H0V-9H-6ZM1-8H7V-2H1Z"/></>}
      </g>
    </svg>}
  </span>;
}
