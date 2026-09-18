import { describe, expect, it } from "vitest";
import { FileTransport } from "../src/transport/file";

class MemoryAdapter {
  readonly files = new Map<string, string>();
  async exists(path: string): Promise<boolean> { return this.files.has(path); }
  async read(path: string): Promise<string> { return this.files.get(path) ?? ""; }
  async write(path: string, content: string): Promise<void> { this.files.set(path, content); }
  async rename(from: string, to: string): Promise<void> { this.files.set(to, this.files.get(from) ?? ""); this.files.delete(from); }
  async mkdir(): Promise<void> { /* directories are implicit in the test adapter */ }
}

describe("file fallback", () => {
  it("writes commands atomically and reads a snapshot envelope", async () => {
    const adapter = new MemoryAdapter();
    const transport = new FileTransport(adapter as never, "FlowTask");
    await transport.enqueue("create", { title: "Comprar leite" });
    const command = [...adapter.files.entries()].find(([path]) => path.startsWith("FlowTask/commands/") && path.endsWith(".json"));
    expect(command).toBeDefined();
    expect([...adapter.files.keys()].some((path) => path.endsWith(".tmp"))).toBe(false);
    expect(JSON.parse(command![1])).toMatchObject({ type: "create", payload: { title: "Comprar leite" } });

    await adapter.write("FlowTask/state/snapshot.json", JSON.stringify({ tasks: [{ id: "1", title: "Offline", status: "open", timeSpentMs: 0 }] }));
    await expect(transport.readSnapshot()).resolves.toMatchObject([{ id: "1", title: "Offline" }]);
  });
});
