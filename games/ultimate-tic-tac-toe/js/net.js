/* Online play: two browsers talk directly over WebRTC using PeerJS (peerjs.min.js).
   No game server of our own. PeerJS's free public broker only introduces the two players.
   This file is only the transport: one host, one guest, JSON messages. The game protocol
   (hello, start, move, ...) lives in app.js, so the transport can be swapped or mocked in tests.

   Failures are told apart, because "check your internet" helped nobody:
     broker  the matchmaking server could not be reached (VPN, ad-blocker, school or work network)
     no_room nobody is hosting that code
     ice     the room was found but the two networks could not open a direct link
             (common on mobile data and strict Wi-Fi); err.detail says whether STUN/relay candidates were seen */
(function (root) {
  'use strict';
  const PREFIX = 'uttt-v1-';
  const LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ';  // no I, L, O: easy to read out loud
  const timeouts = { broker: 12000, link: 25000 };   // ms; tests shorten them

  /* STUN finds a direct path. TURN relays the traffic when no direct path exists (strict networks, mobile data).
     The Open Relay servers are free and shared, so they can be slow or unavailable: for a reliable game add your own
     free TURN account in js/ice-config.js (see HOW_TO_RUN.md), which is appended to this list. */
  function iceConfig() {
    return {
      iceServers: [
        { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478', 'stun:global.stun.twilio.com:3478'] },
        { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp', 'turns:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' },
      ].concat(root.UTTT_ICE_SERVERS || []),
      iceCandidatePoolSize: 4,
    };
  }

  const makeCode = () => Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');
  const fail = (code, detail) => Object.assign(new Error(code), { code, detail });
  const log = (...a) => { try { console.info('[online]', ...a); } catch (e) { /* ignore */ } };

  /* Watch a connection's ICE progress: which kinds of candidates were found, and when it fails. */
  function watchIce(conn, onFailed) {
    const seen = new Set();
    let pc = null, iv = 0;
    const tick = () => {
      pc = pc || conn.peerConnection;
      if (!pc) return;
      if (!pc.__uttt) {
        pc.__uttt = true;
        pc.addEventListener('icecandidate', (e) => { if (e.candidate) seen.add(e.candidate.type); });
        pc.addEventListener('iceconnectionstatechange', () => log('ice', pc.iceConnectionState));
      }
      if (pc.iceConnectionState === 'failed') { clearInterval(iv); onFailed(); }
    };
    iv = setInterval(tick, 400);
    return { stop: () => clearInterval(iv), candidates: () => [...seen] };
  }
  /* "none" = not even a public address was found: the network blocks STUN/UDP, so only a relay can work. */
  const explain = (types) => (types.includes('srflx') || types.includes('relay') ? 'candidates:' + types.join(',') : 'no-public-address');

  /* Wrap a PeerJS data connection in the small interface the app uses.
     Messages that arrive before the app has registered its handler are kept and delivered on the next tick. */
  function link(peer, conn, early) {
    const h = { msg: [], close: [] };
    const api = {
      send(m) { if (conn && conn.open) try { conn.send(m); } catch (e) { /* closed */ } },
      onMsg(f) { h.msg.push(f); },
      onClose(f) { h.close.push(f); },
      get open() { return !!(conn && conn.open); },
      close() { try { conn.close(); } catch (e) { /* ignore */ } try { peer.destroy(); } catch (e) { /* ignore */ } },
    };
    conn.on('data', (m) => { if (h.msg.length) h.msg.forEach((f) => f(m)); else early.push(m); });
    conn.on('close', () => h.close.forEach((f) => f()));
    conn.on('error', () => {});
    setTimeout(() => { early.splice(0).forEach((m) => h.msg.forEach((f) => f(m))); }, 0);
    return api;
  }

  /* Create a room. Resolves { code, close } once the room exists; onGuest(link) fires when a friend's link opens.
     onStage('friend-connecting' | 'friend-failed') reports what happens next. */
  function host(onGuest, onStage) {
    return new Promise((resolve, reject) => {
      let tries = 0;
      const attempt = () => {
        const code = makeCode();
        const peer = new root.Peer(PREFIX + code, { debug: 0, config: iceConfig() });
        let opened = false, taken = false;
        const stage = (s) => { log('host', s); if (onStage) onStage(s); };
        const timer = setTimeout(() => { if (!opened) { try { peer.destroy(); } catch (e) { /* ignore */ } reject(fail('broker')); } }, timeouts.broker);
        peer.on('open', () => { opened = true; clearTimeout(timer); resolve({ code, close: () => { try { peer.destroy(); } catch (e) { /* ignore */ } } }); });
        peer.on('connection', (conn) => {
          const early = [];
          let linked = false;
          conn.on('data', (m) => { if (!linked) early.push(m); });     // never lose a message sent right as the link opens
          stage('friend-connecting');
          const ice = watchIce(conn, () => { if (!linked) stage('friend-failed'); });
          const giveUp = setTimeout(() => { if (!linked) { stage('friend-failed'); try { conn.close(); } catch (e) { /* ignore */ } } }, timeouts.link);
          conn.on('open', () => {
            clearTimeout(giveUp); ice.stop();
            if (taken) { try { conn.send({ t: 'full' }); } catch (e) { /* ignore */ } setTimeout(() => conn.close(), 300); return; }
            taken = true; linked = true;
            onGuest(link(peer, conn, early));
          });
        });
        peer.on('error', (e) => {
          clearTimeout(timer);
          if (!opened && e && e.type === 'unavailable-id' && tries++ < 5) { try { peer.destroy(); } catch (x) { /* ignore */ } attempt(); return; }
          if (!opened) { try { peer.destroy(); } catch (x) { /* ignore */ } reject(fail('broker', e && e.type)); }
        });
        peer.on('disconnected', () => { if (opened) try { peer.reconnect(); } catch (e) { /* ignore */ } });
      };
      attempt();
    });
  }

  /* Join a room by code. Resolves with a link, or rejects with code 'no_room' / 'broker' / 'ice'.
     onStage('broker' | 'found' | 'slow') reports progress. */
  function join(code, onStage) {
    return new Promise((resolve, reject) => {
      const peer = new root.Peer({ debug: 0, config: iceConfig() });
      let done = false, ice = null, slow = 0, timer = 0;
      const stage = (s) => { log('join', s); if (onStage) onStage(s); };
      const end = (err) => {
        if (done) return;
        done = true; clearTimeout(timer); clearTimeout(slow); if (ice) ice.stop();
        try { peer.destroy(); } catch (e) { /* ignore */ }
        reject(err);
      };
      const iceError = () => fail('ice', explain(ice ? ice.candidates() : []));
      timer = setTimeout(() => end(ice ? iceError() : fail('broker')), timeouts.broker);
      stage('broker');
      peer.on('open', () => {
        stage('found');
        clearTimeout(timer);
        timer = setTimeout(() => end(iceError()), timeouts.link);
        slow = setTimeout(() => stage('slow'), 8000);
        const conn = peer.connect(PREFIX + code.toUpperCase(), { reliable: true, serialization: 'json' });
        ice = watchIce(conn, () => end(iceError()));
        const early = [];
        conn.on('data', (m) => early.push(m));
        conn.on('open', () => {
          if (done) return;
          done = true; clearTimeout(timer); clearTimeout(slow); ice.stop();
          resolve(link(peer, conn, early));
        });
        conn.on('error', () => end(iceError()));
      });
      peer.on('error', (e) => end(e && e.type === 'peer-unavailable' ? fail('no_room') : fail('broker', e && e.type)));
    });
  }

  root.UTTT.net = { host, join, makeCode, timeouts };
})(window);
