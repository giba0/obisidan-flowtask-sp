import { ItemView, Notice, setIcon, type WorkspaceLeaf } from "obsidian";
import { formatDuration, isAfterToday, isBeforeToday, isToday } from "../domain/date";
import { fuzzyScore } from "../domain/search";
import type { FlowTask, TaskFilters } from "../types";
import { TransportManager } from "../transport/manager";

export const FLOWTASK_VIEW_TYPE = "flowtask-task-panel";

export class TaskView extends ItemView {
  private tasks: FlowTask[] = [];
  private filters: TaskFilters = { view: "all", groupBy: "project", scope: "all", includeCompleted: false };
  private listEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private searchEl!: HTMLInputElement;
  private currentTaskId?: string;
  private readonly collapsedGroups = new Set<string>();
  private readonly collapsedTasks = new Set<string>();
  private projectOrder: string[];

  constructor(
    leaf: WorkspaceLeaf,
    private readonly transport: TransportManager,
    private readonly openQuickCapture: () => void,
    private readonly onTasksLoaded?: (tasks: FlowTask[]) => Promise<void>,
    projectOrder: string[] = [],
    private readonly onProjectOrderChange?: (projectOrder: string[]) => Promise<void>,
  ) { super(leaf); this.projectOrder = [...projectOrder]; }
  override getViewType(): string { return FLOWTASK_VIEW_TYPE; }
  override getDisplayText(): string { return "FlowTask"; }
  override getIcon(): string { return "check-check"; }

  override async onOpen(): Promise<void> { this.renderShell(); await this.refresh(); }
  override async onClose(): Promise<void> { this.contentEl.empty(); }

  async refresh(): Promise<void> {
    // Fetch completed tasks for remote checkbox sync; visibility remains a local filter.
    this.tasks = await this.transport.refresh(this.filters.scope === "archived" ? "archived" : "active", true);
    this.currentTaskId = (await this.transport.currentTask())?.id;
    if (this.onTasksLoaded) await this.onTasksLoaded(this.tasks);
    this.renderTasks();
    this.statusEl?.toggleClass("is-offline", this.transport.state !== "connected");
    if (this.statusEl) this.statusEl.setText(this.transport.state === "connected" ? "connected" : this.transport.state === "fallback" ? "fallback mode" : "offline");
  }

  setView(view: TaskFilters["view"]): void { this.filters.view = view; this.renderTasks(); }

  private renderShell(): void {
    this.contentEl.empty();
    const panel = this.contentEl.createDiv({ cls: "flowtask-panel" });
    const header = panel.createDiv({ cls: "flowtask-panel-header" });
    const brand = header.createDiv({ cls: "flowtask-brand" });
    brand.createEl("h2", { text: "FlowTask" });
    this.statusEl = brand.createSpan({ cls: "flowtask-status", text: "conectando" });
    const toolbar = header.createDiv({ cls: "flowtask-toolbar" });
    const capture = toolbar.createEl("button", { text: "+ Capture" });
    capture.addEventListener("click", () => this.openQuickCapture());
    const refresh = toolbar.createEl("button", { attr: { "aria-label": "Refresh" } });
    setIcon(refresh, "refresh-cw");
    refresh.addEventListener("click", () => void this.refresh());
    const searchRow = header.createDiv({ cls: "flowtask-search-row" });
    this.searchEl = searchRow.createEl("input", { cls: "flowtask-search", type: "search", placeholder: "Search tasks, notes or projects..." });
    this.searchEl.addEventListener("input", () => { this.filters.query = this.searchEl.value; this.renderTasks(); });
    const filterButton = searchRow.createEl("button", { cls: "flowtask-filter-button", text: "Filtros" });
    const filterPopover = header.createDiv({ cls: "flowtask-filter-popover is-hidden" });
    filterButton.addEventListener("click", () => filterPopover.toggleClass("is-hidden", !filterPopover.hasClass("is-hidden")));
    filterPopover.createDiv({ cls: "flowtask-filter-title", text: "Scope" });
    const scopeSelect = filterPopover.createEl("select", { cls: "flowtask-filter-select" });
    [["all", "All tasks"], ["inbox", "Inbox"], ["archived", "Archived"]].forEach(([value, label]) => scopeSelect.createEl("option", { value, text: label }));
    scopeSelect.addEventListener("change", () => { this.filters.scope = scopeSelect.value as TaskFilters["scope"]; void this.refresh(); });
    const completedLabel = filterPopover.createEl("label", { cls: "flowtask-completed-toggle" });
    const completed = completedLabel.createEl("input", { type: "checkbox" });
    completedLabel.createSpan({ text: "Include completed" });
    completed.addEventListener("change", () => { this.filters.includeCompleted = completed.checked; void this.refresh(); });
    const tabs = panel.createDiv({ cls: "flowtask-tabs" });
    for (const [view, label] of [["all", "All"], ["today", "Today"], ["schedule", "Upcoming"], ["overdue", "Overdue"], ["undated", "No date"]] as const) {
      const tab = tabs.createEl("button", { cls: "flowtask-tab", text: label });
      tab.addEventListener("click", () => { this.filters.view = view; tabs.querySelectorAll(".flowtask-tab").forEach((element) => element.toggleClass("is-active", element === tab)); void this.refresh(); });
      if (view === "all") tab.addClass("is-active");
    }
    const groupSelect = panel.createEl("select", { cls: "flowtask-group-select" });
    [["project", "Group by project"], ["date", "Group by date"], ["tag", "Group by tag"]].forEach(([value, label]) => groupSelect.createEl("option", { value, text: label }));
    groupSelect.addEventListener("change", () => { this.filters.groupBy = groupSelect.value as TaskFilters["groupBy"]; this.renderTasks(); });
    this.listEl = panel.createDiv({ cls: "flowtask-list" });
  }

