import type { MapDefinition, Rect, Point } from './types';
export const APARTMENT: MapDefinition = {
 id:'apartment-07',name:'Apartment 07',width:1808,height:1984,tile:64,spawn:{x:320,y:390},
 rooms:[
  {id:'bedroom',name:'Your bedroom',subtitle:'Everything is familiar. Almost.',x:64,y:64,w:536,h:528,floor:'#735744',wall:'#607879'},
  {id:'hall',name:'The hallway',subtitle:'Home is just beyond the next door.',x:600,y:64,w:224,h:1664,floor:'#665247',wall:'#b2a48a'},
  {id:'living',name:'Living room',subtitle:'Something still has power.',x:64,y:592,w:536,h:528,floor:'#795d47',wall:'#73816c'},
  {id:'kitchen',name:'The kitchen',subtitle:'Small things have their hiding places.',x:824,y:64,w:536,h:528,floor:'#73766b',wall:'#a6ad9e'},
  {id:'study',name:'The study',subtitle:'There is a reason for all of this.',x:64,y:1120,w:536,h:608,floor:'#65503e',wall:'#536964'},
  {id:'utility',name:'Utility room',subtitle:'A little light goes a long way.',x:1360,y:64,w:384,h:528,floor:'#646b69',wall:'#8b9691'},
  {id:'parents',name:'Mum’s room',subtitle:'The last piece was here all along.',x:824,y:592,w:536,h:528,floor:'#806451',wall:'#a9998e'}
 ],
 doors:[
  {id:'bedroom',rooms:['bedroom','hall'],label:'Bedroom release',x:588,y:416,w:24,h:96,horizontal:false,interaction:'bedroomDoor'},
  {id:'living',rooms:['living','hall'],label:'Living room',x:588,y:832,w:24,h:96,horizontal:false,interaction:'livingDoor'},
  {id:'kitchen',rooms:['hall','kitchen'],label:'Kitchen',x:812,y:416,w:24,h:96,horizontal:false,interaction:'kitchenDoor'},
  {id:'study',rooms:['study','hall'],label:'Study panel',x:588,y:1440,w:24,h:96,horizontal:false,interaction:'studyDoor'},
  {id:'utility',rooms:['kitchen','utility'],label:'Utility lock',x:1348,y:416,w:24,h:96,horizontal:false,interaction:'utilityDoor'},
  {id:'parents',rooms:['hall','parents'],label:'Bedroom indicator',x:812,y:832,w:24,h:96,horizontal:false,interaction:'parentsDoor'},
  {id:'exit',rooms:['hall','outside'],label:'Front door',x:664,y:1716,w:96,h:24,horizontal:true,interaction:'entrance'}
 ],
 furniture:[
  {kind:'bed',x:106,y:126,w:142,h:216,color:'#779392'}, {kind:'rug',x:292,y:290,w:220,h:174,color:'#c09b63',solid:false},
  {kind:'shelf',x:416,y:102,w:124,h:76}, {kind:'desk',x:298,y:116,w:96,h:76},
  {kind:'toy',x:112,y:458,w:64,h:48,solid:false}, {kind:'plant',x:500,y:510,w:42,h:44},
  {kind:'cabinet',x:638,y:122,w:142,h:64}, {kind:'coat',x:626,y:292,w:52,h:76},
  {kind:'runner',x:673,y:550,w:76,h:750,solid:false}, {kind:'plant',x:754,y:1530,w:38,h:48},
  {kind:'sofa',x:106,y:846,w:112,h:186,color:'#71877e'}, {kind:'rug',x:256,y:816,w:234,h:198,solid:false,color:'#aa795f'},
  {kind:'table',x:302,y:860,w:92,h:84}, {kind:'tv',x:274,y:636,w:166,h:78},
  {kind:'cabinet',x:114,y:638,w:110,h:84}, {kind:'plant',x:487,y:636,w:49,h:56},
  {kind:'counter',x:870,y:108,w:272,h:80}, {kind:'fridge',x:1210,y:118,w:84,h:108},
  {kind:'table',x:922,y:282,w:142,h:118}, {kind:'cabinet',x:1168,y:292,w:114,h:92},
  {kind:'desk',x:126,y:1184,w:214,h:106}, {kind:'rug',x:288,y:1392,w:216,h:190,solid:false,color:'#8c8263'},
  {kind:'shelf',x:414,y:1180,w:120,h:86}, {kind:'chair',x:183,y:1320,w:58,h:64},
  {kind:'plant',x:108,y:1586,w:52,h:64}, {kind:'cabinet',x:384,y:1606,w:136,h:64},
  {kind:'washer',x:1410,y:128,w:112,h:118}, {kind:'console',x:1580,y:128,w:106,h:138},
  {kind:'shelf',x:1456,y:456,w:168,h:72},
  {kind:'bed',x:1048,y:672,w:176,h:246,color:'#c2b2a0'}, {kind:'table',x:958,y:684,w:60,h:76},
  {kind:'suitcase',x:898,y:978,w:110,h:66}, {kind:'suitcase',x:1050,y:978,w:110,h:66,color:'#977b63'},
  {kind:'suitcase',x:1200,y:978,w:98,h:66,color:'#6c7e74'}, {kind:'plant',x:1264,y:666,w:44,h:54}
 ],
 interactables:[
  {id:'toyHouse',room:'bedroom',name:'Toy-house drawing',icon:'⌂',kind:'document',x:343,y:214},
  {id:'seat',room:'bedroom',name:'Stool seat',icon:'▱',kind:'item',x:187,y:405},
  {id:'legs',room:'bedroom',name:'Wooden legs',icon:'⋒',kind:'item',x:147,y:510},
  {id:'shelf',room:'bedroom',name:'High shelf',icon:'⌁',kind:'mechanism',x:475,y:203},
  {id:'bedroomDoor',room:'bedroom',name:'Release hatch',icon:'⚙',kind:'mechanism',x:561,y:464},
  {id:'notice',room:'hall',name:'Maintenance notice',icon:'▤',kind:'document',x:782,y:570},
  {id:'photo',room:'hall',name:'Family photograph',icon:'▣',kind:'document',x:778,y:244},
  {id:'hooks',room:'hall',name:'Coat hooks',icon:'♧',kind:'hook',x:665,y:391},
  {id:'keyCabinet',room:'hall',name:'Key cabinet',icon:'⚿',kind:'mechanism',x:704,y:211},
  {id:'livingDoor',room:'hall',name:'Living-room release',icon:'⚿',kind:'mechanism',x:631,y:880},
  {id:'kitchenDoor',room:'hall',name:'Kitchen release',icon:'⚿',kind:'mechanism',x:780,y:464},
  {id:'batteries',room:'living',name:'Sideboard drawer',icon:'▰',kind:'item',x:166,y:746},
  {id:'remote',room:'living',name:'TV remote',icon:'▯',kind:'mechanism',x:348,y:975},
  {id:'tv',room:'living',name:'Maintenance recording',icon:'▷',kind:'mechanism',x:350,y:742},
  {id:'diagram',room:'living',name:'Framed apartment diagram',icon:'▦',kind:'document',x:483,y:767},
  {id:'studyDoor',room:'hall',name:'Study release panel',icon:'▦',kind:'code',x:636,y:1488},
  {id:'receipt',room:'kitchen',name:'Grocery receipt',icon:'▤',kind:'document',x:1090,y:350},
  {id:'magnet',room:'kitchen',name:'Fridge magnet',icon:'∩',kind:'item',x:1248,y:254},
  {id:'pantry',room:'kitchen',name:'Pantry tins',icon:'▥',kind:'tin',x:1224,y:410},
  {id:'utilityDoor',room:'kitchen',name:'Utility release',icon:'⚿',kind:'mechanism',x:1317,y:464},
  {id:'sheet',room:'study',name:'Transparent service sheet',icon:'▱',kind:'item',x:468,y:1293},
  {id:'floorPlan',room:'study',name:'Service floor plan',icon:'▦',kind:'overlay',x:338,y:1320},
  {id:'deskNote',room:'study',name:'Dad’s desk note',icon:'▤',kind:'document',x:137,y:1320},
  {id:'drawer',room:'study',name:'Locked desk drawer',icon:'▦',kind:'code',x:264,y:1316},
  {id:'legend',room:'utility',name:'Status legend',icon:'▤',kind:'document',x:1420,y:312},
  {id:'console',room:'utility',name:'Backup service console',icon:'⚙',kind:'sequence',x:1624,y:296},
  {id:'parentsDoor',room:'hall',name:'Bedroom indicator',icon:'◉',kind:'mechanism',x:780,y:880},
  {id:'bedsideNote',room:'parents',name:'Bedside note',icon:'▤',kind:'document',x:981,y:787},
  {id:'suitcases',room:'parents',name:'Packed suitcases',icon:'▣',kind:'suitcase',x:1080,y:1070},
  {id:'entrance',room:'hall',name:'Entrance override',icon:'⚿',kind:'selector',x:712,y:1660}
 ]
};

