import {useTranslation} from '@/shared/i18n';
import {Button} from '@/shared/ui';
import {stockSheetUrl} from '../lib/stockSheetUrl';

/**
 * Download stock sheet: the spreadsheet of the given products, to fill in and upload. A plain link (the session
 * cookie authenticates it); it never renders without a product.
 */
export function DownloadStockSheet({uuids}: {uuids: readonly string[]}) {
  const {t} = useTranslation();
  return (
    <Button
      variant="secondary"
      size="sm"
      icon="fa-file-excel"
      href={stockSheetUrl(uuids)}
      download
    >
      {t('products.sheet.download')}
    </Button>
  );
}
