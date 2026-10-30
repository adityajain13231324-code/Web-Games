/* Online play: two browsers talk directly over WebRTC using PeerJS (peerjs.min.js).
   No game server of our own. PeerJS's free public broker only introduces the two players.
   This file is only the transport: one host, one guest, JSON messages. The game protocol
   (hello, start, move, ...) lives in app.js, so the transport can be swapped or mocked in tests. */
(function (root) {
  'use strict';
  const PREFIX = 'uttt-v1-';
  const LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ';  // no I, L, O: easy to read out loud

  // STUN finds a direct path; the free public TURN relay is the fallback for strict networks.
  const ICE = {
    iceServers: [
      { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
      { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turns:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' },
    ],
  };

  const makeCode = () => Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');
  const fail = (code) => Object.assign(new Error(code), { code });

  /* Wrap a PeerJS data connection in the small interface the app uses. */
  function link(peer, conn) {
    const h = { msg: [], close: [] };
    const api = {
      send(m) { if (conn && conn.open) try { conn.send(m); } catch (e) { /* closed */ } },
      onMsg(f) { h.msg.push(f); },
      onClose(f) { h.close.push(f); },
      get open() { return !!(conn && conn.open); },
      close() { try { conn.close(); } catch (e) { /* ignore */ } try { peer.destroy(); } catch (e) { /* ignore */ } },
    };
    conn.on('data', (m) => h.msg.forEach((f) => f(m)));
    conn.on('close', () => h.close.forEach((f) => f()));
    conn.on('error', () => {});
    return api;
  }

  /* Create a room. Resolves { code, waitForGuest() } once the room exists; waitForGuest resolves with the link. */
  function host(onGuest) {
    return new Promise((resolve, reject) => {
      let tries = 0;
      const attempt = () => {
        const code = makeCode();
        const peer = new root.Peer(PREFIX + code, { debug: 0, config: ICE });
        let opened = false, taken = false;
        const timer = setTimeout(() => { if (!opened) { try { peer.destroy(); } catch (e) { /* ignore */ } reject(fail('timeout')); } }, 20000);
        peer.on('open', () => { opened = true; clearTimeout(timer); resolve({ code, close: () => { try { peer.destroy(); } catch (e) { /* ignore */ } } }); });
        peer.on('connection', (conn) => {
          conn.on('open', () => {
            if (taken) { try { conn.send({ t: 'full' }); } catch (e) { /* ignore */ } setTimeout(() => conn.close(), 300); return; }
            taken = true;
            onGuest(link(peer, conn));
          });
        });
        peer.on('error', (e) => {
          clearTimeout(timer);
          if (!opened && e && e.type === 'unavailable-id' && tries++ < 5) { try { peer.destroy(); } catch (x) { /* ignore */ } attempt(); return; }
          if (!opened) { try { peer.destroy(); } catch (x) { /* ignore */ } reject(fail((e && e.type) || 'network')); }
        });
        peer.on('disconnected', () => { if (opened) try { peer.reconnect(); } catch (e) { /* ignore */ } });
      };
      attempt();
    });
  }

  /* Join a room by code. Resolves with a link, or rejects with code 'no_room' / 'timeout' / 'network'. */
  function join(code) {
    return new Promise((resolve, reject) => {
      const peer = new root.Peer({ debug: 0, config: ICE });
      let done = false;
      const end = (err) => { if (done) return; done = true; clearTimeout(timer); try { peer.destroy(); } catch (e) { /* ignore */ } reject(err); };
      const timer = setTimeout(() => end(fail('timeout')), 20000);
      peer.on('open', () => {
        const conn = peer.connect(PREFIX + code.toUpperCase(), { reliable: true, serialization: 'json' });
        conn.on('open', () => { if (done) return; done = true; clearTimeout(timer); resolve(link(peer, conn)); });
        conn.on('error', () => end(fail('network')));
      });
      peer.on('error', (e) => end(fail(e && e.type === 'peer-unavailable' ? 'no_room' : (e && e.type) || 'network')));
    });
  }

  root.UTTT.net = { host, join, makeCode };
})(window);
