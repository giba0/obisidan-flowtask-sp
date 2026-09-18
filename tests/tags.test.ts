import { describe, expect, it } from "vitest";
import { normalizeTagToken } from "../src/domain/tags";

describe("tag configuration", () => {
  it("normalizes legacy values with one or more hash prefixes", () => {
    expect(normalizeTagToken("#sp")).toBe("sp");
    expect(normalizeTagToken("##sp")).toBe("sp");
  });
});
