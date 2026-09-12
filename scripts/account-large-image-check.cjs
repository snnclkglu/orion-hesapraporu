/* Gerçek kayıt oluşturmadan Vercel sınırını aşan PNG ve HEIC aktarımını sınar. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const safari=process.argv.includes('--webkit');
if(safari)process.env.PLAYWRIGHT_BROWSERS_PATH=path.resolve('tmp/playwright-browsers');
const {chromium,webkit,expect}=require('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/test');
(async()=>{
 const output='artifacts/task-release';fs.mkdirSync(output,{recursive:true});
 const browser=await(safari?webkit:chromium).launch({headless:true,...(safari?{}:{channel:'msedge'})});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const png=await sharp(crypto.randomBytes(2000*1200*3),{raw:{width:2000,height:1200,channels:3}}).png().toBuffer();
 const sample=fs.readFileSync('artifacts/account-mobile/example.heic');
 const free=Buffer.alloc(4000000);free.writeUInt32BE(free.length,0);free.write('free',4);
 const cases=[{name:'large.png',mimeType:'image/png',buffer:png},{name:'large.heic',mimeType:'image/heic',buffer:Buffer.concat([sample,free])}];
 const results=[];
 try{
  for(const file of cases){
   if(file.buffer.length<=3500000||file.buffer.length>10485760)throw Error('Kontrol dosyası sınır dışında');
   await page.goto('http://localhost:3000/dev/account-preview',{waitUntil:'networkidle'});
   await page.getByLabel('Fotoğraf seç',{exact:true}).setInputFiles(file);
   const image=page.getByAltText('Fotoğraf kırpma önizlemesi');
   await expect(image).toBeVisible({timeout:60000});
   const data=await image.evaluate(async img=>({width:img.naturalWidth,height:img.naturalHeight,bytes:(await(await fetch(img.src)).blob()).size}));
   if(data.bytes>3500000||Math.max(data.width,data.height)>1800)throw Error('Aktarım küçülmedi');
   results.push({file:file.name,inputBytes:file.buffer.length,...data});
   await page.getByRole('button',{name:'Fotoğrafı kullan',exact:true}).click();
   await expect(image).toHaveCount(0);
  }
  if(errors.length)throw Error(errors.join('\n'));
  fs.writeFileSync(`${output}/large-images-${safari?'webkit':'chromium'}.json`,JSON.stringify({physicalDevice:false,results,errors},null,2));
  console.log(JSON.stringify({results,errors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
