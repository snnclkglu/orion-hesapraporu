import { DCOL, type Diagram, type DiagramEl } from "../diagrams/model";

/** Özgün eğitim şemaları. Ölçü, donanım adedi veya projeye özgü tasarım iddiası taşımaz. */
export const MANUAL_ILLUSTRATIONS = {
  crane: "Çift kirişli vinç · genel görünüş",
  movements: "Üç temel vinç hareketi",
  lifting: "Düşey kaldırma / eğik çekme",
  clearance: "Yük yolu ve güvenli çalışma alanı",
  emergency: "Acil durdurma",
  isolation: "Enerji izolasyonu",
  ppe: "Kişisel koruyucu donanım",
  hook: "Kanca kontrol noktaları",
  plate: "Vinç kimlik plakası",
  landing: "Yükü güvenli indirme",
  swing: "Yük salınımı",
  liftReady: "İşlem · yükü ve yolu kontrol et",
  liftAttach: "İşlem · düşey bağlama",
  liftTrial: "İşlem · ilk kaldırma",
  liftTravel: "İşlem · yükü taşıma",
  liftLand: "İşlem · desteklere indirme",
  liftRelease: "İşlem · bağlantıyı çözme",
} as const;
export type ManualIllustrationKey = keyof typeof MANUAL_ILLUSTRATIONS;

