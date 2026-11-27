import type { ScoreResult, SectionKey } from '../../scoring/types';
import {
  fieldLabels, formatNumber, reasonText, sectionLabels, strings, warningText,
} from '../strings';

const ORDER: SectionKey[] = ['damage', 'price', 'km', 'description'];
const missingLabels = { price: 'Fiyat', km: fieldLabels.km, year: fieldLabels.year };

export function ScoreCard({
  result,
  partLabel,
}: {
  result: ScoreResult;
  partLabel: (key: string) => string;
}) {
  // Heavy damage goes first because it outweighs everything else.
  const warnings = [...result.warnings].sort(
    (a, b) => Number(b === 'heavyDamage') - Number(a === 'heavyDamage'),
  );

  return (
    <section className="card">
      {result.total === null ? (
        <p className="no-total" data-testid="total">
          {strings.missingForTotal} {result.missing.map((f) => missingLabels[f]).join(', ')}
        </p>
      ) : (
        <p className="total" data-testid="total">
          <strong>{result.total}</strong> / 100
        </p>
      )}

      {warnings.length > 0 && (
        <ul className="warnings">
          {warnings.map((warning) => (
            <li key={warning} className={warning === 'heavyDamage' ? 'severe' : undefined}>
              {warningText(warning)}
            </li>
          ))}
        </ul>
      )}

      {ORDER.map((key) => {
        const section = result.sections[key];
        const insufficient = section.warnings.includes('noReference');
        return (
          <details key={key}>
            <summary>
              <span>{sectionLabels[key]}</span>
              <span className="points">
                {section.points === null
                  ? insufficient
                    ? strings.insufficient
                    : '—'
                  : `${formatNumber(section.points)} / ${section.max}`}
              </span>
            </summary>
            <ul>
              {section.reasons.map((reason, index) => (
                <li key={index}>{reasonText(reason, partLabel)}</li>
              ))}
              {section.reasons.length === 0 &&
                section.warnings.map((warning) => <li key={warning}>{warningText(warning)}</li>)}
              {section.reasons.length === 0 && section.warnings.length === 0 && (
                // Full marks still need a reason.
                <li>
                  {key === 'damage' ? strings.noDeductions : key === 'description' ? strings.noPhrases : '—'}
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
