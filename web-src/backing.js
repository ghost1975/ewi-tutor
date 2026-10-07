// ---------- Фонограма: акорди, бас, ударні ----------
const QUAL = { '':[0,4,7], m:[0,3,7], '7':[0,4,7,10], m7:[0,3,7,10], maj7:[0,4,7,11], dim:[0,3,6], sus4:[0,5,7], m6:[0,3,7,9], '6':[0,4,7,9] };
const ROOT = {C:0,D:2,E:4,F:5,G:7,A:9,B:11};
// "G:4 D7:2 N:1" → [{name, root, tones, beats}]
function parseChords(str){
  return (str||'').trim().split(/\s+/).filter(Boolean).map(tok=>{
    const [nm, d] = tok.split(':'); const beats = parseDur(d||'4');
    if(nm==='N') return {name:'', root:null, tones:[], beats};
    const m = /^([A-G])([#b]?)(.*)$/.exec(nm); if(!m || !(m[3] in QUAL)) return {name:nm, root:null, tones:[], beats, bad:true};
    const root = (ROOT[m[1]] + (m[2]==='#'?1:m[2]==='b'?-1:0) + 12) % 12;
    return {name:nm.replace('#','♯').replace(/^([A-G])b/,'$1♭'), root, tones:QUAL[m[3]].map(x=>(root+x)%12), beats};
  });
}
function parseDur(s){ if(typeof s==='number') return s; if(String(s).includes('/')){ const [a,b] = String(s).split('/'); return (+a)/(+b); } return +s; }
const STYLES = { pop:'Поп', folk:'Фолк', ballad:'Балада', waltz:'Вальс', swing:'Свінг', funk:'Фанк', classical:'Класика (струнні)' };

let NOISE = null;
function noiseBuf(){ const a = ac(); if(NOISE && NOISE.sampleRate===a.sampleRate) return NOISE;
  NOISE = a.createBuffer(1, a.sampleRate, a.sampleRate); const d = NOISE.getChannelData(0); for(let i=0;i<d.length;i++) d[i] = Math.random()*2-1; return NOISE; }
function drum(kind, ct, vol, out){
  const a = ac(), g = a.createGain(), v = vol*(Settings.backVol??0.7); g.connect(out); const nodes = [];
  if(kind==='kick'){ const o = a.createOscillator(); o.frequency.setValueAtTime(140, ct); o.frequency.exponentialRampToValueAtTime(42, ct+0.12);
    g.gain.setValueAtTime(0.9*v, ct); g.gain.exponentialRampToValueAtTime(0.001, ct+0.3); o.connect(g); o.start(ct); o.stop(ct+0.32); nodes.push(o); }
  else { const s = a.createBufferSource(); s.buffer = noiseBuf(); const f = a.createBiquadFilter();
    const spec = { snare:['bandpass',1900,0.8,0.42,0.16], hat:['highpass',7500,0.7,0.16,0.045], ohat:['highpass',7000,0.7,0.14,0.22], ride:['bandpass',5200,2.5,0.13,0.35], rim:['bandpass',3200,4,0.22,0.04], brush:['bandpass',3500,0.6,0.10,0.18] }[kind];
    f.type = spec[0]; f.frequency.value = spec[1]; f.Q.value = spec[2];
    g.gain.setValueAtTime(spec[3]*v, ct); g.gain.exponentialRampToValueAtTime(0.001, ct+spec[4]);
    s.connect(f).connect(g); s.start(ct, Math.random()*0.5); s.stop(ct+spec[4]+0.02); nodes.push(s);
    if(kind==='snare'){ const o = a.createOscillator(), g2 = a.createGain(); o.type='triangle'; o.frequency.value = 185; g2.gain.setValueAtTime(0.25*v, ct); g2.gain.exponentialRampToValueAtTime(0.001, ct+0.09); o.connect(g2).connect(out); o.start(ct); o.stop(ct+0.1); nodes.push(o); } }
  return nodes;
}
// ноти в зручних діапазонах незалежно від транспозиції
const fold = (p, lo) => { let n = lo + ((p - lo) % 12 + 12) % 12; return n; };
function backingNodes(t0, spb, backing, beats, swing){
  const a = ac(), out = a.createGain(); out.gain.value = 1; out.connect(bus());
  const chords = parseChords(backing.chords), style = backing.style || (beats===3?'waltz':'pop'), nodes = [], vol = Settings.backVol??0.7;
  const tn = (n, t, d, v, o) => nodes.push(...tone(n, t, d, v*vol, {...o, inst: o && o.inst}));
  const off = pc(Settings.offset);
  const sp = p => swingPos(p, swing || style==='swing');
  let pos = 0;
  chords.forEach((c, ci)=>{
    const s = pos, e = pos + c.beats; pos = e; if(c.root==null) return;
    const root = (c.root + off) % 12, bass = fold(root, 36), tones = c.tones.map(x=>(x+off)%12);
    const pad = tones.map(x=>fold(x, 55)).sort((x,y)=>x-y);
    // акорди
    if(style==='waltz'){ for(let b=Math.ceil(s); b<e; b++){ if((b - pickupOf(backing.chords, beats)) % beats !== 0) pad.forEach(n=>tn(n, t0+b*spb, spb*0.55, 0.035, {bright:2, inst:'piano'})); } }
    else if(style==='funk'){ for(let b=s; b<e; b+=1){ [0.5, 0.75].forEach(f=>{ if(b+f<e) pad.forEach(n=>tn(n+12, t0+(b+f)*spb, spb*0.14, 0.03, {bright:3.5, stacc:true})); }); } }
    else if(style==='swing'){ for(let b=Math.ceil(s); b<e; b++){ if(b%2===1 || c.beats<2) pad.forEach(n=>tn(n, t0+sp(b-0.5)*spb, spb*0.5, 0.03, {bright:2})); } }
    else pad.forEach(n=>tn(n, t0+s*spb, c.beats*spb*0.97, style==='classical'?0.045:0.032, {bright: style==='classical'?1.4:1.8, inst: style==='classical'?'pad':'piano'}));
    // бас
    if(style==='swing'){ const next = chords.slice(ci+1).find(x=>x.root!=null); const nr = next ? (next.root+off)%12 : root;
      for(let b=Math.ceil(s); b<e; b++){ const k = b - Math.ceil(s), last = b===Math.ceil(e)-1;
        const p = last && k>0 ? fold(nr, 36) + (k%2? -1 : 1) : bass + [0, tones.length>1?(tones[1]-root+12)%12:4, 7, 9][k%4];
        tn(p, t0+b*spb, spb*0.9, 0.17, {bright:2.5, inst:'bass'}); } }
    else if(style==='waltz'){ for(let b=Math.ceil(s); b<e; b++) if((b - pickupOf(backing.chords, beats)) % beats === 0) tn(bass, t0+b*spb, spb*0.9, 0.18, {bright:2.5, inst:'bass'}); }
    else if(style==='funk'){ for(let b=s; b<e; b+=1){ tn(bass, t0+b*spb, spb*0.3, 0.2, {bright:3, stacc:true}); if(b+0.75<e) tn(bass+12, t0+(b+0.75)*spb, spb*0.18, 0.15, {bright:3, stacc:true}); } }
    else if(style==='classical' || style==='ballad'){ tn(bass, t0+s*spb, c.beats*spb*0.97, 0.15, {bright:1.8, inst:'bass'}); }
    else { for(let b=s; b<e; b+=2){ tn((b-s)%4===2 ? bass+7 : bass, t0+b*spb, Math.min(2, e-b)*spb*0.85, 0.17, {bright:2.4, inst:'bass'}); } }
  });
  // ударні
  const total = pos, D = (k,b,v)=>{ if(b < total) nodes.push(...drum(k, t0+sp(b)*spb, v, out)); };
  const pk = pickupOf(backing.chords, beats);
  for(let bar=0; pk + bar*beats < total; bar++){ const b0 = pk + bar*beats;
    if(chords.length && pos>0){ let p=0, empty=true; for(const c of chords){ if(b0 < p+c.beats && b0+beats > p && c.root!=null) empty=false; p+=c.beats; } if(empty) continue; }
    if(style==='pop' || style==='folk'){ for(let k=0;k<beats;k++){ if(k%2===0) D('kick', b0+k, style==='folk'?0.7:1); else D('snare', b0+k, style==='folk'?0.6:1);
        D('hat', b0+k, 0.8); if(style==='pop') D('hat', b0+k+0.5, 0.5); } }
    else if(style==='ballad'){ D('kick', b0, 0.7); for(let k=0;k<beats;k++) D('brush', b0+k, 0.8); if(beats===4) D('rim', b0+2, 0.7); }
    else if(style==='waltz'){ D('kick', b0, 0.8); D('hat', b0+1, 0.6); D('hat', b0+2, 0.6); }
    else if(style==='swing'){ D('kick', b0, 0.45); for(let k=0;k<beats;k++){ D('ride', b0+k, k%2?1:0.8); if(k%2===1) { D('hat', b0+k, 0.7); D('ride', b0+k+0.5, 0.6); } } }
    else if(style==='funk'){ D('kick', b0, 1); D('kick', b0+1.75, 0.8); D('kick', b0+2.5, 0.9); D('snare', b0+1, 1); D('snare', b0+3, 1);
      for(let x=0; x<beats; x+=0.25) D('hat', b0+x, x%0.5? 0.35 : 0.7); }
  }
  return [...nodes, {stop(){ try{ out.disconnect(); }catch(e){} }}];
}

function pickupOf(chords, beats){ if(!chords || typeof chords!=='string') return 0; const f = parseChords(chords)[0]; return f && f.root==null && f.beats < beats ? f.beats : 0; }