export function manualIllustration(key: ManualIllustrationKey): Diagram {
  const els: DiagramEl[] = [];
  const ink=DCOL.ink, red=DCOL.accent, pale=DCOL.paper, gray=DCOL.muted;
  const line=(x1:number,y1:number,x2:number,y2:number,stroke=ink,strokeWidth=2,dash?:string)=>els.push({kind:"line",x1,y1,x2,y2,stroke,strokeWidth,dash});
  const rect=(x:number,y:number,w:number,h:number,fill=pale,stroke=ink)=>els.push({kind:"rect",x,y,w,h,fill,stroke,strokeWidth:1.5});
  const poly=(points:[number,number][],fill=pale,stroke=ink)=>els.push({kind:"polygon",points,fill,stroke,strokeWidth:1.5});
  const circle=(cx:number,cy:number,r:number,fill=pale,stroke=ink)=>els.push({kind:"circle",cx,cy,r,fill,stroke,strokeWidth:2});
  const text=(x:number,y:number,s:string,size=13,color=ink,bold=false)=>els.push({kind:"text",x,y,text:s,size,fill:color,bold,fixed:true});
  const path=(d:string,stroke=ink,sw=3,fill="none")=>els.push({kind:"path",d,stroke,strokeWidth:sw,fill,cap:"round"});
  const arrow=(x:number,y:number,xx:number,yy:number,color=red)=>{
    line(x,y,xx,yy,color,3);const a=Math.atan2(yy-y,xx-x),r=10;
    poly([[xx,yy],[xx-r*Math.cos(a-0.45),yy-r*Math.sin(a-0.45)],[xx-r*Math.cos(a+0.45),yy-r*Math.sin(a+0.45)]],color,color);
  };
  const person=(x:number,y:number,s=1)=>{
    circle(x,y,9*s,"white");line(x,y+10*s,x,y+45*s,ink,5*s);
    line(x,y+21*s,x-17*s,y+34*s,ink,4*s);line(x,y+21*s,x+17*s,y+34*s,ink,4*s);
    line(x,y+45*s,x-12*s,y+68*s,ink,4*s);line(x,y+45*s,x+12*s,y+68*s,ink,4*s);
  };
  const check=(x:number,y:number)=>path(`M ${x} ${y} l 7 8 l 17 -23`,ink,4);
  const cross=(x:number,y:number)=>{line(x,y,x+19,y+19,red,4);line(x+19,y,x,y+19,red,4);};
  const hook=(x:number,y:number)=>{rect(x-18,y,36,26);circle(x,y+13,8,"white");path(`M ${x} ${y+27} v 14 c 0 10 17 12 20 0 l 1 -9`,ink,5);};
  if(key.startsWith("lift") && key!=="lifting"){
    const raised=key==="liftTrial"||key==="liftTravel";
    const loadY=raised?62:82;
    line(12,125,188,125,gray,1);rect(62,loadY,80,30);
    if(key==="liftReady"){circle(48,43,20,"white");line(32,58,18,73,ink,5);check(35,43);}
    else {
      line(102,7,102,31,ink,2);path("M 102 30 v 9 c 0 12 18 12 18 0",ink,3);
      if(key!=="liftRelease"){line(110,49,70,loadY,ink,2);line(110,49,134,loadY,ink,2);}
    }
    if(key==="liftTrial")arrow(164,103,164,65);
    if(key==="liftTravel")arrow(30,28,75,28);
    if(key==="liftLand"||key==="liftRelease"){rect(69,112,18,12,gray);rect(118,112,18,12,gray);}
    if(key==="liftLand")arrow(165,57,165,93);
    if(key==="liftRelease")check(158,53);
    return {width:200,height:138,els};
  }
  if(key==="crane"||key==="movements") {
    // Axonometrik kutu kiriş; aynı izdüşüm bütün alt birleşimlerde kullanılır.
    const p=(x:number,y:number,z:number):[number,number]=>[78+x+y*0.47,264+y*0.31-z];
    const beam=(x:number,y:number,z:number,w:number,d:number,h:number,fill:string)=>{
      poly([p(x,y,z+h),p(x+w,y,z+h),p(x+w,y+d,z+h),p(x,y+d,z+h)],fill);
      poly([p(x,y,z),p(x+w,y,z),p(x+w,y,z+h),p(x,y,z+h)],fill);
      poly([p(x+w,y,z),p(x+w,y+d,z),p(x+w,y+d,z+h),p(x+w,y,z+h)],pale);
    };
    for(const x of [0,400]){beam(x,-75,50,15,300,14,pale);for(const yy of [-60,175])beam(x,yy,0,12,13,50,pale);}
    for(const x of [0,386]){beam(x,0,67,30,135,16,gray);for(const yy of [12,110]){const q=p(x+15,yy,59);circle(q[0],q[1],8,ink);circle(q[0],q[1],3,pale);}}
    beam(18,10,84,380,17,36,red);beam(18,102,84,380,17,36,red);
    for(const yy of [16,108]){const a=p(18,yy,123),b=p(398,yy,123);line(...a,...b,ink,3);}
    beam(140,4,126,105,126,12,pale);
    beam(148,38,138,82,40,25,gray);beam(225,45,139,34,28,21,ink);
    for(let i=0;i<9;i++){const a=p(153+i*8,39,164),b=p(153+i*8,75,164);line(...a,...b,pale,1);}
    const a=p(184,60,138),b=p(184,60,18);
    line(a[0]-7,a[1],b[0]-7,b[1],ink,2);line(a[0]+7,a[1],b[0]+7,b[1],ink,2);hook(b[0],b[1]);
    // Kablo taşıma hattı; varlığı/yerleşimi metinde şematik olarak belirtilir.
    const c=p(40,125,123),d=p(385,125,123);line(...c,...d,gray,1);
    for(let i=0;i<6;i++){const x=c[0]+i*43;path(`M ${x} ${c[1]} q 21 29 43 0`,gray,1.5);}
    if(key==="movements"){
      arrow(110,84,440,84);text(202,68,"ARABA YÜRÜTME",14,red,true);
      arrow(485,225,555,274);text(412,312,"KÖPRÜ YÜRÜTME",14,red,true);
      arrow(254,215,254,311);text(87,305,"KALDIRMA / İNDİRME",13,red,true);
    }
    return {width:600,height:350,els};
  }
  if(key==="lifting"){
    for(const x of [45,335]){rect(x,43,215,13,gray);line(x+106,56,x+106,170,gray,1,"5 4");rect(x+57,194,100,48);line(x+25,250,x+188,250,gray);}
    line(151,56,151,154);hook(151,151);line(151,194,112,194);line(151,194,195,194);check(64,95);text(48,290,"DÜŞEY KALDIRMA",16,ink,true);
    line(441,56,395,154,red,3);hook(395,151);line(395,194,400,194);cross(502,83);text(338,290,"EĞİK ÇEKME YASAK",16,red,true);
  } else if(key==="clearance"){
    rect(42,57,516,212,"white",gray);rect(95,96,292,117,DCOL.accentSoft,red);
    rect(120,126,72,55);arrow(213,153,354,153);person(475,133);
    line(387,75,387,247,red,2,"7 5");text(105,239,"YÜK YOLU / ERİŞİMİ SINIRLANAN ALAN",12,red,true);text(429,242,"OPERATÖR",12,ink,true);
    text(45,303,"Güzergâhı boşaltın. Yükü ve çevresini sürekli izleyin.",14);
  } else if(key==="emergency"){
    rect(85,90,135,155,pale);circle(153,135,45,"white");circle(153,135,33,red);rect(140,189,26,18,gray);text(115,274,"ACİL STOP",16,red,true);
    arrow(240,142,294,142);text(321,108,"1  DURDUR",18,red,true);text(321,144,"2  ALANI KORU",18,ink,true);text(321,180,"3  NEDENİ GİDER",18,ink,true);text(321,216,"4  KONTROLLÜ BAŞLAT",16,ink,true);
    text(65,315,"Butonun serbest bırakılması yeniden başlatma komutu değildir.",13);
  } else if(key==="isolation"){
    rect(48,67,154,191);circle(125,129,38,"white");line(125,129,145,102,red,9);text(66,92,"0 / KAPALI",12,red,true);
    path("M 112 220 v -22 c 0 -24 30 -24 30 0 v 22",ink,5);rect(103,218,48,42,red);circle(127,232,4,"white");line(127,235,127,246,"white",3);
    text(245,93,"DURDUR → AYIR → KİLİTLE",18,red,true);text(245,131,"Depolanmış enerjiyi güvenli hâle getir.",13);text(245,160,"Enerjisizliği yetkili kişi doğrulasın.",13);text(245,210,"ACİL STOP ≠ ENERJİ İZOLASYONU",14,red,true);
  } else if(key==="ppe"){
    person(291,87,2.2);path("M 267 86 q 0 -34 48 0",red,5);line(263,86,319,86,red,4);
    const labels:[[number,number,string,number,number],...Array<[number,number,string,number,number]>]=[[35,58,"BAŞ KORUMASI",273,67],[390,95,"GÖZ / YÜZ",309,93],[35,155,"UYGUN İŞ KIYAFETİ",270,147],[390,183,"EL KORUMASI",329,161],[35,280,"AYAK KORUMASI",270,237]];
    labels.forEach(([x,y,s,xx,yy])=>{text(x,y,s,13,ink,true);line(x<200?x+160:x-8,y-5,xx,yy,gray,1);});
    text(65,324,"Donanımı sahadaki risk değerlendirmesine göre seçin.",14);
  } else if(key==="hook"){
    rect(245,47,74,55);circle(282,75,20,"white");path("M 282 104 v 46 c -61 5 -76 96 -6 105 c 61 9 85 -65 46 -102",ink,15);
    line(279,157,322,185,gray,4);
    text(32,91,"BLOK / BAĞLANTILAR",13,ink,true);line(205,86,245,78,red,1.5);
    text(385,161,"AĞIZ / MANDAL",13,ink,true);line(371,157,329,169,red,1.5);
    text(30,246,"GÖVDE / YÜZEY",13,ink,true);line(182,240,243,218,red,1.5);
    text(376,282,"YÜK OTURMA YERİ",13,ink,true);line(367,271,287,252,red,1.5);
    text(72,328,"Kanca tipine göre kontrol noktalarını uyarlayın.",14);
  } else if(key==="plate"){
    rect(57,65,486,216,pale);text(79,96,"VİNÇ KİMLİK PLAKASI",20,ink,true);
    ["Seri / iş numarası","Kapasite","Açıklık / kaldırma yüksekliği","Üretim yılı","Besleme bilgileri"].forEach((s,i)=>{text(79,128+i*29,s,13);rect(320,110+i*29,195,22,"white",gray);});
    text(65,321,"Gerçek değerleri vinç plakası ve proje künyesinden okuyun.",13);
  } else if(key==="landing"){
    for(const x of [48,338]){rect(x+45,175,130,66);line(x,264,x+224,264,gray);line(x+110,50,x+110,147);hook(x+110,140);}
    rect(102,241,30,23,gray);rect(178,241,30,23,gray);check(61,106);arrow(237,137,237,215);
    person(514,194,0.65);cross(505,113);text(49,307,"DENGELİ DESTEK",15,ink,true);text(339,307,"SIKIŞMA BÖLGESİNE GİRME",13,red,true);
  } else if(key==="swing"){
    rect(70,48,460,15,gray);rect(266,65,65,24);line(298,89,298,230,gray,1,"5 5");
    line(298,89,202,210,red,3);line(298,89,393,210,gray,2);rect(174,210,56,42,DCOL.accentSoft,red);rect(366,210,56,42,pale,gray);
    path("M 190 267 Q 298 323 412 267",red,2);arrow(206,28,381,28);text(111,330,"Ani hareket ve duruş yükün salınımını büyütür.",14,ink,true);
  }
  return {width:600,height:350,els};
}
