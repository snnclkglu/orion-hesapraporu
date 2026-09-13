import { beforeEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { manualFromTemplate } from "../payload";
import { upgradeManualDesign } from "../rich-content";

vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({render:vi.fn(),sources:vi.fn()}));
vi.mock("../export-server",()=>({renderManualResponse:mocks.render}));
vi.mock("@/app/(app)/projects/[id]/manual/sources-data",()=>({buildManualSourceData:mocks.sources}));
import { publishManualDelivery } from "../delivery-server";

const upload=vi.fn(),remove=vi.fn(),rpc=vi.fn();
const db={storage:{from:()=>({upload,remove})},rpc} as unknown as SupabaseClient;
const payload=upgradeManualDesign(manualFromTemplate({}));
beforeEach(()=>{
  vi.resetAllMocks();upload.mockResolvedValue({error:null});remove.mockResolvedValue({error:null});rpc.mockResolvedValue({error:null});
  mocks.sources.mockResolvedValue({equipment:[]});
  mocks.render.mockImplementation(async(_db,_p,_r,full,options)=>{options.onManifest({appendices:[],source:"test"});return new Response(full?"FULL":"BODY");});
});
it("iki dosyayı değişmez yollarla saklar, özet ve hash ile tek işlemde yayımlar",async()=>{
  expect(await publishManualDelivery(db,"p","r",payload,payload)).toBeNull();expect(upload).toHaveBeenCalledTimes(2);
  const args=rpc.mock.calls[0][1];expect(args.p_archive.body.sha256).toBe(createHash("sha256").update("BODY").digest("hex"));
  expect(args.p_archive.full.sha256).toBe(createHash("sha256").update("FULL").digest("hex"));
  expect(args.p_expected).toEqual(payload);expect(remove).not.toHaveBeenCalled();
  expect(upload.mock.calls[0][2].upsert).toBe(false);
});
it("eksik ekte yayın yapmaz, yalnız bu denemede yüklenen dosyayı temizler",async()=>{
  mocks.render.mockResolvedValueOnce(new Response("BODY")).mockResolvedValueOnce(new Response("Seçili ek eksik",{status:422}));
  expect(await publishManualDelivery(db,"p","r",payload,payload)).toBe("Seçili ek eksik");expect(rpc).not.toHaveBeenCalled();expect(remove).toHaveBeenCalledWith([upload.mock.calls[0][0]]);
});
it("üretim sırasında değişen kaynakta taslağı korur",async()=>{
  mocks.sources.mockResolvedValueOnce({a:1}).mockResolvedValueOnce({a:2});
  expect(await publishManualDelivery(db,"p","r",payload,payload)).toContain("kaynaklar değişti");expect(rpc).not.toHaveBeenCalled();expect(remove).toHaveBeenCalledTimes(1);
});
it("başka oturumun taslağını ezmez; atomik kayıt reddinde dosyaları temizler",async()=>{
  rpc.mockResolvedValue({error:{message:"Taslak başka oturumda değişti"}});
  expect(await publishManualDelivery(db,"p","r",payload,payload)).toContain("başka oturumda");expect(remove).toHaveBeenCalledTimes(1);
});
