// Original synthesized instrumental loops. No downloads or third-party audio.
const tracks = [
  {name:'Midnight Arcade', bpm:82, roots:[48,45,53,43], voices:[0,7,10,14], wave:'triangle'},
  {name:'Golden Hour', bpm:96, roots:[53,48,50,46], voices:[0,7,11,16], wave:'sine'},
  {name:'After Hours', bpm:68, roots:[45,41,48,43], voices:[0,7,10,14], wave:'sine'}
];
const button = document.querySelector('#music'), notice = document.querySelector('#music-status');
let ctx, master, analyser, samples, bus, timer, meter, noticeTimer, index=-1, beat=0, next=0, busy=false;
function setup() {
  ctx = new AudioContext(); master = ctx.createGain(); master.gain.value=.7;
  const compressor=ctx.createDynamicsCompressor(); analyser=ctx.createAnalyser(); analyser.fftSize=1024;
  samples=new Float32Array(1024); master.connect(compressor); compressor.connect(analyser); analyser.connect(ctx.destination);
  clearInterval(meter); meter=setInterval(()=>{
    analyser.getFloatTimeDomainData(samples);
    const rms=Math.sqrt(samples.reduce((s,v)=>s+v*v,0)/samples.length);
    button.dataset.audioLevel=rms.toFixed(5); button.dataset.audioState=ctx.state;
    button.classList.toggle('audio-active',index>=0 && rms>.0001 && ctx.state==='running');
  },300);
}
function note(midi,time,duration,volume,wave='sine') {
  const oscillator=ctx.createOscillator(), gain=ctx.createGain();
  oscillator.type=wave; oscillator.frequency.value=440*2**((midi-69)/12);
  gain.gain.setValueAtTime(0,time); gain.gain.linearRampToValueAtTime(volume,time+.025);
  gain.gain.exponentialRampToValueAtTime(.0001,time+duration);
  oscillator.connect(gain); gain.connect(bus); oscillator.start(time); oscillator.stop(time+duration+.02);
  oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
}
function schedule() {
  if(index<0 || ctx.state!=='running') return;
  const song=tracks[index], step=30/song.bpm;
  if(next<ctx.currentTime-.15) next=ctx.currentTime+.02;
  while(next<ctx.currentTime+.15) {
    const root=song.roots[Math.floor(beat/16)%4];
    if(beat%16===0) song.voices.forEach(n=>note(root+n,next,step*14,.04));
    if(beat%4===0) note(root-12,next,step*3,.14);
    if(beat%2===0) note(root+12+song.voices[(beat/2)%4],next,step*2.4,.075,song.wave);
    if(beat%4===2) note(root+24+[7,2,0,4][Math.floor(beat/4)%4],next,step*2,.035);
    beat++;next+=step;
  }
}
function stop() {
  clearInterval(timer);
  if(bus) { const old=bus; old.gain.cancelScheduledValues(ctx.currentTime);old.gain.setTargetAtTime(0,ctx.currentTime,.12);setTimeout(()=>old.disconnect(),1500);bus=null; }
}
function start() {
  bus=ctx.createGain();bus.gain.setValueAtTime(0,ctx.currentTime);bus.gain.linearRampToValueAtTime(1,ctx.currentTime+.4);bus.connect(master);
  beat=0;next=ctx.currentTime+.03;schedule();timer=setInterval(schedule,40);
}
function tell(message) {notice.textContent=message;notice.classList.add('show');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>notice.classList.remove('show'),3500);}
button.addEventListener('click',async()=>{
  if(busy)return;busy=true;
  try {
    if(!ctx||ctx.state==='closed')setup();await ctx.resume();
    if(ctx.state!=='running')throw new Error('Audio suspended');
    stop();index=(index+2)%4-1;if(index>=0)start();
    const label=index<0?'Music off':tracks[index].name;
    button.dataset.track=label;button.classList.toggle('playing',index>=0);
    button.setAttribute('aria-label',`${label}. Click to ${index===2?'turn music off':'play '+tracks[index+1].name}`);
    button.title=button.getAttribute('aria-label');tell(index<0?label:`${index+1}/3 · ${label} · Click for ${index===2?'silence':'next track'}`);
  } catch {stop();index=-1;button.classList.remove('playing');tell('Audio could not start. Tap to retry.');}
  finally {busy=false;}
});
document.addEventListener('visibilitychange',async()=>{
  if(!ctx||ctx.state==='closed')return;
  try {if(document.hidden){clearInterval(timer);await ctx.suspend();}else if(index>=0){await ctx.resume();next=ctx.currentTime+.03;clearInterval(timer);timer=setInterval(schedule,40);}}catch{tell('Tap the music icon to resume.');}
});
addEventListener('pagehide',()=>{clearInterval(timer);clearInterval(meter);ctx?.close();});
