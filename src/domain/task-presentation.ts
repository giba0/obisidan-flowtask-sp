import type { FlowTask, ProjectRef, TagRef } from "../types";

export function enrichTaskReferences(task: FlowTask, projects: ProjectRef[], tags: TagRef[]): FlowTask {
  const project = task.projectId ? projects.find((item) => item.id === task.projectId) : undefined;
  const resolvedTags = (task.tagIds ?? []).map((id) => tags.find((tag) => tag.id === id)).filter((tag): tag is TagRef => Boolean(tag));
  const tagNames = resolvedTags.map((tag) => tag.name);
  const tagStyles = Object.fromEntries(resolvedTags.map((tag) => [tag.name, { color: tag.color, icon: tag.icon }]));
  return {
    ...task,
    projectName: task.projectName ?? project?.name,
    projectColor: task.projectColor ?? project?.color,
    projectIcon: task.projectIcon ?? project?.icon,
    tagNames: task.tagNames?.length ? task.tagNames : tagNames,
    tagStyles: task.tagStyles ?? tagStyles,
  };
}
