// The answer first: which car, how good, and why.
import type { ScoreResult } from '../../scoring/types';
import type { Listing } from '../../types';
import { ScoreRing } from '../ScoreRing';
import {
  factList,
  fieldLabels,
  formatMoney,
  sectionLabels,
  strings,
  verdictText,
} from '../strings';
import type { Finding, Level } from './insights';

const MARKS = { bad: '!', warn: '!', good: '✓' };
const missingLabels = { price: sectionLabels.price, km: fieldLabels.km, year: fieldLabels.year };

export function Summary({
  listing,
  result,
  level,
}: {
  listing: Omit<Listing, 'savedAt'>;
  result: ScoreResult;
  level: Level;
}) {
  const heavy = result.warnings.includes('heavyDamage');
  const facts = factList(listing);
  return (
    <section className="summary card">
      <h1>{listing.title ?? strings.untitled}</h1>
      {facts.length > 0 && (
        <ul className="facts">
          {facts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      )}
      <p className="price">{listing.price ? formatMoney(listing.price) : '—'}</p>
      <div className={`verdict ${level}`}>
        <ScoreRing score={result.total} level={level} />
        <div>
          <h2>{verdictText[level].title}</h2>
          <p>
            {heavy ? `${strings.heavyNote} ` : ''}
            {verdictText[level].note}
          </p>
          <p className="score-line" data-testid="total">
            {result.total === null
              ? `${strings.missingForTotal} ${result.missing.map((f) => missingLabels[f]).join(', ')}`
              : `100 üzerinden ${result.total} puan`}
          </p>
        </div>
      </div>
    </section>
  );
}

function List({ items }: { items: Finding[] }) {
  return (
    <ul className="findings">
      {items.map((finding) => (
        <li key={`${finding.text}${finding.detail ?? ''}`} className={finding.tone}>
          <span className="mark" aria-hidden="true">
            {MARKS[finding.tone]}
          </span>
          <div>
            <span>{finding.text}</span>
            {finding.detail && <q>{finding.detail}</q>}
          </div>
          {finding.cost ? <span className="cost">−{Math.round(finding.cost)}</span> : null}
        </li>
      ))}
    </ul>
  );
}

export function Findings({ findings, missing }: { findings: Finding[]; missing: string[] }) {
  const problems = findings.filter((f) => f.tone !== 'good');
  const good = findings.filter((f) => f.tone === 'good');
  return (
    <section className="card">
      <h3>{strings.watchOut}</h3>
      {problems.length > 0 ? (
        <List items={problems} />
      ) : (
        <p className="quiet">{strings.nothingToWatch}</p>
      )}
      {missing.length > 0 && (
        <>
          <h3>{strings.missingTitle}</h3>
          <ul className="missing">
            {missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      )}
      {good.length > 0 && (
        <>
          <h3>{strings.goodSides}</h3>
          <List items={good} />
        </>
      )}
    </section>
  );
}
