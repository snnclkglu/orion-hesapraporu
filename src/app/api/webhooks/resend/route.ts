import { Webhook } from 'svix';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
export const runtime='nodejs';
const payloadSchema=z.object({type:z.enum(['email.sent','email.delivered','email.delivery_delayed','email.bounced','email.complained','email.failed','email.suppressed']),
  created_at:z.string().datetime({offset:true}),data:z.object({email_id:z.string().min(1).max(200)})});
export async function POST(request:Request){
  const secret=process.env.RESEND_WEBHOOK_SECRET;
  if(!secret)return Response.json({error:'Teslim bağlantısı yapılandırılmamış.'},{status:503});
  if(Number(request.headers.get('content-length'))>100_000)return new Response(null,{status:413});
  const body=await request.text();if(Buffer.byteLength(body)>100_000)return new Response(null,{status:413});
  let payload:unknown;
  try{new Webhook(secret).verify(body,{'svix-id':request.headers.get('svix-id')??'',
    'svix-timestamp':request.headers.get('svix-timestamp')??'','svix-signature':request.headers.get('svix-signature')??''});payload=JSON.parse(body);}
  catch{return Response.json({error:'İmza doğrulanamadı.'},{status:400});}
  const parsed=payloadSchema.safeParse(payload);if(!parsed.success)return Response.json({ignored:true});
  const event=parsed.data;
  try{
    const db=createAdminClient();const {error}=await db.from('email_webhook_events').upsert({id:request.headers.get('svix-id'),
      provider_id:event.data.email_id,event_type:event.type,occurred_at:event.created_at},{onConflict:'id',ignoreDuplicates:true});
    if(error)throw new Error();
    const result=await db.rpc('email_reconcile_delivery',{p_provider:event.data.email_id});if(result.error)throw new Error();
    return Response.json({received:true});
  }catch{return Response.json({error:'Teslim sonucu kaydedilemedi.'},{status:503});}
}
