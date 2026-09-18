import type { DataAdapter } from "obsidian";
import type { CreateTaskInput, FlowTask } from "../types";

interface CommandEnvelope {
  id: string;
  type: "create" | "update" | "delete" | "start";
  payload: unknown;
  createdAt: string;
}

export class FileTransport {
  constructor(private readonly adapter: DataAdapter, private readonly root: string) {}

  async readSnapshot(): Promise<FlowTask[]> {
    const path = `${this.root}/state/snapshot.json`;
    if (!(await this.adapter.exists(path))) return [];
    try {
      const value = JSON.parse(await this.adapter.read(path)) as unknown;
      if (Array.isArray(value)) return value as FlowTask[];
      if (typeof value === "object" && value !== null && Array.isArray((value as { tasks?: unknown }).tasks)) return (value as { tasks: FlowTask[] }).tasks;
      return [];
    } catch {
      return [];
    }
  }

  async enqueue(type: CommandEnvelope["type"], payload: CreateTaskInput | Partial<FlowTask> | string): Promise<void> {
    const command: CommandEnvelope = { id: crypto.randomUUID(), type, payload, createdAt: new Date().toISOString() };
    const folder = `${this.root}/commands`;
    await this.adapter.mkdir(this.root).catch(() => undefined);
    await this.adapter.mkdir(`${this.root}/state`).catch(() => undefined);
    await this.adapter.mkdir(`${this.root}/events`).catch(() => undefined);
    await this.adapter.mkdir(`${this.root}/processed`).catch(() => undefined);
    const temporary = `${folder}/${command.id}.tmp`;
    const target = `${folder}/${command.id}.json`;
    await this.adapter.mkdir(folder).catch(() => undefined);
    await this.adapter.write(temporary, JSON.stringify(command, null, 2));
    await this.adapter.rename(temporary, target);
  }
}
