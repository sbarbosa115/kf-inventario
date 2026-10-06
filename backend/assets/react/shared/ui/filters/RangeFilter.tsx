import {useEffect, useState} from 'react';
import {useTranslation} from '@/shared/i18n';
import {useFormat} from '@/shared/lib';
import type {NumberRangeValue} from '@/shared/api';
import {FilterPopover} from './FilterPopover';

export type RangeKind = 'money' | 'number';

interface QuickPick {
  key: string;
  label: string;
  value: Required<NumberRangeValue> | {min?: string; max?: string};
}

/** The quick ranges: "Under $100", "$100 – $500", "Over $500" for money; "0", "1 – 10", "Over 10" for quantities. */
export function useQuickRanges(kind: RangeKind): QuickPick[] {
  const {t} = useTranslation();
  const {money, num} = useFormat();
  const show = (n: number) =>
    kind === 'money' ? money(n).replace(/[.,]00(?=\D*$)/, '') : num(n);
  if (kind === 'money') {
    return [
      {
        key: 'u100',
        label: t('filters.under', {amount: show(100)}),
        value: {max: '99.99'},
      },
      {
        key: '100-500',
        label: t('filters.between', {from: show(100), to: show(500)}),
        value: {min: '100', max: '500'},
      },
      {
        key: 'o500',
        label: t('filters.over', {amount: show(500)}),
        value: {min: '500.01'},
      },
    ];
  }
  return [
    {key: '0', label: show(0), value: {min: '0', max: '0'}},
    {
      key: '1-10',
      label: t('filters.between', {from: show(1), to: show(10)}),
      value: {min: '1', max: '10'},
    },
    {
      key: 'o10',
      label: t('filters.over', {amount: show(10)}),
      value: {min: '11'},
    },
  ];
}

/** "$100 – $500", "Over $500", "Under 10"… or null for no range. */
export function useDescribeRange(
  kind: RangeKind,
): (value: NumberRangeValue) => string | null {
  const {t} = useTranslation();
  const {money, num} = useFormat();
  const quick = useQuickRanges(kind);
  const show = (text: string) =>
    kind === 'money' ? money(Number(text)) : num(Number(text));
  return (value) => {
    const pick = quick.find(
      (q) =>
        (q.value.min ?? '') === (value.min ?? '') &&
        (q.value.max ?? '') === (value.max ?? ''),
    );
    if (pick) return pick.label;
    if (value.min && value.max) {
      return t('filters.between', {from: show(value.min), to: show(value.max)});
    }
    if (value.min) return t('filters.since', {from: show(value.min)});
    if (value.max) return t('filters.until', {to: show(value.max)});
    return null;
  };
}

/** Min and max inputs and the quick ranges. A typed number applies when the input loses the focus or on Enter. */
export function RangeFields({
  label,
  kind,
  value,
  onChange,
}: {
  label: string;
  kind: RangeKind;
  value: NumberRangeValue;
  onChange: (value: NumberRangeValue) => void;
}) {
  const {t} = useTranslation();
  const quick = useQuickRanges(kind);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = (next: NumberRangeValue) => {
    if (
      (next.min ?? '') !== (value.min ?? '') ||
      (next.max ?? '') !== (value.max ?? '')
    ) {
      onChange(next);
    }
  };
  const input = (part: 'min' | 'max') => (
    <label className="kf-filter-field">
      <span className="kf-filter-field__label">{t(`filters.${part}`)}</span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step={kind === 'money' ? '0.01' : '1'}
        className="form-control"
        value={draft[part] ?? ''}
        onChange={(event) => setDraft({...draft, [part]: event.target.value})}
        onBlur={() => commit(draft)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit(draft);
          }
        }}
      />
    </label>
  );
  return (
    <div className="kf-filter-range" role="group" aria-label={label}>
      <div className="kf-filter-quick">
        {quick.map((pick) => {
          const on =
            (pick.value.min ?? '') === (value.min ?? '') &&
            (pick.value.max ?? '') === (value.max ?? '');
          return (
            <button
              key={pick.key}
              type="button"
              className="kf-chip"
              aria-pressed={on}
              onClick={() => onChange(on ? {} : pick.value)}
            >
              {pick.label}
            </button>
          );
        })}
      </div>
      <div className="kf-filter-range__fields">
        {input('min')}
        {input('max')}
      </div>
    </div>
  );
}

/** A money or number column's filter in the filter row: a button with the range opening the fields. */
export function RangeFilter({
  label,
  kind,
  value,
  onChange,
}: {
  label: string;
  kind: RangeKind;
  value: NumberRangeValue;
  onChange: (value: NumberRangeValue) => void;
}) {
  const {t} = useTranslation();
  const describe = useDescribeRange(kind);
  const text = describe(value);
  return (
    <FilterPopover
      label={text ? t('filters.chip', {label, value: text}) : label}
      active={text !== null}
    >
      <div className="kf-filter-panel">
        <RangeFields
          label={label}
          kind={kind}
          value={value}
          onChange={onChange}
        />
        <div className="kf-filter-panel__footer">
          <button
            type="button"
            className="kf-btn kf-btn--ghost kf-btn--sm"
            disabled={text === null}
            onClick={() => onChange({})}
          >
            <span className="kf-btn__label">{t('filters.clearOne')}</span>
          </button>
        </div>
      </div>
    </FilterPopover>
  );
}
