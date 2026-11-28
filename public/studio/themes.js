// All patterns are vector artwork generated at the requested canvas resolution.
const sans = 'Arial, sans-serif', serif = 'Georgia, serif', mono = '"Courier New", monospace';
const library = [
  ['trace','Trace Route','Systems','#073c40','#d8f6ee','Follow the signal.',sans,700],
  ['proof','Working Paper','Research','#232d43','#f6f1e5','Show your work.',serif,500],
  ['terminal','Phosphor','Developer','#d1ffe4','#07201d','Under the hood.',mono,700],
  ['facet','Model Stack','Architecture','#1e2851','#e4e7ff','Layer by layer.',sans,700],
  ['spectral','Spectral Glass','Optics','#f2f0ff','#17152c','A different lens.',serif,500],
  ['letter','Margin Note','Essay','#3d2821','#ffeed9','Worth a closer look.',serif,500],
  ['matrix','Pixel Orchard','Generative','#203523','#e8f3dc','Small parts matter.',mono,700],
  ['dispatch','Flash Dispatch','News','#f9f2e6','#3c1c2c','Just in.',sans,700],
  ['contour','Phase Space','Scientific','#dff7ff','#071e32','A change of phase.',sans,700],
  ['grain','Risograph','Print','#282526','#ffdfbe','Beyond the print.',serif,700],
  ['cutout','Cut & Carry','Collage','#302142','#f0daf1','A fresh cut.',sans,700],
  ['wafer','Silicon Wafer','Hardware','#f6f6eb','#242a24','Inside silicon.',mono,700],
  ['blueprint','Blueprint','Schematic','#f1faff','#193858','Look inside.',mono,700],
  ['eclipse','Orbital Review','Science','#301c29','#faeee0','A wider orbit.',serif,500],
  ['ribbon','Folded Signal','Poster','#effaf7','#143b42','Signal over noise.',sans,700],
  ['contact','Contact Sheet','Visual study','#362c21','#f5eedf','In close focus.',serif,500],
];
export const extraStyles = library.map(([id,name,family,color,base,title,fontFamily,weight]) => ({id,name,family,color,base,title,fontFamily,weight}));

