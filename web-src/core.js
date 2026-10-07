'use strict';
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const mean = a => a.length ? a.reduce((x,y)=>x+y,0)/a.length : 0;
const sd = a => { const m = mean(a); return a.length ? Math.sqrt(mean(a.map(x=>(x-m)**2))) : 0; };
const now = () => performance.now();

// ---------- Збереження ----------
const DESKTOP = typeof window !== 'undefined' && !!window.ewiStore;
const LS = DESKTOP ? {
  // настільна версія: файли в папці даних на диску
  get(k, d){ try{ const v = window.ewiStore.get(k); return v==null ? d : v; }catch(e){ return d; } },
  set(k, v){ try{ window.ewiStore.set(k, v); }catch(e){} }
} : {
  get(k, d){ try{ const v = localStorage.getItem('ewi2.'+k); return v==null ? d : JSON.parse(v); }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem('ewi2.'+k, JSON.stringify(v)); }catch(e){} }
};
const DEFAULT_SETTINGS = {
  offset:0, anyOct:false, noteSource:'auto', latMidi:0, latAudio:70, a4:440, bendRange:2,
  gate:-52, unlockAll:false, backVol:0.7, realistic:true, remindAt:'19:00', remind:false, labels:{L1:'Л1',L2:'Л2',L3:'Л3',R1:'П1',R2:'П2',R3:'П3',GS:'G♯',EB:'E♭',LC:'C'},
  guide:true, metroVol:0.6
};
const Settings = Object.assign({}, DEFAULT_SETTINGS, LS.get('settings', {}));
Settings.labels = Object.assign({}, DEFAULT_SETTINGS.labels, Settings.labels);
const saveSettings = () => LS.set('settings', Settings);

const Progress = Object.assign({lessons:{}, days:{}, wrong:{}, log:[]}, LS.get('progress', {}));
const saveProgress = () => { LS.set('progress', Progress); if(typeof checkBadges==='function') setTimeout(checkBadges, 0); };
const today = () => new Date().toISOString().slice(0,10);

// ---------- Ноти й аплікатура ----------
const NAMES = ['C','C♯','D','E♭','E','F','F♯','G','G♯','A','B♭','B'];
const FINGER = {
  0:['L2'], 1:[], 2:['L1','L2','L3','R1','R2','R3'], 3:['L1','L2','L3','R1','R2','R3','EB'],
  4:['L1','L2','L3','R1','R2'], 5:['L1','L2','L3','R1'], 6:['L1','L2','L3','R2'],
  7:['L1','L2','L3'], 8:['L1','L2','L3','GS'], 9:['L1','L2'], 10:['L1','R1'], 11:['L1']
};
const pc = n => ((n%12)+12)%12;
function parseNote(s){
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(s); if(!m) return null;
  const base = {C:0,D:2,E:4,F:5,G:7,A:9,B:11}[m[1]], acc = m[2]==='#'?1:m[2]==='b'?-1:0;
  return {midi:(+m[3]+1)*12+base+acc, letter:m[1], acc:m[2], oct:+m[3]};
}
const nameOf = n => NAMES[pc(n)] + (Math.floor(n/12)-1);
const pcName = n => NAMES[pc(n)];
function keysOf(n){ if(n===60) return ['L1','L2','L3','R1','R2','R3','LC']; return FINGER[pc(n)]; }
function rollerOf(n){ if(n===60) return 0; return Math.floor((n-62)/12); }
const rollerText = r => r===0 ? '' : (r>0?'ролик +'+r:'ролик −'+(-r));
function keysFull(n){ const k = keysOf(n).map(x=>Settings.labels[x]); const r = rollerText(rollerOf(n));
  return [k.length?k.join(' '):'усі відкриті', r].filter(Boolean).join(', '); }
