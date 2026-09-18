import { describe, expect, it } from "vitest";
import { fuzzyScore } from "../src/domain/search";
import { enrichTaskReferences } from "../src/domain/task-presentation";
import type { FlowTask } from "../src/types";

const task: FlowTask = { id: "1", title: "Revisar PR", status: "open", projectId: "p1", tagIds: ["t1"], timeSpentMs: 4_000 };

describe("task presentation", () => {
  it("resolves project and tag names from the SP reference lists", () => {
    expect(enrichTaskReferences(task, [{ id: "p1", name: "Trabalho" }], [{ id: "t1", name: "urgente" }])).toMatchObject({ projectName: "Trabalho", tagNames: ["urgente"] });
  });

  it("matches fuzzy search terms", () => {
    expect(fuzzyScore("Revisar PR", "rpr")).toBeDefined();
    expect(fuzzyScore("Revisar PR", "xyz")).toBeUndefined();
  });
});
