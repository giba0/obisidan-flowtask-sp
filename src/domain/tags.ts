export function normalizeTagToken(value: string): string {
  return value.replace(/^#+/, "").trim();
}
