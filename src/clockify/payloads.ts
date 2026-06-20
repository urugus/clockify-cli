import type { Project, TimeEntry } from "./schemas.js";

export type TimeEntryUpdatePatch = {
  readonly start: string;
  readonly end: string;
  readonly description: string;
  readonly projectId: string;
  readonly taskId?: string;
  readonly tagIds?: readonly string[];
  readonly clearTags: boolean;
  readonly billable?: boolean;
};

export type TimeEntryUpdatePayload = {
  readonly start: string;
  readonly end: string;
  readonly description: string;
  readonly projectId: string;
  readonly taskId?: string | null;
  readonly tagIds?: readonly string[];
  readonly billable?: boolean;
};

export const buildTimeEntryUpdatePayload = (
  current: TimeEntry,
  patch: TimeEntryUpdatePatch,
): TimeEntryUpdatePayload => ({
  start: patch.start,
  end: patch.end,
  description: patch.description,
  projectId: patch.projectId,
  taskId: patch.taskId ?? current.taskId,
  tagIds: patch.clearTags ? [] : (patch.tagIds ?? current.tagIds ?? undefined),
  billable: patch.billable ?? current.billable,
});

export type ProjectUpdatePatch = {
  readonly name?: string;
  readonly clientId?: string;
  readonly color?: string;
  readonly archived?: boolean;
  readonly billable?: boolean;
  readonly public?: boolean;
  readonly note?: string;
};

export type ProjectUpdatePayload = {
  readonly name?: string;
  readonly clientId?: string | null;
  readonly color?: string;
  readonly archived?: boolean;
  readonly billable?: boolean;
  readonly isPublic?: boolean;
  readonly note?: string;
};

export const buildProjectUpdatePayload = (
  current: Project,
  patch: ProjectUpdatePatch,
): ProjectUpdatePayload => ({
  name: patch.name ?? current.name,
  clientId: patch.clientId ?? current.clientId,
  color: patch.color ?? (typeof current.color === "string" ? current.color : undefined),
  archived: patch.archived ?? current.archived,
  billable:
    patch.billable ?? (typeof current.billable === "boolean" ? current.billable : undefined),
  isPublic: patch.public ?? (typeof current.public === "boolean" ? current.public : undefined),
  note: patch.note ?? (typeof current.note === "string" ? current.note : undefined),
});