export const contains=(r:Rect,p:Point,pad=0)=>p.x>=r.x-pad&&p.x<=r.x+r.w+pad&&p.y>=r.y-pad&&p.y<=r.y+r.h+pad;
export function roomAt(p:Point){return APARTMENT.rooms.find(r=>contains(r,p));}
// Split each room boundary at its doorways. This single geometry drives collision and sight.
export function wallRects():Rect[]{
 const walls:Rect[]=[];
 for(const r of APARTMENT.rooms){
  const edges=[{h:true,f:r.y,a:r.x,b:r.x+r.w},{h:true,f:r.y+r.h,a:r.x,b:r.x+r.w},{h:false,f:r.x,a:r.y,b:r.y+r.h},{h:false,f:r.x+r.w,a:r.y,b:r.y+r.h}];
  for(const e of edges){let spans=[[e.a,e.b]]; for(const d of APARTMENT.doors){if(d.horizontal!==e.h||!d.rooms.includes(r.id))continue; const c=e.h?d.y+d.h/2:d.x+d.w/2; if(Math.abs(c-e.f)>16)continue;const a=e.h?d.x:d.y,b=a+(e.h?d.w:d.h);spans=spans.flatMap(([s,t])=>b<=s||a>=t?[[s,t]]:[[s,Math.max(s,a)],[Math.min(t,b),t]].filter(([u,v])=>v>u));}for(const[a,b]of spans)walls.push(e.h?{x:a,y:e.f-8,w:b-a,h:16}:{x:e.f-8,y:a,w:16,h:b-a});}
 }
 return walls;
}
export const WALLS=wallRects();
export function blockers(openDoors: readonly string[], furniture=false):Rect[]{return [...WALLS,...APARTMENT.doors.filter(d=>!openDoors.includes(d.id)),...(furniture?APARTMENT.furniture.filter(f=>f.solid!==false):[])];}
export function rayRect(origin:Point,dx:number,dy:number,r:Rect,max:number):number{
 let lo=0,hi=max; for(const [o,d,a,b]of [[origin.x,dx,r.x,r.x+r.w],[origin.y,dy,r.y,r.y+r.h]]){if(Math.abs(d)<1e-8){if(o<a||o>b)return max;}else{let t1=(a-o)/d,t2=(b-o)/d;if(t1>t2)[t1,t2]=[t2,t1];lo=Math.max(lo,t1);hi=Math.min(hi,t2);if(lo>hi)return max;}}return lo>=0&&lo<=max?lo:max;
}
export function canSee(a:Point,b:Point,doors:readonly string[],radius=320){const d=Math.hypot(b.x-a.x,b.y-a.y);if(d>radius)return false;if(d<1)return true;return blockers(doors).every(r=>rayRect(a,(b.x-a.x)/d,(b.y-a.y)/d,r,d)>=d-1);}
export function walkable(p:Point,doors:readonly string[],radius=12){
 const inWorld=APARTMENT.rooms.some(r=>contains(r,p))||APARTMENT.doors.some(d=>doors.includes(d.id)&&contains(d,p,16))||(doors.includes('exit')&&contains({x:640,y:1728,w:144,h:160},p));
 return inWorld&&!blockers(doors,true).some(r=>{const x=Math.max(r.x,Math.min(p.x,r.x+r.w)),y=Math.max(r.y,Math.min(p.y,r.y+r.h));return Math.hypot(p.x-x,p.y-y)<radius;});
}
export function movePoint(p:Point,dx:number,dy:number,doors:readonly string[]){const q={...p};const n=Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/5);for(let i=0;i<n;i++){if(walkable({x:q.x+dx/n,y:q.y},doors))q.x+=dx/n;if(walkable({x:q.x,y:q.y+dy/n},doors))q.y+=dy/n;}return q;}
