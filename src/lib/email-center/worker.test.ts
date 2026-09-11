import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({rpc:vi.fn(),from:vi.fn(),getUser:vi.fn(),updates:[] as Record<string,unknown>[]}));
vi.mock('@/lib/supabase/admin',()=>({createAdminClient:()=>({rpc:mocks.rpc,from:mocks.from,auth:{admin:{getUserById:mocks.getUser}}})}));
import {captureNotificationEvents,emailCenterEnabled,processEmailCenter} from './worker';
const row={id:'delivery-1',attempts:1,mode:'test',recipient:'scolakoglu@orioncranes.com',payload:{subject:'Deneme',to:['scolakoglu@orioncranes.com']}};
let settings={paused:false,test_address:row.recipient};
let ruleMode='test';
function queued(value:Record<string,unknown>={}) {
  mocks.rpc.mockImplementation(async(name:string)=>({data:name==='email_claim_delivery'?[{...row,...value}]:[],error:null}));
}
describe('Kalıcı e-posta işleyicisi',()=>{
  beforeEach(()=>{
    vi.stubEnv('EMAIL_NOTIFICATIONS_ENABLED','true');vi.stubEnv('VERCEL_ENV','production');vi.stubEnv('RESEND_API_KEY','test-key');
    mocks.rpc.mockReset().mockResolvedValue({data:[],error:null});mocks.getUser.mockReset();mocks.updates.length=0;
    settings={paused:false,test_address:row.recipient};ruleMode='test';
    mocks.from.mockImplementation((table:string)=>{
      const query:Record<string,unknown>={};
      for(const method of ['select','eq','in','limit'])query[method]=()=>query;
      query.single=async()=>({data:table==='email_settings'?settings:{mode:ruleMode},error:null});
      query.update=(value:Record<string,unknown>)=>{mocks.updates.push(value);return query;};
      query.then=(resolve:(value:unknown)=>void)=>resolve({data:[],error:null});return query;
    });
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({id:'provider-1'}))));
  });
  afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
  it('Önizleme ortamı ne olay yazar ne gönderim yapar',async()=>{
    vi.stubEnv('VERCEL_ENV','preview');expect(emailCenterEnabled()).toBe(false);
    await captureNotificationEvents([{id:'n',user_id:'u',title:'Görev',href:'/jobs/1',kind:'gorev_atandi'}]);
    expect(await processEmailCenter()).toEqual({processed:0,disabled:true});expect(mocks.rpc).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();
  });
  it('Bir bildirim grubunu tek olay ve tekil alıcılarla kaydeder',async()=>{
    const notification={id:'n1',user_id:'u1',title:'Görev',href:'/jobs/1',kind:'gorev_atandi'};
    await captureNotificationEvents([notification,{...notification,id:'n2',user_id:'u2'},{...notification,id:'n3'}]);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);expect(mocks.rpc.mock.calls[0][1]).toMatchObject({p_source:'notification/n1',p_targets:['u1','u2']});
  });
  it('Durdurma ve değişen kural gönderimden hemen önce uygulanır',async()=>{
    queued({rule_id:'rule-1'});ruleMode='off';await processEmailCenter(1);
    expect(fetch).not.toHaveBeenCalled();expect(mocks.updates[0].status).toBe('cancelled');
    queued();settings.paused=true;await processEmailCenter(1);expect(fetch).not.toHaveBeenCalled();
  });
  it('Adres değişmişse eski test adresine göndermez',async()=>{
    queued();settings.test_address='new@example.com';await processEmailCenter(1);expect(fetch).not.toHaveBeenCalled();
  });
  it('Doğrulaması olmayan canlı alıcıya göndermez',async()=>{
    queued({mode:'live',user_id:'user-1'});mocks.getUser.mockResolvedValue({data:{user:{email:row.recipient}},error:null});
    await processEmailCenter(1);expect(fetch).not.toHaveBeenCalled();expect(mocks.updates[0].status).toBe('skipped');
  });
  it('Belirsiz sonuçta aynı mesaj gövdesini ve anahtarı yeniden kullanır',async()=>{
    queued();vi.mocked(fetch).mockRejectedValueOnce(new Error('timeout'));
    await processEmailCenter(1);expect(mocks.updates[0].status).toBe('pending');
    queued({attempts:2});await processEmailCenter(1);
    expect(vi.mocked(fetch).mock.calls[0][1]?.body).toBe(vi.mocked(fetch).mock.calls[1][1]?.body);
    expect(vi.mocked(fetch).mock.calls[1][1]?.headers).toMatchObject({'Idempotency-Key':'email-center/delivery-1'});
    expect(mocks.rpc).toHaveBeenCalledWith('email_reconcile_delivery',{p_provider:'provider-1'});
  });
  it('Kalıcı sağlayıcı hatasını sonsuza kadar denemez',async()=>{
    queued();vi.mocked(fetch).mockResolvedValue(new Response('{}',{status:422}));await processEmailCenter(1);
    expect(mocks.updates[0].status).toBe('failed');
  });
});
