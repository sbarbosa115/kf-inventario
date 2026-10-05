import {useFormat} from '@/shared/lib';

type Amount = number | string | null | undefined;

const isNegative = (value: Amount) => Number(value) < 0;

/** A US dollar amount in the current language, tabular; negative in the danger colour. */
export function Money({amount}: {amount: Amount}) {
  const {money} = useFormat();
  return (
    <span className={`kf-num${isNegative(amount) ? ' kf-num--negative' : ''}`}>
      {money(amount)}
    </span>
  );
}

/** A number in the current language, tabular. */
export function Num({value}: {value: Amount}) {
  const {num} = useFormat();
  return <span className="kf-num">{num(value)}</span>;
}
