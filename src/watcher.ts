import { Notice, TFile, type App, type EventRef, type Vault } from "obsidian";
import { parseCheckboxLine } from "./domain/parser";
import type { FlowTask } from "./types";
import { TransportManager } from "./transport/manager";

const MARKER_RE = /(?:<!--\s*sp-id:|%%\s*sp-id:)([\w-]+)(?:\s*-->|%%)/i;
const LEGACY_MARKER_RE = /<!--\s*sp-id:([\w-]+)\s*-->/i;

export class CheckboxWatcher {
  private readonly timers = new Map<string, number>();
  private readonly processing = new Set<string>();
  private readonly syncedStates = new Map<string, boolean>();

  constructor(private readonly app: App, private readonly transport: TransportManager, private importTag = "sp") {}

  configure(importTag: string): void { this.importTag = importTag.replace(/^#/, "").trim() || "sp"; }

  register(vault: Vault, registerEvent: (event: EventRef) => void): void {
    registerEvent(vault.on("modify", (file) => {
      if (!(file instanceof TFile) || file.extension !== "md" || this.processing.has(file.path)) return;
      this.schedule(file);
    }));
  }

  async syncCurrentLine(): Promise<void> {
    const editor = this.app.workspace.activeEditor?.editor;
    const file = this.app.workspace.getActiveFile();
    if (!editor || !file) { new Notice("Abra uma nota para sincronizar a linha atual."); return; }
    await this.processLine(file, editor.getLine(editor.getCursor().line), editor.getCursor().line);
  }

  private schedule(file: TFile): void {
    const previous = this.timers.get(file.path);
    if (previous) window.clearTimeout(previous);
    this.timers.set(file.path, window.setTimeout(() => { void this.scanFile(file); }, 450));
  }

  private async scanFile(file: TFile): Promise<void> {
    const content = await this.app.vault.read(file);
    for (const [lineNumber, line] of content.split("\n").entries()) await this.processLine(file, line, lineNumber);
  }

  private async processLine(file: TFile, line: string, lineNumber: number): Promise<void> {
    const match = parseCheckboxLine(line);
    if (!match || !match.parsed.title) return;
    const marker = line.match(MARKER_RE)?.[1];
    if (marker) {
      const stateKey = `${file.path}:${lineNumber}:${marker}`;
      const previous = this.syncedStates.get(stateKey);
      if (previous !== match.checked) {
        await this.transport.updateTask(marker, { status: match.checked ? "done" : "open" });
        this.syncedStates.set(stateKey, match.checked);
      }
      return;
    }

    if (!hasImportTag(match.parsed.tagNames, this.importTag)) return;

    const task = await this.transport.createTask({
      title: match.parsed.title,
      projectName: match.parsed.projectName,
      tagNames: match.parsed.tagNames.filter((tag) => tag.toLocaleLowerCase() !== this.importTag.toLocaleLowerCase()),
      dueDate: match.parsed.dueDate,
      estimateMinutes: match.parsed.estimateMinutes,
      notes: `Criada a partir de ${file.path}`,
    });
    if (!task) return;

    const markerText = ` %%sp-id:${task.id}%%`;
    this.processing.add(file.path);
    try {
      await this.app.vault.process(file, (content) => {
        const lines = content.split("\n");
        if (lineNumber >= lines.length || lines[lineNumber].match(MARKER_RE)) return content;
        lines[lineNumber] = `${lines[lineNumber]}${markerText}`;
        return lines.join("\n");
      });
      if (match.checked) await this.transport.updateTask(task.id, { status: "done" });
      new Notice(`FlowTask: ${match.checked ? "task completed" : "task synced"}.`);
    } finally {
      this.processing.delete(file.path);
    }
  }

  async syncRemoteCompletions(tasks: FlowTask[]): Promise<void> {
    const states = new Map(tasks.map((task) => [task.id, task.status === "done"]));
    for (const file of this.app.vault.getMarkdownFiles()) {
      const original = await this.app.vault.read(file);
      const lines = original.split("\n");
      let changed = false;
      lines.forEach((line, index) => {
        const marker = line.match(MARKER_RE)?.[1];
        const remoteDone = marker ? states.get(marker) : undefined;
        if (remoteDone === undefined) return;
        const local = parseCheckboxLine(line);
        const migrated = line.replace(LEGACY_MARKER_RE, `%%sp-id:${marker}%%`);
        if (migrated !== line) { lines[index] = migrated; changed = true; }
        if (!local || local.checked === remoteDone) return;
        lines[index] = lines[index].replace(/^(\s*-\s+\[)[ xX](\])/, `$1${remoteDone ? "x" : " "}$2`);
        changed = true;
      });
      if (changed) {
        this.processing.add(file.path);
        try { await this.app.vault.process(file, () => lines.join("\n")); }
        finally { this.processing.delete(file.path); }
      }
    }
  }
}

export function findTaskIdInLine(line: string): string | undefined { return line.match(MARKER_RE)?.[1]; }

export function hasImportTag(tags: string[], importTag: string): boolean {
  const normalized = importTag.replace(/^#/, "").trim().toLocaleLowerCase();
  return tags.some((tag) => tag.toLocaleLowerCase() === normalized);
}
