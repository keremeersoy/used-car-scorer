import type { Level } from './panel/insights';

const RADIUS = 42;
const AROUND = 2 * Math.PI * RADIUS;

/** The score as a gauge; its colour is the verdict. */
export function ScoreRing({ score, level }: { score: number | null; level: Level }) {
  return (
    <svg className={`ring ${level}`} viewBox="0 0 100 100" aria-hidden="true">
      <circle className="track" cx="50" cy="50" r={RADIUS} />
      <circle
        className="value"
        cx="50"
        cy="50"
        r={RADIUS}
        strokeDasharray={`${(AROUND * (score ?? 0)) / 100} ${AROUND}`}
        transform="rotate(-90 50 50)"
      />
      <text x="50" y="52">
        {score ?? '?'}
      </text>
    </svg>
  );
}
