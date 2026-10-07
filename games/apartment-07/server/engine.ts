import { APARTMENT, canSee, movePoint, walkable } from '../shared/map';
import { cleanAvatar, RUN_SPEED, WALK_SPEED } from '../shared/types';
import type { Snapshot, Player, Inspection, AvatarConfig } from '../shared/types';
import { CLUES, ITEMS, PUZZLES } from './content';

export class GameEngine {
 state:Snapshot={roomCode:'',hostId:'',phase:'lobby',startedAt:0,players:[],inventory:[],clues:[],flags:[],doors:[],chat:[],locks:{},hintCounts:{},pings:[],objectives:[]};
 inputs=new Map<string,{x:number;y:number;seq:number;at:number;run:boolean}>();
 /** Last time each player reported a client-predicted position. */
 moved=new Map<string,number>();
 constructor(code='TESTAA'){this.state.roomCode=code;}
 has(id:string){return this.state.flags.includes(id);}
 flag(id:string){if(!this.has(id))this.state.flags.push(id);}
 item(id:string){return this.state.inventory.some(i=>i.id===id);}
 give(id:string){if(!this.item(id))this.state.inventory.push(ITEMS[id]);}
 clue(id:string){if(!this.state.clues.some(c=>c.id===id))this.state.clues.push(CLUES[id]);}
 open(id:string){if(!this.state.doors.includes(id)){this.state.doors.push(id);this.flag(id);this.system(`${APARTMENT.doors.find(d=>d.id===id)?.label??id} unlocked.`);}}
 player(id:string){const p=this.state.players.find(p=>p.id===id);if(!p)throw Error('Player not found.');return p;}
 add(id:string,name:string,avatar:Partial<AvatarConfig>){if(this.state.players.filter(p=>p.connected).length>=4)throw Error('This apartment already has four explorers.');const p:Player={id,name:typeof name==='string'?name.trim().slice(0,18)||'Explorer':'Explorer',avatar:cleanAvatar(avatar),...APARTMENT.spawn,direction:'down',moving:false,running:false,connected:true,arrived:false,inputSeq:0};this.state.players.push(p);if(!this.state.hostId)this.state.hostId=id;return p;}
 disconnect(id:string){const p=this.player(id);p.connected=false;p.moving=false;this.release(id);this.inputs.delete(id);this.moved.delete(id);if(this.state.hostId===id)this.state.hostId=this.state.players.find(p=>p.connected)?.id??'';this.checkWin();}
 remove(id:string){this.state.players=this.state.players.filter(p=>p.id!==id);}
 reconnect(id:string){this.player(id).connected=true;if(!this.state.hostId)this.state.hostId=id;}
 start(id:string){if(id!==this.state.hostId)throw Error('Only the room creator can begin.');if(this.state.phase!=='lobby')return;this.state.phase='playing';this.state.startedAt=Date.now();this.state.objectives=this.objectives();this.system('The rain wakes you. Start with the drawing on the little desk.');}
 system(text:string){this.state.chat.push({id:Date.now()+Math.random(),name:'Apartment 07',text,system:true});this.state.chat=this.state.chat.slice(-50);}
 chat(id:string,text:unknown){if(typeof text!=='string')return;const clean=text.trim().slice(0,240);if(clean)this.state.chat.push({id:Date.now()+Math.random(),name:this.player(id).name,text:clean});this.state.chat=this.state.chat.slice(-50);}
 input(id:string,data:any){if(!data||!Number.isFinite(data.x)||!Number.isFinite(data.y)||!Number.isSafeInteger(data.seq))return;let x=Math.max(-1,Math.min(1,data.x)),y=Math.max(-1,Math.min(1,data.y));const length=Math.hypot(x,y);if(length>1){x/=length;y/=length;}this.inputs.set(id,{x,y,seq:data.seq,at:Date.now(),run:data.run===true});}

