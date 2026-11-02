// No player recording is ever sent to an AI service.
export const audioPrefs = {
  voice: 0.85,
  effects: 0.3,
  announcements: 0,
  music: 0,
  ...JSON.parse(localStorage.getItem("sd-audio") || "{}"),
};
export const audioBus = {
  busy: 0,
  live: false,
  effects: new Set(),
  context: null,
};
export function saveAudio() {
  localStorage.setItem("sd-audio", JSON.stringify(audioPrefs));
  window.dispatchEvent(new Event("audio-prefs"));
}
export function silenceEffects() {
  for (const a of audioBus.effects) {
    a.pause();
    a.currentTime = 0;
  }
  audioBus.effects.clear();
}
export function cue(name) {
  if (audioBus.busy || audioBus.live || !audioPrefs.effects) return;
  const a = new Audio(`/audio/${name}.mp3`);
  a.volume = audioPrefs.effects;
  audioBus.effects.add(a);
  a.onended = () => audioBus.effects.delete(a);
  a.play().catch(() => audioBus.effects.delete(a));
}
export const mic = {
  stream: null,
  device: (() => {
    try {
      return localStorage.getItem("sd-mic") || "";
    } catch {
      return "";
    }
  })(),
  performance: true,
  muted: false,
  request: null,
  async acquire() {
    if (this.stream?.getTracks().some((t) => t.readyState === "live"))
      return this.stream;
    if (this.request) return this.request;
    if (!navigator.mediaDevices?.getUserMedia)
      throw new Error(
        "Microphone access needs HTTPS, or localhost. Open the secure invitation link.",
      );
    this.request = navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: this.device ? { exact: this.device } : undefined,
        echoCancellation: true,
        noiseSuppression: !this.performance,
        autoGainControl: !this.performance,
      },
      video: false,
    });
    try {
      this.stream = await this.request;
      return this.stream;
    } catch (e) {
      // A remembered microphone that is no longer plugged in: fall back to the system default once.
      if (e.name === "OverconstrainedError" && this.device) {
        this.device = "";
        try {
          localStorage.removeItem("sd-mic");
        } catch {}
        this.request = null;
        return this.acquire();
      }
      throw new Error(
        e.name === "NotAllowedError"
          ? "Microphone permission was denied. Allow it in your browser settings, or join as a guesser or spectator."
          : e.name === "NotFoundError"
            ? "No microphone found. Connect one, or join as a spectator."
            : "Your microphone is busy or unavailable. Close other audio apps and try again.",
      );
    } finally {
      this.request = null;
    }
  },
  stop() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  },
  setMuted(muted) {
    this.muted = muted;
    this.stream?.getAudioTracks().forEach((t) => (t.enabled = !muted));
  },
};
export function createMeter(stream, callback) {
  const context = new AudioContext();
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = 256;
  source.connect(analyser);
  const samples = new Uint8Array(analyser.fftSize);
  let frame;
  const draw = () => {
    analyser.getByteTimeDomainData(samples);
    let sum = 0;
    for (const n of samples) sum += ((n - 128) / 128) ** 2;
    callback(Math.min(1, Math.sqrt(sum / samples.length) * 5));
    frame = requestAnimationFrame(draw);
  };
  draw();
  return () => {
    cancelAnimationFrame(frame);
    source.disconnect();
    context.close().catch(() => {});
    callback(0);
  };
}
export function record(stream, maxSeconds, onStop) {
  const mime = [
    "audio/webm;codecs=opus",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ].find((t) => MediaRecorder.isTypeSupported(t));
  const recorder = new MediaRecorder(stream, {
    ...(mime ? { mimeType: mime } : {}),
    audioBitsPerSecond: 64000,
  });
  const chunks = [];
  const start = performance.now();
  audioBus.busy++;
  silenceEffects();
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  let timer;
  recorder.onstop = () => {
    clearTimeout(timer);
    audioBus.busy = Math.max(0, audioBus.busy - 1);
    onStop(
      new Blob(chunks, { type: recorder.mimeType }),
      Math.min(maxSeconds, (performance.now() - start) / 1000),
    );
  };
  recorder.start();
  timer = setTimeout(() => {
    if (recorder.state !== "inactive") recorder.stop();
  }, maxSeconds * 1000);
  return () => {
    if (recorder.state !== "inactive") recorder.stop();
  };
}

