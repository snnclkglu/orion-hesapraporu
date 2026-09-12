import { z } from "zod";
const id = z.uuid();
export const teamSchemas = {
  create: z
    .object({
      name: z.string().trim().min(1).max(120),
      description: z.string().max(500),
    })
    .strict(),
  update: z
    .object({
      id,
      version: z.number().int().positive(),
      name: z.string().trim().min(1).max(120),
      description: z.string().max(500),
    })
    .strict(),
  members: z
    .object({
      id,
      version: z.number().int().positive(),
      users: z.array(id).min(1).max(100),
    })
    .strict(),
  member: z
    .object({
      id,
      version: z.number().int().positive(),
      user_id: id,
      role: z.enum(["manager", "editor", "viewer", "remove"]),
      replacement: id.nullable().optional(),
    })
    .strict(),
  transfer: z
    .object({ id, version: z.number().int().positive(), user_id: id })
    .strict(),
  archive: z.object({ id, version: z.number().int().positive() }).strict(),
  restore: z.object({ id, version: z.number().int().positive() }).strict(),
};
export type TeamOperation = keyof typeof teamSchemas;
export interface DirectoryPerson {
  id: string;
  full_name: string;
  email: string;
  role: string;
  avatar_path?: string | null;
  member?: boolean;
}
export interface ManagedTeam {
  id: string;
  name: string;
  description: string;
  owner_id: string;
  archived_at: string | null;
  version: number;
  member_count?: number;
  open_count?: number;
  unassigned_count?: number;
  overdue_count?: number;
}
export interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  role: string;
  app_role: string;
  open_count: number;
  avatar_path?: string | null;
}
