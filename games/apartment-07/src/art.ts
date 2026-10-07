import { APARTMENT, WALLS } from '../shared/map';
import { SKINS, HAIR, COLORS, type AvatarConfig, type Direction } from '../shared/types';
type C=CanvasRenderingContext2D;
function rect(c:C,x:number,y:number,w:number,h:number,color:string,r=0){c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();}
function ellipse(c:C,x:number,y:number,rx:number,ry:number,color:string){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();}
function line(c:C,x:number,y:number,x2:number,y2:number,color:string,width=1){c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.stroke();}
export function drawAvatar(c:C,a:AvatarConfig,d:Direction='down',frame=0,x=48,y=112,scale=1){
 c.save();c.translate(x,y);c.scale(scale,scale);const bob=frame%2?-2:0,step=frame===1?-5:frame===3?5:0;const skin=SKINS[a.skin],hair=HAIR[a.hairColor],top=COLORS[a.topColor],bottom=COLORS[a.bottomColor];
 ellipse(c,0,-2,22,7,'#101a1e55');c.translate(0,bob);
 rect(c,-15,-31,12,26+step,bottom,4);rect(c,3,-31,12,26-step,bottom,4);
 if(a.bottom===1){rect(c,-15,-20,12,13+step,skin,3);rect(c,3,-20,12,13-step,skin,3);}if(a.bottom===2){c.fillStyle=bottom;c.beginPath();c.moveTo(-15,-34);c.lineTo(15,-34);c.lineTo(22,-16);c.lineTo(-22,-16);c.fill();}
 rect(c,-17,-9+step,15,8,'#344047',4);rect(c,3,-9-step,15,8,'#344047',4);line(c,-15,-3+step,-5,-3+step,'#b4b4a8',2);line(c,5,-3-step,15,-3-step,'#b4b4a8',2);
 const facing=d==='left'?-1:d==='right'?1:0;
 rect(c,-25,-60+step/2,11,31,skin,6);rect(c,14,-60-step/2,11,31,skin,6);
 rect(c,-21,-64,42,37,top,10);rect(c,-25,-61,12,a.top===1?26:15,top,5);rect(c,13,-61,12,a.top===1?26:15,top,5);
 if(a.top===2){for(let i=0;i<3;i++)rect(c,-18,-53+i*9,36,3,'#f0e1bf99');}if(a.top===3){rect(c,-17,-60,7,30,bottom,2);rect(c,10,-60,7,30,bottom,2);rect(c,-15,-45,30,19,bottom,3);}
 if(d!=='up'){ellipse(c,0,-40,4,4,'#f0dab999');if(a.top===1){line(c,-4,-62,-5,-49,'#ead6b5',1);line(c,4,-62,5,-49,'#ead6b5',1);}}
 if(a.accessory===2&&d==='up'){rect(c,-16,-61,32,33,'#ac7050',9);rect(c,-11,-41,22,10,'#8b593e',3);}
 rect(c,-7,-74,14,16,skin,4);ellipse(c,-20,-82,5,7,skin);ellipse(c,20,-82,5,7,skin);ellipse(c,0,-87,22,25,skin);
 c.fillStyle=hair;c.beginPath();c.ellipse(0,-96,23,19,0,Math.PI,Math.PI*2);c.lineTo(22,-84);c.quadraticCurveTo(14,-91,7,-101);c.quadraticCurveTo(-3,-86,-21,-83);c.closePath();c.fill();
 if(a.hair===1){ellipse(c,-19,-80,7,22,hair);ellipse(c,19,-80,7,22,hair);}if(a.hair===2){for(let i=0;i<8;i++)ellipse(c,-20+i*6,-105+(i%2)*3,7,9,hair);}if(a.hair===3){ellipse(c,21,-100,11,12,hair);rect(c,-22,-103,43,10,hair,4);}if(a.hair===4){ellipse(c,-25,-82,8,14,hair);ellipse(c,25,-82,8,14,hair);}if(a.hair===5){c.fillStyle=hair;c.beginPath();c.moveTo(-21,-100);c.lineTo(-15,-120);c.lineTo(-6,-109);c.lineTo(5,-123);c.lineTo(10,-109);c.lineTo(20,-116);c.lineTo(22,-96);c.fill();}
 if(d==='up')ellipse(c,0,-91,23,22,hair);else{const offset=facing*7;ellipse(c,-8+offset,-85,2.2,3,'#293334');if(!facing)ellipse(c,8,-85,2.2,3,'#293334');line(c,offset-3,-74,offset+3,-74,'#9d6656',1.6);ellipse(c,offset+3,-81,2,2,'#b2785e44');if(a.accessory===1){c.strokeStyle='#364853';c.lineWidth=2;c.strokeRect(-16+offset,-91,13,10);if(!facing)c.strokeRect(3,-91,13,10);line(c,-3,-86,3,-86,'#364853',2);}}
 if(a.accessory===3)rect(c,-23,-100,46,5,'#bd795f',2);if(a.accessory===4){rect(c,-16,-67,32,7,'#b86c61',3);rect(c,8,-65,8,21,'#b86c61',2);}c.restore();
}

