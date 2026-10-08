/* Liar's Call networking: one host, up to 5 guests, over PeerJS (WebRTC).
   The host relays everything, so guests only ever talk to the host. */
window.LC_NET=(function(){
  'use strict';
  var PFX='liarscall-v1-';
  // STUN finds a direct path; the TURN relays are the fallback for strict networks (school/office Wi-Fi,
  // some mobile data) that block direct browser-to-browser links. Port 443 over TCP/TLS gets through
  // firewalls that only allow web traffic. These are the free public Open Relay servers (no paid service).
  var ICE={iceServers:[
    {urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302','stun:global.stun.twilio.com:3478']},
    {urls:['turn:openrelay.metered.ca:80','turn:openrelay.metered.ca:443','turn:openrelay.metered.ca:443?transport=tcp','turns:openrelay.metered.ca:443?transport=tcp'],username:'openrelayproject',credential:'openrelayproject'}
  ],iceCandidatePoolSize:4};
  function err(code){ var e=new Error(code); e.code=code; return e }

  function host(code,maxGuests){
    return new Promise(function(resolve,reject){
      var peer=new Peer(PFX+code,{debug:0,config:ICE}), conns=new Map(), done=false, closed=false, banned=new Set();
      var H={msg:[],join:[],leave:[]};
      var api={
        id:null, isHost:true,
        send:function(to,m){
          if(to){ var c=conns.get(to); if(c&&c.open) try{c.send(m)}catch(e){} return }
          conns.forEach(function(c){ if(c.open) try{c.send(m)}catch(e){} });
        },
        // close one guest's connection (optionally telling them why, and keeping them out)
        drop:function(id,msg,ban){
          if(ban) banned.add(id);
          var c=conns.get(id); if(!c)return;
          if(msg&&c.open) try{c.send(msg)}catch(e){}
          conns.delete(id); H.leave.forEach(function(f){f(id)});
          setTimeout(function(){ try{c.close()}catch(e){} },250);
        },
        onMsg:function(f){H.msg.push(f)}, onJoin:function(f){H.join.push(f)}, onLeave:function(f){H.leave.push(f)},
        peers:function(){ return Array.from(conns.keys()) },
        leave:function(){ closed=true; conns.forEach(function(c){try{c.close()}catch(e){}}); try{peer.destroy()}catch(e){} }
      };
      var timer=setTimeout(function(){ if(!done){ done=true; closed=true; try{peer.destroy()}catch(e){} reject(err('timeout')) } },30000);
      peer.on('open',function(id){ if(done)return; done=true; clearTimeout(timer); api.id=id; resolve(api) });
      peer.on('connection',function(c){
        c.on('open',function(){
          if(closed){ try{c.close()}catch(e){} return }
          var id=c.peer;
          if(banned.has(id)){ try{c.send({t:'kicked'})}catch(e){} setTimeout(function(){try{c.close()}catch(e){}},400); return }
          if(!conns.has(id)&&conns.size>=maxGuests){ try{c.send({t:'full'})}catch(e){} setTimeout(function(){try{c.close()}catch(e){}},400); return }
          var old=conns.get(id); if(old&&old!==c) try{old.close()}catch(e){}
          conns.set(id,c); H.join.forEach(function(f){f(id)});
        });
        c.on('data',function(m){ if(conns.get(c.peer)===c) H.msg.forEach(function(f){f(c.peer,m)}) });
        c.on('close',function(){ if(conns.get(c.peer)===c){ conns.delete(c.peer); H.leave.forEach(function(f){f(c.peer)}) } });
        c.on('error',function(){});
      });
      peer.on('error',function(e){
        if(!done){ done=true; clearTimeout(timer); closed=true; try{peer.destroy()}catch(_){} reject(err(e&&e.type==='unavailable-id'?'taken':(e&&e.type)||'network')) }
      });
      peer.on('disconnected',function(){ if(!closed) try{peer.reconnect()}catch(e){} });
    });
  }

  function join(code){
    return new Promise(function(resolve,reject){
      var peer=new Peer({debug:0,config:ICE}), conn=null, done=false, closed=false, tries=0;
      var H={msg:[],lost:[],back:[]};
      var api={
        id:null, isHost:false,
        send:function(_,m){ if(conn&&conn.open) try{conn.send(m)}catch(e){} },
        onMsg:function(f){H.msg.push(f)}, onLost:function(f){H.lost.push(f)}, onBack:function(f){H.back.push(f)},
        connected:function(){ return !!(conn&&conn.open) },
        leave:function(){ closed=true; try{conn&&conn.close()}catch(e){} try{peer.destroy()}catch(e){} }
      };
      function fail(code){ if(done)return; done=true; closed=true; clearTimeout(timer); try{peer.destroy()}catch(e){} reject(err(code)) }
      var timer=setTimeout(function(){ fail('timeout') },30000);
      function retry(ms){ if(!closed&&tries++<60) setTimeout(go,ms) }
      function go(){
        if(closed)return;
        var c=peer.connect(PFX+code,{reliable:true,serialization:'json'}); conn=c;
        c.on('open',function(){
          if(closed||conn!==c){ try{c.close()}catch(e){} return }
          tries=0;
          if(!done){ done=true; clearTimeout(timer); resolve(api) } else H.back.forEach(function(f){f()});
        });
        c.on('data',function(m){ if(conn===c) H.msg.forEach(function(f){f(m)}) });
        c.on('close',function(){ if(conn===c){ conn=null; if(done&&!closed){ H.lost.forEach(function(f){f()}); retry(2500) } } });
        c.on('error',function(){});
      }
      peer.on('open',function(id){ api.id=id; go() });
      peer.on('error',function(e){
        if(e&&e.type==='peer-unavailable'){ if(!done) fail('no_room'); else retry(3000) }
        else if(!done) fail((e&&e.type)||'network');
      });
      peer.on('disconnected',function(){ if(!closed) try{peer.reconnect()}catch(e){} });
    });
  }
  return {host:host, join:join};
})();
