import { describe, expect, it } from "vitest";
import { fuzzyScore } from "../src/domain/search";
import { enrichTaskReferences } from "../src/domain/task-presentation";
import type { FlowTask } from "../src/types";

const task: FlowTask = { id: "1", title: "Revisar PR", status: "open", projectId: "p1", tagIds: ["t1"], timeSpentMs: 4_000 };

describe("task presentation", () => {
  it("resolves project and tag names from the SP reference lists", () => {
    expect(enrichTaskReferences(task, [{ id: "p1", name: "Trabalho", color: "#7c3aed", icon: "folder" }], [{ id: "t1", name: "urgente", color: "#ef4444", icon: "alert-circle" }])).toMatchObject({ projectName: "Trabalho", projectColor: "#7c3aed", projectIcon: "folder", tagNames: ["urgente"], tagStyles: { urgente: { color: "#ef4444", icon: "alert-circle" } } });
  });

  it("matches fuzzy search terms", () => {
    expect(fuzzyScore("Revisar PR", "rpr")).toBeDefined();
    expect(fuzzyScore("Revisar PR", "xyz")).toBeUndefined();
  });
});
