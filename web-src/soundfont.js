// ---------- Реалістичні інструменти: семпли Fluid R3 GM (CC BY 3.0) через midi-js-soundfonts ----------
// Настільна версія бере файли з папки soundfonts поруч зі сторінкою, браузерна — з CDN.
const SF_FILES = { piano:'acoustic_grand_piano', bass:'acoustic_bass', pad:'string_ensemble_1', lead:'alto_sax' };
const SF_CDN = 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/';
const SF = { raw:{}, buf:{}, loading:{}, ready:{} };
const SF_NAMES = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
const sfName = m => SF_NAMES[((m%12)+12)%12] + (Math.floor(m/12)-1);
async function sfLoad(inst){
  if(SF.ready[inst] || SF.loading[inst]) return SF.loading[inst];
  const file = SF_FILES[inst]; if(!file) return;
  SF.loading[inst] = (async()=>{
    let txt = null;
    for(const base of (DESKTOP ? ['soundfonts/', SF_CDN] : [SF_CDN])){
      try{ const r = await fetch(base + file + '-mp3.js'); if(r.ok){ txt = await r.text(); break; } }catch(e){}
    }
    if(!txt) throw new Error('не вдалося завантажити '+file);
    const raw = {}; txt.replace(/"([A-G]b?\d)":\s*"data:audio\/mp3;base64,([^"]+)"/g, (_, k, b64)=>{ raw[k] = b64; return ''; });
    SF.raw[inst] = raw; SF.buf[inst] = {}; SF.ready[inst] = true;
  })();
  return SF.loading[inst].catch(e=>{ SF.loading[inst] = null; console.warn(e); });
}
// розшифрувати семпли потрібних нот заздалегідь, щоб під час гри не було затримок
async function sfPrepare(inst, notes){
  await sfLoad(inst); if(!SF.ready[inst]) return;
  const a = ac(), raw = SF.raw[inst], buf = SF.buf[inst];
  await Promise.all([...new Set(notes)].map(async m=>{ const k = sfName(m); if(buf[k] || !raw[k]) return;
    try{ const bin = Uint8Array.from(atob(raw[k]), ch=>ch.charCodeAt(0)); buf[k] = await a.decodeAudioData(bin.buffer); }catch(e){} }));
}
function sampleNote(inst, midi, ct, dur, vol, opts){
  const b = SF.buf[inst] && SF.buf[inst][sfName(midi)]; if(!b) return null;
  const a = ac(), s = a.createBufferSource(), g = a.createGain(); s.buffer = b;
  const att = inst==='pad' ? 0.12 : 0.004, rel = inst==='piano' ? 0.25 : 0.12, peak = vol * ({piano:3.2, bass:1.5, pad:4, lead:2.2}[inst]||2);
  g.gain.setValueAtTime(0, ct); g.gain.linearRampToValueAtTime(peak, ct+att);
  g.gain.setValueAtTime(peak, ct+Math.max(att, dur)); g.gain.linearRampToValueAtTime(0, ct+dur+rel);
  s.connect(g).connect(opts.out || bus()); s.start(ct); s.stop(ct+dur+rel+0.05); return [s];
}
// підготувати всі інструменти для відтворення: мелодія, акорди фонограми, доріжки
async function prepareSound({seq, chords, tracks}){
  if(!Settings.realistic) return;
  const k = typeof trackShift==='function' ? trackShift() : 0, jobs = [];
  if(seq) jobs.push(sfPrepare('lead', seq.filter(i=>i.n!=null).map(i=>i.n+Settings.offset)));
  if(chords){ const cs = parseChords(chords).filter(c=>c.root!=null), off = pc(Settings.offset);
    const bassN = [], padN = []; cs.forEach(c=>{ const r = (c.root+off)%12; for(let d=-1; d<=12; d++) bassN.push(fold(r,36)+d); c.tones.forEach(t=>{ const p = fold((t+off)%12,55); padN.push(p, p+12); }); });
    jobs.push(sfPrepare('bass', bassN), sfPrepare('piano', padN), sfPrepare('pad', padN)); }
  (tracks||[]).forEach(t=>{ if(t.kind==='drums') return; const inst = t.kind==='other' ? 'piano' : t.kind; jobs.push(sfPrepare(inst, t.notes.map(x=>x[0]+k))); });
  await Promise.all(jobs);
}
let GUIDE = null;
function GuideBus(){ const a = ac(); if(!GUIDE){ GUIDE = a.createGain(); GUIDE.connect(bus()); } return GUIDE; }
function setGuide(on){ const g = GuideBus(); g.gain.setTargetAtTime(on ? 1 : 0, ac().currentTime, 0.02); }
