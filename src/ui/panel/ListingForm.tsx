import { useEffect, useState, type ReactNode } from 'react';
import { editField, editPart, takePageValue, type Draft, type EditKey, type FieldKey } from '../../draft/draft';
import { config } from '../../scoring/config';
import type { PartStatus } from '../../types';
import { parsePrice, parseWholeNumber, parseYear, type ParsedNumber } from '../parse';
import {
  fieldLabels, formatNumber, heavyDamageLabels, partStatusLabels, strings,
} from '../strings';

type Change = (apply: (draft: Draft) => Draft) => void;
type NumberKey = 'price' | 'referencePrice' | 'year' | 'km' | 'damageRecordTL';
type TextKey = 'id' | 'title' | 'brand' | 'series' | 'model' | 'fuel' | 'gearbox' | 'engine';

const parsers: Record<NumberKey, (text: string) => ParsedNumber> = {
  price: parsePrice,
  referencePrice: parsePrice,
  year: parseYear,
  km: parseWholeNumber,
  damageRecordTL: parseWholeNumber,
};

function describePageValue(key: EditKey, value: unknown): string {
  if (key.startsWith('parts.')) return partStatusLabels[value as PartStatus];
  if (key === 'heavyDamage') return value ? heavyDamageLabels.yes : heavyDamageLabels.no;
  if (typeof value === 'number') return key === 'year' ? String(value) : formatNumber(value, 0);
  return String(value);
}

function Row({
  label, name, draft, current, onTake, error, hint, children,
}: {
  label: string;
  name: EditKey;
  draft: Draft;
  current: unknown;
  onTake: (name: EditKey) => void;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  const pageValue = draft.pageValues[name];
  return (
    <div className="row">
      <label>
        <span>{label}</span>
        {children}
      </label>
      {hint && <small>{hint}</small>}
      {error && <small className="error">{error}</small>}
      {pageValue !== undefined && pageValue !== current && (
        <small className="page-value">
          {strings.pageSays} {describePageValue(name, pageValue)}{' '}
          <button type="button" className="link" onClick={() => onTake(name)}>
            {strings.usePage}
          </button>
        </small>
      )}
    </div>
  );
}

function NumberInput({
  name, value, onValue, onValidity,
}: {
  name: NumberKey;
  value: number | null;
  onValue: (value: number | null) => void;
  onValidity: (valid: boolean) => void;
}) {
  // While typing, the raw text is shown; otherwise the stored value.
  const [text, setText] = useState<string | null>(null);
  const shown = value === null ? '' : name === 'year' ? String(value) : formatNumber(value, 0);
  const invalid = text !== null && !parsers[name](text).ok;
  return (
    <input
      data-field={name}
      inputMode="numeric"
      className={value === null ? 'unknown' : undefined}
      aria-invalid={invalid}
      value={text ?? shown}
      onChange={(event) => {
        const next = event.target.value;
        const parsed = parsers[name](next);
        setText(next);
        onValidity(parsed.ok);
        if (parsed.ok) onValue(parsed.value);
      }}
      onBlur={() => {
        if (!invalid) setText(null);
      }}
    />
  );
}

export function ListingForm({
  draft, onChange, onValidity,
}: {
  draft: Draft;
  onChange: Change;
  onValidity: (valid: boolean) => void;
}) {
  const { listing } = draft;
  const [invalid, setInvalid] = useState<ReadonlySet<string>>(new Set());
  // Bumped when a page value is taken, so the input drops whatever was typed in it.
  const [generation, setGeneration] = useState<Record<string, number>>({});

  useEffect(() => onValidity(invalid.size === 0), [invalid, onValidity]);

  const mark = (name: string, valid: boolean) =>
    setInvalid((previous) => {
      if (valid === !previous.has(name)) return previous;
      const next = new Set(previous);
      if (valid) next.delete(name);
      else next.add(name);
      return next;
    });

  const take = (name: EditKey) => {
    setGeneration((previous) => ({ ...previous, [name]: (previous[name] ?? 0) + 1 }));
    mark(name, true);
    onChange((current) => takePageValue(current, name));
  };

  const set = <K extends FieldKey>(key: K, value: Draft['listing'][K & keyof Draft['listing']]) =>
    onChange((current) => editField(current, key, value as never));

  const textRow = (name: TextKey) => (
    <Row label={fieldLabels[name]} name={name} draft={draft} current={listing[name]} onTake={take}>
      <input
        data-field={name}
        className={listing[name] ? undefined : 'unknown'}
        value={listing[name] ?? ''}
        onChange={(event) => {
          const value = event.target.value;
          if (name === 'id') set('id', value.trim());
          else set(name, value.trim() === '' ? null : value);
        }}
      />
    </Row>
  );

  const numberRow = (name: NumberKey, hint?: string) => (
    <Row
      label={fieldLabels[name]}
      name={name}
      draft={draft}
      current={listing[name]}
      onTake={take}
      hint={hint}
      error={invalid.has(name) ? strings.invalidNumber : undefined}
    >
      <NumberInput
        key={generation[name] ?? 0}
        name={name}
        value={listing[name]}
        onValue={(value) => set(name, value)}
        onValidity={(valid) => mark(name, valid)}
      />
    </Row>
  );

  const heavy = listing.heavyDamage === null ? 'unknown' : listing.heavyDamage ? 'yes' : 'no';

  return (
    <section className="card">
      {numberRow('referencePrice')}
      <h2>{strings.fields}</h2>
      {textRow('id')}
      {textRow('title')}
      {numberRow('price')}
      <div className="grid">
        {numberRow('year')}
        {numberRow('km')}
        {textRow('brand')}
        {textRow('series')}
        {textRow('model')}
        {textRow('engine')}
        {textRow('fuel')}
        {textRow('gearbox')}
      </div>
      <Row label={fieldLabels.heavyDamage} name="heavyDamage" draft={draft} current={listing.heavyDamage} onTake={take}>
        <select
          data-field="heavyDamage"
          className={heavy === 'unknown' ? 'unknown' : undefined}
          value={heavy}
          onChange={(event) =>
            set('heavyDamage', event.target.value === 'unknown' ? null : event.target.value === 'yes')
          }
        >
          {(['unknown', 'yes', 'no'] as const).map((option) => (
            <option key={option} value={option}>{heavyDamageLabels[option]}</option>
          ))}
        </select>
      </Row>
      {numberRow('damageRecordTL', strings.damageRecordHint)}

      <h2>{strings.parts}</h2>
      <div className="grid">
        {config.damage.parts.map(({ key, label }) => {
          const status = listing.parts[key] ?? 'unknown';
          return (
            <Row key={key} label={label} name={`parts.${key}`} draft={draft} current={status} onTake={take}>
              <select
                data-field={`parts.${key}`}
                className={status === 'unknown' ? 'unknown' : undefined}
                value={status}
                onChange={(event) =>
                  onChange((current) => editPart(current, key, event.target.value as PartStatus))
                }
              >
                {Object.entries(partStatusLabels).map(([value, text]) => (
                  <option key={value} value={value}>{text}</option>
                ))}
              </select>
            </Row>
          );
        })}
      </div>

      <Row label={fieldLabels.description} name="description" draft={draft} current={listing.description} onTake={take}>
        <textarea
          data-field="description"
          rows={5}
          className={listing.description ? undefined : 'unknown'}
          value={listing.description ?? ''}
          onChange={(event) =>
            set('description', event.target.value.trim() === '' ? null : event.target.value)
          }
        />
      </Row>
    </section>
  );
}