const withKeys = n => `${pcName(n)} (${keysFull(n)})`;
function keysShort(n){
  const k = keysOf(n); if(!k.length) return ['відкр.'];
  const L = Settings.labels, l = k.filter(x=>/^L\d/.test(x)), r = k.filter(x=>/^R\d/.test(x));
  const a = [l.map(x=>L[x]).join(''), k.includes('GS')?L.GS:''].filter(Boolean).join(' ');
  const b = [r.map(x=>L[x]).join(''), k.includes('EB')?L.EB:'', k.includes('LC')?L.LC:''].filter(Boolean).join(' ');
  const out = [a,b].filter(Boolean); const rr = rollerOf(n); if(rr) out.push((rr>0?'+':'−')+Math.abs(rr)+' окт');
  return out;
}
// "G4:1 A4:0.5 r:1" -> [{n:67|null, d:1, s:'G4'}]
function parseSeq(str){
  return str.trim().split(/\s+/).filter(Boolean).map(tok=>{
    const [s,d] = tok.split(':'); const dur = d ? parseDur(d) : 1;
    if(s==='r') return {n:null, d:dur, s:'r'};
    const p = parseNote(s); return {n:p?p.midi:null, d:dur, s, p};
  });
}
// у тексті уроків {G4} → G (Л1 Л2 Л3)
function noteText(s){ return s.replace(/\{([A-G][#b]?-?\d)\}/g, (_,x)=>`<span class="note">${esc(withKeys(parseNote(x).midi))}</span>`)
  .replace(/\*\*(.+?)\*\*/g,'<b>$1</b>'); }
const hz2midi = hz => 69 + 12*Math.log2(hz/Settings.a4);
const midi2hz = m => Settings.a4 * Math.pow(2,(m-69)/12);

// ---------- Шина подій вводу ----------
const Hub = { subs:new Set(), on(f){ this.subs.add(f); return ()=>this.subs.delete(f); },
  emit(type, d){ this.subs.forEach(f=>{ try{ f(type,d); }catch(e){ console.error(e); } }); } };
const Live = { breath:0, breathSrc:'', note:null, cents:null, hz:0, db:-100, lastMidiNote:0, lastMidiBreath:0,
  midiNames:[], micOn:false, vib:null, centroid:0, activity:0 };

function useMidiNotes(){ if(Settings.noteSource==='midi') return true; if(Settings.noteSource==='audio') return false;
  return Live.midiNames.length>0 || now()-Live.lastMidiNote < 15000; }

function emitNoteOn(n, t, src){ Live.note = n; Live.activity = t; Hub.emit('on', {n, t, src}); }
function emitNoteOff(n, t, src){ if(Live.note===n) Live.note = null; Hub.emit('off', {n, t, src}); }
function emitBreath(v, t, src){
  if(src==='audio' && now()-Live.lastMidiBreath < 2000) return;
  if(src==='midi') Live.lastMidiBreath = t;
  Live.breath = v; Live.breathSrc = src; Hub.emit('breath', {v, t, src});
}

// ---------- MIDI ----------
let midiAccess = null; const midiSeen = {};
function onMidi(e){
  const [st,d1,d2] = e.data, type = st & 0xf0, t = now() - Settings.latMidi;
  if(type===0x90 && d2>0){ Live.lastMidiNote = t; if(useMidiNotes()) emitNoteOn(d1, t, 'midi'); }
  else if(type===0x80 || (type===0x90 && d2===0)){ if(useMidiNotes()) emitNoteOff(d1, t, 'midi'); }
  else if(type===0xB0 && (d1===2||d1===11||d1===7)){ midiSeen['cc'+d1]=1; if(d1===2 || (!midiSeen.cc2 && (d1===11 || !midiSeen.cc11))) emitBreath(d2, t, 'midi'); }
  else if(type===0xD0){ midiSeen.at=1; if(!midiSeen.cc2 && !midiSeen.cc11) emitBreath(d1, t, 'midi'); }
  else if(type===0xE0){ const v = (d2<<7)|d1; Hub.emit('bend', {cents:(v-8192)/8192*Settings.bendRange*100, t}); }
}
function bindMidi(){
  Live.midiNames = [];
  if(midiAccess) midiAccess.inputs.forEach(inp=>{ Live.midiNames.push(inp.name); inp.onmidimessage = onMidi; });
  Hub.emit('status');
}
function initMidi(){
  if(!navigator.requestMIDIAccess){ Live.midiErr = 'Браузер без Web MIDI'; Hub.emit('status'); return; }
  navigator.requestMIDIAccess().then(a=>{ midiAccess=a; a.onstatechange=bindMidi; bindMidi(); })
    .catch(()=>{ Live.midiErr = DESKTOP ? 'MIDI недоступне' : 'MIDI заблоковано в Chrome'; Hub.emit('status'); });
}

// ---------- Аудіо: контекст, синтезатор, метроном ----------
let AC = null;
function ac(){ if(!AC){ AC = new (window.AudioContext||window.webkitAudioContext)({latencyHint:'interactive'}); MASTER = AC.createGain(); MASTER.connect(AC.destination); } if(AC.state==='suspended') AC.resume(); return AC; }
// усе, що звучить із застосунку, йде через одну шину, щоб його можна було записати разом із грою
let MASTER = null; const bus = () => { ac(); return MASTER; };
// переведення часу аудіоконтексту в performance.now()
function ctxToPerf(ct){ const a = ac(); const lat = (a.outputLatency||a.baseLatency||0); return now() + (ct - a.currentTime + lat)*1000; }
function perfToCtx(pt){ const a = ac(); const lat = (a.outputLatency||a.baseLatency||0); return a.currentTime + (pt - now())/1000 - lat; }

function click(ct, accent){
  const a = ac(), o = a.createOscillator(), g = a.createGain();
  o.frequency.value = accent ? 1600 : 1050; o.type = 'square';
  g.gain.setValueAtTime(0, ct); g.gain.linearRampToValueAtTime(0.25*Settings.metroVol, ct+0.002); g.gain.exponentialRampToValueAtTime(0.0001, ct+0.05);
  o.connect(g).connect(bus()); o.start(ct); o.stop(ct+0.06);
}
// м'який «саксофонний» тон для прикладів і дрону
function tone(midi, ct, dur, vol=0.18, opts={}){
  if(opts.inst && Settings.realistic){ const r = sampleNote(opts.inst, midi, ct, dur, vol, opts); if(r) return r; }
  const a = ac(), f = midi2hz(midi);
  const o = a.createOscillator(), o2 = a.createOscillator(), filt = a.createBiquadFilter(), g = a.createGain();
  o.type = 'sawtooth'; o2.type = 'square'; o.frequency.value = f; o2.frequency.value = f; o2.detune.value = 4;
  const g2 = a.createGain(); g2.gain.value = 0.25;
  filt.type = 'lowpass'; filt.Q.value = 2;
  filt.frequency.setValueAtTime(f*1.5, ct); filt.frequency.linearRampToValueAtTime(f*(opts.bright||4), ct+0.08);
  if(opts.vibrato){ const l = a.createOscillator(), lg = a.createGain(); l.frequency.value = 5.5; lg.gain.value = f*0.012;
    l.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency); l.start(ct+0.25); l.stop(ct+dur+0.1); }
  const att = opts.att ?? (opts.stacc ? 0.01 : 0.04), rel = opts.stacc ? 0.03 : 0.08;
  g.gain.setValueAtTime(0, ct); g.gain.linearRampToValueAtTime(vol, ct+att);
  if(opts.decay){ g.gain.exponentialRampToValueAtTime(Math.max(0.0005, vol*0.12), Math.max(ct+att+0.01, ct+dur)); g.gain.linearRampToValueAtTime(0, ct+dur+0.04); }
  else { g.gain.setValueAtTime(vol, Math.max(ct+att, ct+dur-rel)); g.gain.linearRampToValueAtTime(0, ct+dur); }
  o.connect(filt); o2.connect(g2).connect(filt); filt.connect(g).connect(opts.out || bus());
  o.start(ct); o2.start(ct); o.stop(ct+dur+0.05); o2.stop(ct+dur+0.05);
  return [o,o2];
}
// планувальник: метроном + (необов'язково) ноти-приклад
function schedule({bpm, beats=4, countIn=1, totalBeats, seq=null, guide=false, swing=false, drone=null, chords=null, clickOn=true, backing=null, pickup=0, tracks=null, guideOn, startBeat=0, audio=null}){
  const a = ac(), spb = 60/bpm, start = a.currentTime + 0.25, nodes = [];
  const allBeats = countIn*beats + totalBeats;
  for(let b=0; b<allBeats; b++) if(clickOn || b<countIn*beats) click(start + b*spb, b<countIn*beats ? b%beats===0 : ((b-countIn*beats-pickup)%beats+beats)%beats===0);
  const t0 = start + countIn*beats*spb;
  if(seq && guide){ setGuide(guideOn ?? true); let pos = 0; seq.forEach(it=>{ if(it.n!=null){ const on = swingPos(pos, swing); nodes.push(...tone(it.n+Settings.offset, t0+on*spb, Math.max(0.08, it.d*spb*0.92), 0.12, {inst:'lead', out:GuideBus()})); } pos += it.d; }); }
  if(drone!=null) nodes.push(...tone(drone, t0, totalBeats*spb, 0.07, {bright:2}));
  if(backing && backing.chords) nodes.push(...backingNodes(t0, spb, backing, beats, swing));
  const mix = tracks && tracks.list && tracks.list.length ? scheduleTracks(t0, spb, tracks.list, tracks.muted||[]) : null; if(mix) nodes.push(mix);
  if(chords){ let pos=0; chords.forEach(c=>{ c.notes.forEach(n=>nodes.push(...tone(n, t0+pos*spb, c.beats*spb*0.98, 0.045, {bright:2}))); pos+=c.beats; }); }
  return { mix, t0Perf: ctxToPerf(t0), spbMs: spb*1000, endPerf: ctxToPerf(t0 + totalBeats*spb), stop(){ nodes.forEach(n=>{ try{ n.stop(); }catch(e){} }); } };
}
function swingPos(pos, swing){ if(!swing) return pos; const f = pos - Math.floor(pos); return Math.abs(f-0.5)<1e-6 ? Math.floor(pos)+2/3 : pos; }
function playSeq(seq, bpm, opts={}){
  const a = ac(), spb = 60/bpm, t0 = a.currentTime + 0.1; let pos = 0, nodes = [];
  seq.forEach(it=>{ if(it.n!=null){ const on = swingPos(pos, opts.swing); nodes.push(...tone(it.n+Settings.offset, t0+on*spb, Math.max(0.08, it.d*spb*(opts.stacc?0.45:0.94)), 0.16, opts)); } pos += it.d; });
  return { endPerf: ctxToPerf(t0 + pos*spb), stop(){ nodes.forEach(n=>{ try{ n.stop(); }catch(e){} }); } };
}

// ---------- Аналіз звуку в реальному часі ----------
const Audio = { stream:null, an:null, buf:null, fbuf:null, raf:0, run:[], cur:null, peak:-100, dip:false, frames:null, devices:[] };
function yin(buf, sr){
  const W = 1024, tMin = Math.floor(sr/1800), tMax = Math.min(Math.floor(sr/55), buf.length-W-1);
  const d = new Float32Array(tMax+2); let run = 0; d[0] = 1;
  for(let tau=1; tau<=tMax+1; tau++){
    let s = 0; for(let i=0;i<W;i++){ const x = buf[i]-buf[i+tau]; s += x*x; }
    run += s; d[tau] = run ? s*tau/run : 1;
  }
  let best = -1;
  for(let tau=tMin; tau<=tMax; tau++){ if(d[tau] < 0.15){ while(tau<tMax && d[tau+1] < d[tau]) tau++; best = tau; break; } }
  if(best<0) return null;
  const a = d[best-1], b = d[best], c = d[best+1];
  const den = a+c-2*b, shift = den ? (a-c)/(2*den) : 0;
  return { hz: sr/(best+shift), clarity: 1-b };
}
async function micStart(deviceId){
  const a = ac();
  const stream = await navigator.mediaDevices.getUserMedia({audio:{deviceId:deviceId?{exact:deviceId}:undefined, echoCancellation:false, noiseSuppression:false, autoGainControl:false}});
  micStop(true);
  Audio.stream = stream; const src = a.createMediaStreamSource(stream);
  Audio.an = a.createAnalyser(); Audio.an.fftSize = 4096; Audio.an.smoothingTimeConstant = 0;
  src.connect(Audio.an);
  Audio.buf = new Float32Array(Audio.an.fftSize); Audio.fbuf = new Float32Array(Audio.an.frequencyBinCount);
  Live.micOn = true; Hub.emit('status');
  try{ Audio.devices = (await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='audioinput'); }catch(e){}
  const tick = () => { analyse(); Audio.raf = requestAnimationFrame(tick); }; tick();
}
function micStop(silent){ cancelAnimationFrame(Audio.raf); if(Audio.stream) Audio.stream.getTracks().forEach(t=>t.stop()); Audio.stream=null; Audio.an=null; Live.micOn=false; if(!silent) Hub.emit('status'); }

const pitchHist = []; // для вібрато: {t,c}
function analyse(){
  const an = Audio.an; if(!an) return;
  an.getFloatTimeDomainData(Audio.buf);
  let rms = 0; for(let i=0;i<Audio.buf.length;i++) rms += Audio.buf[i]*Audio.buf[i];
  const db = 10*Math.log10(rms/Audio.buf.length + 1e-12);
  const t = now() - Settings.latAudio;
  let hz = 0, midiF = null, clarity = 0;
  if(db > Settings.gate){ const r = yin(Audio.buf, AC.sampleRate); if(r && r.clarity > 0.8){ hz = r.hz; clarity = r.clarity; midiF = hz2midi(hz); } }
  // яскравість (спектральний центроїд)
  an.getFloatFrequencyData(Audio.fbuf); let num=0, den=0; const binHz = AC.sampleRate/an.fftSize;
  for(let i=2;i<Audio.fbuf.length;i++){ const m = Math.pow(10, Audio.fbuf[i]/20); num += m*i*binHz; den += m; }
  const centroid = den ? num/den : 0;
  const nearest = midiF!=null ? Math.round(midiF) : null, cents = midiF!=null ? (midiF-nearest)*100 : null;
  Live.hz = hz; Live.db = db; Live.cents = cents; Live.centroid = centroid;
  if(nearest!=null){ pitchHist.push({t, c:midiF*100}); }
  while(pitchHist.length && pitchHist[0].t < t-2000) pitchHist.shift();
  Live.vib = vibratoOf(pitchHist);
  const frame = {t, hz, midi:nearest, midiF, cents, db, centroid, clarity};
  if(Audio.frames) Audio.frames.push(frame);
  Hub.emit('frame', frame);
  emitBreath(Math.round(clamp((db+60)/50, 0, 1)*127), t, 'audio');
  audioNotes(frame);
}
// ноти з аудіо: стабільна висота ≥3 кадри, повторна атака по провалу гучності
function audioNotes(f){
  if(useMidiNotes()){ Audio.cur=null; Audio.run=[]; return; }
  if(f.midi==null){ Audio.run=[]; if(Audio.cur!=null){ emitNoteOff(Audio.cur, f.t, 'audio'); Audio.cur=null; } Audio.peak=-100; return; }
  if(Audio.cur!=null && f.midi===Audio.cur){
    Audio.peak = Math.max(Audio.peak, f.db);
    if(f.db < Audio.peak-12) Audio.dip = true;
    else if(Audio.dip && f.db > Audio.peak-5){ Audio.dip=false; emitNoteOff(Audio.cur, f.t, 'audio'); emitNoteOn(Audio.cur, f.t, 'audio'); Audio.peak=f.db; }
    return;
  }
  Audio.run.push(f); Audio.run = Audio.run.filter(x=>x.midi===f.midi);
  if(Audio.run.length>=3){ if(Audio.cur!=null) emitNoteOff(Audio.cur, Audio.run[0].t, 'audio');
    Audio.cur = f.midi; Audio.peak = f.db; Audio.dip=false; emitNoteOn(f.midi, Audio.run[0].t, 'audio'); Audio.run=[]; }
}
// вібрато з ряду висот (центи): частота за перетинами нуля, глибина за розмахом
function vibratoOf(h){
  if(h.length < 30) return null; const span = h[h.length-1].t - h[0].t; if(span < 700) return null;
  const base = Math.round(mean(h.map(x=>x.c))/100)*100; if(h.some(x=>Math.abs(x.c-base)>120)) return null;
  // прибрати тренд ковзним середнім
  const k = 9, dev = h.map((x,i)=>{ const w = h.slice(Math.max(0,i-k), i+k+1); return x.c - mean(w.map(y=>y.c)); }).slice(k, -k);
  if(dev.length<10) return null;
  let zc = 0; for(let i=1;i<dev.length;i++) if((dev[i-1]<0)!==(dev[i]<0)) zc++;
  const dur = (h[h.length-1-k].t - h[k].t)/1000; const rate = zc/2/dur;
  const sorted = dev.map(Math.abs).sort((a,b)=>a-b); const depth = sorted[Math.floor(sorted.length*0.9)];
  if(depth < 4) return null;
  return { rate, depth };
}
// вібрато з pitch bend (MIDI)
const bendHist = [];
Hub.on((type,d)=>{ if(type==='bend'){ bendHist.push({t:d.t, c:6000+d.cents}); while(bendHist.length && bendHist[0].t < d.t-2000) bendHist.shift();
  if(!Live.micOn) Live.vib = vibratoOf(bendHist); } });

// ---------- Запис дублів ----------
const Takes = [];
const Rec = { mr:null, chunks:[], start:0, label:'' };
function recStart(label){
  if(!Audio.stream){ return false; }
  Rec.chunks = []; Rec.label = label || 'Вільна гра'; Rec.start = now(); Audio.frames = []; Rec.notes = [];
  // запис разом із супроводом: мікрофон + усе, що грає застосунок (фонограма, доріжки, мінусовка)
  let stream = Audio.stream; Rec.cleanup = null;
  if(Settings.recMix !== false){ try{ const a = ac(), dest = a.createMediaStreamDestination(), mic = a.createMediaStreamSource(Audio.stream), dl = a.createDelay(1);
    dl.delayTime.value = Math.min(0.9, Math.max(0, (Settings.latAudio||0)/1000)); mic.connect(dest); bus().connect(dl); dl.connect(dest); stream = dest.stream;
    Rec.cleanup = () => { try{ mic.disconnect(); bus().disconnect(dl); dl.disconnect(); }catch(e){} }; }catch(e){ stream = Audio.stream; } }
  Rec.mr = new MediaRecorder(stream); Rec.mr.ondataavailable = e => Rec.chunks.push(e.data);
  Rec.mr.onstop = () => {
    const blob = new Blob(Rec.chunks, {type: Rec.mr.mimeType || 'audio/webm'});
    Takes.unshift({ url: URL.createObjectURL(blob), at: new Date(), label: Rec.label, dur: (now()-Rec.start)/1000, stats: takeStats(Audio.frames||[], Rec.notes) });
    Audio.frames = null; Rec.mr = null; if(Rec.cleanup) Rec.cleanup(); Hub.emit('takes'); Hub.emit('status');
  };
  Rec.mr.start(); Hub.emit('status'); return true;
}
function recStop(){ if(Rec.mr) Rec.mr.stop(); }
Hub.on((type,d)=>{ if(type==='on' && Rec.mr) Rec.notes.push(d.n); });
function takeStats(fr, notes){
  const voiced = fr.filter(f=>f.midi!=null);
  if(!voiced.length) return null;
  const dbs = voiced.map(f=>f.db).sort((a,b)=>a-b);
  const cents = voiced.map(f=>Math.abs(f.cents));
  const ms = voiced.map(f=>f.midi); let runs = 0; ms.forEach((m,i)=>{ if(i===0 || m!==ms[i-1]) runs++; });
  if(!notes.length) notes = [Math.min(...ms), Math.max(...ms)];
  return { notes: Math.max(notes.length, runs), voicedSec: voiced.length/60, dynRange: dbs[Math.floor(dbs.length*.95)]-dbs[Math.floor(dbs.length*.05)],
    intonation: mean(cents), bright: mean(voiced.map(f=>f.centroid)), range: notes.length ? nameOf(Math.min(...notes)-Settings.offset)+'–'+nameOf(Math.max(...notes)-Settings.offset) : '' };
}

// ---------- Симуляція з клавіатури ----------
const SIMKEYS = {a:'D4',s:'E4',d:'F4',f:'F#4','1':'G4','2':'A4','3':'B4','4':'C5','5':'D5','6':'E5','7':'F#5','8':'G5','9':'A5',q:'G#4',w:'Bb4',e:'C#5',r:'Eb5'};
const Sim = { n:null, level:80 };
addEventListener('keydown', e=>{
  if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if(e.key==='[' || e.key===']'){ Sim.level = clamp(Sim.level + (e.key===']'?10:-10), 10, 127); return; }
  const s = SIMKEYS[e.key.toLowerCase()]; if(!s || e.repeat) return;
  const t = now(), n = parseNote(s).midi + Settings.offset;
  if(Sim.n!=null) emitNoteOff(Sim.n, t, 'sim'); Sim.n = n; Live.lastMidiNote = t; emitNoteOn(n, t, 'sim');
});
addEventListener('keyup', e=>{ const s = SIMKEYS[e.key.toLowerCase()]; if(!s || Sim.n==null) return;
  if(parseNote(s).midi + Settings.offset !== Sim.n) return; const t = now(); emitNoteOff(Sim.n, t, 'sim'); Sim.n = null; emitBreath(0, t, 'midi'); });
let simLast = 0;
function simTick(t){ if(Sim.n==null || t-simLast<30) return; simLast=t; emitBreath(Math.round(clamp(Sim.level + Math.sin(t/180)*3 + Math.random()*2, 0, 127)), t, 'midi');
  Hub.emit('bend', {cents: Math.sin(t/1000*2*Math.PI*5.5)*(Sim.level>110?30:0), t}); }

// ---------- Час практики ----------
let lastTick = now();
setInterval(()=>{ const t = now(); if(t - Live.activity < 20000){ const d = today(); Progress.days[d] = (Progress.days[d]||0) + (t-lastTick)/60000; saveProgress(); } lastTick = t; }, 5000);
function streak(){ let s=0; const d=new Date(); for(;;){ const k=d.toISOString().slice(0,10); if((Progress.days[k]||0) >= 5){ s++; d.setDate(d.getDate()-1); } else { if(s===0 && k===today()){ d.setDate(d.getDate()-1); const k2=d.toISOString().slice(0,10); if((Progress.days[k2]||0)>=5) continue; } break; } } return s; }

// ---------- Експорт у MP3 ----------
function loadScript(src){ return new Promise((res, rej)=>{ const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
async function toMp3(url, kbps=192){
  if(!window.lamejs){ for(const src of (DESKTOP ? ['vendor/lame.min.js'] : []).concat(['https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js'])){ try{ await loadScript(src); if(window.lamejs) break; }catch(e){} } }
  if(!window.lamejs) throw new Error('кодер MP3 недоступний');
  const buf = await (await fetch(url)).arrayBuffer(), audio = await ac().decodeAudioData(buf);
  const sr = audio.sampleRate, ch = Math.min(2, audio.numberOfChannels), enc = new lamejs.Mp3Encoder(ch, sr, kbps), out = [];
  const conv = f => { const r = new Int16Array(f.length); for(let i=0;i<f.length;i++){ const s = Math.max(-1, Math.min(1, f[i])); r[i] = s < 0 ? s*0x8000 : s*0x7fff; } return r; };
  const L = conv(audio.getChannelData(0)), R = ch > 1 ? conv(audio.getChannelData(1)) : null;
  for(let i=0;i<L.length;i+=1152){ const d = R ? enc.encodeBuffer(L.subarray(i,i+1152), R.subarray(i,i+1152)) : enc.encodeBuffer(L.subarray(i,i+1152)); if(d.length) out.push(new Uint8Array(d)); }
  const end = enc.flush(); if(end.length) out.push(new Uint8Array(end));
  return new Blob(out, {type:'audio/mpeg'});
}
