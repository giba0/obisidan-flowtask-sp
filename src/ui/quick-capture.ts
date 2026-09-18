import { Modal, Notice, Setting, type App } from "obsidian";
import { applySuggestion, getSuggestions, type Suggestion } from "../domain/autocomplete";
import { parseTaskText } from "../domain/parser";
import { resolveDateToken } from "../domain/date";
import type { ProjectRef, TagRef } from "../types";
import { TransportManager } from "../transport/manager";

export class QuickCaptureModal extends Modal {
  private input!: HTMLInputElement;
  private preview!: HTMLDivElement;
  private autocompleteEl!: HTMLDivElement;
  private suggestions: Suggestion[] = [];
  private highlightedSuggestion = -1;
  private attachLink = false;
  private projects: ProjectRef[] = [];
  private tags: TagRef[] = [];

  constructor(app: App, private readonly transport: TransportManager) { super(app); }

  override onOpen(): void {
    this.modalEl.addClass("flowtask-modal");
    this.titleEl.setText("Quick capture");
    const content = this.contentEl;
    content.empty();
    this.input = content.createEl("input", { type: "text", placeholder: "Buy milk +Home #shopping @today 15m" });
    this.input.addClass("flowtask-capture-input");
    this.input.style.width = "100%";
    this.input.style.fontSize = "16px";
    this.input.style.padding = "10px";
    this.autocompleteEl = content.createDiv({ cls: "flowtask-autocomplete" });
    this.preview = content.createDiv({ cls: "flowtask-preview" });
    this.updatePreview();
    this.input.addEventListener("input", () => { this.updatePreview(); this.updateAutocomplete(); });
    this.input.addEventListener("keydown", (event) => this.handleAutocompleteKey(event));
    this.input.addEventListener("blur", () => window.setTimeout(() => this.hideAutocomplete(), 120));

    new Setting(content).setName("Attach link to current note").setDesc("Adds an obsidian:// link to the task notes.").addToggle((toggle) => toggle.onChange((value) => { this.attachLink = value; }));
    const actions = content.createDiv({ cls: "modal-button-container" });
    const cancel = actions.createEl("button", { text: "Cancel" });
    cancel.addEventListener("click", () => this.close());
    const submit = actions.createEl("button", { text: "Create task", cls: "mod-cta" });
    submit.addEventListener("click", () => void this.submit());
    this.loadReferences();
    window.setTimeout(() => this.input.focus(), 20);
  }

  private async loadReferences(): Promise<void> {
    [this.projects, this.tags] = await Promise.all([this.transport.listProjects(), this.transport.listTags()]);
    this.updateAutocomplete();
  }

  private updateAutocomplete(): void {
    if (!this.autocompleteEl || !this.input) return;
    this.suggestions = getSuggestions(this.input.value, this.input.selectionStart ?? this.input.value.length, this.projects, this.tags);
    this.highlightedSuggestion = -1;
    this.autocompleteEl.empty();
    if (!this.suggestions.length) { this.hideAutocomplete(); return; }
    this.autocompleteEl.removeClass("is-hidden");
    this.suggestions.forEach((suggestion, index) => {
      const item = this.autocompleteEl.createEl("button", { cls: "flowtask-suggestion", attr: { type: "button" } });
      item.createSpan({ cls: "flowtask-suggestion-prefix", text: suggestion.kind === "project" ? "+" : suggestion.kind === "tag" ? "#" : "@" });
      item.createSpan({ text: suggestion.label });
      item.addEventListener("mousedown", (event) => { event.preventDefault(); this.chooseSuggestion(index); });
    });
  }

  private handleAutocompleteKey(event: KeyboardEvent): void {
    if (event.key === "ArrowDown" && this.suggestions.length) { event.preventDefault(); this.highlightedSuggestion = (this.highlightedSuggestion + 1) % this.suggestions.length; this.highlightAutocomplete(); return; }
    if (event.key === "ArrowUp" && this.suggestions.length) { event.preventDefault(); this.highlightedSuggestion = (this.highlightedSuggestion - 1 + this.suggestions.length) % this.suggestions.length; this.highlightAutocomplete(); return; }
    if (event.key === "Enter" && this.highlightedSuggestion >= 0) { event.preventDefault(); this.chooseSuggestion(this.highlightedSuggestion); return; }
    if (event.key === "Escape") this.hideAutocomplete();
    if (event.key === "Enter") void this.submit();
  }

  private highlightAutocomplete(): void {
    this.autocompleteEl.querySelectorAll(".flowtask-suggestion").forEach((element, index) => element.toggleClass("is-highlighted", index === this.highlightedSuggestion));
  }

  private chooseSuggestion(index: number): void {
    const suggestion = this.suggestions[index];
    if (!suggestion) return;
    const result = applySuggestion(this.input.value, this.input.selectionStart ?? this.input.value.length, suggestion);
    this.input.value = result.value;
    this.input.setSelectionRange(result.cursor, result.cursor);
    this.updatePreview();
    this.updateAutocomplete();
    this.input.focus();
  }

  private hideAutocomplete(): void { this.autocompleteEl?.addClass("is-hidden"); }

  private updatePreview(): void {
    if (!this.preview || !this.input) return;
    const parsed = parseTaskText(this.input.value);
    this.preview.empty();
    if (!this.input.value.trim()) { this.preview.setText("Enter a task. Use +project, #tag, @date and a duration."); return; }
    this.preview.createEl("strong", { text: parsed.title || "Untitled task" });
    const details = [parsed.projectName && `Project: ${parsed.projectName}`, parsed.tagNames.length && `Tags: ${parsed.tagNames.join(", ")}`, parsed.dueDate && `Date: ${parsed.dueDate}`, parsed.estimateMinutes && `Estimate: ${parsed.estimateMinutes}min`].filter(Boolean).join(" · ");
    this.preview.createEl("div", { text: details || "No additional metadata" });
  }

  private async submit(): Promise<void> {
    const parsed = parseTaskText(this.input.value);
    if (!parsed.title) { new Notice("Enter a task title."); return; }
    const file = this.app.workspace.getActiveFile();
    const notes = this.attachLink && file ? `obsidian://open?vault=${encodeURIComponent(this.app.vault.getName())}&file=${encodeURIComponent(file.path)}` : undefined;
    const task = await this.transport.createTask({ ...parsed, notes });
    if (task) { new Notice("Task created in Super Productivity."); this.close(); }
    else new Notice("The task could not be created.");
  }
}
