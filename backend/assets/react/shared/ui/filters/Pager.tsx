import './filters.css';
import {useId} from 'react';
import {useTranslation} from '@/shared/i18n';
import {useFormat} from '@/shared/lib';

export const PER_PAGE_OPTIONS = [25, 50, 100];

/** A server-paged list's pager: "1 – 25 of 1,240", Previous, Next and the rows per page. */
export function Pager({
  page,
  perPage,
  total,
  onPage,
  onPerPage,
  perPageOptions = PER_PAGE_OPTIONS,
}: {
  page: number;
  perPage: number;
  total: number;
  onPage: (page: number) => void;
  /** Without it, no rows-per-page choice. */
  onPerPage?: (perPage: number) => void;
  perPageOptions?: number[];
}) {
  const {t} = useTranslation();
  const {num} = useFormat();
  const id = useId();
  const pages = perPage > 0 ? Math.max(1, Math.ceil(total / perPage)) : 1;
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = perPage > 0 ? Math.min(total, page * perPage) : total;
  return (
    <nav className="kf-pager" aria-label={t('filters.pages')}>
      <span className="kf-pager__label">
        {t('filters.range', {from: num(from), to: num(to), total: num(total)})}
      </span>
      {onPerPage && (
        <label className="kf-pager__size" htmlFor={id}>
          <span className="kf-pager__size-label">{t('filters.rowsPerPage')}</span>
          <select
            id={id}
            className="custom-select custom-select-sm"
            value={perPage}
            onChange={(event) => onPerPage(Number(event.target.value))}
          >
            {perPageOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      )}
      <button
        type="button"
        className="kf-btn kf-btn--secondary kf-btn--sm"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        <span className="kf-btn__label">{t('common.previous')}</span>
      </button>
      <button
        type="button"
        className="kf-btn kf-btn--secondary kf-btn--sm"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
      >
        <span className="kf-btn__label">{t('common.next')}</span>
      </button>
    </nav>
  );
}
