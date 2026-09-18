import { requestUrl, type RequestUrlParam, type RequestUrlResponse } from "obsidian";
import type { CreateTaskInput, FlowTask, ProjectRef, TagRef } from "../types";

export interface HttpRequester {
  request(options: RequestUrlParam): Promise<RequestUrlResponse>;
}

const defaultRequester: HttpRequester = { request: requestUrl };

export class RestApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "RestApiError";
  }
}

export class RestTransport {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly requester: HttpRequester;

  constructor(baseUrl: string, token = "", requester: HttpRequester = defaultRequester) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token = token.trim();
    this.requester = requester;
  }

  async health(): Promise<void> {
    await this.call("GET", "/health", undefined, false);
  }

  async listTasks(options: { source?: "active" | "archived" | "all"; includeDone?: boolean } = {}): Promise<FlowTask[]> {
    const query = new URLSearchParams({ source: options.source ?? "active", includeDone: String(options.includeDone ?? true) });
    const response = await this.call("GET", `/tasks?${query.toString()}`);
    const payload = unwrapResponse(response.json);
    const values = Array.isArray(payload) ? payload : isRecord(payload) && Array.isArray(payload.tasks) ? payload.tasks : isRecord(payload) && Array.isArray(payload.items) ? payload.items : [];
    return values.filter(isRecord).map(normalizeTask);
  }

  async createTask(input: CreateTaskInput): Promise<FlowTask> {
    const response = await this.call("POST", "/tasks", {
      title: input.title,
      projectId: input.projectId,
      tagIds: input.tagIds,
      dueDay: input.dueDate,
      timeEstimate: input.estimateMinutes ? input.estimateMinutes * 60 * 1000 : undefined,
      notes: input.notes,
    });
    return normalizeTask(response.json);
  }

  async updateTask(id: string, patch: Partial<FlowTask>): Promise<FlowTask> {
    const response = await this.call("PATCH", `/tasks/${encodeURIComponent(id)}`, toApiTaskPatch(patch));
    return normalizeTask(response.json);
  }

  async deleteTask(id: string): Promise<void> {
    await this.call("DELETE", `/tasks/${encodeURIComponent(id)}`);
  }

  async startTask(id: string): Promise<void> {
    await this.call("POST", `/tasks/${encodeURIComponent(id)}/start`);
  }

  async stopTask(): Promise<void> {
    await this.call("POST", "/task-control/stop");
  }

  async currentTask(): Promise<FlowTask | undefined> {
    const response = await this.call("GET", "/task-control/current");
    const value = unwrapResponse(response.json);
    return value ? normalizeTask(value) : undefined;
  }

  async listProjects(): Promise<ProjectRef[]> {
    const response = await this.call("GET", "/projects");
    return toRefList(response.json);
  }

  async listTags(): Promise<TagRef[]> {
    const response = await this.call("GET", "/tags");
    return toRefList(response.json);
  }

  private async call(method: string, path: string, body?: unknown, includeAuth = true): Promise<RequestUrlResponse> {
    const headers: Record<string, string> = { Accept: "application/json" };
    // Authentication is deliberately conditional: modern local SP versions do not issue tokens.
    if (includeAuth && this.token) headers.Authorization = `Bearer ${this.token}`;
    const options: RequestUrlParam = { url: `${this.baseUrl}${path}`, method, headers };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }
    const response = await this.requester.request(options);
    if (response.status >= 400) throw new RestApiError(response.status, describeHttpError(response.status));
    return response;
  }
}

function describeHttpError(status: number): string {
  if (status === 401 || status === 403) return "The Super Productivity token is invalid or unauthorized.";
  if (status === 404) return "The endpoint was not found in Super Productivity.";
  return `Super Productivity returned HTTP ${status}.`;
}

function toApiTaskPatch(patch: Partial<FlowTask>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (patch.title !== undefined) result.title = patch.title;
  if (patch.notes !== undefined) result.notes = patch.notes;
  if (patch.status !== undefined) result.isDone = patch.status === "done";
  if (patch.timeSpentMs !== undefined) result.timeSpent = patch.timeSpentMs;
  if (patch.estimateMinutes !== undefined) result.timeEstimate = patch.estimateMinutes * 60 * 1000;
  if (patch.projectId !== undefined) result.projectId = patch.projectId;
  if (patch.tagIds !== undefined) result.tagIds = patch.tagIds;
  if (patch.dueDate !== undefined) result.dueDay = patch.dueDate;
  if (patch.plannedAt !== undefined) result.plannedAt = patch.plannedAt;
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toRefList(payload: unknown): Array<{ id: string; name: string }> {
  payload = unwrapResponse(payload);
  const values = Array.isArray(payload) ? payload : isRecord(payload) && Array.isArray(payload.items) ? payload.items : [];
  return values.filter(isRecord).map((value) => ({ id: String(value.id ?? value.uid ?? value.name), name: String(value.name ?? value.title ?? value.id) }));
}

function normalizeTask(value: unknown): FlowTask {
  const unwrapped = unwrapResponse(value);
  const taskValue = isRecord(unwrapped) && "task" in unwrapped ? unwrapResponse(unwrapped.task) : unwrapped;
  const task = isRecord(taskValue) ? taskValue : {};
  const project = isRecord(task.project) ? task.project : undefined;
  const tags = Array.isArray(task.tags) ? task.tags.filter(isRecord) : [];
  return {
    id: String(task.id ?? task.uid ?? crypto.randomUUID()),
    title: String(task.title ?? task.name ?? "Untitled task"),
    status: task.isArchived || task.status === "ARCHIVED" ? "archived" : task.isDone || task.status === "DONE" || task.completed ? "done" : "open",
    projectId: task.projectId ? String(task.projectId) : project?.id ? String(project.id) : undefined,
    projectName: task.projectName ? String(task.projectName) : project?.name ? String(project.name) : undefined,
    tagIds: Array.isArray(task.tagIds) ? task.tagIds.map((id) => String(id)) : tags.map((tag) => String(tag.id)).filter(Boolean),
    tagNames: tags.map((tag) => String(tag.name ?? tag.title)).filter(Boolean),
    dueDate: task.dueDay ? String(task.dueDay) : typeof task.dueWithTime === "number" ? new Date(task.dueWithTime).toISOString() : task.dueDate ? String(task.dueDate) : task.plannedAt ? String(task.plannedAt) : undefined,
    plannedAt: task.plannedAt ? String(task.plannedAt) : undefined,
    estimateMinutes: typeof task.timeEstimate === "number" ? Math.round(task.timeEstimate / 60000) : typeof task.estimate === "number" ? Math.round(task.estimate / 60000) : typeof task.estimateMinutes === "number" ? task.estimateMinutes : undefined,
    timeSpentMs: typeof task.timeSpent === "number" ? task.timeSpent : typeof task.timeSpentMs === "number" ? task.timeSpentMs : 0,
    notes: task.notes ? String(task.notes) : undefined,
    createdAt: task.createdAt ? String(task.createdAt) : undefined,
    parentId: task.parentId ? String(task.parentId) : undefined,
    subTaskIds: Array.isArray(task.subTaskIds) ? task.subTaskIds.map((id) => String(id)) : undefined,
    raw: taskValue,
  };
}

function unwrapResponse(value: unknown): unknown {
  if (isRecord(value) && "data" in value) return unwrapResponse(value.data);
  return value;
}

export { normalizeTask };
