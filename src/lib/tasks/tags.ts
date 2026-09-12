import { z } from "zod";
import { adBuyuk } from "@/lib/tr-text";

export const tagHues = [300, 250, 65, 155, 200, 20] as const;
export interface TaskTag {
  id: string;
  name: string;
  color_hue: number;
  scope: "global" | "team" | "personal";
  team_id: string | null;
  owner_id: string | null;
  archived_at: string | null;
  version: number;
  updated_at: string;
  can_edit?: boolean;
}
export const tagIdsSchema = z.array(z.uuid()).max(10).refine(
  (ids) => new Set(ids).size === ids.length, "Etiketler benzersiz olmalı",
);
const tagFields = {
  name: z.string().trim().min(1).max(40).transform(adBuyuk),
  color_hue: z.number().int().refine((h) => tagHues.includes(h as typeof tagHues[number]), "Paletten renk seçin"),
};
export const createTagSchema = z.object({
  ...tagFields,
  scope: z.enum(["global", "team", "personal"]),
  team_id: z.uuid().nullable().optional(),
}).strict().refine((t) => t.scope === "team" ? !!t.team_id : !t.team_id, "Etiket kapsamını kontrol edin");
export const updateTagSchema = z.object({
  id: z.uuid(), version: z.number().int().positive(),
  name: tagFields.name.optional(), color_hue: tagFields.color_hue.optional(),
  archived: z.boolean().optional(),
}).strict();
export function compatibleTag(tag: TaskTag, task: {visibility: string; created_by: string; board_id: string | null}, boards: {id: string; team_id: string | null}[]) {
  return tag.scope === "global" ||
    (tag.scope === "personal" && task.visibility === "private" && tag.owner_id === task.created_by) ||
    (tag.scope === "team" && task.visibility === "team" && boards.some((b) => b.id === task.board_id && b.team_id === tag.team_id));
}
