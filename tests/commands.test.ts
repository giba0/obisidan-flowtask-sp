import { describe, expect, it } from "vitest";
import { COMMAND_NAMES } from "../src/commands";

describe("Command Palette labels", () => {
  it("does not repeat the plugin prefix already supplied by Obsidian", () => {
    expect(Object.values(COMMAND_NAMES).every((name) => !name.startsWith("Super Productivity:"))).toBe(true);
  });
});
