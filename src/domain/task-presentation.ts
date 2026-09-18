import type { FlowTask, ProjectRef, TagRef } from "../types";

export function enrichTaskReferences(task: FlowTask, projects: ProjectRef[], tags: TagRef[]): FlowTask {
  const project = task.projectId ? projects.find((item) => item.id === task.projectId) : undefined;
  const tagNames = (task.tagIds ?? []).map((id) => tags.find((tag) => tag.id === id)?.name).filter((name): name is string => Boolean(name));
  return {
    ...task,
    projectName: task.projectName ?? project?.name,
    tagNames: task.tagNames?.length ? task.tagNames : tagNames,
  };
}
