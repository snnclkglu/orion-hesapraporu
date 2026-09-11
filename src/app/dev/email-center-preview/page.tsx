import { notFound } from 'next/navigation';
import { EmailCenter } from '@/app/(app)/admin/email-center/email-center';
import { defaultContent,renderTemplate } from '@/lib/email-center/render';
import { StandaloneEmailPreview } from '@/app/(app)/admin/email-center/standalone-preview';
import { eventLabels,fieldLabels } from '@/lib/email-center/model';
export default async function EmailCenterPreview({searchParams}:{searchParams:Promise<{template?:string}>}){
  if(process.env.NODE_ENV!=='development')notFound();
  if((await searchParams).template)return <main className="mx-auto max-w-5xl p-4"><StandaloneEmailPreview version={1} payload={renderTemplate(defaultContent,{'notification.title':'E-posta bağlantısı denemesi','recipient.name':'Deneme alıcısı','links.job':'https://app.orioncranes.com/jobs'})}/></main>;
  return <main className="mx-auto max-w-7xl p-4 sm:p-6"><EmailCenter previewOnly initial={{
    settings:{paused:false,test_address:'scolakoglu@orioncranes.com'},templates:[],versions:[],rules:[],deliveries:[],total:0,people:[],jobs:[],events:[],audit:[],page:0,
    connection:{sending:true,webhook:false,production:false},catalog:{events:eventLabels,fields:fieldLabels},defaultContent,
  }}/></main>;
}
