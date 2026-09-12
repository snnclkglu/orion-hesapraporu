import { describe,it,expect } from "vitest";
import {createTagSchema,updateTagSchema,compatibleTag,tagHues,type TaskTag} from "./tags";
import {createTaskSchema,updateTaskSchema,filtersSchema} from "./model";
import {readFileSync} from "node:fs";
const a="10000000-0000-4000-8000-000000000001",b="10000000-0000-4000-8000-000000000002";
describe("Görev etiket sözleşmesi",()=>{
 it("Türkçe adı büyütür, kapsamı ve renk paletini doğrular",()=>{
  expect(createTagSchema.parse({name:"teklif",scope:"personal",color_hue:300}).name).toBe("TEKLİF");
  expect(createTagSchema.safeParse({name:"Proje",scope:"team",color_hue:250}).success).toBe(false);
  expect(createTagSchema.safeParse({name:"Proje",scope:"global",team_id:a,color_hue:250}).success).toBe(false);
  expect(updateTagSchema.safeParse({id:a,version:1,color_hue:99}).success).toBe(false);
 });
 it("mevcut görev istemcisini korur; mükerrer, fazla, null ve çelişen etiketleri reddeder",()=>{
  expect(createTaskSchema.safeParse({title:"İş"}).success).toBe(true);
  for(const tags of [null,[a,a],Array.from({length:11},()=>crypto.randomUUID())])expect(createTaskSchema.safeParse({title:"İş",tag_ids:tags}).success).toBe(false);
  expect(updateTaskSchema.safeParse({id:a,version:1,tag_ids:[],add_tag_ids:[b]}).success).toBe(false);
  expect(updateTaskSchema.safeParse({id:a,version:1,add_tag_ids:[b],remove_tag_ids:[b]}).success).toBe(false);
  expect(updateTaskSchema.safeParse({id:a,version:1,add_tag_ids:[b]}).success).toBe(true);
 });
 it("URL ve kayıtlı görünüm filtresi tekrar ayrıştırılabilir",()=>{
  const f=filtersSchema.parse({tagIds:`${a},${b}`,tagMatch:"all"});expect(filtersSchema.parse(f)).toEqual(f);
  expect(filtersSchema.safeParse({tagIds:a,untagged:true}).success).toBe(false);
 });
 it("kişisel etiket ekip/doğrudan göreve taşınamaz",()=>{
  const tag={scope:"personal",owner_id:a} as TaskTag;
  expect(compatibleTag(tag,{visibility:"private",created_by:a,board_id:null},[])).toBe(true);
  expect(compatibleTag(tag,{visibility:"direct",created_by:a,board_id:null},[])).toBe(false);
  expect(compatibleTag(tag,{visibility:"private",created_by:b,board_id:null},[])).toBe(false);
 });
 it("SQL ve istemci paleti/sınırı ayrışmaz",()=>{
  const sql=readFileSync("supabase/migrations/20260912200000_task_tags.sql","utf8");
  expect(sql).toContain(`color_hue in (${tagHues.join(",")})`);
  expect(sql).toContain("cardinality(tag_ids)<=10");
 });
});
