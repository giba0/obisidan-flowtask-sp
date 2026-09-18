import { describe, expect, it } from "vitest";
import type { RequestUrlParam, RequestUrlResponse } from "obsidian";
import { RestTransport } from "../src/transport/rest";

function response(json: unknown): RequestUrlResponse { return { status: 200, headers: {}, json, text: JSON.stringify(json) } as RequestUrlResponse; }

describe("Super Productivity task fields", () => {
  it("maps FlowTask dates and estimates to the Local REST API contract", async () => {
    let request!: RequestUrlParam;
    const transport = new RestTransport("http://127.0.0.1:3876", "token", { request: async (value) => { request = value; return response({ ok: true, data: { id: "1", title: "Planejada", dueDay: "2026-09-20", timeEstimate: 1800 } }); } });
    await transport.createTask({ title: "Planejada", dueDate: "2026-09-20", estimateMinutes: 30 });
    const body = JSON.parse(String(request.body ?? "{}")) as Record<string, unknown>;
    expect(body).toMatchObject({ dueDay: "2026-09-20", timeEstimate: 1_800_000 });
    expect(body).not.toHaveProperty("dueDate");
    expect(body).not.toHaveProperty("estimate");
  });

  it("maps completion status to isDone", async () => {
    let request!: RequestUrlParam;
    const transport = new RestTransport("http://127.0.0.1:3876", "token", { request: async (value) => { request = value; return response({ ok: true, data: { id: "1", title: "Concluída", isDone: true } }); } });
    await transport.updateTask("1", { status: "done" });
    const body = JSON.parse(String(request.body ?? "{}")) as Record<string, unknown>;
    expect(body).toMatchObject({ isDone: true });
    expect(body).not.toHaveProperty("status");
  });

  it("uses the task-control endpoints for current task and pause", async () => {
    const requests: RequestUrlParam[] = [];
    const transport = new RestTransport("http://127.0.0.1:3876", "token", { request: async (value) => { requests.push(value); return response({ ok: true, data: null }); } });
    await transport.currentTask();
    await transport.stopTask();
    expect(requests.map((request) => `${request.method} ${request.url}`)).toEqual([
      "GET http://127.0.0.1:3876/task-control/current",
      "POST http://127.0.0.1:3876/task-control/stop",
    ]);
  });
});
