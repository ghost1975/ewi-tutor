// ---------- Акорди з MIDI-доріжок ----------
QUAL.m7b5 = [0,3,6,10]; QUAL.dim7 = [0,3,6,9]; QUAL['7sus4'] = [0,5,7,10];
const DETECT_Q = [['maj7',[0,4,7,11]],['7',[0,4,7,10]],['m7',[0,3,7,10]],['m7b5',[0,3,6,10]],['dim7',[0,3,6,9]],['',[0,4,7]],['m',[0,3,7]],['dim',[0,3,6]],['sus4',[0,5,7]],['6',[0,4,7,9]],['m6',[0,3,7,9]]];
const NAMES_SHARP = ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
// Визначає акорд у кожному вікні (півтакту в 4/4, такт у 3/4) за доріжками супроводу
function detectChords(tracks, total, beats){
  const harm = (tracks||[]).filter(t=>t.kind !== 'drums' && t.kind !== 'lead');
  if(!harm.length || !total) return null;
  const win = beats === 4 ? 2 : beats, out = [];
  for(let w = 0; w < total - 1e-6; w += win){
    const we = Math.min(total, w + win), wt = new Array(12).fill(0); let low = null, lowN = 999;
    harm.forEach(t=>t.notes.forEach(([n, s, d])=>{ const ov = Math.min(s+d, we) - Math.max(s, w); if(ov <= 0) return;
      const k = t.kind === 'bass' ? 1.6 : 1; wt[pc(n)] += ov * k; if(n < lowN){ lowN = n; low = pc(n); } }));
    const sum = wt.reduce((a,b)=>a+b, 0);
    if(sum < 0.2){ out.push(['N', we - w]); continue; }
    let best = null, bs = -1e9;
    for(let r = 0; r < 12; r++) for(const [q, iv] of DETECT_Q){
      const tones = iv.map(x=>(r+x)%12); let s = 0;
      for(let p = 0; p < 12; p++) s += tones.includes(p) ? wt[p] : -0.6*wt[p];
      s -= iv.length > 3 ? 0.08*sum : 0;            // простіші акорди мають перевагу при рівності
      if(low === r) s += 0.25*sum;                   // бас на тоніці
      if(tones.length > 3 && wt[(r+iv[3])%12] < 0.05*sum) s -= 0.2*sum; // септима мусить реально звучати
      if(s > bs){ bs = s; best = NAMES_SHARP[r] + q; } }
    out.push([best, we - w]);
  }
  // злити однакові сусідні
  const merged = []; out.forEach(([nm, d])=>{ const l = merged[merged.length-1]; if(l && l[0] === nm) l[1] += d; else merged.push([nm, d]); });
  return merged.map(([nm, d])=>nm + ':' + +d.toFixed(3)).join(' ');
}
// акорди пісні → формат вправи імпровізації
const IMPROV_TYPE = { '':'maj', m:'min', '7':'dom7', maj7:'maj7', m7:'m7', m7b5:'m7', dim:'min', dim7:'min', sus4:'maj', '6':'maj', m6:'min', '7sus4':'dom7' };
function chordsForImprov(str){
  return parseChords(str).filter(c=>c.root != null).map(c=>{ const m = /^([A-G][#b♯♭]?)(.*)$/.exec(c.name.replace('♯','#').replace('♭','b'));
    return {name:c.name, root:m[1].replace('♯','#').replace('♭','b') + '3', type: IMPROV_TYPE[m[2]] || 'maj', beats:c.beats}; });
}
function scaleFromChords(str){ const w = new Array(12).fill(0);
  parseChords(str).forEach(c=>c.tones.forEach(t=>w[t] += c.beats));
  const pcs = w.map((v,i)=>[i,v]).sort((a,b)=>b[1]-a[1]).slice(0,7).map(x=>x[0]).sort((a,b)=>a-b);
  return pcs.map(p=>NAMES_SHARP[p] + (p < 2 ? '5' : '4')).sort((a,b)=>parseNote(a).midi - parseNote(b).midi).join(' '); }
