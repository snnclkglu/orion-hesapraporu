// PDF ve tarayıcı için aynı gerçek font genişlikleri. Kaynak font değişince yeniden çalıştırılır.
const fs=require('node:fs'),crypto=require('node:crypto'),fontkit=require('fontkit');
const result={};for(const [name,file] of [['regular','Archivo-Regular.ttf'],['bold','Archivo-Bold.ttf']]){const bytes=fs.readFileSync('src/assets/fonts/'+file),font=fontkit.create(bytes);const widths={};for(const cp of [...Array(768).keys(),...Array.from({length:128},(_,i)=>8192+i),8594,10003,10007]){const glyph=font.glyphForCodePoint(cp);if(glyph.id)widths[String.fromCodePoint(cp)]=+(glyph.advanceWidth/font.unitsPerEm).toFixed(5);}result[name]={file,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),widths};}
fs.writeFileSync('src/lib/manual/font-metrics.json',JSON.stringify(result));
