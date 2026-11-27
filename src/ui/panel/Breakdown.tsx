import type { ScoreResult, SectionKey } from '../../scoring/types';
import { formatNumber, reasonText, sectionLabels, strings, warningText } from '../strings';

const ORDER: SectionKey[] = ['damage', 'price', 'km', 'description'];

/** Where the score comes from, one bar per section with its reasons underneath. */
export function Breakdown({
  result,
  partLabel,
}: {
  result: ScoreResult;
  partLabel: (key: string) => string;
}) {
  return (
    <section className="card">
      <h3>{strings.breakdownTitle}</h3>
      <p className="quiet">{strings.breakdownHint}</p>
      {ORDER.map((key) => {
        const section = result.sections[key];
        const insufficient = section.warnings.includes('noReference');
        const empty = section.reasons.length === 0 && section.warnings.length === 0;
        return (
          <details key={key} className="score-section">
            <summary>
              <span>{sectionLabels[key]}</span>
              <span className="points">
                {section.points === null
                  ? insufficient
                    ? strings.insufficient
                    : '—'
                  : `${formatNumber(section.points)} / ${section.max}`}
              </span>
              <progress max={section.max} value={section.points ?? 0} />
            </summary>
            <ul>
              {section.reasons.map((reason, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: reasons have no identity and never reorder
                <li key={index}>{reasonText(reason, partLabel)}</li>
              ))}
              {section.reasons.length === 0 &&
                section.warnings.map((warning) => <li key={warning}>{warningText(warning)}</li>)}
              {empty && (
                // Full marks still need a reason.
                <li>
                  {key === 'damage'
                    ? strings.noDeductions
                    : key === 'description'
                      ? strings.noPhrases
                      : '—'}
                </li>
              )}
            </ul>
          </details>
        );
      })}
      <p className="note">{strings.askingPrice}</p>
    </section>
  );
}
