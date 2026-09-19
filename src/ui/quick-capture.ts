import { Modal, Notice, Setting, type App } from "obsidian";
import { applySuggestion, getSuggestions, type Suggestion } from "../domain/autocomplete";
import { parseTaskText } from "../domain/parser";
import type { ProjectRef, TagRef } from "../types";
import { TransportManager } from "../transport/manager";

export class QuickCaptureModal extends Modal {
  private input!: HTMLInputElement;
  private captureField!: HTMLDivElement;
  private preview!: HTMLDivElement;
  private autocompleteEl!: HTMLDivElement;
  private suggestions: Suggestion[] = [];
  private highlightedSuggestion = -1;
  private attachLink = false;
  private projects: ProjectRef[] = [];
  private tags: TagRef[] = [];
  private subtaskBody!: HTMLDivElement;
  private subtaskInputs: HTMLInputElement[] = [];

  constructor(app: App, private readonly transport: TransportManager, private readonly parentId?: string) { super(app); }

  override onOpen(): void {
    this.modalEl.addClass("flowtask-modal");
    this.titleEl.setText(this.parentId ? "Add subtask" : "Quick capture");
    const content = this.contentEl;
    content.empty();
    this.captureField = content.createDiv({ cls: "flowtask-capture-field" });
    this.input = this.captureField.createEl("input", { type: "text", placeholder: "Buy milk +Home #shopping @today 15m" });
    this.input.addClass("flowtask-capture-input");
    this.autocompleteEl = this.captureField.createDiv({ cls: "flowtask-autocomplete" });
    this.preview = content.createDiv({ cls: "flowtask-preview" });
    this.updatePreview();
    this.input.addEventListener("input", () => { this.updatePreview(); this.updateAutocomplete(); });
    this.input.addEventListener("keydown", (event) => this.handleAutocompleteKey(event));
    this.input.addEventListener("blur", () => window.setTimeout(() => this.hideAutocomplete(), 120));

    new Setting(content).setName("Attach link to current note").setDesc("Adds an obsidian:// link to the task notes.").addToggle((toggle) => toggle.onChange((value) => { this.attachLink = value; }));
    if (!this.parentId) this.renderSubtasks(content);
    const actions = content.createDiv({ cls: "modal-button-container" });
    const cancel = actions.createEl("button", { text: "Cancel" });
    cancel.addEventListener("click", () => this.close());
    const submit = actions.createEl("button", { text: this.parentId ? "Create subtask" : "Create task", cls: "mod-cta" });
    submit.addEventListener("click", () => void this.submit());
    void this.loadReferences().catch(() => this.hideAutocomplete());
    window.setTimeout(() => this.input.focus(), 20);
  }

  private async loadReferences(): Promise<void> {
    const [projects, tags] = await Promise.all([this.transport.listProjects(), this.transport.listTags()]);
    this.projects = projects;
    this.tags = tags;
    this.updateAutocomplete();
  }

  private renderSubtasks(content: HTMLElement): void {
    const section = content.createDiv({ cls: "flowtask-quick-subtasks" });
    const header = section.createEl("button", { cls: "flowtask-quick-subtasks-header", attr: { type: "button", "aria-expanded": "false" } });
    header.createSpan({ cls: "flowtask-quick-subtasks-icon", text: "☷" });
    header.createSpan({ text: "Subtasks" });
    header.createSpan({ cls: "flowtask-quick-subtasks-chevron", text: "▸" });
    this.subtaskBody = section.createDiv({ cls: "flowtask-quick-subtasks-body is-hidden" });
    const add = this.subtaskBody.createEl("button", { cls: "flowtask-add-subtask", text: "+  Add subtask", attr: { type: "button" } });
    add.addEventListener("click", () => this.addSubtaskInput());
    header.addEventListener("click", () => {
      const expanded = header.getAttribute("aria-expanded") === "true";
      header.setAttribute("aria-expanded", String(!expanded));
      header.querySelector(".flowtask-quick-subtasks-chevron")?.setText(expanded ? "▸" : "▾");
      this.subtaskBody.toggleClass("is-hidden", expanded);
    });
  }

