// ---------- Імпорт MusicXML (.musicxml, .xml, .mxl) ----------
// Перетворює партитуру на ту саму структуру, що й читач MIDI: {tracks:[{name, program, notes:[{n,s,e,v}]}], div, bpm, tsig, chords}
async function readScoreFile(file){
  const name = file.name.toLowerCase();
  if(/\.(mid|midi)$/.test(name)) return readMidiFile(await file.arrayBuffer());
  let xml;
  if(name.endsWith('.mxl')){
    if(!window.JSZip){ for(const src of (DESKTOP ? ['vendor/jszip.min.js'] : []).concat(['https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'])){ try{ await loadScript(src); if(window.JSZip) break; }catch(e){} } }
    if(!window.JSZip) throw new Error('не вдалося відкрити .mxl');
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    let path = null; const cont = zip.file('META-INF/container.xml');
    if(cont){ const m = /full-path="([^"]+)"/.exec(await cont.async('string')); if(m) path = m[1]; }
    if(!path) path = Object.keys(zip.files).find(f=>/\.(xml|musicxml)$/i.test(f) && !f.startsWith('META-INF'));
    xml = await zip.file(path).async('string');
  } else xml = await file.text();
  return parseMusicXML(xml);
}
const STEP_PC = {C:0,D:2,E:4,F:5,G:7,A:9,B:11};
const KIND = { major:'', minor:'m', dominant:'7', 'major-seventh':'maj7', 'minor-seventh':'m7', diminished:'dim', 'diminished-seventh':'dim7', 'half-diminished':'m7b5',
  augmented:'', 'suspended-fourth':'sus4', 'major-sixth':'6', 'minor-sixth':'m6', 'dominant-ninth':'7', 'major-ninth':'maj7', 'minor-ninth':'m7', 'suspended-second':'', power:'' };
function parseMusicXML(xml){
  const doc = new DOMParser().parseFromString(xml, 'application/xml'); if(doc.querySelector('parsererror')) throw new Error('файл MusicXML пошкоджений');
  const DIV = 480, txt = (el, sel) => { const x = el.querySelector(sel); return x ? x.textContent.trim() : null; };
  const names = {}; doc.querySelectorAll('part-list score-part').forEach(sp=>{ names[sp.getAttribute('id')] = txt(sp, 'part-name') || sp.getAttribute('id'); });
  let bpm = null, tsig = null, harmPart = null; const tracks = [], harmonies = [];
  doc.querySelectorAll('part').forEach((part, pi)=>{
    let div = 1, t = 0, transp = 0, lastStart = 0; const notes = [], open = {};
    part.querySelectorAll(':scope > measure').forEach(meas=>{
      for(const el of meas.children){
        const tag = el.tagName;
        if(tag === 'attributes'){ const d = txt(el, 'divisions'); if(d) div = +d; const bt = txt(el, 'time beats'); if(bt && !tsig) tsig = +bt;
          const ch = txt(el, 'transpose chromatic'), oc = txt(el, 'transpose octave-change'); if(ch != null) transp = +ch + 12*(+oc||0); }
        else if(tag === 'sound' || tag === 'direction'){ const s = tag === 'sound' ? el : el.querySelector('sound'); if(s && s.getAttribute('tempo') && !bpm) bpm = Math.round(+s.getAttribute('tempo')); }
        else if(tag === 'backup'){ t -= (+txt(el, 'duration')||0) * DIV / div; }
        else if(tag === 'forward'){ t += (+txt(el, 'duration')||0) * DIV / div; }
        else if(tag === 'harmony' && (harmPart === null || harmPart === pi)){ const st = txt(el, 'root root-step'); if(st){ harmPart = pi; const alt = +txt(el, 'root root-alter') || 0, kind = el.querySelector('kind');
            harmonies.push({t, name: NAMES_SHARP[((STEP_PC[st] + alt + transp) % 12 + 12) % 12] + (KIND[kind ? kind.textContent.trim() : 'major'] ?? '')}); } }
        else if(tag === 'note'){
          const dur = (+txt(el, 'duration')||0) * DIV / div, isChord = !!el.querySelector('chord'), rest = !!el.querySelector('rest'), grace = !!el.querySelector('grace');
          if(grace) continue;
          const start = isChord ? lastStart : t;
          if(!rest){ const st = txt(el, 'pitch step'), alt = +txt(el, 'pitch alter') || 0, oct = +txt(el, 'pitch octave');
            const n = (oct+1)*12 + STEP_PC[st] + alt + transp, tieStop = !!el.querySelector('tie[type="stop"]'), tieStart = !!el.querySelector('tie[type="start"]');
            if(tieStop && open[n]){ open[n].e = start + dur; if(!tieStart) delete open[n]; }
            else { const nt = {n, s:start, e:start + dur, v:0.8}; notes.push(nt); if(tieStart) open[n] = nt; } }
          if(!isChord){ lastStart = t; t += dur; }
        }
      }
    });
    if(notes.length) tracks.push({name: names[part.getAttribute('id')] || 'Партія '+(pi+1), program:null, notes: notes.sort((a,b)=>a.s-b.s || b.n-a.n)});
  });
  let chords = null;
  if(harmonies.length){ harmonies.sort((a,b)=>a.t-b.t); const end = Math.max(...tracks.map(tr=>Math.max(...tr.notes.map(x=>x.e)))), parts = [];
    if(harmonies[0].t > 0) parts.push('N:' + +(harmonies[0].t/DIV).toFixed(3));
    harmonies.forEach((h,i)=>{ const e = i+1 < harmonies.length ? harmonies[i+1].t : end; const d = (e - h.t)/DIV; if(d > 0.01) parts.push(h.name + ':' + +d.toFixed(3)); });
    chords = parts.join(' '); }
  return { tracks, div:DIV, bpm: bpm || 100, tsig: tsig || 4, chords };
}
