/** Where the by-code lookup of a line stands: still asking, a product, not a product, or the lookup failed. */
export type Lookup = 'checking' | 'found' | 'missing' | 'failed';

/**
 * A code read so far, newest first. The quantity stays the text in its box while it is edited (it may be half
 * typed); the title arrives with the lookup.
 */
export interface ScannedLine {
  code: string;
  quantity: string;
  lookup: Lookup;
  title: string | null;
  /** How many times it was read: changes on every read, so the row flashes again. */
  reads: number;
}

export type ScanMode = 'add' | 'remove';

const count = (line: ScannedLine) => Number(line.quantity) || 0;

/** Reading a code moves its line to the top with one more; a new one starts at 1, still being checked. */
export function readCode(lines: ScannedLine[], code: string): ScannedLine[] {
  const known = lines.find((line) => line.code === code);
  const line: ScannedLine = known
    ? {...known, quantity: String(count(known) + 1), reads: known.reads + 1}
    : {code, quantity: '1', lookup: 'checking', title: null, reads: 1};
  return [line, ...lines.filter((other) => other.code !== code)];
}

/** Takes back one read of the code: one less, and the line goes when nothing is left. */
export function unreadCode(lines: ScannedLine[], code: string): ScannedLine[] {
  return lines.flatMap((line) => {
    if (line.code !== code) return [line];
    const left = count(line) - 1;
    return left > 0 ? [{...line, quantity: String(left)}] : [];
  });
}

export function setLookup(
  lines: ScannedLine[],
  code: string,
  lookup: Lookup,
  title: string | null = null,
): ScannedLine[] {
  return lines.map((line) =>
    line.code === code ? {...line, lookup, title} : line,
  );
}

export function setQuantity(
  lines: ScannedLine[],
  code: string,
  quantity: string,
): ScannedLine[] {
  return lines.map((line) => (line.code === code ? {...line, quantity} : line));
}

/** The stepper: one more or one less, never under 1 (the × takes a line out). */
export function stepQuantity(
  lines: ScannedLine[],
  code: string,
  delta: 1 | -1,
): ScannedLine[] {
  return lines.map((line) =>
    line.code === code
      ? {...line, quantity: String(Math.max(1, count(line) + delta))}
      : line,
  );
}

export function removeLine(
  lines: ScannedLine[],
  code: string,
): ScannedLine[] {
  return lines.filter((line) => line.code !== code);
}

/** A whole number of 1 or more. */
export function isValidQuantity(text: string): boolean {
  return /^[1-9]\d*$/.test(text.trim());
}

/** What is sent: every line but the codes that are not products (they never block the others). */
export function linesToSend(lines: ScannedLine[]): ScannedLine[] {
  return lines.filter((line) => line.lookup !== 'missing');
}

/** The footer's figures over the lines sent: how many products, how many units. */
export function totals(lines: ScannedLine[]): {
  products: number;
  units: number;
} {
  const sent = linesToSend(lines);
  return {
    products: sent.length,
    units: sent.reduce((sum, line) => sum + count(line), 0),
  };
}
