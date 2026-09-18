import { describe, expect, it } from "vitest";
import type { RequestUrlParam, RequestUrlResponse } from "obsidian";
import { RestTransport } from "../src/transport/rest";

function response(json: unknown): RequestUrlResponse { return { status: 200, headers: {}, json, text: JSON.stringify(json) } as RequestUrlResponse; }

describe("Super Productivity response envelopes", () => {
  it("unwraps the standard ok/data/tasks response returned by the local API", async () => {
    const requester = { request: async (_request: RequestUrlParam) => response({ ok: true, data: { tasks: [{ id: "sp-1", title: "Tarefa do SP", timeSpent: 3600 }] } }) };
    const tasks = await new RestTransport("http://127.0.0.1:3876", "token", requester).listTasks();
    expect(tasks).toMatchObject([{ id: "sp-1", title: "Tarefa do SP", timeSpentMs: 3600 }]);
  });

  it("unwraps create responses before normalizing the task", async () => {
    const requester = { request: async (_request: RequestUrlParam) => response({ ok: true, data: { task: { id: "sp-2", title: "Criada" } } }) };
    await expect(new RestTransport("http://127.0.0.1:3876", "token", requester).createTask({ title: "Criada" })).resolves.toMatchObject({ id: "sp-2", title: "Criada" });
  });
});