  private visibleTasks(): FlowTask[] {
    const filtered = this.tasks.filter((task) => {
      if (this.filters.scope === "archived") return task.status === "archived";
      if (task.status === "archived") return false;
      if (!this.filters.includeCompleted && task.status === "done") return false;
      if (this.filters.view === "today") return isToday(task.dueDate);
      if (this.filters.scope === "inbox") return task.projectId === "INBOX_PROJECT" || task.projectName?.toLocaleLowerCase() === "inbox";
      if (this.filters.view === "schedule") return isAfterToday(task.dueDate);
      if (this.filters.view === "overdue") return isBeforeToday(task.dueDate);
      if (this.filters.view === "undated") return !task.dueDate;
      return true;
    });
    const query = this.filters.query ?? "";
    const ranked = filtered.flatMap((task) => {
      const score = fuzzyScore([task.title, task.notes, task.projectName, ...(task.tagNames ?? [])].filter(Boolean).join(" "), query);
      return score === undefined ? [] : [{ task, score }];
    });
    return ranked.sort((a, b) => b.score - a.score || Number(a.task.status === "done") - Number(b.task.status === "done")).map(({ task }) => task);
  }

  private renderTasks(): void {
    if (!this.listEl) return;
    this.listEl.empty();
    const tasks = this.visibleTasks();
    if (!tasks.length) { this.listEl.createDiv({ cls: "flowtask-empty", text: "No tasks in this view." }); return; }
    const groups = new Map<string, FlowTask[]>();
    tasks.forEach((task) => {
      const keys = this.filters.groupBy === "tag" ? (task.tagNames?.length ? task.tagNames : ["No tag"]) : [this.groupLabel(task)];
      keys.forEach((group) => groups.set(group, [...(groups.get(group) ?? []), task]));
    });
    this.orderedGroups(groups).forEach(([groupName, groupTasks]) => {
      const group = this.listEl.createDiv({ cls: "flowtask-group" });
      const groupHeader = group.createEl("button", { cls: "flowtask-group-title", attr: { "aria-expanded": String(!this.collapsedGroups.has(groupName)) } });
      groupHeader.createSpan({ cls: "flowtask-project-drag-handle", text: "⋮⋮", attr: { title: "Drag to reorder projects" } });
      groupHeader.createSpan({ cls: "flowtask-collapse-icon", text: this.collapsedGroups.has(groupName) ? "▸" : "▾" });
      groupHeader.createSpan({ text: groupName });
      groupHeader.draggable = true;
      groupHeader.addEventListener("click", (event) => { if ((event.target as HTMLElement).closest(".flowtask-project-drag-handle")) return; if (this.collapsedGroups.has(groupName)) this.collapsedGroups.delete(groupName); else this.collapsedGroups.add(groupName); this.renderTasks(); });
      groupHeader.addEventListener("dragstart", (event) => { event.dataTransfer?.setData("text/flowtask-project", groupName); groupHeader.addClass("is-dragging"); });
      groupHeader.addEventListener("dragend", () => groupHeader.removeClass("is-dragging"));
      groupHeader.addEventListener("dragover", (event) => event.preventDefault());
      groupHeader.addEventListener("drop", (event) => { event.preventDefault(); const source = event.dataTransfer?.getData("text/flowtask-project"); if (source && source !== groupName) void this.reorderProject(source, groupName); });
      if (!this.collapsedGroups.has(groupName)) this.renderTaskHierarchy(group, groupTasks);
    });
  }

  private orderedGroups(groups: Map<string, FlowTask[]>): Array<[string, FlowTask[]]> {
    return [...groups.entries()].sort(([a], [b]) => {
      const inboxA = a.toLocaleLowerCase() === "inbox" ? -1 : 0;
      const inboxB = b.toLocaleLowerCase() === "inbox" ? -1 : 0;
      if (inboxA !== inboxB) return inboxA - inboxB;
      const indexA = this.projectOrder.indexOf(a);
      const indexB = this.projectOrder.indexOf(b);
      if (indexA !== -1 || indexB !== -1) return (indexA === -1 ? Number.MAX_SAFE_INTEGER : indexA) - (indexB === -1 ? Number.MAX_SAFE_INTEGER : indexB);
      return a.localeCompare(b);
    });
  }

