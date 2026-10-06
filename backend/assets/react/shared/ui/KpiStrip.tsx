import type {ReactNode} from 'react';
import type {Tone} from './StatusBadge';

export interface Kpi {
  label: string;
  value: ReactNode;
  tone?: Tone;
}

/** Two to four figures computed from what the page loaded; stacked on phones. */
export function KpiStrip({items}: {items: Kpi[]}) {
  return (
    <dl className="kf-kpis">
      {items.map((item) => (
        <div
          key={item.label}
          className={`kf-kpi${item.tone ? ` kf-kpi--${item.tone}` : ''}`}
        >
          <dt className="kf-kpi__label">{item.label}</dt>
          <dd className="kf-kpi__value">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
