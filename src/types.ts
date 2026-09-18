export type TaskStatus = "open" | "done" | "archived";

export interface FlowTask {
  id: string;
  title: string;
  status: TaskStatus;
  projectId?: string;
  projectName?: string;
  tagIds?: string[];
  tagNames?: string[];
  dueDate?: string;
  plannedAt?: string;
  estimateMinutes?: number;
  timeSpentMs: number;
  notes?: string;
  createdAt?: string;
  parentId?: string;
  subTaskIds?: string[];
  raw?: unknown;
}

export interface ProjectRef {
  id: string;
  name: string;
}

export interface TagRef {
  id: string;
  name: string;
}

export interface CreateTaskInput {
  title: string;
  projectId?: string;
  projectName?: string;
  tagIds?: string[];
  tagNames?: string[];
  dueDate?: string;
  estimateMinutes?: number;
  notes?: string;
}

export interface TaskFilters {
  view: "all" | "today" | "inbox" | "planner" | "schedule" | "boards" | "overdue" | "undated" | "archived";
  groupBy: "project" | "date" | "tag";
  scope: "all" | "inbox" | "archived";
  includeCompleted: boolean;
  projectId?: string;
  query?: string;
}

export interface BridgeSettings {
  baseUrl: string;
  accessToken: string;
  pollingSeconds: number;
  fallbackFolder: string;
  enableFileFallback: boolean;
  defaultProjectName: string;
  defaultTagName: string;
  projectOrder: string[];
  importTag: string;
}

export const DEFAULT_SETTINGS: BridgeSettings = {
  baseUrl: "http://127.0.0.1:3876",
  accessToken: "",
  pollingSeconds: 5,
  fallbackFolder: "FlowTask",
  enableFileFallback: true,
  defaultProjectName: "",
  defaultTagName: "",
  projectOrder: [],
  importTag: "sp",
};

export interface ParsedTaskLine {
  title: string;
  projectName?: string;
  tagNames: string[];
  dueDate?: string;
  estimateMinutes?: number;
  existingId?: string;
}

export interface TaskLineMatch {
  checked: boolean;
  text: string;
  start: number;
  end: number;
  indent: string;
  marker: string;
  parsed: ParsedTaskLine;
}
