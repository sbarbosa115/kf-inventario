import {stockSheetUrl} from './stockSheetUrl';

/** Starts the download of these products' stock sheet from a menu item (a link click that leaves the page alone). */
export function downloadStockSheet(uuids: readonly string[]): void {
  const link = document.createElement('a');
  link.href = stockSheetUrl(uuids);
  link.download = '';
  document.body.appendChild(link);
  link.click();
  link.remove();
}
