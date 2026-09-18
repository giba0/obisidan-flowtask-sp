import { describe, expect, it } from "vitest";
import { formatDuration, isToday, resolveDateToken } from "../src/domain/date";
import { parseCheckboxLine, parseTaskText } from "../src/domain/parser";

const boundary = new Date("2026-09-18T00:30:00.000Z");

describe("date engine", () => {
  it("resolves today in the requested timezone instead of parsing an ISO string locally", () => {
    expect(resolveDateToken("@today", { now: boundary, timeZone: "Europe/Lisbon" })).toBe("2026-09-18");
    expect(resolveDateToken("@today", { now: boundary, timeZone: "America/Los_Angeles" })).toBe("2026-09-17");
  });

  it("handles relative and explicit dates", () => {
    expect(resolveDateToken("tomorrow", { now: boundary, timeZone: "UTC" })).toBe("2026-09-19");
    expect(resolveDateToken("2026/12/03", { now: boundary, timeZone: "UTC" })).toBe("2026-12-03");
    expect(resolveDateToken("next monday", { now: boundary, timeZone: "UTC" })).toBe("2026-09-21");
    expect(parseTaskText("Planejar semana @next monday", { now: boundary, timeZone: "UTC" }).dueDate).toBe("2026-09-21");
  });

  it("compares date-only values in the same timezone", () => {
    expect(isToday("2026-09-17", { now: boundary, timeZone: "America/Los_Angeles" })).toBe(true);
    expect(formatDuration(5_400_000)).toBe("1.5h");
    expect(formatDuration(4_000)).toBe("4s");
  });
});

describe("task line parser", () => {
  it("extracts FlowTask metadata without treating the title as metadata", () => {
    const result = parseTaskText("Revisar PR +Engineering %sp @tomorrow 1.5h", { now: boundary, timeZone: "UTC" });
    expect(result).toMatchObject({ title: "Revisar PR", projectName: "Engineering", tagNames: ["sp"], dueDate: "2026-09-19", estimateMinutes: 90 });
  });

  it("accepts Obsidian Tasks due-date syntax", () => {
    const result = parseTaskText("Revisar contrato #sp 📅 2026-09-20", { now: boundary, timeZone: "UTC" });
    expect(result).toMatchObject({ title: "Revisar contrato", tagNames: ["sp"], dueDate: "2026-09-20" });
  });

  it("recognizes checked and unchecked Obsidian lines and existing IDs", () => {
    expect(parseCheckboxLine("  - [ ] Criar tarefa +Casa")).toMatchObject({ checked: false, indent: "  " });
    expect(parseCheckboxLine("- [x] Feita <!--sp-id:task-1-->")).toMatchObject({ checked: true, parsed: { existingId: "task-1" } });
    expect(parseCheckboxLine("- [ ] Hidden marker %%sp-id:task-2%%")).toMatchObject({ parsed: { existingId: "task-2" } });
  });
});