  private async reorderProject(source: string, target: string): Promise<void> {
    const names = this.orderedGroups(new Map([...new Set([source, target, ...this.projectOrder])].map((name) => [name, [] as FlowTask[]]))).map(([name]) => name);
    const sourceIndex = names.indexOf(source);
    const targetIndex = names.indexOf(target);
    if (sourceIndex === -1 || targetIndex === -1) return;
    names.splice(sourceIndex, 1);
    names.splice(names.indexOf(target), 0, source);
    this.projectOrder = names.filter((name) => name.toLocaleLowerCase() !== "inbox");
    if (this.onProjectOrderChange) await this.onProjectOrderChange(this.projectOrder);
    this.renderTasks();
  }

  private renderTaskHierarchy(parent: HTMLElement, tasks: FlowTask[]): void {
    const taskIds = new Set(tasks.map((task) => task.id));
    const children = new Map<string, FlowTask[]>();
    tasks.forEach((task) => {
      if (task.parentId && taskIds.has(task.parentId)) children.set(task.parentId, [...(children.get(task.parentId) ?? []), task]);
    });
    const roots = tasks.filter((task) => !task.parentId || !taskIds.has(task.parentId));
    const visit = (task: FlowTask, depth: number): void => {
      const taskChildren = children.get(task.id) ?? [];
      this.renderTask(parent, task, depth, taskChildren.length > 0);
      if (!this.collapsedTasks.has(task.id)) taskChildren.forEach((child) => visit(child, depth + 1));
    };
    roots.forEach((task) => visit(task, 0));
  }

  private renderTask(parent: HTMLElement, task: FlowTask, depth = 0, hasChildren = false): void {
    const card = parent.createDiv({ cls: "flowtask-card" });
    card.setCssProps({ "--flowtask-indent": `${depth * 16}px` });
    const check = card.createEl("input", { type: "checkbox" });
    check.addClass("flowtask-check"); check.checked = task.status === "done";
    check.addEventListener("change", () => void this.complete(task, check.checked));
    const body = card.createDiv();
    const titleRow = body.createDiv({ cls: "flowtask-title-row" });
    if (hasChildren) {
      const toggle = titleRow.createEl("button", { cls: "flowtask-subtask-toggle", text: this.collapsedTasks.has(task.id) ? "▸" : "▾", attr: { "aria-label": this.collapsedTasks.has(task.id) ? "Expand subtasks" : "Collapse subtasks" } });
      toggle.addEventListener("click", () => { if (this.collapsedTasks.has(task.id)) this.collapsedTasks.delete(task.id); else this.collapsedTasks.add(task.id); this.renderTasks(); });
    } else {
      titleRow.createSpan({ cls: "flowtask-subtask-spacer" });
    }
    titleRow.createDiv({ cls: "flowtask-title", text: task.title });
    const meta = body.createDiv({ cls: "flowtask-meta" });
    if (task.timeSpentMs > 0) meta.createSpan({ cls: "flowtask-badge is-invested", text: `↻ ${formatDuration(task.timeSpentMs)} investidas` });
    else if (task.estimateMinutes) meta.createSpan({ cls: "flowtask-badge", text: `~${formatDuration(task.estimateMinutes * 60 * 1000)}` });
    if (task.dueDate) meta.createSpan({ cls: "flowtask-badge", text: task.dueDate });
    (task.tagNames ?? []).forEach((tag) => meta.createSpan({ cls: "flowtask-badge", text: `#${tag}` }));
    const actions = body.createDiv({ cls: "flowtask-actions" });
    const isCurrent = this.currentTaskId === task.id;
    const startLabel = isCurrent ? "■ Pause" : task.timeSpentMs > 0 ? `↻ Resume (${formatDuration(task.timeSpentMs)})` : "▶ Start";
    const start = actions.createEl("button", { cls: "flowtask-start-button", text: startLabel, attr: { "aria-label": startLabel } });
    start.addEventListener("click", () => void (isCurrent ? this.pause() : this.start(task)));
    const trash = actions.createEl("button", { cls: "flowtask-icon-button", attr: { "aria-label": "Excluir" } });
    setIcon(trash, "trash-2"); trash.addEventListener("click", () => void this.remove(task));
  }

  private async complete(task: FlowTask, done: boolean): Promise<void> { await this.transport.updateTask(task.id, { status: done ? "done" : "open" }); await this.refresh(); }
  private async start(task: FlowTask): Promise<void> { const started = await this.transport.startTask(task.id); new Notice(started ? (task.timeSpentMs ? "Tracking resumed." : "Tracking started.") : "Tracking is currently unavailable."); await this.refresh(); }
  private async pause(): Promise<void> { const stopped = await this.transport.stopTask(); new Notice(stopped ? "Tracking paused." : "Tracking could not be paused."); await this.refresh(); }
  private async remove(task: FlowTask): Promise<void> { await this.transport.deleteTask(task.id); this.tasks = this.tasks.filter((item) => item.id !== task.id); this.renderTasks(); }

  private groupLabel(task: FlowTask): string {
    if (this.filters.groupBy === "project") return task.projectName || "No project";
    if (this.filters.groupBy === "date") return task.dueDate || "No date";
    return task.projectName || "No project";
  }
}
