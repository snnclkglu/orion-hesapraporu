import type { ManualBlock, ManualPayload, ManualSection } from "./types";
import { manualIllustration, type ManualIllustrationKey } from "./illustrations";
import { modernizeManualContent } from "./rich-content";

/** Referans yalnız konu ve anlatım karşılaştırmasıdır; şekiller ve metinler özgündür.
 * Teknik dayanak / değişiklik kaydı: docs/plans/EL_KITABI_GORSEL_ICERIK_DENETIMI.md.
 * Uygulama açık kullanıcı işlemiyle veya yeni belge oluşturulurken yapılır.
 */
export function illustrateManualContent(input: ManualPayload): ManualPayload {
  if(input.contentEdition===1)return input;
  const payload=modernizeManualContent(input);
  const additions=new Map<string,ManualBlock[]>();
  const media=(key:ManualIllustrationKey,text:string):ManualBlock=>({id:`guide-${key}`,kind:"media",title:"",side:"top",text,media:{diagram:manualIllustration(key),diagramKey:`manual:${key}`},caption:"Şematik anlatım; gerçek donanım ve yerleşim projeye göre değişir."});
  additions.set("tanim.anaParcalar",[{id:"guide-crane",kind:"figure",title:"Vincin ana parçalarını tanıyın",media:{diagram:manualIllustration("crane"),diagramKey:"manual:crane"},caption:"Genel çift kirişli köprülü vinç şemasıdır. Ölçekli montaj resmi değildir; projeye özel görselle değiştirilebilir.",markers:[
    {id:"runway",x:0.16,y:0.61,label:"Vinç yolu",text:"Köprünün üzerinde yürüdüğü ray ve taşıyıcı sistem."},
    {id:"bridge",x:0.66,y:0.46,label:"Ana kirişler",text:"Arabanın hareket ettiği köprü taşıyıcıları."},
    {id:"end",x:0.83,y:0.66,label:"Başlık grubu",text:"Köprüyü vinç yolunda taşıyan tekerlekli yürütme grubu."},
    {id:"trolley",x:0.46,y:0.35,label:"Araba",text:"Kaldırma mekanizmasını köprü üzerinde taşıyan grup."},
    {id:"hoist",x:0.49,y:0.27,label:"Kaldırma grubu",text:"Tahrik, tambur ve halat sistemiyle düşey hareket sağlar."},
    {id:"hook",x:0.50,y:0.83,label:"Kanca bloğu",text:"Uygun kaldırma aksesuarları aracılığıyla yüke bağlanır."},
  ]}]);
  additions.set("kullanim.hareketler",[media("movements","Kumanda üzerindeki yön işaretlerini gerçek hareket yönleriyle eşleştirin. Şemadaki oklar üç temel hareketi açıklar; kumanda tuşlarının yerini veya aynı anda hareket iznini tanımlamaz.")]);
  additions.set("guvenlik.kkd",[media("ppe","Kişisel koruyucular çalışma alanının risk değerlendirmesine göre belirlenir. Koruyucu donanım, yük altında bulunmayı veya tehlikeli bölgeye girmeyi güvenli hâle getirmez.")]);
  additions.set("guvenlik.acilStop",[media("emergency","Acil durdurmadan sonra yük yolunu koruyun ve arızayı bildirin. Tehlike ortadan kaldırılmadan yeniden çalıştırmayın. Acil durdurma bakım için gereken enerji izolasyonunun yerine geçmez.")]);
  additions.set("guvenlik.anaKesici",[media("isolation","Enerji kaynaklarını ve izolasyon noktalarını işe başlamadan önce belirleyin. Kilitleme, etiketleme ve enerjisizliği doğrulama işlemleri yetkili personel tarafından sahaya özgü prosedürle yürütülür.")]);
  additions.set("guvenlik.kimlikPlakalari",[media("plate","Vinç, motor ve redüktör etiketleri farklı ekipmanları tanımlar. Servis talebinde doğru ekipmanın seri numarasını ve etiket fotoğrafını kullanın; okunamayan değeri tahmin etmeyin.")]);
  additions.set("kullanim.yukKurallari",[media("lifting","Kancayı yükün ağırlık merkezinin üzerine getirin. Eğik halatla kaldırma veya yerde sürükleme yapmayın. Yük dengesizse güvenli biçimde yere indirin ve bağlamayı düzeltin; askıdaki yükü elle dengelemeye çalışmayın.")]);
  additions.set("kullanim.savrulma",[media("swing","Salınımı sınırlamak için yumuşak hızlanma ve yavaşlama kullanın. Yükü elle yakalamayın. Salınım giderme manevraları yalnız eğitimli operatör ve ilgili kumanda talimatı kapsamında uygulanır.")]);
  additions.set("kullanim.gunlukKontrol",[media("clearance","İlk hareketten önce yük yolunu, görüşü, engelleri ve çevredeki kişileri kontrol edin. Bir uygunsuzluk tespit edilirse işe başlamayın; sorumluya bildirin ve giderildiği doğrulanana kadar vinci kullanım dışında tutun.")]);
  const procedure=(id:string,title:string,steps:string[]):ManualBlock=>({id,kind:"procedure",title,steps:steps.map((text,i)=>({id:`${id}-${i}`,text,...(id==="guide-lift-steps"?{media:{diagram:manualIllustration((["liftReady","liftReady","liftAttach","liftTrial","liftTravel","liftRelease"] as const)[i]),diagramKey:`manual:${["liftReady","liftReady","liftAttach","liftTrial","liftTravel","liftRelease"][i]}`}}:{})}))});
  const newSections:Record<string,ManualSection[]>={
    tanim:[{id:"guide-safety-functions",key:"tanim.emniyetIslevleri",title:"Emniyet Donanımlarının Görevleri",children:[],blocks:[{id:"guide-safety-table",kind:"table",table:{head:["Donanım / işlev","Görevi","Operatörün dikkat edeceği nokta"],rows:[
      ["Acil durdurma","Tehlikeli hareketlerin durdurulmasını başlatır.","Enerji izolasyonu yerine kullanılmaz."],
      ["Hareket sınırlandırıcı","İlgili hareketin belirlenmiş sınırı aşmasını önler.","Normal duruş için sürekli limite dayanılmaz."],
      ["Fren","İlgili hareketi durdurma / tutma görevini üstlenir.","Kayma veya olağan dışı davranış bildirilir."],
      ["Aşırı yük koruması (varsa)","İzin verilen yükleme sınırlarının korunmasına yardımcı olur.","Devre dışı bırakılmaz; tartım cihazı kabul edilmez."],
      ["Çarpışma önleme (varsa)","İlgili donanımın tanımlı yaklaşmasını sınırlar.","Operatörün görüş ve mesafe kontrolünün yerini almaz."],
    ],caption:"Bu tablo genel işlevleri açıklar. Donanımların bu vinçteki varlığı, kapsamı ve ayarları proje belgelerinden doğrulanır."}}]},
    {id:"guide-environment",key:"tanim.calismaKosullari",title:"Çalışma Koşulları ve Kullanım Sınırları",children:[],blocks:[{id:"guide-environment-text",kind:"text",text:"Kapasite ve sınıflandırma bilgilerini proje künyesinden kontrol edin. Sıcaklık, rüzgâr, patlayıcı ortam, aşındırıcı ortam veya özel yük koşulları için yalnız projede tanımlanmış sınırlar geçerlidir. Yeni veya değişen koşullar varsa uygunluk değerlendirilmeden çalışmaya başlamayın."},{id:"guide-environment-note",kind:"note",level:"onemli",text:"Genel şema, vincin açık hava, patlayıcı ortam, insan kaldırma veya birlikte kaldırma için uygun olduğunu göstermez. Özel kullanım amacı ve çalışma yöntemi ayrı olarak doğrulanmalıdır."}]}],
    kullanim:[
      {id:"guide-lift-sequence",key:"kullanim.kaldirmaSirasi",title:"Yükü Alma ve Taşıma Sırası",children:[],blocks:[
        procedure("guide-lift-steps","Her kaldırmada uygulanacak sıra",[
          "Yükün ağırlığını, ağırlık merkezini ve kullanılacak kaldırma aksesuarlarını doğrulayın. Vincin ve aksesuarların çalışma sınırlarını aşmayın.",
          "Güzergâhı ve indirme yerini hazırlayın. Görüş yeterli değilse görevlendirilmiş sinyalciyle haberleşmeyi kurun.",
          "Kancayı ağırlık merkezinin üzerine konumlandırın. Aksesuarları kendi üretici talimatına göre bağlayın; vinç halatını sapan olarak kullanmayın.",
          "Boşluğu yavaşça alın. Yükü başlangıçta yalnız dengeyi ve tutmayı kontrol edecek kadar kaldırın; uygunsuzlukta indirin.",
          "Yükü engelleri aşacak güvenli yükseklikte, ani hız ve yön değişimlerinden kaçınarak taşıyın. İnsanların üzerinden geçirmeyin.",
          "Hazırlanan indirme yerine yavaşça yaklaşın. Yük dengeli desteklenmeden ve aksesuarlar gevşemeden bağlantıları çözmeyin.",
        ]),{id:"guide-uncertain-load",kind:"note",level:"uyari",text:"Yükün ağırlığı veya bağlamanın uygunluğu bilinmiyorsa kaldırmaya başlamayın. Aşırı yük korumasını yük tartma veya kaldırılabilirliği deneme aracı olarak kullanmayın."}]},
      {id:"guide-landing-section",key:"kullanim.indirme",title:"Yükü İndirme ve Bağlantıyı Çözme",children:[],blocks:[media("landing","İndirme yüzeyini ve destekleri önceden hazırlayın. Eller ve ayaklar yük ile destek arasında bulunmamalıdır. Yük tamamen desteklendikten sonra aksesuarları gevşetin ve güvenli konumdan ayırın.")]},
      {id:"guide-power-loss",key:"kullanim.enerjiKesintisi",title:"Enerji Kesintisi ve Yeniden Başlatma",children:[],blocks:[procedure("guide-power-steps","Beklenmeyen duruş",[
        "Kumandaları duruş konumuna alın. Askıdaki yüke yaklaşılmasını engelleyin ve operatör görüşünü koruyun.",
        "Kesintiyi veya arızayı sorumlu personele bildirin. Freni elle açarak yük indirmeye çalışmayın.",
        "Enerji geri geldiğinde doğrudan harekete başlamayın. Kesinti nedeni, çalışma alanı ve kumanda durumu kontrol edilsin.",
        "Yeniden başlatmayı ilgili ekipmanın talimatına göre gerçekleştirin. Kontroller uygun değilse vinci kullanım dışında bırakın.",
      ]),{id:"guide-rescue",kind:"note",level:"uyari",text:"Askıda kalan yükün güvenli indirilmesi gerekiyorsa üreticinin ekipmana özgü kurtarma yöntemi ve yetkili personel kullanılmalıdır. Bu genel kılavuz bir acil indirme mekanizması bulunduğunu varsaymaz."}]},
    ],
    muayene:[{id:"guide-hook-section",key:"muayene.kanca",title:"Kanca ve Kanca Bloğunun Kontrolü",children:[],blocks:[media("hook","Çatlak şüphesi, kalıcı şekil değişikliği, hasarlı bağlantı veya düzgün çalışmayan kilitleme parçası varsa kullanımı durdurun. Şema genel bir kancayı gösterir; çift ağızlı ve özel kancalarda her yük oturma bölgesi ayrıca değerlendirilir."),{id:"guide-hook-table",kind:"table",table:{head:["Kontrol noktası","İnceleme","Uygunsuzlukta"],rows:[
      ["Gövde ve ağız","Hasar, aşınma, şekil değişikliği","Kullanımı durdur; yetkili muayene iste."],
      ["Mandal / kilit (varsa)","Serbest hareket ve doğru kapanma","Kaldırmaya başlama; bakım bildirimi aç."],
      ["Blok ve bağlantılar","Gevşeme, hasar, olağan dışı hareket","Yetkili personelin değerlendirmesini bekle."],
    ],caption:"Sayısal aşınma ve ağız açılması sınırları ilgili kanca üreticisi ve uygulanabilir muayene standardından alınır."}}]}],
    notlar:[{id:"guide-reading",key:"notlar.okumaRehberi",title:"Bu Kitabı İş Sırasına Göre Kullanma",children:[],blocks:[{id:"guide-reading-table",kind:"table",table:{head:["İhtiyacınız","Başvurulacak bölüm"],rows:[["Vinci ve hareketlerini tanımak","Makine Tanımı; Vinç Hareketleri"],["Vardiyaya başlamak","Kullanım Öncesi Günlük Kontrol"],["Yükü taşımak","Yükü Alma ve Taşıma Sırası"],["Beklenmeyen duruş","Acil Stop; Enerji Kesintisi ve Yeniden Başlatma"],["Bakım yapmak","Bakım Güvenliği; Muayene; üretici ekleri"]]}},{id:"guide-specific",kind:"note",level:"onemli",text:"Şemalar genel çalışma prensibini açıklar. Gerçek kumanda düzeni, emniyet donanımı, bakım değerleri ve özel çalışma koşulları için bu vince ait teknik belgeler ve üretici talimatları esas alınır."}]}],
  };
  additions.set("muayene.kayit",[{id:"guide-inspection-record",kind:"table",table:{head:["Tarih / kişi","Parça / konum","Bulgu / fotoğraf no","Yapılan işlem / kapanış"],rows:Array.from({length:4},()=>["","","",""]),caption:"Muayene kayıt formu. Fotoğrafları konum ve kayıt numarasıyla ilişkilendirin; giderilmemiş bulguları vardiya devrinde bildirin."}}]);
  const reviewStandard=(b:ManualBlock,key:string):ManualBlock=>{
    if(b.edited || !b.fromTemplate)return b;
    if(key==="guvenlik.anaKesici" && b.kind==="text" && b.text.startsWith("Ana kesici vincin bütün enerjisini"))return {...b,text:"Ana kesici vincin ana elektrik beslemesini ayırır. Bakım öncesinde diğer beslemeler ve depolanmış enerji kaynakları da belirlenmeli; sahaya özgü izolasyon, kilitleme ve doğrulama prosedürü uygulanmalıdır."};
    if(key==="guvenlik.anaKesici" && b.kind==="procedure")return {...b,steps:b.steps.map(step=>({...step,text:step.text==="Gerilim yokluğunu ölçerek doğrulayın."?"Gerilim yokluğunu yetkili elektrik personeli uygun yöntemle doğrulasın. Diğer enerji kaynakları ve depolanmış enerji de güvenli hâle getirilsin.":step.text,...(step.result?{result:"Çalışmaya ancak tüm enerji kaynaklarının güvenli durumu doğrulandıktan ve çalışma izni koşulları sağlandıktan sonra başlanır."}:{})}))};
    if(key==="guvenlik.acilStop" && b.kind==="list")return {...b,items:b.items.map(text=>text==="Butona basıldığında bütün hareketler durur ve enerji kesilir."?"Buton tehlikeli hareketleri durdurma işlevini başlatır; elektriksel izolasyon sağladığı varsayılmaz.":text==="Buton kilitlenir; çevrilerek serbest bırakılana kadar vinç yeniden çalıştırılamaz."?"Buton kilitli kalır; serbest bırakma şekli kullanılan butonun talimatına göre uygulanır.":text)};
    if(key==="guvenlik.acilStop" && b.kind==="note" && b.text.includes("haftalık olarak"))return {...b,text:"Acil durdurma işlevi üreticinin kontrol planına göre güvenli koşullarda denenir. İşlevde uygunsuzluk varsa vinç kullanılmaz; kontrol aralığı bu vince ait bakım planında belirlenir."};
    if(b.kind==="list")return {...b,items:b.items.map(text=>text.startsWith("Savrulma başladıysa kumandayla söndürülür:")?"Salınım giderme manevralarını yalnız ilgili kumanda için eğitim aldıysanız uygulayın. Yükü elle yakalamayın; güvenli alanı koruyun ve üretici talimatını izleyin.":text)};
    if(b.kind==="table")return {...b,table:{...b.table,rows:b.table.rows.map(row=>row[0]==="Korna ve ikaz lambaları"?[row[0],"Varsa, ilgili kumanda talimatına göre","Mevcut ikazlar düzgün çalışmalı"]:row[0]==="Frenler"?[row[0],"Üretici talimatına göre yüksüz fonksiyon kontrolü","İstenmeyen hareket veya kayma olmamalı"]:row[0]==="Limit siviçleri"?[row[0],"Üreticinin tarif ettiği yüksüz test yöntemiyle","İlgili hareket güvenli sınırda durmalı"]:row)}};
    if(b.kind==="note" && b.text.includes("Bu üç sistemin herhangi biri, tek başına yükün düşmesini önleyen"))return {...b,text:"Fren, hareket sınırlandırıcı veya acil durdurma işlevinde uygunsuzluk varsa vinç kullanılmaz. Bu donanımlar farklı görevler üstlenir; birbirlerinin yerine geçmez."};
    return b;
  };
  const visit=(sections:ManualSection[]):ManualSection[]=>sections.map(s=>{
    const children=visit(s.children), extra=newSections[s.key??""]??[];
    if(s.key==="kullanim"){
      const at=children.findIndex(c=>c.key==="kullanim.yukKurallari");
      children.splice(at<0?children.length:at+1,0,...extra.slice(0,2));
      const end=children.findIndex(c=>c.key==="kullanim.kullanimSonrasi");
      children.splice(end<0?children.length:end+1,0,...extra.slice(2));
    }else children.push(...extra);
    return {...s,blocks:[...(additions.get(s.key??"")??[]),...s.blocks.map(b=>reviewStandard(b,s.key??""))],children};
  });
  return {...payload,contentEdition:1,sections:visit(payload.sections)};
}
