/* Fiziksel iPhone klavyesi ayrı kabul edilir; burada tarayıcı ve taşma ölçülür. */
const fs=require('node:fs'),path=require('node:path');
const safari=process.argv.includes('--webkit');
if(safari)process.env.PLAYWRIGHT_BROWSERS_PATH=path.resolve('tmp/playwright-browsers');
const {chromium,webkit,expect}=require('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/test');
(async()=>{
 const out=path.resolve('artifacts/integrations-'+(safari?'webkit':'chromium'));fs.mkdirSync(out,{recursive:true});
 const browser=await(safari?webkit:chromium).launch({headless:true,...(safari?{}:{channel:'msedge'})});
 const results=[],errors=[];
 for(const width of [320,360,375,390,430,768,1440]){
  const ctx=await browser.newContext({viewport:{width,height:900},isMobile:width<768,hasTouch:width<1024});
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto((process.env.INTEGRATION_TEST_URL||'http://localhost:3000')+'/dev/integrations-preview',{waitUntil:'networkidle',timeout:90000});
  await page.addStyleTag({content:'nextjs-portal{display:none!important}'});
  const check=async(label)=>{
   const overflow=await page.evaluate(()=>[...document.querySelectorAll('.int-page,.int-page input,.int-page select,.int-page pre,.int-page code,.int-page .ac-card')].filter(el=>{const r=el.getBoundingClientRect();return r.width&&r.height&&(r.left < -1||r.right>innerWidth+1||el.scrollWidth>el.clientWidth+2);}).map(el=>el.tagName+'.'+el.className));
   expect(overflow,`${width} ${label}`).toEqual([]);results.push({width,label});
  };
  for(const tab of ['Genel bakış','Ajanlar','Uç noktalar','İstekler','Rehber']){
   await page.getByRole('button',{name:tab,exact:true}).click();
   for(const theme of ['light','dark']){
    await page.evaluate(t=>{document.documentElement.classList.remove('light','dark');document.documentElement.classList.add(t);},theme);
    await check(tab+' '+theme);
    if(width===390||width===1440)await page.screenshot({path:path.join(out,`${tab}-${width}-${theme}.png`),fullPage:true});
   }
   if(tab==='Uç noktalar'){
    await page.locator('.int-endpoint summary').first().click();await check('Uç ayrıntısı');
   }
  }
  await page.getByRole('button',{name:'Ajanlar',exact:true}).click();
  await page.getByRole('button',{name:'Yeni ajan',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  if(width<768)expect(await page.locator(':focus').evaluate(el=>el.tagName)).not.toBe('INPUT');
  await page.getByLabel('Ajan adı',{exact:true}).last().fill('Mobil test');
  await check('Yeni ajan penceresi');
  await page.keyboard.press('Escape');
  await ctx.close();
 }
 await browser.close();expect(errors).toEqual([]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({results,errors},null,2));console.log(`${results.length} mobil/görsel kontrol geçti (${safari?'WebKit':'Chromium'}).`);
})().catch(e=>{console.error(e);process.exit(1);});
