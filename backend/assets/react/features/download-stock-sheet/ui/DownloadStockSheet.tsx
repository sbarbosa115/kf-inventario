import {useTranslation} from '@/shared/i18n';
import {stockSheetUrl} from '../lib/stockSheetUrl';

/**
 * Update Selected Using Excel: the stock spreadsheet of the selected products, to fill in and upload. Downloaded by a
 * plain link (the session cookie authenticates it); disabled until something is selected.
 */
export function DownloadStockSheet({uuids}: {uuids: readonly string[]}) {
  const {t} = useTranslation();
  const label = (
    <>
      <i className="fas fa-archive mr-1" aria-hidden="true" />
      {t('products.sheet.download')}
    </>
  );
  return uuids.length === 0 ? (
    <button type="button" className="btn btn-sm btn-success m-1" disabled>
      {label}
    </button>
  ) : (
    <a
      className="btn btn-sm btn-success m-1"
      href={stockSheetUrl(uuids)}
      download
    >
      {label}
    </a>
  );
}
