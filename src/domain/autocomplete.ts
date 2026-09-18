import type { ProjectRef, TagRef } from "../types";

export type SuggestionKind = "project" | "tag" | "date";

export interface Suggestion {
  kind: SuggestionKind;
  label: string;
  value: string;
}

export function activeToken(value: string, cursor: number): string {
  return value.slice(0, cursor).match(/\S*$/)?.[0] ?? "";
}

export function getSuggestions(value: string, cursor: number, projects: ProjectRef[], tags: TagRef[]): Suggestion[] {
  const token = activeToken(value, cursor);
  if (token.startsWith("+")) return projects.filter((project) => project.name.toLocaleLowerCase().includes(token.slice(1).toLocaleLowerCase())).slice(0, 8).map((project) => ({ kind: "project" as const, label: project.name, value: `+${project.name}` }));
  if (token.startsWith("#")) return tags.filter((tag) => tag.name.toLocaleLowerCase().includes(token.slice(1).toLocaleLowerCase())).slice(0, 8).map((tag) => ({ kind: "tag" as const, label: tag.name, value: `#${tag.name}` }));
  if (token.startsWith("@")) {
    const dateSuggestions: Suggestion[] = [
      { kind: "date" as const, label: "Today", value: "@today" },
      { kind: "date" as const, label: "Tomorrow", value: "@tomorrow" },
      { kind: "date" as const, label: "Next Monday", value: "@next monday" },
      { kind: "date" as const, label: "Next week", value: "@next week" },
    ].filter((suggestion) => suggestion.value.toLocaleLowerCase().includes(token.toLocaleLowerCase()));
    return dateSuggestions;
  }
  return [];
}

export function applySuggestion(value: string, cursor: number, suggestion: Suggestion): { value: string; cursor: number } {
  const token = activeToken(value, cursor);
  const start = cursor - token.length;
  const suffix = value.slice(cursor);
  const separator = suffix.startsWith(" ") || suffix.startsWith("\t") ? "" : " ";
  const nextValue = `${value.slice(0, start)}${suggestion.value}${separator}${suffix}`;
  return { value: nextValue, cursor: start + suggestion.value.length + separator.length };
}
