import type { ParsedTaskLine, TaskLineMatch } from "../types";
import { resolveDateToken, type DateContext } from "./date";

const ID_RE = /(?:<!--\s*sp-id:|%%\s*sp-id:)([\w-]+)(?:\s*-->|%%)/i;
const CHECKBOX_RE = /^(\s*)[-*+]\s+\[([ xX])\]\s+(.*)$/;
const TOKEN_RE = /(?:\+([^\s+%#@]+)|%([^\s+%#@]+)|#([^\s+%#@]+)|@((?:(?:next|proxima|próxima)\s+)?(?:today|tomorrow|amanha|amanhã|yesterday|ontem|week|semana|[a-zà-ú]+|\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}))|\b(\d+(?:\.\d+)?)\s*(m|min|h|hora|horas|d|dia|dias)\b)/gi;

export function parseTaskText(text: string, context: DateContext = {}): ParsedTaskLine {
  let title = text.replace(ID_RE, "").trim();
  let projectName: string | undefined;
  const tagNames: string[] = [];
  let dueDate: string | undefined;
  let estimateMinutes: number | undefined;

  // Obsidian Tasks uses 📅 YYYY-MM-DD for due dates. Keep the note syntax intact
  // while translating the date to the Local REST API's dueDay field.
  const tasksDate = title.match(/(?:📅|⏳)\s*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/u);
  if (tasksDate) {
    dueDate = resolveDateToken(tasksDate[1], context);
    title = title.replace(tasksDate[0], " ");
  }

  title = title.replace(TOKEN_RE, (token, project, percentTag, hashTag, date, amount, unit) => {
    if (project) projectName = project;
    if (percentTag || hashTag) tagNames.push(percentTag || hashTag);
    if (date) dueDate = resolveDateToken(date, context);
    if (amount) {
      const numeric = Number(amount);
      const normalizedUnit = String(unit).toLowerCase();
      estimateMinutes = normalizedUnit.startsWith("h") || normalizedUnit.startsWith("hora") ? Math.round(numeric * 60) : normalizedUnit.startsWith("d") ? Math.round(numeric * 8 * 60) : Math.round(numeric);
    }
    return " ";
  }).replace(/\s{2,}/g, " ").trim();

  return { title, projectName, tagNames, dueDate, estimateMinutes, existingId: text.match(ID_RE)?.[1] };
}

export function parseCheckboxLine(line: string, context: DateContext = {}): TaskLineMatch | undefined {
  const match = line.match(CHECKBOX_RE);
  if (!match) return undefined;
  const [, indent, marker, text] = match;
  return {
    checked: marker.toLowerCase() === "x",
    text,
    start: indent.length,
    end: line.length,
    indent,
    marker,
    parsed: parseTaskText(text, context),
  };
}

export function buildTaskLine(input: ParsedTaskLine, checked = false): string {
  const metadata = [input.projectName && `+${input.projectName}`, ...input.tagNames.map((tag) => `%${tag}`), input.dueDate && `@${input.dueDate}`, input.estimateMinutes && `${input.estimateMinutes}m`].filter(Boolean).join(" ");
  return `- [${checked ? "x" : " "}] ${input.title}${metadata ? ` ${metadata}` : ""}`;
}