 /**
  * Client-predicted movement. The client simulates its own walking for instant, smooth controls and
  * reports where it is; the server only accepts positions that are reachable at sprint speed without
  * crossing walls or closed doors. Returns false when the report was rejected (the client snaps back).
  */
 position(id:string,data:any):boolean{
  if(this.state.phase!=='playing'||!data||!Number.isFinite(data.x)||!Number.isFinite(data.y))return true;
  const p=this.player(id);if(!p.connected)return true;
  const now=Date.now(),last=this.moved.get(id)??now-250;
  const frozen=Object.values(this.state.locks).includes(id);
  const dist=Math.hypot(data.x-p.x,data.y-p.y),allowed=RUN_SPEED*Math.min(.5,(now-last)/1000)*1.4+28;
  const dir=['down','up','left','right'].includes(data.dir)?data.dir:p.direction;
  this.moved.set(id,now);
  if(frozen||dist>allowed||!this.clearPath(p,data)){p.moving=false;return dist<1;}
  p.moving=data.moving===true&&dist>0.05;p.running=p.moving&&data.run===true;p.x=data.x;p.y=data.y;p.direction=dir;
  if(Number.isSafeInteger(data.seq))p.inputSeq=data.seq;
  return true;
 }
 /** Samples the straight line between two points; walls are thicker than the sample step so none can be skipped. */
 clearPath(a:{x:number;y:number},b:{x:number;y:number}){const d=Math.hypot(b.x-a.x,b.y-a.y),n=Math.max(1,Math.ceil(d/4));for(let i=1;i<=n;i++){if(!walkable({x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n},this.state.doors,10))return false;}return true;}
 objectives(){const active=PUZZLES.filter(p=>!this.has(p.completion)&&p.prerequisites.every(r=>this.has(r)));return this.has('exit')?['Walk through the front door together.']:active.map(p=>p.goal);}
 tick(dt=0.05){if(this.state.phase!=='playing')return;this.state.objectives=this.objectives();for(const p of this.state.players){const reported=Date.now()-(this.moved.get(p.id)??0)<300;if(reported)continue;const i=this.inputs.get(p.id);p.moving=false;p.running=false;if(!p.connected||!i||Date.now()-i.at>300||Object.values(this.state.locks).includes(p.id))continue;const speed=i.run?RUN_SPEED:WALK_SPEED;const q=movePoint(p,i.x*speed*dt,i.y*speed*dt,this.state.doors);p.moving=Math.hypot(q.x-p.x,q.y-p.y)>0.1;p.running=p.moving&&i.run;p.x=q.x;p.y=q.y;p.inputSeq=i.seq;if(i.x||i.y)p.direction=Math.abs(i.x)>Math.abs(i.y)?i.x>0?'right':'left':i.y>0?'down':'up';}this.state.pings=this.state.pings.filter(p=>p.until>Date.now());this.checkWin();}
 checkWin(){if(!this.has('exit')||this.state.phase!=='playing')return;const ps=this.state.players.filter(p=>p.connected);for(const p of ps)p.arrived=p.y>1748;if(ps.length&&ps.every(p=>p.arrived)){this.state.phase='won';this.flag('reunion');this.system('The door opens. Mum is here. You are home.');}}
 reachable(id:string,target:string){if(this.state.phase!=='playing')throw Error('Begin the chapter first.');const p=this.player(id),o=APARTMENT.interactables.find(o=>o.id===target);if(!p.connected||!o||Math.hypot(o.x-p.x,o.y-p.y)>94||!canSee(p,o,this.state.doors,94))throw Error('Walk closer to this object first.');return o;}
 release(id:string){for(const k of Object.keys(this.state.locks))if(this.state.locks[k]===id)delete this.state.locks[k];}
 inspect(id:string,target:string):Inspection{
 const o=this.reachable(id,target);this.release(id);
 const view:Inspection={id:target,title:o.name,subtitle:APARTMENT.rooms.find(r=>r.id===o.room)!.name,text:'',kind:o.kind,actions:[],solved:false};
 const texts:Record<string,string>={
  seat:'A round wooden seat lies beside the bed. Its underside has four threaded sockets.',legs:'Four short stool legs are scattered near the toy chest. They look like a set.',
  shelf:this.has('stool')?'The assembled stool reaches the shelf. A square-ended winding handle lies behind the books.':'The shelf is too high. A short stool would let you reach the handle behind the books.',
  bedroomDoor:'A low hatch beside the door has a square socket. It is the manual release from the toy-house drawing.',
  hooks:'Four wooden coat hooks: moon, star, leaf and circle. One has something tucked behind it.',keyCabinet:'Two labelled release keys hang behind the cabinet’s little glass door. The cabinet itself is locked.',
  livingDoor:'A leaf-shaped tag marks this mechanical release. The key cabinet may have its match.',kitchenDoor:'A cup-shaped tag marks the kitchen release.',
  batteries:'A sideboard drawer contains two sealed AA batteries.',remote:this.has('remote')?'The remote lights up. You can now play the saved recording at the television.':'The television remote has an empty battery compartment. The TV’s own standby light is on.',
  tv:this.has('recording')?CLUES.recording.text:'The TV’s battery-backup light is glowing. There is a saved maintenance video, but the remote needs batteries.',
  studyDoor:'Four symbols on the release panel: a bed, a plate, a book and a front door. Each takes one number.',
  magnet:'A small fishing-game magnet hangs from a string on the fridge. It is stronger than it looks.',
  pantry:'Four labelled pantry tins sit on the shelf. The receipt might explain which one matters.',utilityDoor:'A small brass lock guards the utility room’s release.',
  sheet:'A transparent sheet is tucked between the service manuals. Its printed corner marks match a floor plan.',floorPlan:'The apartment service plan has labels but no arrows. Drag the transparent sheet into alignment to trace the backup route.',
  drawer:'A four-digit combination secures the desk drawer. Dad’s note explains the date he chose.',
  console:this.has('backup')?'The status lights show three green ticks. The backup system is running.':this.has('toolInserted')?'The service tool is seated. Press the three zones in the route’s order, then confirm.':'A triangular service socket sits beneath three zone controls. It needs the emergency release tool.',
  parentsDoor:this.has('backup')?'The bedroom latch has released.':'An amber indicator reads: AWAITING BACKUP. There is no separate keyhole.',
  suitcases:'Three bags have luggage tags: WORK, HOME and HOLIDAY. A note on the bedside table mentions the spare key.',
  entrance:this.has('exit')?'The front door is open. Walk through together.':this.has('manual')?'MANUAL is selected. The release handle is ready.':this.has('keyInserted')?'The override key is inserted. Turn the selector to MANUAL.':'A mechanical override socket, an AUTO / MANUAL selector and a release handle. Mum calls softly from outside.'
 };
 if(CLUES[target]){this.clue(target);this.flag(`read:${target}`);view.text=CLUES[target].text;}else view.text=texts[target]??'A familiar object in a strangely quiet home.';
 const action=(aid:string,label:string,item?:string)=>view.actions.push({id:aid,label,item});
 switch(target){
  case'seat':if(!this.item('seat'))action('collectSeat','Take the stool seat');else view.solved=true;break;
  case'legs':if(!this.item('legs'))action('collectLegs','Gather the four legs');else view.solved=true;break;
  case'shelf':if(!this.has('stool'))action('assemble','Assemble the stool','seat');else if(!this.item('handle'))action('handle','Climb up and take the handle');else view.solved=true;break;
  case'bedroomDoor':if(!this.has('bedroom'))action('wind','Fit the handle and wind','handle');else view.solved=true;break;
  case'hooks':if(!this.item('cabinetKey'))view.controls={type:'hook',options:['Moon','Star','Leaf','Circle']};else view.solved=true;break;
  case'keyCabinet':if(!this.has('cabinet'))action('cabinet','Open with the small brass key','cabinetKey');else view.solved=true;break;
  case'livingDoor':case'kitchenDoor':case'utilityDoor':{const d=target.replace('Door','');if(!this.has(d))action(d,'Turn the matching release key',`${d}Key`);else view.solved=true;break;}
  case'batteries':if(!this.item('batteries'))action('battery','Take the batteries');else view.solved=true;break;
  case'remote':if(!this.has('remote'))action('remote','Insert both batteries','batteries');else view.solved=true;break;
  case'tv':action('play',this.has('recording')?'Replay the maintenance recording':'Play the saved recording');break;
  case'studyDoor':if(!this.has('study'))view.controls={type:'code'};else view.solved=true;break;
  case'magnet':if(!this.item('magnet'))action('magnet','Take the magnet and string');else view.solved=true;break;
  case'pantry':if(!this.item('utilityKey'))view.controls={type:'tin',options:['Flour','Rice','Tea','Sugar']};else view.solved=true;break;
  case'sheet':if(!this.item('sheet'))action('sheet','Take the transparent sheet');else view.solved=true;break;
  case'floorPlan':if(!this.has('route'))view.controls={type:'overlay'};else{view.text=CLUES.route.text;view.solved=true;}break;
  case'drawer':if(!this.item('tool'))view.controls={type:'code'};else view.solved=true;break;
  case'console':if(this.has('backup'))view.solved=true;else if(!this.has('toolInserted'))action('insertTool','Insert the triangular tool','tool');else view.controls={type:'sequence',options:['Hall','Rooms','Entrance']};break;
  case'suitcases':if(!this.item('override'))view.controls={type:'suitcase',options:['Work','Home','Holiday']};else view.solved=true;break;
  case'entrance':if(this.has('exit'))view.solved=true;else if(!this.has('keyInserted'))action('insertKey','Insert the entrance key','override');else if(!this.has('manual'))view.controls={type:'selector',options:['Auto','Manual']};else action('pull','Pull the release handle');break;
 }
 const owner=this.state.locks[target];if(owner&&owner!==id)view.lockedBy=this.state.players.find(p=>p.id===owner)?.name??'Another explorer';else this.state.locks[target]=id;
 return view;
 }
 act(id:string,target:string,action:string,value?:unknown):string{
 this.reachable(id,target);if(this.state.locks[target]!==id)throw Error('Inspect this object first, or wait for your friend to finish.');
 const allowed:Record<string,string[]>={seat:['collectSeat'],legs:['collectLegs'],shelf:['assemble','handle'],bedroomDoor:['wind'],hooks:['hook'],keyCabinet:['cabinet'],livingDoor:['living'],kitchenDoor:['kitchen'],batteries:['battery'],remote:['remote'],tv:['play'],studyDoor:['code'],magnet:['magnet'],pantry:['tin'],utilityDoor:['utility'],sheet:['sheet'],floorPlan:['overlay'],drawer:['code'],console:['insertTool','sequence'],suitcases:['suitcase'],entrance:['insertKey','manual','pull']};
 if(!allowed[target]?.includes(action))throw Error('That action does not belong to this object.');
 const need=(condition:boolean,text:string)=>{if(!condition)throw Error(text);};const hasItem=(i:string)=>need(this.item(i),`You still need ${ITEMS[i].name.toLowerCase()}.`);
 switch(action){
 case'collectSeat':this.give('seat');return'Stool seat added to your shared bag.';
 case'collectLegs':this.give('legs');return'Four legs added to your shared bag.';
 case'assemble':hasItem('seat');hasItem('legs');this.flag('stool');return'The legs screw into place. The stool is sturdy enough to reach the shelf.';
 case'handle':need(this.has('stool'),'Assemble the stool first.');this.give('handle');return'You reach the winding handle. The little square end looks familiar.';
 case'wind':hasItem('handle');this.open('bedroom');return'A gentle click. The bedroom door slides free.';
 case'hook':need(value==='Star','Only dust behind that hook. Look at the family photograph.');this.give('cabinetKey');return'The small brass key was behind the star.';
 case'cabinet':hasItem('cabinetKey');this.give('livingKey');this.give('kitchenKey');this.flag('cabinet');return'Two labelled keys. You can explore the living room and kitchen in either order.';
 case'living':case'kitchen':case'utility':hasItem(`${action}Key`);this.open(action);return'The release turns and the door opens.';
 case'battery':this.give('batteries');return'Two fresh batteries added to the bag.';
 case'remote':hasItem('batteries');this.flag('remote');return'The remote’s little green light wakes up.';
 case'play':need(this.has('remote'),'The remote needs batteries from the sideboard drawer.');this.flag('recording');this.clue('recording');return'The maintenance recording has been saved in your notebook.';
 case'code':if(target==='studyDoor'){need(value==='2413','The panel gives a soft beep. That sequence does not match.');this.open('study');return'The four symbols light up. The study door releases.';}need(value==='1806','The drawer stays closed. Check the receipt date and DDMM note.');this.give('tool');return'Inside is the emergency release tool.';
 case'magnet':this.give('magnet');return'Magnet and string added to the bag.';
 case'tin':need(value==='Tea','That tin contains exactly what its label says.');hasItem('magnet');this.give('utilityKey');return'The magnet catches something beneath the false bottom. A key!';
 case'sheet':this.give('sheet');return'Transparent service sheet added to the bag.';
 case'overlay':hasItem('sheet');need(value===true,'Align the sheet’s corner marks with the plan.');this.flag('route');this.clue('route');return'The arrows connect Hall → Rooms → Entrance. Route saved.';
 case'insertTool':hasItem('tool');this.flag('toolInserted');return'The triangular tool fits. The three zone controls are ready.';
 case'sequence':need(this.has('toolInserted'),'Insert the release tool first.');need(this.has('route'),'Find and trace the backup route in the study first.');need(Array.isArray(value)&&value.join('|')==='Hall|Rooms|Entrance','The amber lights reset. Check the route in your notebook and try again.');this.flag('backup');this.open('parents');return'Three green ticks. Warm backup lighting returns. Mum’s bedroom unlocks.';
 case'suitcase':need(value==='Home','Clothes and travel things, but no spare key. Check Mum’s note.');this.give('override');this.clue('finalCard');return'The override key and instruction card were tucked beneath the lining.';
 case'insertKey':hasItem('override');need(this.has('backup'),'Restore the backup service first.');this.flag('keyInserted');return'The entrance key turns. Choose the manual setting.';
 case'manual':need(this.has('keyInserted'),'Insert the override key first.');need(value==='Manual','AUTO still relies on the failed controller.');this.flag('manual');return'The selector clicks into MANUAL.';
 case'pull':need(this.has('manual'),'Set the entrance selector to MANUAL first.');this.open('exit');return'The door opens. Mum is waiting. Walk through the doorway together.';
 default:throw Error('Unknown action.');
 }
 }
 hint(id:string){this.player(id);const puzzle=PUZZLES.find(p=>!this.has(p.completion)&&p.prerequisites.every(r=>this.has(r)))??PUZZLES.find(p=>!this.has(p.completion));if(!puzzle)return'Walk through the front door together. Mum is waiting.';const n=this.state.hintCounts[puzzle.id]??0;this.state.hintCounts[puzzle.id]=Math.min(3,n+1);return puzzle.hints[Math.min(n,2)];}
 ping(id:string){const p=this.player(id);this.state.pings=this.state.pings.filter(v=>v.id!==id);this.state.pings.push({id,name:p.name,x:p.x,y:p.y,until:Date.now()+6000});}
}