  private addSubtaskInput(): void {
    const row = this.subtaskBody.createDiv({ cls: "flowtask-quick-subtask-row" });
    const input = row.createEl("input", { type: "text", placeholder: "Subtask title" });
    const autocomplete = row.createDiv({ cls: "flowtask-autocomplete flowtask-subtask-autocomplete is-hidden" });
    const remove = row.createEl("button", { text: "×", attr: { type: "button", "aria-label": "Remove subtask" } });
    this.bindSubtaskAutocomplete(input, autocomplete);
    remove.addEventListener("click", () => { this.subtaskInputs = this.subtaskInputs.filter((item) => item !== input); row.remove(); this.updatePreview(); });
    input.addEventListener("input", () => this.updatePreview());
    input.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); this.addSubtaskInput(); } });
    this.subtaskInputs.push(input);
    input.focus();
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

  private bindSubtaskAutocomplete(input: HTMLInputElement, menu: HTMLDivElement): void {
    let suggestions: Suggestion[] = [];
    let highlighted = -1;
    const render = (): void => {
      suggestions = getSuggestions(input.value, input.selectionStart ?? input.value.length, this.projects, this.tags);
      highlighted = -1;
      menu.empty();
      if (!suggestions.length) { menu.addClass("is-hidden"); return; }
      menu.removeClass("is-hidden");
      suggestions.forEach((suggestion, index) => {
        const item = menu.createEl("button", { cls: "flowtask-suggestion", attr: { type: "button" } });
        item.createSpan({ cls: "flowtask-suggestion-prefix", text: suggestion.kind === "project" ? "+" : suggestion.kind === "tag" ? "#" : "@" });
        item.createSpan({ text: suggestion.label });
        item.addEventListener("mousedown", (event) => { event.preventDefault(); choose(index); });
      });
    };
    const highlight = (): void => menu.querySelectorAll(".flowtask-suggestion").forEach((item, index) => item.toggleClass("is-highlighted", index === highlighted));
    const choose = (index: number): void => {
      const suggestion = suggestions[index];
      if (!suggestion) return;
      const result = applySuggestion(input.value, input.selectionStart ?? input.value.length, suggestion);
      input.value = result.value;
      input.setSelectionRange(result.cursor, result.cursor);
      render();
      input.focus();
      this.updatePreview();
    };
    input.addEventListener("input", render);
    input.addEventListener("blur", () => window.setTimeout(() => menu.addClass("is-hidden"), 120));
    input.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" && suggestions.length) { event.preventDefault(); highlighted = (highlighted + 1) % suggestions.length; highlight(); }
      else if (event.key === "ArrowUp" && suggestions.length) { event.preventDefault(); highlighted = (highlighted - 1 + suggestions.length) % suggestions.length; highlight(); }
      else if (event.key === "Tab" && suggestions.length) { event.preventDefault(); choose(highlighted >= 0 ? highlighted : 0); }
      else if (event.key === "Enter") { event.preventDefault(); if (input.value.trim()) this.addSubtaskInput(); }
      else if (event.key === "Escape") menu.addClass("is-hidden");
    });
  }

  private handleAutocompleteKey(event: KeyboardEvent): void {
    if (event.key === "ArrowDown" && this.suggestions.length) { event.preventDefault(); this.highlightedSuggestion = (this.highlightedSuggestion + 1) % this.suggestions.length; this.highlightAutocomplete(); return; }
    if (event.key === "ArrowUp" && this.suggestions.length) { event.preventDefault(); this.highlightedSuggestion = (this.highlightedSuggestion - 1 + this.suggestions.length) % this.suggestions.length; this.highlightAutocomplete(); return; }
    if (event.key === "Tab" && this.suggestions.length) { event.preventDefault(); this.chooseSuggestion(this.highlightedSuggestion >= 0 ? this.highlightedSuggestion : 0); return; }
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
    this.preview.createDiv({ text: details || "No additional metadata" });
  }

  private async submit(): Promise<void> {
    const parsed = parseTaskText(this.input.value);
    if (!parsed.title) { new Notice("Enter a task title."); return; }
    const file = this.app.workspace.getActiveFile();
    const notes = this.attachLink && file ? `obsidian://open?vault=${encodeURIComponent(this.app.vault.getName())}&file=${encodeURIComponent(file.path)}` : undefined;
    const task = await this.transport.createTask({ ...parsed, parentId: this.parentId, notes });
    if (task) {
      const subtasks = this.subtaskInputs.map((input) => input.value.trim()).filter(Boolean);
      let failedSubtasks = 0;
      if (!this.parentId) for (const title of subtasks) if (!(await this.transport.createTask({ title, parentId: task.id }))) failedSubtasks += 1;
      new Notice(failedSubtasks ? `Task created, but ${failedSubtasks} subtask(s) could not be created.` : this.parentId ? "Subtask created in Super Productivity." : "Task created in Super Productivity.");
      this.close();
    }
    else new Notice("The task could not be created.");
  }
}
