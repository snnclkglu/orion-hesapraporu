/* Gerçek bileşenler; programatik hareket/klavye alanı fiziksel cihaz kabulü değildir. */
const fs=require('node:fs'),path=require('node:path');
const safari=process.argv.includes('--webkit');
if(safari)process.env.PLAYWRIGHT_BROWSERS_PATH=path.resolve('tmp/playwright-browsers');
const {chromium,webkit,expect}=require('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/test');
expect.setTimeout?.(20000);
const out=path.resolve(process.env.TASK_CHECK_OUTPUT||'artifacts/task-014-'+(safari?'webkit':'chromium'));
const baseUrl=process.env.TASK_PREVIEW_URL||'http://localhost:3000';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await(safari?webkit:chromium).launch({headless:true,...(safari?{}:{channel:'msedge'})});
 const checks=[],errors=[];
 try{
 for(const width of (process.argv.find(a=>a.startsWith('--width='))?[Number(process.argv.find(a=>a.startsWith('--width=')).split('=')[1])]:[320,360,390,430,768,820,1024,1280,1440])){
  const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<=1280,isMobile:width<768});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(60000);
  await page.goto(`${baseUrl}/dev/panel-preview`,{waitUntil:'networkidle'});
  // Önizlemedeki PageHeader portalı istemcide yerinde açılır; SSR tek başına hazır değildir.
  await expect(page.getByRole('heading',{name:'Panel',exact:true})).toBeVisible({timeout:20000});
  await page.addStyleTag({content:'nextjs-portal{display:none!important}'});
  for(const theme of ['light','dark']){
   console.log(`Kontrol: ${width} ${theme}`);
   await page.evaluate(theme=>{document.documentElement.classList.remove('light','dark');document.documentElement.classList.add(theme);},theme);
   await page.evaluate(()=>document.fonts.ready);
   // Tema değişiminden sonra WebKit'in yeni düzeni boyamasını bekler; liste de görsel kanıttır.
   await page.screenshot({path:path.join(out,`list-${width}-${theme}.png`)});
   await page.evaluate(()=>{window.__taskTestEvents=[];for(const type of ['pointerdown','pointerup','click'])document.addEventListener(type,e=>window.__taskTestEvents.push({type,target:e.target.outerHTML.slice(0,180),x:e.clientX,y:e.clientY,scroll:scrollY,coarse:matchMedia('(pointer:coarse)').matches,rect:document.querySelector('.tw-task-body').getBoundingClientRect().toJSON()}),{capture:true,once:true});});
   await page.locator('.tw-task-body').first().click();try{await expect(page.getByLabel('Görev başlığını düzenle')).toBeVisible({timeout:20000});}catch(e){console.log(await page.evaluate(()=>({url:location.href,events:window.__taskTestEvents})));await page.screenshot({path:path.join(out,`failed-${width}-${theme}.png`)});throw e;}
   await bounds(page,`detail ${width} ${theme}`);
   await page.screenshot({path:path.join(out,`detail-${width}-${theme}.png`)});
   await page.getByRole('button',{name:'Kapat',exact:true}).click();
   await page.locator('.tw-mobile-create:visible,.tw-desktop-create:visible').first().click();
   await expect(page.getByLabel('Görev başlığı',{exact:true})).toBeVisible();
   await bounds(page,`create ${width} ${theme}`);
   if(width<=1280)expect(await page.getByLabel('Görev başlığı',{exact:true}).evaluate(el=>el===document.activeElement)).toBe(false);
   await page.screenshot({path:path.join(out,`create-${width}-${theme}.png`)});
   await page.getByRole('button',{name:'Kapat',exact:true}).click();
   checks.push({width,theme,detail:true,create:true});
  }
  if(width===390||width===820){
   await page.locator('.tw-mobile-create:visible,.tw-desktop-create:visible').first().click();
   await page.getByLabel('Görev başlığı',{exact:true}).fill('Klavye alanı ve taslak kontrolü');
   await page.evaluate(()=>{Object.defineProperty(window.visualViewport,'height',{configurable:true,get:()=>360});Object.defineProperty(window.visualViewport,'offsetTop',{configurable:true,get:()=>75});window.visualViewport.dispatchEvent(new Event('resize'));});
   await page.waitForTimeout(400);await bounds(page,`keyboard ${width}`);
   await page.screenshot({path:path.join(out,`keyboard-${width}.png`)});
   page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Kapat',exact:true}).click();
   await expect(page.getByLabel('Görev başlığı',{exact:true})).toHaveValue('Klavye alanı ve taslak kontrolü');
   page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Kapat',exact:true}).click();
   await page.evaluate(()=>{delete window.visualViewport.height;delete window.visualViewport.offsetTop;window.visualViewport.dispatchEvent(new Event('resize'));});
   checks.push({width,keyboard:true,draftCancel:true});
  }
  if(width===390){
   const title=await page.locator('.tw-task-body').first().getAttribute('aria-label');
   await gesture(page,160,10);await expect(page.getByText('Görev arşivlendi',{exact:true})).toBeVisible();
   await expect(page.getByRole('button',{name:title,exact:true})).toHaveCount(0);
   await page.getByRole('button',{name:'Geri al',exact:true}).last().click();await expect(page.getByRole('button',{name:title,exact:true})).toBeVisible();
   await gesture(page,30,3);await expect(page.getByRole('dialog')).toHaveCount(0);
   await gesture(page,15,90);await expect(page.getByRole('dialog')).toHaveCount(0);
   await cancelGesture(page,false);await expect(page.getByRole('button',{name:title,exact:true})).toBeVisible();
   await cancelGesture(page,true);await expect(page.getByRole('button',{name:title,exact:true})).toBeVisible();
   await gesture(page,-160,5);await expect(page.getByRole('heading',{name:'Tarih değiştir / Ertele',exact:true})).toBeVisible();
   await page.getByRole('button',{name:/Yarın/}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
   await hold(page);await expect(page.getByRole('heading',{name:'Hızlı işlemler'})).toBeVisible();
   await page.getByRole('button',{name:'Beklemede',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
   await page.locator('.tw-row-menu').first().click();await page.getByRole('button',{name:'Etiketler',exact:true}).click();
   await page.getByRole('button',{name:'TEKLİF',exact:true}).click();
   await page.getByRole('button',{name:'Yeni etiket oluştur',exact:true}).click();await page.getByLabel('Etiket adı',{exact:true}).fill('Test kategori');
   await page.getByRole('button',{name:'Turuncu',exact:true}).click();await page.getByRole('button',{name:'Kaydet',exact:true}).click();
   await expect(page.getByRole('button',{name:'TEST KATEGORİ',exact:true})).toBeVisible();
   await page.getByRole('button',{name:'Bitti',exact:true}).click();await expect(page.locator('.tw-tag-dialog')).toHaveCount(0);await page.locator('.tw-action-dialog').getByRole('button',{name:'Kapat',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
   await expect(page.locator('.tw-task').first().locator('.tw-tag')).toHaveCount(2);await expect(page.locator('.tw-task').first().getByText('+1',{exact:true})).toBeVisible();
   await page.locator('.tw-task-body').first().click();await expect(page.locator('.tw-detail-dialog').getByText('TEST KATEGORİ',{exact:true})).toBeVisible();
   await page.getByRole('button',{name:'Görevi iptal et',exact:true}).click();
   const cancellation=page.locator('.tw-cancel-dialog');
   await expect(cancellation.getByRole('button',{name:'İptal et ve kaydet'})).toBeDisabled();
   await cancellation.getByLabel('İptal nedeni',{exact:true}).fill('Yanlışlıkla açılan görev testi');
   await bounds(page,'cancel 390');await cancellation.getByRole('button',{name:'İptal et ve kaydet'}).click();
   await expect(cancellation).toHaveCount(0);await expect(page.getByText('Bu görev iptal edildi',{exact:true})).toBeVisible();
   await expect(page.locator('.tw-cancellation-history')).toContainText('Yanlışlıkla açılan görev testi');
   await page.getByRole('button',{name:'Görevi yeniden aç',exact:true}).click();
   await expect(page.getByText('Bu görev iptal edildi',{exact:true})).toHaveCount(0);
   await expect(page.locator('.tw-cancellation-history article')).toHaveCount(2);
   await page.getByRole('button',{name:'Kapat',exact:true}).click();
   await page.locator('.tw-mobile-create:visible,.tw-desktop-create:visible').first().click();
   await page.getByLabel('Görev başlığı',{exact:true}).fill('Yön değişiminde korunan taslak');
   await page.setViewportSize({width:820,height:390});await bounds(page,'landscape draft');
   await expect(page.getByLabel('Görev başlığı',{exact:true})).toHaveValue('Yön değişiminde korunan taslak');
   await page.screenshot({path:path.join(out,'landscape-draft.png')});
   await page.setViewportSize({width:390,height:900});page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Kapat',exact:true}).click();
   checks.push({width,archiveUndo:true,shortCancel:true,verticalCancel:true,pointerCancel:true,multiPointerCancel:true,leftDate:true,longPressStatus:true,tagCreateAndAssign:true,cancellationReasonAndAudit:true,reactivation:true,landscapeDraft:true});
  }
  await context.close();
 }
 expect(errors).toEqual([]);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks:checks.length,errors,out}));
 }finally{await browser.close();}
 async function bounds(page,label){const r=await page.getByRole('dialog').last().evaluate(el=>{const r=el.getBoundingClientRect(),v=visualViewport;return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,vLeft:v.offsetLeft,vRight:v.offsetLeft+v.width,vTop:v.offsetTop,vBottom:v.offsetTop+v.height,overflow:el.scrollWidth-el.clientWidth};});expect(r.left,label).toBeGreaterThanOrEqual(r.vLeft-1);expect(r.right,label).toBeLessThanOrEqual(r.vRight+1);expect(r.top,label).toBeGreaterThanOrEqual(r.vTop-1);expect(r.bottom,label).toBeLessThanOrEqual(r.vBottom+1);expect(r.overflow,label).toBeLessThanOrEqual(1);}
 async function gesture(page,dx,dy){const node=page.locator('.tw-task-body').first();await node.scrollIntoViewIfNeeded();const r=await node.boundingBox();const x=r.x+r.width/2,y=r.y+r.height/2;await node.dispatchEvent('pointerdown',{pointerId:1,pointerType:'touch',isPrimary:true,clientX:x,clientY:y});await node.dispatchEvent('pointermove',{pointerId:1,pointerType:'touch',isPrimary:true,clientX:x+dx,clientY:y+dy});await node.dispatchEvent('pointerup',{pointerId:1,pointerType:'touch',isPrimary:true,clientX:x+dx,clientY:y+dy});await page.waitForTimeout(750);}
 async function hold(page){const node=page.locator('.tw-task-body').first();await node.scrollIntoViewIfNeeded();const r=await node.boundingBox();await node.dispatchEvent('pointerdown',{pointerId:2,pointerType:'touch',isPrimary:true,clientX:r.x+50,clientY:r.y+15});await page.waitForTimeout(550);await node.dispatchEvent('pointerup',{pointerId:2,pointerType:'touch',isPrimary:true,clientX:r.x+50,clientY:r.y+15});await page.waitForTimeout(750);}
 async function cancelGesture(page,multi){const node=page.locator('.tw-task-body').first(),r=await node.boundingBox(),point={pointerId:3,pointerType:'touch',isPrimary:true,clientX:r.x+50,clientY:r.y+15};await node.dispatchEvent('pointerdown',point);await node.dispatchEvent('pointermove',{...point,clientX:point.clientX+160});await node.dispatchEvent(multi?'pointerdown':'pointercancel',multi?{...point,pointerId:4,isPrimary:false}:point);await node.dispatchEvent('pointerup',point);await page.waitForTimeout(750);}
})().catch(e=>{console.error(e);process.exitCode=1;});
