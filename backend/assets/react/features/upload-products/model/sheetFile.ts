const EXTENSION = /\.(xlsx?)$/i;

/** A file the upload accepts: an Excel sheet by its name (.xls or .xlsx), as the input's accept says. */
export function isSpreadsheet(file: {name: string}): boolean {
  return EXTENSION.test(file.name);
}

/** The sheet's type as people know it: XLS or XLSX. */
export function sheetType(file: {name: string}): string {
  return (EXTENSION.exec(file.name)?.[1] ?? '').toUpperCase();
}