export function liveConnections(socket, state, onStatus) {
  let cancelled = false;
  const peers = new Map(),
    elements = new Map(),
    pending = new Map();
  const isPerformer = state.performers.includes(state.you);
  const ids = state.players
    .filter((p) => p.connected && p.id !== state.you)
    .map((p) => p.id);
  let local, config;
  audioBus.live = true;
  silenceEffects();
  const report = () => {
    const connections = [...peers.values()];
    const failed = connections.some((p) =>
      ["failed", "disconnected"].includes(p.connectionState),
    );
    onStatus(
      failed
        ? "Audio connection interrupted. Try reconnecting; restrictive networks may need a relay."
        : connections.some((p) => p.connectionState === "connected")
          ? "Live audio connected"
          : "Connecting live audio…",
    );
  };
  function makePeer(id) {
    const peer = new RTCPeerConnection(config);
    peers.set(id, peer);
    if (local) local.getTracks().forEach((t) => peer.addTrack(t, local));
    peer.onicecandidate = (e) => {
      if (e.candidate)
        socket.emit("signal", {
          to: id,
          kind: "candidate",
          payload: e.candidate.toJSON(),
          phaseId: state.phaseId,
        });
    };
    peer.onconnectionstatechange = report;
    peer.ontrack = (e) => {
      let a = elements.get(id);
      if (!a) {
        a = new Audio();
        a.autoplay = true;
        elements.set(id, a);
      }
      a.volume = audioPrefs.voice;
      a.srcObject = e.streams[0];
      a.play().catch(() => onStatus("Tap Enable audio to hear your friends."));
    };
    return peer;
  }
  const ready = (async () => {
    config = await fetch("/api/ice").then((r) => r.json());
    if (isPerformer) {
      local = await mic.acquire();
      mic.setMuted(mic.muted);
    }
    if (cancelled) {
      if (isPerformer) mic.stop();
      return;
    }
    for (const id of ids) {
      if (isPerformer && (!state.performers.includes(id) || state.you < id)) {
        const peer = makePeer(id);
        await peer.setLocalDescription(await peer.createOffer());
        socket.emit("signal", {
          to: id,
          kind: "offer",
          payload: peer.localDescription.toJSON(),
          phaseId: state.phaseId,
        });
      }
    }
  })().catch((e) => onStatus(e.message));
  const signal = async (data) => {
    if (data.phaseId !== state.phaseId) return;
    await ready;
    if (cancelled) return;
    try {
      let peer = peers.get(data.from);
      if (data.kind === "offer") {
        peer ??= makePeer(data.from);
        await peer.setRemoteDescription(data.payload);
        for (const c of pending.get(data.from) || [])
          await peer.addIceCandidate(c);
        pending.delete(data.from);
        await peer.setLocalDescription(await peer.createAnswer());
        socket.emit("signal", {
          to: data.from,
          kind: "answer",
          payload: peer.localDescription.toJSON(),
          phaseId: state.phaseId,
        });
      } else if (data.kind === "answer" && peer) {
        await peer.setRemoteDescription(data.payload);
        for (const c of pending.get(data.from) || [])
          await peer.addIceCandidate(c);
        pending.delete(data.from);
      } else if (data.kind === "candidate") {
        if (peer?.remoteDescription) await peer.addIceCandidate(data.payload);
        else {
          const list = pending.get(data.from) || [];
          list.push(data.payload);
          pending.set(data.from, list);
        }
      }
    } catch {
      onStatus("Audio connection failed. Reconnect to try again.");
    }
  };
  const enable = () => {
    for (const a of elements.values()) {
      a.volume = audioPrefs.voice;
      a.play().catch(() => {});
    }
  };
  socket.on("signal", signal);
  window.addEventListener("enable-audio", enable);
  window.addEventListener("audio-prefs", enable);
  return () => {
    cancelled = true;
    audioBus.live = false;
    socket.off("signal", signal);
    window.removeEventListener("enable-audio", enable);
    window.removeEventListener("audio-prefs", enable);
    for (const p of peers.values()) p.close();
    for (const a of elements.values()) {
      a.pause();
      a.srcObject = null;
    }
    if (isPerformer) mic.stop();
  };
}
