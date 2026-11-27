import { type ReactNode, useEffect, useState } from 'react';
import {
  type Draft,
  type EditKey,
  editField,
  editPart,
  type FieldKey,
  takePageValue,
} from '../../draft/draft';
import { config } from '../../scoring/config';
import type { PartStatus } from '../../types';
import { CarDiagram, STATUS_MARKS } from '../CarDiagram';
import { type ParsedNumber, parsePrice, parseWholeNumber, parseYear } from '../parse';
import {
  fieldLabels,
  formatNumber,
  heavyDamageLabels,
  partStatusLabels,
  strings,
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
  label,
  name,
  draft,
  current,
  onTake,
  error,
  hint,
  children,
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
      {/* biome-ignore lint/a11y/noLabelWithoutControl: the control is passed in as children */}
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
  name,
  value,
  onValue,
  onValidity,
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
  draft,
  onChange,
  onValidity,
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

  const [selected, setSelected] = useState<string | null>(null);
  // Open from the start when something needed for a score or a save is blank.
  const [open, setOpen] = useState(
    () =>
      listing.id === '' || listing.price === null || listing.year === null || listing.km === null,
  );

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

  const status = selected ? (listing.parts[selected] ?? 'unknown') : null;
  const selectedPart = config.damage.parts.find((part) => part.key === selected);
  const changedParts = config.damage.parts.filter(
    ({ key }) => draft.pageValues[`parts.${key}`] !== undefined,
  );

  return (
    <>
      <section className="card">
        <h3>{strings.extraTitle}</h3>
        <p className="quiet">{strings.extraHint}</p>
        {numberRow('damageRecordTL', strings.damageRecordHint)}
        {listing.damageRecordTL === null && (
          <button
            type="button"
            className="link"
            data-action="no-record"
            onClick={() => {
              setGeneration((g) => ({ ...g, damageRecordTL: (g.damageRecordTL ?? 0) + 1 }));
              mark('damageRecordTL', true);
              set('damageRecordTL', 0);
            }}
          >
            {strings.noRecordAction}
          </button>
        )}
        <Row
          label={fieldLabels.heavyDamage}
          name="heavyDamage"
          draft={draft}
          current={listing.heavyDamage}
          onTake={take}
        >
          <select
            data-field="heavyDamage"
            className={heavy === 'unknown' ? 'unknown' : undefined}
            value={heavy}
            onChange={(event) =>
              set(
                'heavyDamage',
                event.target.value === 'unknown' ? null : event.target.value === 'yes',
              )
            }
          >
            {(['unknown', 'yes', 'no'] as const).map((option) => (
              <option key={option} value={option}>
                {heavyDamageLabels[option]}
              </option>
            ))}
          </select>
        </Row>
        {numberRow('referencePrice', strings.referenceHint)}
      </section>

      <section className="card">
        <label className="note-field">
          <h3>{fieldLabels.note}</h3>
          <textarea
            data-field="note"
            rows={3}
            maxLength={2000}
            placeholder={strings.noteHint}
            value={listing.note ?? ''}
            onChange={(event) =>
              set('note', event.target.value.trim() === '' ? null : event.target.value)
            }
          />
        </label>
      </section>

      <section className="card">
        <h3>{strings.bodyTitle}</h3>
        <p className="quiet">{strings.bodyHint}</p>
        <div className="body-view">
          <CarDiagram parts={listing.parts} selected={selected} onSelect={setSelected} />
          <ul className="legend">
            {Object.entries(partStatusLabels).map(([value, text]) => (
              <li key={value} className={value}>
                <span className="swatch">{STATUS_MARKS[value as PartStatus]}</span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        {selectedPart && status && (
          <fieldset className="picker">
            <legend>{selectedPart.label}</legend>
            {Object.entries(partStatusLabels).map(([value, text]) => (
              <button
                key={value}
                type="button"
                data-status={value}
                aria-pressed={status === value}
                onClick={() =>
                  onChange((current) => editPart(current, selectedPart.key, value as PartStatus))
                }
              >
                {text}
              </button>
            ))}
          </fieldset>
        )}
        {changedParts.map(({ key, label }) => {
          const pageValue = draft.pageValues[`parts.${key}`];
          if (pageValue === (listing.parts[key] ?? 'unknown')) return null;
          return (
            <small key={key} className="page-value">
              {label}. {strings.pageSays} {partStatusLabels[pageValue as PartStatus]}{' '}
              <button type="button" className="link" onClick={() => take(`parts.${key}`)}>
                {strings.usePage}
              </button>
            </small>
          );
        })}
      </section>

      <details
        className="card all-fields"
        open={open}
        onToggle={(event) => setOpen(event.currentTarget.open)}
      >
        <summary>{strings.allFields}</summary>
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
        <Row
          label={fieldLabels.description}
          name="description"
          draft={draft}
          current={listing.description}
          onTake={take}
        >
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
      </details>
    </>
  );
}
