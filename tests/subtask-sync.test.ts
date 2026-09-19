import { describe, expect, it } from "vitest";
import { resolveRemoteDone } from "../src/watcher";

describe("parent completion synchronization", () => {
  it("completes children when the parent is done even if the child response is stale", () => {
    expect(resolveRemoteDone(true, false)).toBe(true);
    expect(resolveRemoteDone(true, undefined)).toBe(true);
  });

  it("keeps an independent child state when the parent is not done", () => {
    expect(resolveRemoteDone(false, false)).toBe(false);
    expect(resolveRemoteDone(false, undefined)).toBeUndefined();
  });
});
