/** The API's 422 body (`violations: [{field, message}]`, the messages already translated) as {field: message}. */
export function violationMessages(body: unknown): Record<string, string> {
  const violations =
    (body as {violations?: {field: string; message: string}[]} | null)
      ?.violations ?? [];
  const messages: Record<string, string> = {};
  for (const {field, message} of violations) {
    // A list item ("cc[0]", "cc.0") is shown on its list's field.
    const key = field.replace(/(\[\d+\]|\.\d+)$/, '');
    messages[key] ??= message;
  }
  return messages;
}

/** A deliberately plain check (one @, no spaces): the server's validator has the last word. */
export const isEmailAddress = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
