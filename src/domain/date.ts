const WEEKDAYS: Record<string, number> = {
  sun: 0,
  sunday: 0,
  dom: 0,
  domingo: 0,
  mon: 1,
  monday: 1,
  seg: 1,
  segunda: 1,
  tue: 2,
  tuesday: 2,
  ter: 2,
  terca: 2,
  quarta: 3,
  wed: 3,
  wednesday: 3,
  qua: 3,
  thu: 4,
  thursday: 4,
  qui: 4,
  quinta: 4,
  fri: 5,
  friday: 5,
  sex: 5,
  sexta: 5,
  sat: 6,
  saturday: 6,
  sab: 6,
  sabado: 6,
};

export interface DateContext {
  now?: Date;
  timeZone?: string;
}

function localParts(date: Date, timeZone: string): { year: number; month: number; day: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const weekday = WEEKDAYS[value.weekday.toLowerCase()] ?? 0;
  return { year: Number(value.year), month: Number(value.month), day: Number(value.day), weekday };
}

function isoDate(year: number, month: number, day: number): string {
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function addDays(year: number, month: number, day: number, days: number): string {
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return isoDate(result.getUTCFullYear(), result.getUTCMonth() + 1, result.getUTCDate());
}

/** Resolves user-facing date tokens to a date-only value in the requested timezone. */
export function resolveDateToken(token: string, context: DateContext = {}): string | undefined {
  const normalized = token.trim().toLowerCase().replace(/^@/, "").replace(/\s+/g, " ");
  if (!normalized) return undefined;
  const now = context.now ?? new Date();
  const timeZone = context.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = localParts(now, timeZone);

  if (normalized === "today" || normalized === "hoje") return isoDate(today.year, today.month, today.day);
  if (normalized === "tomorrow" || normalized === "amanha" || normalized === "amanhã") {
    return addDays(today.year, today.month, today.day, 1);
  }
  if (normalized === "yesterday" || normalized === "ontem") return addDays(today.year, today.month, today.day, -1);
  if (normalized === "next week" || normalized === "proxima semana" || normalized === "próxima semana") {
    return addDays(today.year, today.month, today.day, 7);
  }

  const weekdayMatch = normalized.match(/^(?:next |proxima |próxima )?([a-zà-ú]+)$/i);
  if (weekdayMatch && WEEKDAYS[weekdayMatch[1]] !== undefined) {
    const target = WEEKDAYS[weekdayMatch[1]];
    let delta = (target - today.weekday + 7) % 7;
    if (normalized.startsWith("next ") || normalized.startsWith("proxima ") || normalized.startsWith("próxima ") || delta === 0) delta ||= 7;
    return addDays(today.year, today.month, today.day, delta);
  }

  const explicit = normalized.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (explicit) {
    const year = Number(explicit[1]);
    const month = Number(explicit[2]);
    const day = Number(explicit[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return isoDate(year, month, day);
  }
  const shortDate = normalized.match(/^(\d{1,2})[-/.](\d{1,2})$/);
  if (shortDate) {
    const month = Number(shortDate[1]);
    const day = Number(shortDate[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return isoDate(today.year, month, day);
  }
  return undefined;
}

export function isToday(dateValue: string | undefined, context: DateContext = {}): boolean {
  if (!dateValue) return false;
  const now = context.now ?? new Date();
  const timeZone = context.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = localParts(now, timeZone);
  return dateValue === isoDate(today.year, today.month, today.day) || dateValue.startsWith(`${isoDate(today.year, today.month, today.day)}T`);
}

export function isBeforeToday(dateValue: string | undefined, context: DateContext = {}): boolean {
  if (!dateValue) return false;
  const now = context.now ?? new Date();
  const timeZone = context.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = localParts(now, timeZone);
  return dateValue.slice(0, 10) < isoDate(today.year, today.month, today.day);
}

export function isAfterToday(dateValue: string | undefined, context: DateContext = {}): boolean {
  if (!dateValue) return false;
  const now = context.now ?? new Date();
  const timeZone = context.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = localParts(now, timeZone);
  return dateValue.slice(0, 10) > isoDate(today.year, today.month, today.day);
}

export function formatDuration(milliseconds: number): string {
  const seconds = Math.max(0, Math.round(milliseconds / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}min`;
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
}
