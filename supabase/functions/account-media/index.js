// Anahtar Supabase çalışma ortamında kalır; yanıt, log veya yerel ayara aktarılmaz.
import { createClient } from "npm:@supabase/supabase-js@2.110.7";
import { inspectWebp } from "./webp.js";
const reply = (value, status=200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
Deno.serve(async request => {
  try {
    if (request.method !== "POST") return reply({ error: "Yalnız POST" },405);
    const token = request.headers.get("authorization");
    if (!token?.startsWith("Bearer ")) return reply({ error: "Oturum gerekli" },401);
    const url = Deno.env.get("SUPABASE_URL");
    const userDb = createClient(url,Deno.env.get("SUPABASE_ANON_KEY"),{global:{headers:{Authorization:token}},auth:{persistSession:false}});
    const {data:{user},error:authError} = await userDb.auth.getUser();
    if (authError || !user) return reply({error:"Oturum gerekli"},401);
    const { data: allowed, error: rateError } = await userDb.rpc("account_media_rate_limit");
    if (rateError || !allowed) return reply({error:"Çok sık işlem yapıldı. Bir dakika sonra deneyin."},429);
    const reader = request.body?.getReader(); if (!reader) return reply({error:"Görsel gerekli"},400);
    const chunks=[]; let size=0;
    while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>14500000){await reader.cancel();return reply({error:"Dosya büyük"},413);}chunks.push(part.value);}
    const raw=new Uint8Array(size);let offset=0;for(const chunk of chunks){raw.set(chunk,offset);offset+=chunk.length;}
    const data=JSON.parse(new TextDecoder().decode(raw));
    if (!['account-avatars','feedback-images'].includes(data.bucket) || typeof data.path!=="string" || typeof data.image!=="string") return reply({error:"Geçersiz görsel"},422);
    const uuid='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
    const pattern=data.bucket==='account-avatars' ? new RegExp(`^${user.id}/${uuid}/(64|256)\\.webp$`) : new RegExp(`^${user.id}/(${uuid})/([0-2])-${uuid}\\.webp$`);
    const match=data.path.match(pattern);if(!match)return reply({error:"Dosya yolu yetkisiz"},403);
    if(data.bucket==='feedback-images'){
      const {data:feedback,error}=await userDb.from('app_feedback').select('id,submitted_at,expected_files,created_at').eq('id',match[1]).eq('user_id',user.id).single();
      if(error || !feedback || feedback.submitted_at || Number(match[2])>=feedback.expected_files || Date.now()-Date.parse(feedback.created_at)>86400000)return reply({error:"Taslak yüklemeye açık değil"},403);
    }
    const bytes=Uint8Array.from(atob(data.image),c=>c.charCodeAt(0));
    const dimensions=inspectWebp(bytes,data.bucket==='account-avatars'?256:1800);
    if(data.bucket==='account-avatars' && (dimensions.width!==Number(match[1]) || dimensions.height!==Number(match[1])))return reply({error:"Fotoğraf boyutu geçersiz"},422);
    const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false}});
    const {error}=await admin.storage.from(data.bucket).upload(data.path,bytes,{contentType:'image/webp',upsert:false});
    if(error)return reply({error:"Görsel kaydedilemedi. Yeniden deneyin."},409);
    return reply({ok:true});
  } catch { return reply({error:"Görsel işlenemedi. Dosyayı kontrol edin."},422); }
});
