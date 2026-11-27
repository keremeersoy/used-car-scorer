// A top view of the car, front at the top: the site's paint diagram, readable at a glance.
import { useId } from 'react';
import { config } from '../scoring/config';
import type { PartStatus } from '../types';
import { partStatusLabels, strings } from './strings';

type Box = [x: number, y: number, width: number, height: number, radius: number];

const BOXES: Record<string, Box> = {
  frontBumper: [48, 6, 104, 22, 11],
  hood: [62, 32, 76, 72, 10],
  leftFrontFender: [28, 34, 30, 70, 10],
  rightFrontFender: [142, 34, 30, 70, 10],
  leftFrontDoor: [28, 108, 30, 68, 4],
  rightFrontDoor: [142, 108, 30, 68, 4],
  leftRearDoor: [28, 180, 30, 64, 4],
  rightRearDoor: [142, 180, 30, 64, 4],
  roof: [62, 128, 76, 102, 8],
  leftRearFender: [28, 248, 30, 66, 10],
  rightRearFender: [142, 248, 30, 66, 10],
  trunk: [62, 254, 76, 60, 10],
  rearBumper: [48, 318, 104, 22, 11],
};

/** A letter on each panel, so the state never depends on colour alone. */
export const STATUS_MARKS: Record<PartStatus, string> = {
  original: '',
  localPaint: 'L',
  painted: 'B',
  replaced: 'D',
  unknown: '?',
};

export function CarDiagram({
  parts,
  selected,
  onSelect,
}: {
  parts: Record<string, PartStatus>;
  selected?: string | null;
  onSelect?: (part: string) => void;
}) {
  const hatch = useId();
  return (
    <svg
      className={onSelect ? 'car editable' : 'car'}
      viewBox="0 0 200 346"
      aria-label={strings.bodyTitle}
    >
      <title>{strings.bodyTitle}</title>
      <defs>
        <pattern id={hatch} width="6" height="6" patternUnits="userSpaceOnUse">
          <path d="M-1 7 7 -1" className="hatch" />
        </pattern>
      </defs>
      {[44, 250].map((y) => (
        <g key={y} className="wheel">
          <rect x="14" y={y} width="12" height="48" rx="5" />
          <rect x="174" y={y} width="12" height="48" rx="5" />
        </g>
      ))}
      <path className="glass" d="M66 108h68l-4 16H70z" />
      <path className="glass" d="M70 234h60l4 16H66z" />
      {config.damage.parts.map(({ key, label }) => {
        const box = BOXES[key];
        if (!box) return null;
        const [x, y, width, height, radius] = box;
        const status = parts[key] ?? 'unknown';
        const name = `${label}: ${partStatusLabels[status]}`;
        const select = onSelect && (() => onSelect(key));
        return (
          // biome-ignore lint/a11y/noStaticElementInteractions: it is a button when it can be chosen
          <g
            key={key}
            data-part={key}
            data-value={status}
            className={`panel ${status}${selected === key ? ' selected' : ''}`}
            role={select ? 'button' : undefined}
            tabIndex={select ? 0 : undefined}
            aria-label={select ? name : undefined}
            onClick={select}
            onKeyDown={(event) => {
              if (select && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                select();
              }
            }}
          >
            <title>{name}</title>
            <rect x={x} y={y} width={width} height={height} rx={radius} />
            {status === 'unknown' && (
              <rect x={x} y={y} width={width} height={height} rx={radius} fill={`url(#${hatch})`} />
            )}
            <text x={x + width / 2} y={y + height / 2}>
              {STATUS_MARKS[status]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
