/**
 * A code read so far. The quantity stays the text in its box while it is edited (it may be half typed); `exists` is
 * null while the product is being checked.
 */
export interface ScannedLine {
  code: string;
  quantity: string;
  exists: boolean | null;
}

/** Reading a code that is already listed raises its quantity by one; a new one starts at 1, still unchecked. */
export function readCode(lines: ScannedLine[], code: string): ScannedLine[] {
  if (lines.some((line) => line.code === code)) {
    return lines.map((line) =>
      line.code === code
        ? {...line, quantity: String((Number(line.quantity) || 0) + 1)}
        : line,
    );
  }
  return [...lines, {code, quantity: '1', exists: null}];
}

export function setExists(
  lines: ScannedLine[],
  code: string,
  exists: boolean,
): ScannedLine[] {
  return lines.map((line) => (line.code === code ? {...line, exists} : line));
}

export function setQuantity(
  lines: ScannedLine[],
  code: string,
  quantity: string,
): ScannedLine[] {
  return lines.map((line) => (line.code === code ? {...line, quantity} : line));
}

/** A whole number of 1 or more. */
export function isValidQuantity(text: string): boolean {
  return /^[1-9]\d*$/.test(text.trim());
}
