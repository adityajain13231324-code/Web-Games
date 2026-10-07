import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { randomInt } from 'node:crypto';
import { Server, Room, type Client, matchMaker } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { GameEngine } from './engine';

const rooms=new Map<string,ApartmentRoom>();
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ';
const newCode=()=>Array.from({length:6},()=>alphabet[randomInt(alphabet.length)]).join('');
class ApartmentRoom extends Room {
 maxClients=4;autoDispose=false;engine!:GameEngine;emptyTimer?:ReturnType<typeof setTimeout>;rates=new Map<string,number>();
 onCreate(){let code=newCode();while(rooms.has(code))code=newCode();this.engine=new GameEngine(code);rooms.set(code,this);this.setPrivate(true);
  this.setSimulationInterval(()=>{this.engine.tick();this.broadcast('snapshot',this.engine.state);},50);
  this.onMessage('move',(c,data)=>this.engine.input(c.sessionId,data));
  this.onMessage('pos',(c,data)=>{try{if(!this.engine.position(c.sessionId,data)){const p=this.engine.player(c.sessionId);c.send('correct',{x:p.x,y:p.y});}}catch{/* Player left mid-message. */}});
  this.onMessage('start',c=>this.safe(c,()=>this.engine.start(c.sessionId)));
  this.onMessage('inspect',(c,data)=>this.safe(c,()=>{if(typeof data!=='string')return;c.send('inspection',this.engine.inspect(c.sessionId,data));}));
  this.onMessage('close',c=>this.engine.release(c.sessionId));
  this.onMessage('action',(c,data)=>this.safe(c,()=>{if(!data||typeof data.target!=='string'||typeof data.action!=='string')return;const message=this.engine.act(c.sessionId,data.target,data.action,data.value);c.send('feedback',{message,good:true});c.send('inspection',this.engine.inspect(c.sessionId,data.target));}));
  this.onMessage('hint',c=>this.safe(c,()=>c.send('hint',this.engine.hint(c.sessionId))));
  this.onMessage('ping',c=>this.safe(c,()=>this.engine.ping(c.sessionId)));
  this.onMessage('chat',(c,data)=>this.safe(c,()=>{const key=`chat:${c.sessionId}`;if(Date.now()-(this.rates.get(key)??0)<500)return;this.rates.set(key,Date.now());this.engine.chat(c.sessionId,data);}));
  this.emptyTimer=setTimeout(()=>{if(!this.clients.length)this.disconnect();},20*60*1000);
 }
 safe(c:Client,fn:()=>unknown){try{fn();}catch(e){c.send('feedback',{message:e instanceof Error?e.message:'Please try again.',good:false});}}
 onJoin(c:Client,options:any){if(this.emptyTimer)clearTimeout(this.emptyTimer);this.engine.add(c.sessionId,options?.name,options?.avatar);c.send('snapshot',this.engine.state);}
 async onLeave(c:Client,consented:boolean){this.engine.disconnect(c.sessionId);if(!this.engine.state.players.some(p=>p.connected))this.emptyTimer=setTimeout(()=>{if(!this.engine.state.players.some(p=>p.connected))this.disconnect();},20*60*1000);
  try{if(consented)throw Error('left');await this.allowReconnection(c,120);this.engine.reconnect(c.sessionId);if(this.emptyTimer)clearTimeout(this.emptyTimer);c.send('snapshot',this.engine.state);}catch{this.engine.remove(c.sessionId);}this.rates.delete(`chat:${c.sessionId}`);
 }
 onDispose(){if(this.emptyTimer)clearTimeout(this.emptyTimer);rooms.delete(this.engine.state.roomCode);}
}
const app=express();
const allowed=process.env.CLIENT_ORIGIN?.split(',').map(s=>s.trim());
app.use(cors({origin:allowed??true}));app.use(express.json({limit:'4kb'}));
const apiRates=new Map<string,{count:number;reset:number}>();
app.use('/api',(req,res,next)=>{const key=req.ip??'local',now=Date.now(),slot=apiRates.get(key);if(!slot||slot.reset<now)apiRates.set(key,{count:1,reset:now+60000});else if(++slot.count>30){res.status(429).json({error:'Too many room requests. Try again in a minute.'});return;}next();});
app.get('/api/health',(_req,res)=>res.json({ok:true,game:'Apartment 07'}));
app.post('/api/rooms',async(req,res)=>{try{const reservation=await matchMaker.create('apartment',req.body??{});res.json(reservation);}catch{res.status(503).json({error:'Could not create an apartment. Please try again.'});}});
app.post('/api/rooms/:code/join',async(req,res)=>{const room=rooms.get(req.params.code.toUpperCase());if(!room){res.status(404).json({error:'That room code was not found. Check the six letters.'});return;}if(room.engine.state.phase==='won'){res.status(409).json({error:'This chapter is already complete. Create a new apartment.'});return;}try{res.json(await matchMaker.joinById(room.roomId,req.body??{}));}catch{res.status(409).json({error:'This apartment is full, or its seats are reserved for reconnecting friends.'});}});
const http=createServer(app);const server=new Server({transport:new WebSocketTransport({server:http,maxPayload:8192})});server.define('apartment',ApartmentRoom);const port=Number(process.env.PORT??2567);await server.listen(port,'0.0.0.0');console.log(`Apartment 07 server ready at http://127.0.0.1:${port}`);