/** Outside-wall windows. `lx/ly` is where their storm light falls inside the room. */
export interface WindowDef { room:string; side:'top'|'left'|'right'; at:number; size:number; curtain:string; lx:number; ly:number }
export const WINDOWS:WindowDef[]=[
 {room:'bedroom',side:'top',at:177,size:104,curtain:'#8f6f5c',lx:177,ly:110},
 {room:'kitchen',side:'top',at:1006,size:112,curtain:'#a9a27f',lx:1006,ly:110},
 {room:'utility',side:'top',at:1551,size:52,curtain:'#7f8c87',lx:1551,ly:105},
 {room:'living',side:'left',at:785,size:92,curtain:'#8b6a5a',lx:110,ly:785},
 {room:'study',side:'left',at:1430,size:96,curtain:'#6f7e63',lx:110,ly:1430},
 {room:'parents',side:'right',at:810,size:96,curtain:'#a07c74',lx:1314,ly:810}
];
function drawWindow(c:C,w:WindowDef){
 const glass=(x:number,y:number,gw:number,gh:number)=>{const g=c.createLinearGradient(x,y,x+gw,y+gh);g.addColorStop(0,'#5d8796');g.addColorStop(.55,'#2f4c5a');g.addColorStop(1,'#1d3440');c.fillStyle=g;c.fillRect(x,y,gw,gh);
  // Rain running down the glass.
  c.save();c.beginPath();c.rect(x,y,gw,gh);c.clip();for(let n=0;n<Math.max(gw,gh)/5;n++){const rx=x+((n*37)%Math.max(4,gw)),ry=y+((n*23)%Math.max(4,gh));line(c,rx,ry,rx-1,ry+5+(n%3)*2,'#d4e8ef66',1);ellipse(c,rx-1,ry+7+(n%3)*2,1,1.3,'#e2f0f388');}
  const sheen=c.createLinearGradient(x,y,x+gw,y);sheen.addColorStop(0,'#ffffff00');sheen.addColorStop(.3,'#ffffff1c');sheen.addColorStop(.45,'#ffffff00');c.fillStyle=sheen;c.fillRect(x,y,gw,gh);c.restore();};
 if(w.side==='top'){
  const y=APARTMENT.rooms.find(r=>r.id===w.room)!.y,x=w.at-w.size/2;
  rect(c,x-5,y-17,w.size+10,31,'#d8cfb6',3);glass(x,y-13,w.size,21);
  line(c,w.at,y-13,w.at,y+8,'#d8cfb6',4);line(c,x,y-2,x+w.size,y-2,'#d8cfb6',2.5);
  rect(c,x-9,y+11,w.size+18,7,'#e6dcc2',2);rect(c,x-9,y+17,w.size+18,3,'#2a2a2655',1);
  // Curtains gathered at both sides.
  for(const side of[-1,1]){const cx=side<0?x-14:x+w.size+2;rect(c,cx,y-19,12,46,w.curtain,5);for(let n=0;n<3;n++)line(c,cx+3+n*3,y-16,cx+3+n*3,y+24,'#00000026',1);rect(c,cx-1,y+10,14,5,'#d9b77f',2);}
  rect(c,x-22,y-23,w.size+44,5,'#3c3129',2);
 }else{
  const r=APARTMENT.rooms.find(r=>r.id===w.room)!,wx=w.side==='left'?r.x:r.x+r.w,y=w.at-w.size/2;
  rect(c,wx-9,y-5,18,w.size+10,'#d8cfb6',3);glass(wx-5,y,10,w.size);line(c,wx-5,w.at,wx+5,w.at,'#d8cfb6',3);
  const inside=w.side==='left'?1:-1;rect(c,wx+inside*10-(inside<0?6:0),y-4,6,w.size+8,'#e6dcc2',2);
  for(const end of[y-16,y+w.size+2])rect(c,wx+inside*8-(inside<0?12:0),end,12,14,w.curtain,4);
 }
}
export function apartmentCanvas(atlas?:HTMLImageElement){
 const frames:Record<string,{x:number;y:number;w:number;h:number}>={};
 if(atlas){const a=document.createElement('canvas');a.width=atlas.width;a.height=atlas.height;const ac=a.getContext('2d')!;ac.drawImage(atlas,0,0);const rgba=ac.getImageData(0,0,a.width,a.height).data;const names=['bed','sofa','desk','shelf','plant','fridge','counter','washer','console','suitcase','table','cabinet'];for(let index=0;index<names.length;index++){const col=index%4,row=Math.floor(index/4),x0=col*362,x1=(col+1)*362,y0=[0,400,750][row],y1=[400,750,1086][row];let left=x1,right=x0,top=y1,bottom=y0;for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){if(rgba[(y*a.width+x)*4+3]>100){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}}frames[names[index]]={x:left,y:top,w:right-left+1,h:bottom-top+1};}}
 const canvas=document.createElement('canvas');canvas.width=APARTMENT.width;canvas.height=APARTMENT.height;const c=canvas.getContext('2d')!;
 c.fillStyle='#121c20';c.fillRect(0,0,canvas.width,canvas.height);
 for(const r of APARTMENT.rooms){rect(c,r.x,r.y,r.w,r.h,r.floor);c.save();c.beginPath();c.rect(r.x,r.y,r.w,r.h);c.clip();
  if(r.id==='kitchen'||r.id==='utility'){for(let y=r.y;y<r.y+r.h;y+=48)for(let x=r.x;x<r.x+r.w;x+=48){rect(c,x+1,y+1,46,46,(Math.floor(x/48)+Math.floor(y/48))%2?'#85908733':'#c8c6b322');line(c,x,y,x+48,y,'#363e3d44');}}
  else{for(let y=r.y;y<r.y+r.h;y+=27){line(c,r.x,y,r.x+r.w,y,'#241f1b44',1);for(let x=r.x+((y/27)%2)*78;x<r.x+r.w;x+=156){line(c,x,y,x,y+27,'#28231d44');for(let n=0;n<3;n++)line(c,x+12,y+6+n*6,x+100+n*8,y+5+n*6,'#d6b38e0b');}}}
  const shade=c.createLinearGradient(r.x,r.y,r.x+r.w,r.y+r.h);shade.addColorStop(0,'#acbfd00c');shade.addColorStop(1,'#101e2440');c.fillStyle=shade;c.fillRect(r.x,r.y,r.w,r.h);c.restore();
 }
 // A small section of the communal corridor is revealed only when the entrance opens.
 rect(c,640,1728,144,160,'#989181');for(let y=1728;y<1888;y+=32)line(c,640,y,784,y,'#6b6a64');
 for(const f of APARTMENT.furniture.filter(f=>f.solid===false)){if(f.kind==='rug'||f.kind==='runner'){rect(c,f.x+3,f.y+4,f.w,f.h,'#151d2444',7);rect(c,f.x,f.y,f.w,f.h,f.color??'#988467',5);c.strokeStyle='#ddcda677';c.lineWidth=3;c.strokeRect(f.x+9,f.y+9,f.w-18,f.h-18);c.strokeStyle='#503d3a55';c.lineWidth=1;c.strokeRect(f.x+15,f.y+15,f.w-30,f.h-30);for(let y=f.y+27;y<f.y+f.h-20;y+=28){for(let x=f.x+28;x<f.x+f.w-18;x+=34){c.fillStyle='#e1cd9f33';c.beginPath();c.moveTo(x,y-7);c.lineTo(x+7,y);c.lineTo(x,y+7);c.lineTo(x-7,y);c.fill();}}}else{rect(c,f.x,f.y,f.w,f.h,'#9e7652',8);rect(c,f.x+5,f.y+5,14,14,'#8ca39a',3);rect(c,f.x+28,f.y+19,18,19,'#ad645a',3);}}
 for(const f of APARTMENT.furniture.filter(f=>f.solid!==false)){
  const{x,y,w,h}=f;
  if(atlas&&frames[f.kind]){const b=frames[f.kind],scale=Math.min(w/b.w,(h+24)/b.h),dw=b.w*scale,dh=b.h*scale;ellipse(c,x+w/2,y+h-7,w*.46,10,'#101c2440');c.drawImage(atlas,b.x,b.y,b.w,b.h,x+(w-dw)/2,y+h-dh,dw,dh);continue;}
  rect(c,x+8,y+12,w,h,'#101c244d',9);rect(c,x,y,w,h,'#443b32',5);
  const color=f.color??'#977554';
  if(f.kind==='bed'){rect(c,x+2,y-12,w-4,28,'#684c38',7);rect(c,x+7,y+5,w-14,h-16,'#dbd2b8',12);rect(c,x+9,y+h*.32,w-18,h*.59,color,7);for(let n=0;n<4;n++)line(c,x+15,y+h*.4+n*24,x+w-15,y+h*.4+n*24,'#e0dbc82c',2);rect(c,x+17,y+15,w-34,49,'#e9dfc9',12);line(c,x+28,y+52,x+w-25,y+52,'#bcae943f');rect(c,x+8,y+h-17,w-16,10,'#493b3288',2);}
  else if(f.kind==='sofa'){rect(c,x,y,w,h,color,14);rect(c,x+14,y+12,w-27,h-25,'#92a096',9);line(c,x+13,y+h/2,x+w-12,y+h/2,'#465e5a',2);rect(c,x+4,y+4,19,h-8,'#597369',7);rect(c,x+21,y+19,49,43,'#c1aa83',8);rect(c,x+24,y+h-62,48,41,'#a99c86',8);}
  else if(f.kind==='plant'){ellipse(c,x+w/2,y+h-9,w*.32,13,'#ab8265');rect(c,x+w*.23,y+h*.45,w*.54,h*.43,'#a78061',6);for(let n=0;n<9;n++){const ang=n*2.4;ellipse(c,x+w/2+Math.cos(ang)*w*.28,y+h*.33+Math.sin(ang)*h*.26,w*.22,h*.17,n%2?'#63816b':'#385e52');}}
  else if(f.kind==='tv'){rect(c,x,y,w,h,'#3c4442',6);rect(c,x+7,y-31,w-14,h-9,'#192a30',5);const g=c.createLinearGradient(x,y-31,x+w,y+40);g.addColorStop(0,'#385764');g.addColorStop(1,'#17282c');c.fillStyle=g;c.fillRect(x+13,y-25,w-26,h-22);line(c,x+18,y-19,x+70,y+25,'#8dadb414',8);ellipse(c,x+w-16,y+h-18,2,2,'#bebb80');}
  else if(f.kind==='fridge'){rect(c,x,y-20,w,h+20,'#bbc1b5',8);rect(c,x+4,y-16,w-8,34,'#d4d7c8',5);rect(c,x+4,y+22,w-8,h-26,'#c1c8bb',4);rect(c,x+w-15,y+33,4,35,'#687879',2);rect(c,x+14,y+32,20,25,'#e6d4a0',1);ellipse(c,x+24,y+31,3,3,'#8d6053');}
  else if(f.kind==='washer'){rect(c,x,y-12,w,h+12,'#c0c5b9',7);rect(c,x+5,y-7,w-10,21,'#d3d6c7',3);ellipse(c,x+w/2,y+h*.57,w*.34,w*.34,'#657a7e');ellipse(c,x+w/2,y+h*.57,w*.25,w*.25,'#304a55');line(c,x+38,y+48,x+60,y+69,'#63899a',6);ellipse(c,x+w-18,y+3,5,5,'#728279');}
  else if(f.kind==='console'){rect(c,x,y-14,w,h+14,'#354a4c',5);rect(c,x+9,y-6,w-18,40,'#718277',4);for(let n=0;n<3;n++){ellipse(c,x+22+n*30,y+11,5,5,'#cfa966');rect(c,x+13+n*30,y+52,17,21,'#afb7a4',3);}rect(c,x+24,y+95,w-48,22,'#1c3338',3);}
  else if(f.kind==='shelf'){rect(c,x,y-25,w,h+25,'#77583d',4);for(let n=0;n<9;n++){const bh=29+(n*13)%18;rect(c,x+8+n*(w-16)/9,y-16+45-bh,(w-22)/9,bh,['#82948a','#b39871','#ab7960','#556b79'][n%4],1);}rect(c,x,y+32,w,7,'#b08b65');for(let n=0;n<5;n++)rect(c,x+10+n*20,y+44,15,25,['#a49a7c','#725c51','#809088'][n%3],2);}
  else if(f.kind==='counter'){rect(c,x,y,w,h,'#7a8a7d',4);rect(c,x-3,y-10,w+6,25,'#c5c7b3',3);for(let n=0;n<3;n++){rect(c,x+6+n*w/3,y+21,w/3-12,h-28,'#879586',3);rect(c,x+19+n*w/3,y+29,25,3,'#c6c6ad');}ellipse(c,x+75,y+2,36,14,'#657a79');ellipse(c,x+75,y+2,28,9,'#8e9c90');}
  else if(f.kind==='coat'){rect(c,x+14,y-20,25,h+15,'#738d91',8);for(let n=0;n<4;n++)ellipse(c,x+4+n*12,y-25,3,3,'#c6b17f');}
  else if(f.kind==='suitcase'){rect(c,x,y,w,h,color,9);c.strokeStyle='#d1bc9755';c.lineWidth=2;c.strokeRect(x+8,y+8,w-16,h-16);rect(c,x+w/2-13,y-6,26,8,'#3b3e37',3);rect(c,x+w-25,y+12,15,23,'#d9ceaf',2);}
  else{rect(c,x,y-10,w,h,color,5);rect(c,x+4,y-7,w-8,h*.6,'#b18c65',4);line(c,x+10,y+h*.65,x+w-10,y+h*.65,'#574738',2);rect(c,x+w/2-10,y+h*.76,20,4,'#d9be89',2);if(f.kind==='desk'){rect(c,x+18,y+2,42,32,'#e7dbc0',2);line(c,x+25,y+11,x+51,y+11,'#8b9081');line(c,x+25,y+18,x+47,y+18,'#8b9081');}if(f.kind==='table'){ellipse(c,x+w*.7,y+20,11,7,'#c9d0bd');ellipse(c,x+w*.7,y+18,7,4,'#584637');}}
 }
 // Thick cutaway wall caps create the angled, illustrated apartment view.
 for(const w of WALLS){const room=APARTMENT.rooms.find(r=>Math.abs(r.y-w.y-8)<2||Math.abs(r.x-w.x-8)<2);rect(c,w.x+4,w.y+7,w.w,w.h,'#0b161a55');rect(c,w.x,w.y-14,w.w,w.h+14,room?.wall??'#8d9588');rect(c,w.x,w.y-14,w.w,5,'#d6cfb05c');line(c,w.x,w.y+w.h,w.x+w.w,w.y+w.h,'#354542',2);}
 // Windows sit in the apartment's outside walls only, placed clear of the furniture below them.
 for(const w of WINDOWS)drawWindow(c,w);
 rect(c,754,196,39,36,'#745843',3);rect(c,759,201,29,26,'#c3bda0',1);ellipse(c,766,211,4,5,'#a98062');ellipse(c,780,211,4,5,'#866346');
 return canvas;
}
