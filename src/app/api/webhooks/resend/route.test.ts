import { beforeEach,describe,expect,it,vi } from 'vitest';
import { Webhook } from 'svix';
const mocks=vi.hoisted(()=>({upsert:vi.fn(),rpc:vi.fn()}));
vi.mock('@/lib/supabase/admin',()=>({createAdminClient:()=>({from:()=>({upsert:mocks.upsert}),rpc:mocks.rpc})}));
import { POST } from './route';
const secret=`whsec_${Buffer.from('test-secret-with-enough-entropy').toString('base64')}`;
function request(body:string,signed=true){const id='msg_test';const now=new Date();const wh=new Webhook(secret);
  return new Request('https://app.orioncranes.com/api/webhooks/resend',{method:'POST',body,headers:{'svix-id':id,'svix-timestamp':String(Math.floor(now.getTime()/1000)),'svix-signature':signed?wh.sign(id,now,body):'invalid'}});}
describe('Resend teslim kapısı',()=>{
  beforeEach(()=>{vi.stubEnv('RESEND_WEBHOOK_SECRET',secret);mocks.upsert.mockReset().mockResolvedValue({error:null});mocks.rpc.mockReset().mockResolvedValue({error:null});});
  it('İmzasız isteği veritabanına yazmadan reddeder',async()=>{expect((await POST(request('{}',false))).status).toBe(400);expect(mocks.upsert).not.toHaveBeenCalled();});
  it('Doğru imzayı ham gövdede doğrular ve yalnız teslim metadatasını saklar',async()=>{
    const body=JSON.stringify({type:'email.delivered',created_at:new Date().toISOString(),data:{email_id:'provider-1',to:['private@example.com'],html:'private body'}});
    expect((await POST(request(body))).status).toBe(200);
    expect(mocks.upsert.mock.calls[0][0]).not.toHaveProperty('data');
    expect(mocks.rpc).toHaveBeenCalledWith('email_reconcile_delivery',{p_provider:'provider-1'});
  });
  it('İmza üretildikten sonra değişmiş gövdeyi reddeder',async()=>{
    const original=request('{}');const altered=new Request(original.url,{method:'POST',body:'{"changed":true}',headers:original.headers});
    expect((await POST(altered)).status).toBe(400);
  });
  it('Veritabanı hatasında sağlayıcının yeniden deneyebilmesi için 503 döner',async()=>{
    mocks.upsert.mockResolvedValue({error:{message:'offline'}});
    const body=JSON.stringify({type:'email.delivered',created_at:new Date().toISOString(),data:{email_id:'provider-1'}});
    expect((await POST(request(body))).status).toBe(503);
  });
});
