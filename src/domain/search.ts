export function fuzzyScore(text: string, query: string): number | undefined {
  const normalizedText = text.toLocaleLowerCase();
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return 0;
  let queryIndex = 0;
  let score = 0;
  let previousIndex = -1;
  for (const character of normalizedQuery) {
    const index = normalizedText.indexOf(character, queryIndex);
    if (index === -1) return undefined;
    score += index === previousIndex + 1 ? 3 : 1;
    previousIndex = index;
    queryIndex = index + 1;
  }
  return score + (normalizedText.startsWith(normalizedQuery) ? 4 : 0);
}
