import { describe, expect, it } from "vitest";
import type { RequestUrlParam, RequestUrlResponse } from "obsidian";
import { RestTransport } from "../src/transport/rest";

function response(json: unknown): RequestUrlResponse { return { status: 200, headers: {}, json, text: JSON.stringify(json) } as RequestUrlResponse; }

describe("REST authentication", () => {
  it("sends the configured Bearer token on the actual task request", async () => {
    const requests: RequestUrlParam[] = [];
    const transport = new RestTransport("http://127.0.0.1:3876", "secret-token", { request: async (request) => { requests.push(request); return response([]); } });
    await transport.listTasks();
    expect(requests[0].headers?.Authorization).toBe("Bearer secret-token");
  });

  it("omits Authorization when no token is configured and always keeps health unauthenticated", async () => {
    const requests: RequestUrlParam[] = [];
    const transport = new RestTransport("http://127.0.0.1:3876", "", { request: async (request) => { requests.push(request); return response([]); } });
    await transport.health();
    await transport.listTasks();
    expect(requests[0].headers?.Authorization).toBeUndefined();
    expect(requests[1].headers?.Authorization).toBeUndefined();
  });
});