function path(c, points) {
  c.beginPath();
  for(const [i,[x,y]] of points.entries()) i ? c.lineTo(x,y) : c.moveTo(x,y);
}
function line(c, points, color, width=2) {
  path(c,points); c.strokeStyle=color; c.lineWidth=width; c.stroke();
}
function poly(c, points, color) {
  path(c,points); c.closePath(); c.fillStyle=color; c.fill();
}
function box(c,x,y,w,h,color) {
  c.fillStyle=color; c.fillRect(x,y,w,h);
}
function disc(c,x,y,r,color) {
  c.beginPath(); c.arc(x,y,r,0,2*Math.PI); c.fillStyle=color; c.fill();
}
function ring(c,x,y,rx,ry,tilt,color,width=2) {
  c.beginPath(); c.ellipse(x,y,rx,ry,tilt,0,2*Math.PI); c.strokeStyle=color; c.lineWidth=width; c.stroke();
}
const art = {
  trace(c) {
    for(let i=0;i<7;i++){
      const x=720+i*32,y=776-i*31;
      line(c,[[1005,y],[x+92,y],[x,y+92],[x,1005]],i===3?'#42a78b':'#95ccba',i===3?8:3);
      disc(c,x,936+i%3*18,6,'#68ab94');
    }
    line(c,[[0,143],[24,143],[52,115]],'#81bdab',4);box(c,966,0,34,50,'#4e9b84');
  },
  proof(c) {
    line(c,[[49,41],[952,41]],'#45536c',3);line(c,[[49,49],[952,49]],'#9f9d96');line(c,[[50,960],[950,960]],'#9f9d96');
    for(let k=0;k<6;k++){const x=857+k*24,y=765+k*19;line(c,[[x,y-40],[x-67,y+70],[x+67,y+70],[x,y-40]],'#929eb055',3)}
    box(c,52,33,69,12,'#a14737');
  },
  terminal(c) {
    box(c,0,0,20,1000,'#3c8c59');
    for(let i=0;i<24;i++)line(c,[[889,310+i*27],[998,310+i*27]],'#397159',1.5);
    line(c,[[767,725],[805,764],[767,803]],'#80c995',12);box(c,830,793,54,10,'#80c995');line(c,[[62,49],[174,49]],'#73b992',5);
  },
  facet(c) {
    const colors=['#a5b0f9','#b8a5e8','#91c4ce'];
    for(let i=2;i>=0;i--){
      const x=829+i*24,y=711+i*72;
      poly(c,[[x-91,y],[x+25,y-52],[x+112,y-7],[x-2,y+49]],colors[i]);
      poly(c,[[x-91,y],[x-2,y+49],[x-2,y+79],[x-91,y+31]],'#657db3');
      poly(c,[[x-2,y+49],[x+112,y-7],[x+112,y+22],[x-2,y+79]],'#8096c4');
    }
    poly(c,[[0,0],[87,0],[0,53]],'#99a5dd');
  },
  spectral(c) {
    const g=c.createLinearGradient(610,990,998,572);
    g.addColorStop(0,'#5a528d');g.addColorStop(.48,'#7668ab');g.addColorStop(1,'#b58fbb');
    poly(c,[[685,1003],[1004,538],[1004,1003]],g);
    for(let i=0;i<13;i++)line(c,[[668+i*19,1000],[1000,514+i*24]],'#d3c2ff70',2.3);
    line(c,[[960,40],[960,92]],'#b9a4e7',3);line(c,[[938,66],[982,66]],'#b9a4e7');
  },
  letter(c) {
    line(c,[[35,45],[35,957]],'#bd7b72',3);line(c,[[45,45],[45,957]],'#dba7a0');
    c.save();c.translate(882,896);c.rotate(-.14);
    box(c,-80,-64,196,151,'#edd6b8');box(c,-63,-71,193,146,'#f8e3c6');
    for(let i=0;i<4;i++)line(c,[[-41,-33+i*21],[83-i%2*17,-33+i*21]],'#c99779',3);
    poly(c,[[100,-71],[130,-71],[130,-40]],'#d8ba95');c.restore();box(c,805,0,81,22,'#d09073');
  },
  matrix(c) {
    const ink=['#78a176','#b1c48f','#95b086','#6b9174'];
    for(let r=0;r<15;r++)for(let k=0;k<15;k++){
      if((k-10)**2+(r-9)**2<92 && (r*17+k*7)%11<8)box(c,706+k*21,713+r*21,18,18,ink[(r+k)%4]);
    }
    for(let j=0;j<5;j++)box(c,908+j*15,43,9,9,ink[j%4]);
  },
  dispatch(c) {
    box(c,0,0,1000,20,'#efad81');
    for(let k=0;k<8;k++){const x=643+k*57;poly(c,[[x,1000],[x+85,852],[x+114,852],[x+29,1000]],k%2?'#a75861':'#c37468')}
    box(c,958,94,42,170,'#75414f');
  },
  contour(c) {
    for(let i=0;i<18;i++){
      const points=[];
      for(let j=0;j<=48;j++){const x=560+j*10,t=(x-550)/460;points.push([x,1034-i*9-t*t*(164+72*Math.sin(t*7+i*.105))])}
      line(c,points,i%5===0?'#70b5be':'#477e94',i%5===0?3:1.8);
    }
    for(let i=0;i<4;i++)disc(c,909+i*15,53,2.7,'#81acb8');
  },
  grain(c) {
    disc(c,940,872,107,'#d9977a');c.save();c.beginPath();c.arc(868,871,112,0,Math.PI*2);c.clip();
    for(let i=0;i<21;i++)for(let j=0;j<21;j++)disc(c,750+i*12,750+j*12,3.1,'#b37479');
    c.restore();line(c,[[58,35],[320,35]],'#b3756d',3);line(c,[[46,22],[46,49]],'#8b7269');line(c,[[33,35],[59,35]],'#8b7269');
  },
  cutout(c) {
    poly(c,[[672,1000],[706,873],[752,903],[794,764],[851,821],[924,701],[1000,728],[1000,1000]],'#bfa6d0');
    poly(c,[[804,1000],[877,803],[940,843],[1000,745],[1000,1000]],'#957498');
    poly(c,[[771,1000],[823,883],[853,913],[807,1000]],'#f1c190');
    poly(c,[[799,0],[900,0],[885,18],[775,21]],'#d4afbf');
  },
  wafer(c) {
    c.save();c.beginPath();c.arc(1020,970,271,0,Math.PI*2);c.clip();box(c,710,660,320,360,'#4d5a47');
    for(let r=0;r<9;r++)for(let k=0;k<8;k++){const x=697+k*48,y=652+r*48;
      box(c,x,y,43,43,['#6c795b','#707d69','#74826c'][(r+2*k)%3]);box(c,x+6,y+7,15,27,'#515d50');line(c,[[x+27,y+7],[x+35,y+7],[x+35,y+31]],'#93a386');
    }
    c.restore();ring(c,1020,970,274,274,0,'#9eab8f');
  },
  blueprint(c) {
    for(let i=0;i<=8;i++){const x=745+i*37,y=705+i*37;line(c,[[x,703],[x,1000]],'#507b91',1);line(c,[[744,y],[1000,y]],'#507b91',1)}
    line(c,[[780,920],[780,788],[900,788],[900,821],[943,821],[943,920],[780,920]],'#9fbfcb',3);ring(c,858,856,33,33,0,'#9fbfcb');
    for(const [x,y] of [[794,804],[928,897],[796,904]])ring(c,x,y,6,6,0,'#9fbfcb');line(c,[[53,56],[115,56]],'#98b4c6');
  },
  eclipse(c) {
    disc(c,918,870,90,'#d99683');ring(c,920,880,174,49,-.64,'#b67f85',3.5);ring(c,920,880,200,65,-.64,'#caabad');
    disc(c,792,943,9,'#ae7779');disc(c,957,731,6,'#a46e76');box(c,0,0,1000,8,'#b58381');
  },
  ribbon(c) {
    poly(c,[[595,1000],[746,811],[824,811],[675,1000]],'#66a79a');poly(c,[[746,811],[824,811],[924,903],[849,911]],'#4c8987');
    poly(c,[[849,911],[924,903],[1000,729],[1000,882],[949,1000],[889,1000]],'#79b2a3');line(c,[[35,35],[124,35],[124,42]],'#73a8a2',3);
  },
  contact(c) {
    const tones=['#a7aaa0','#d3ad85','#aa9ca5'];
    for(let i=0;i<3;i++){const x=725+i*86,y=840;box(c,x,y,78,91,'#504b49');box(c,x+5,y+5,68,70,tones[i]);
      c.save();c.beginPath();c.rect(x+5,y+5,68,70);c.clip();for(let j=0;j<4;j++)ring(c,x+21+i*12,y+53,11+j*9,11+j*9,0,'#f6ebd3');c.restore();
      for(let j=0;j<4;j++)box(c,x+10+j*14,y+81,6,4,'#e1d9cc');
    }
    line(c,[[41,49],[955,49]],'#aba49a');line(c,[[41,956],[955,956]],'#aba49a');
  }
};
export function drawTheme(c, style, w, h) {
  if (!Object.hasOwn(art,style.id)) return false;
  c.save(); c.scale(w/1000,h/1000); art[style.id](c); c.restore(); return true;
}
