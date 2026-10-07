import test from 'node:test';
import assert from 'node:assert/strict';
import { Client, type Room } from 'colyseus.js';
import type { Snapshot, Inspection } from '../../shared/types';
const base=process.env.TEST_SERVER_URL??'http://127.0.0.1:2567';
const client=new Client(base.replace(/^http/,'ws'));
type Peer={room:Room;state?:Snapshot;views:Inspection[];feedback:{message:string;good:boolean}[]};
const until=async(fn:()=>boolean,ms=8000)=>{const start=Date.now();while(!fn()){if(Date.now()-start>ms)throw Error('Timed out waiting for server state');await new Promise(r=>setTimeout(r,30));}};
async function connect(name:string,code?:string):Promise<Peer>{const res=await fetch(`${base}/api/rooms${code?`/${code}/join`:''}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});if(!res.ok)throw Error((await res.json()).error);const room=await client.consumeSeatReservation(await res.json());return attach(room);}
function attach(room:Room):Peer{const p:Peer={room,views:[],feedback:[]};room.onMessage('snapshot',(s:Snapshot)=>p.state=s);room.onMessage('inspection',(v:Inspection)=>p.views.push(v));room.onMessage('feedback',(v:any)=>p.feedback.push(v));room.onMessage('hint',()=>{});return p;}
async function walk(p:Peer,x:number,y:number){let seq=0;const start=Date.now();while(true){const me=p.state!.players.find(v=>v.id===p.room.sessionId)!;const dx=x-me.x,dy=y-me.y;if(Math.hypot(dx,dy)<9)break;if(Date.now()-start>12000)throw Error(`Could not walk to ${x},${y}; at ${me.x},${me.y}`);const n=Math.hypot(dx,dy);p.room.send('move',{x:dx/n,y:dy/n,seq:++seq});await new Promise(r=>setTimeout(r,50));}p.room.send('move',{x:0,y:0,seq:++seq});await new Promise(r=>setTimeout(r,90));}
async function inspect(p:Peer,id:string){const before=p.views.length;p.room.send('inspect',id);await until(()=>p.views.length>before);return p.views.at(-1)!;}
async function action(p:Peer,target:string,a:string,value?:unknown){const n=p.feedback.length;p.room.send('action',{target,action:a,value});await until(()=>p.feedback.length>n);return p.feedback.at(-1)!;}
test('real four-client session, late join, shared items, mechanism ownership, disconnect and reconnect',{timeout:45000},async()=>{
 const peers:Peer[]=[];try{
 const a=await connect('Host');peers.push(a);await until(()=>!!a.state);const code=a.state!.roomCode;assert.match(code,/^[A-Z]{6}$/);a.room.send('start');await until(()=>a.state!.phase==='playing');
 const b=await connect('Second',code),c=await connect('Third',code),d=await connect('Fourth',code);peers.push(b,c,d);await until(()=>peers.every(p=>p.state?.players.length===4));assert.equal(b.state!.phase,'playing');
 await assert.rejects(()=>connect('Fifth',code),/full/);
 a.room.send('inspect','entrance');await until(()=>a.feedback.length>0);assert.equal(a.feedback.at(-1)!.good,false);
 await walk(a,220,400);await walk(b,240,400);const av=await inspect(a,'seat');assert.equal(av.lockedBy,undefined);const bv=await inspect(b,'seat');assert.equal(bv.lockedBy,'Host');assert.equal((await action(b,'seat','collectSeat')).good,false);
 assert.equal((await action(a,'seat','collectSeat')).good,true);await until(()=>peers.every(p=>p.state!.inventory.some(i=>i.id==='seat')));assert.equal((await action(a,'seat','collectSeat')).good,true);assert.equal(a.state!.inventory.filter(i=>i.id==='seat').length,1);
 const token=a.room.reconnectionToken,oldId=a.room.sessionId;a.room.connection.close();await until(()=>b.state!.players.find(p=>p.id===oldId)?.connected===false);assert.notEqual(b.state!.hostId,oldId);assert.equal((await inspect(b,'seat')).lockedBy,undefined);
 const restored=attach(await client.reconnect(token));peers[0]=restored;await until(()=>!!restored.state);assert.equal(restored.room.sessionId,oldId);assert.ok(restored.state!.inventory.some(i=>i.id==='seat'));assert.ok(restored.state!.players.find(p=>p.id===oldId)!.connected);
 b.room.send('close');b.room.send('chat','We found the stool!');await until(()=>c.state!.chat.some(m=>m.text==='We found the stool!'));assert.ok(d.state!.inventory.some(i=>i.id==='seat'));
 }finally{await Promise.allSettled(peers.map(p=>p.room.leave()));}
});
