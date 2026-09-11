import sanitizeHtml from 'sanitize-html';
import { contentSchema, fields, type EmailContext, type TemplateContent } from './model';
import { appOrigin, emailFrom, emailReplyTo } from '@/lib/email/message';

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const allowedFields = new Set<string>(fields);
type Node = { text: string } | { field: string } | { condition: string; children: Node[] };

/** Küçük, kapalı dil: değişken ve #if. Kod, üçlü süslü parantez ve keyfi ifade yoktur. */
function parse(source: string): Node[] {
  const root: Node[] = []; const stack = [root];
  const tokens = source.split(/(\{\{[\s\S]*?\}\})/g);
  for (const token of tokens) {
    if (!token.startsWith('{{')) { if (/[{}]{2}/.test(token)) throw new Error('Şablon parantezleri geçersiz.'); stack.at(-1)!.push({text:token}); continue; }
    const value = token.slice(2,-2).trim();
    if (value === '/if') { if (stack.length === 1) throw new Error('Eşleşmeyen /if.'); stack.pop(); continue; }
    const condition = value.startsWith('#if ') ? value.slice(4).trim() : null;
    const field = condition ?? value;
    if (!allowedFields.has(field)) throw new Error(`Bilinmeyen alan: ${field}`);
    if (condition) { if (stack.length > 12) throw new Error('Koşullar çok iç içe.'); const children: Node[]=[]; stack.at(-1)!.push({condition,children}); stack.push(children); }
    else stack.at(-1)!.push({field});
  }
  if (stack.length !== 1) throw new Error('Kapatılmamış #if.');
  return root;
}
function fill(nodes: Node[], context: EmailContext, html: boolean): string {
  return nodes.map(node => {
    if ('text' in node) return node.text;
    if ('condition' in node) return context[node.condition as keyof EmailContext]?.trim() ? fill(node.children,context,html) : '';
    const value = context[node.field as keyof EmailContext] ?? '';
    return html ? escapeHtml(value) : value;
  }).join('');
}
const styleValue = [/^(?!.*(?:url\s*\(|expression\s*\(|javascript|@import|\\))[a-zA-Z0-9\s#%.,()/'"+:!\-]+$/];
const cleanOptions: sanitizeHtml.IOptions = {
  allowedTags: ['html','head','body','title','table','thead','tbody','tfoot','tr','td','th','div','span','p','br','hr','h1','h2','h3','h4','a','img','strong','b','em','i','u','ul','ol','li'],
  allowedAttributes: { '*':['style','class','lang','dir','align','valign','width','height','role'],
    a:['href','title'],img:['src','alt','width','height'],table:['cellpadding','cellspacing','border'],td:['colspan','rowspan'],th:['colspan','rowspan'] },
  allowedSchemes: ['https'], allowProtocolRelative:false,
  allowedStyles: { '*': Object.fromEntries(['color','background-color','background','font-family','font-size','font-weight','font-style','line-height','text-align','text-decoration','letter-spacing','padding','padding-top','padding-bottom','padding-left','padding-right','margin','margin-top','margin-bottom','margin-left','margin-right','border','border-top','border-bottom','border-left','border-right','border-color','border-width','border-style','border-radius','border-collapse','border-spacing','width','max-width','min-width','height','display','vertical-align','white-space','word-break','overflow-wrap'].map(k=>[k,styleValue])) },
  transformTags: {
    a: (tagName, attribs) => {
      try { if (new URL(attribs.href).origin !== appOrigin) delete attribs.href; } catch { delete attribs.href; }
      return { tagName, attribs };
    },
    img: (tagName, attribs) => {
      try { const u=new URL(attribs.src); if (u.protocol!=='https:' || !['app.orioncranes.com','orioncranes.com','www.orioncranes.com'].includes(u.hostname)) delete attribs.src; }
      catch { delete attribs.src; } return {tagName,attribs};
    },
  },
};
export function validateTemplate(input: unknown): TemplateContent {
  const content=contentSchema.parse(input);
  for (const value of [content.subject,content.preheader,content.html,content.text]) parse(value);
  if (/<\s*(script|iframe|object|embed|form|input|style|link|meta|svg|math)\b|\son[a-z]+\s*=/i.test(content.html))
    throw new Error('Çalıştırılabilir içerik ve style etiketi kullanılamaz. E-posta tasarımını satır içi stillerle hazırlayın.');
  return content;
}
export function renderTemplate(input: TemplateContent, context: EmailContext) {
  const content=validateTemplate(input);
  const missing=content.requiredFields.filter(key=>!context[key]?.trim());
  if (missing.length) throw new Error(`Zorunlu alan eksik: ${missing.join(', ')}`);
  if (context['links.job']) { const url=new URL(context['links.job']); if(url.origin!==appOrigin || !/^\/jobs(?:\/|$)/.test(url.pathname)) throw new Error('İş bağlantısı geçersiz.'); }
  const preheader=fill(parse(content.preheader),context,false);
  const html=sanitizeHtml(fill(parse(content.html),context,true),cleanOptions);
  return { from:emailFrom,reply_to:emailReplyTo,subject:fill(parse(content.subject),context,false).replace(/[\r\n]/g,' ').slice(0,250),
    html:`<!doctype html><html lang="tr"><body><div style="display:none;max-height:0;overflow:hidden">${escapeHtml(preheader)}</div>${html}</body></html>`,
    text:fill(parse(content.text),context,false) };
}
export const previewPolicy = "default-src 'none'; img-src https://app.orioncranes.com https://orioncranes.com https://www.orioncranes.com; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'";
export function previewDocument(html: string) {
  return `<!doctype html><html lang="tr"><head><meta http-equiv="Content-Security-Policy" content="${previewPolicy}"><meta name="referrer" content="no-referrer"></head><body>${html}</body></html>`;
}
export const defaultContent: TemplateContent = {
  subject:'ORION · {{notification.title}}',preheader:'{{job.number}} · {{job.customerName}}',
  html:'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF9F7;font-family:Arial,sans-serif;color:#262626"><tr><td align="center" style="padding:24px"><table role="presentation" width="100%" cellpadding="24" cellspacing="0" style="max-width:600px;background-color:#ffffff"><tr><td style="background-color:#262626;color:#ffffff;font-size:24px;font-weight:bold">ORION</td></tr><tr><td><p>Merhaba {{recipient.name}},</p><h1 style="font-size:22px">{{notification.title}}</h1>{{#if job.number}}<p><strong>İş no:</strong> {{job.number}}</p>{{/if}}{{#if job.customerName}}<p><strong>Müşteri:</strong> {{job.customerName}}</p>{{/if}}{{#if job.deliveryDate}}<p><strong>Teslim tarihi:</strong> {{job.deliveryDate}}</p>{{/if}}{{#if publication.revisionLabel}}<p>{{publication.revisionLabel}}</p>{{/if}}<table role="presentation" cellpadding="14" cellspacing="0"><tr><td bgcolor="#A41E1E" style="background-color:#A41E1E"><a href="{{links.job}}" style="color:#ffffff;text-decoration:none;font-weight:bold">Uygulamada görüntüle</a></td></tr></table><p style="font-size:12px;color:#666666">ORION İş Yönetim Sistemi</p></td></tr></table></td></tr></table>',
  text:'Merhaba {{recipient.name}},\n{{notification.title}}\n{{#if job.number}}İş no: {{job.number}}\n{{/if}}{{#if job.customerName}}Müşteri: {{job.customerName}}\n{{/if}}{{#if job.deliveryDate}}Teslim: {{job.deliveryDate}}\n{{/if}}{{links.job}}',
  requiredFields:['notification.title','links.job'],
};
