import { Notice, type App } from "obsidian";
import type { BridgeSettings, CreateTaskInput, FlowTask, ProjectRef, TagRef } from "../types";
import { FileTransport } from "./file";
import { RestApiError, RestTransport } from "./rest";
import { enrichTaskReferences } from "../domain/task-presentation";
import { normalizeTagToken } from "../domain/tags";

export type ConnectionState = "connected" | "fallback" | "offline";

export class TransportManager {
  private rest: RestTransport;
  private readonly file: FileTransport;
  private projectsCache?: { expiresAt: number; value: ProjectRef[] };
  private tagsCache?: { expiresAt: number; value: TagRef[] };
  private _state: ConnectionState = "offline";

  constructor(private readonly app: App, private readonly settings: BridgeSettings) {
    this.rest = new RestTransport(settings.baseUrl, settings.accessToken);
    this.file = new FileTransport(app.vault.adapter, settings.fallbackFolder.replace(/^\/+|\/+$/g, ""));
  }

  get state(): ConnectionState { return this._state; }

  configure(): void {
    this.rest = new RestTransport(this.settings.baseUrl, this.settings.accessToken);
    this.projectsCache = undefined;
    this.tagsCache = undefined;
  }

  async testConnection(): Promise<{ authenticated: boolean; message: string }> {
    try {
      await this.rest.health();
      await this.rest.listTasks();
      this._state = "connected";
      return { authenticated: Boolean(this.settings.accessToken), message: "Connected to Super Productivity." };
    } catch (error) {
      if (error instanceof RestApiError && (error.status === 401 || error.status === 403)) {
        return { authenticated: false, message: this.settings.accessToken ? error.message : "This Super Productivity version requires a token. Add it in settings." };
      }
      return { authenticated: false, message: "Super Productivity is unavailable." };
    }
  }

  async listTasks(source: "active" | "archived" | "all" = "active", includeDone = false): Promise<FlowTask[]> {
    try {
      const [tasks, projects, tags] = await Promise.all([this.rest.listTasks({ source, includeDone: includeDone || source === "archived" }), this.listProjects(), this.listTags()]);
      this._state = "connected";
      return tasks.map((task) => ({ ...enrichTaskReferences(task, projects, tags), ...(source === "archived" ? { status: "archived" as const } : {}) }));
    }
    catch { return this.fallbackOr([], "Could not load tasks."); }
  }

  async listProjects(): Promise<ProjectRef[]> {
    if (this.projectsCache && this.projectsCache.expiresAt > Date.now()) return this.projectsCache.value;
    try { const value = await this.rest.listProjects(); this.projectsCache = { value, expiresAt: Date.now() + 60_000 }; return value; } catch { return []; }
  }

  async listTags(): Promise<TagRef[]> {
    if (this.tagsCache && this.tagsCache.expiresAt > Date.now()) return this.tagsCache.value;
    try { const value = await this.rest.listTags(); this.tagsCache = { value, expiresAt: Date.now() + 60_000 }; return value; } catch { return []; }
  }

  async createTask(input: CreateTaskInput): Promise<FlowTask | undefined> {
    const resolvedInput = await this.resolveCreateInput(input);
    try { const task = await this.rest.createTask(resolvedInput); this._state = "connected"; return task; }
    catch { if (this.settings.enableFileFallback) { await this.file.enqueue("create", input); this._state = "fallback"; new Notice("SP is offline: task queued for sync."); } return undefined; }
  }

  async updateTask(id: string, patch: Partial<FlowTask>): Promise<FlowTask | undefined> {
    try { return await this.rest.updateTask(id, patch); }
    catch { if (this.settings.enableFileFallback) { await this.file.enqueue("update", { ...patch, id }); this._state = "fallback"; } return undefined; }
  }

  async deleteTask(id: string): Promise<void> {
    try { await this.rest.deleteTask(id); }
    catch { if (this.settings.enableFileFallback) { await this.file.enqueue("delete", id); this._state = "fallback"; } }
  }

  async startTask(id: string): Promise<boolean> {
    try { await this.rest.startTask(id); return true; }
    catch { if (this.settings.enableFileFallback) await this.file.enqueue("start", id); return false; }
  }

  async stopTask(): Promise<boolean> {
    try { await this.rest.stopTask(); return true; }
    catch { return false; }
  }

  async currentTask(): Promise<FlowTask | undefined> {
    try { return await this.rest.currentTask(); } catch { return undefined; }
  }

  async refresh(source: "active" | "archived" | "all" = "active", includeDone = false): Promise<FlowTask[]> { return this.listTasks(source, includeDone); }

  private async resolveCreateInput(input: CreateTaskInput): Promise<CreateTaskInput> {
    const [projects, tags] = await Promise.all([this.listProjects(), this.listTags()]);
    const projectName = input.projectName || this.settings.defaultProjectName || undefined;
    const project = projectName ? projects.find((item) => item.name.toLocaleLowerCase() === projectName.toLocaleLowerCase()) : undefined;
    const knownTags = new Set((input.tagNames ?? []).map((name) => name.toLocaleLowerCase()));
    const tagIds = (input.tagNames ?? []).flatMap((name) => {
      const tag = tags.find((item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase());
      return tag ? [tag.id] : [];
    });
    const unresolved = [
      projectName && !project ? `+${projectName}` : "",
      ...(input.tagNames ?? []).filter((name) => !tags.some((tag) => tag.name.toLocaleLowerCase() === name.toLocaleLowerCase())).map((name) => `#${name}`),
    ].filter(Boolean).join(" ");
    const defaultTag = normalizeTagToken(this.settings.defaultTagName);
    const importTag = normalizeTagToken(this.settings.importTag);
    const effectiveDefaultTag = defaultTag && defaultTag.toLocaleLowerCase() !== importTag.toLocaleLowerCase() && !knownTags.has(defaultTag.toLocaleLowerCase()) ? defaultTag : undefined;
    return {
      ...input,
      title: [input.title, unresolved, effectiveDefaultTag && `#${effectiveDefaultTag}`].filter(Boolean).join(" ").trim(),
      projectId: project?.id,
      tagIds,
    };
  }

  private async fallbackOr<T>(fallback: T, message: string): Promise<T> {
    if (this.settings.enableFileFallback) {
      const tasks = await this.file.readSnapshot();
      this._state = tasks.length ? "fallback" : "offline";
      return (tasks.length ? tasks : fallback) as T;
    }
    this._state = "offline";
    return fallback;
  }
}
