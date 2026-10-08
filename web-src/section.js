// ---------- Фрагмент A–B, петля, карта тактів ----------
function barStartsOf(total, beats, pickup){ const s = [0]; let b = pickup > 0 ? pickup : beats; while(b < total - 1e-6){ s.push(b); b += beats; } return s; }
function sliceSection(FULL, ex, sB, eB){
  const items = []; let cum = 0;
  for(const it of FULL){ const st = cum, en = cum + it.d; cum = en;
    if(en <= sB + 1e-6 || st >= eB - 1e-6) continue;
    if(st < sB - 1e-6) items.push({s:'r', n:null, d:+(Math.min(en,eB)-sB).toFixed(4)});
    else items.push({...it, d:+(Math.min(en,eB)-st).toFixed(4)}); }
  let chords = null;
  if(ex.chords){ const out = []; let p = 0;
    for(const tok of ex.chords.trim().split(/\s+/)){ const [nm, d] = tok.split(':'), dur = parseDur(d||'4'), st = p, en = p + dur; p = en;
      if(en <= sB + 1e-6 || st >= eB - 1e-6) continue;
      out.push(nm + ':' + +(Math.min(en,eB) - Math.max(st,sB)).toFixed(4)); }
    chords = out.join(' '); }
  const tracks = ex.tracks ? ex.tracks.map(t=>({...t, notes:t.notes.filter(x=>x[1] >= sB - 1e-6 && x[1] < eB - 1e-6).map(x=>[x[0], +(x[1]-sB).toFixed(4), Math.min(x[2], eB-x[1]), x[3]])})) : null;
  return { items, total: eB - sB, chords, tracks };
}
function heatOf(key){ Progress.heat = Progress.heat || {}; return Progress.heat[key] = Progress.heat[key] || {}; }
function heatColor(v){ return v==null ? 'var(--line)' : v >= 0.85 ? 'var(--ok)' : v >= 0.6 ? 'var(--brass)' : 'var(--bad)'; }
// Панель фрагмента для довгих мелодій: такти з–по, петля, крок темпу, карта тактів
function sectionUI(box, ex, FULL, beats){
  if(!ex.allowLoop || !ex.key) return null;
  const total = FULL.reduce((a,b)=>a+b.d,0), pickup = ex.pickup ?? pickupOf(ex.chords, beats), starts = barStartsOf(total, beats, pickup), N = starts.length;
  if(N < 3) return null;
  const st = Object.assign({a:1, b:N, loop:false, step:4}, LS.get('sec.'+ex.key, {})); st.a = clamp(st.a,1,N); st.b = clamp(st.b,st.a,N);
  const el = document.createElement('div'); el.className = 'section-ui';
  el.innerHTML = `<div class="row"><span class="muted">Фрагмент: такти</span><input type="number" data-s="a" min="1" max="${N}" value="${st.a}" style="width:60px"><span class="muted">–</span><input type="number" data-s="b" min="1" max="${N}" value="${st.b}" style="width:60px"><span class="muted">з ${N}</span>
    <label class="muted"><input type="checkbox" data-s="loop" ${st.loop?'checked':''}> петля</label>
    <label class="muted">крок темпу +<input type="number" data-s="step" min="1" max="20" value="${st.step}" style="width:52px"> bpm</label>
    <button class="small" data-s="weak">Найслабші такти</button><button class="small" data-s="all">Уся мелодія</button></div>
    <div class="heat" data-s="heat" title="Карта точності по тактах. Натисни такт, щоб вибрати його; із Shift — розширити фрагмент."></div>`;
  box.querySelector('.ex-head').after(el);
  const S = {}; el.querySelectorAll('[data-s]').forEach(x=>S[x.dataset.s]=x);
  const api = { onChange:null };
  const save = () => { st.a = clamp(+S.a.value||1,1,N); st.b = clamp(+S.b.value||N, st.a, N); st.loop = S.loop.checked; st.step = clamp(+S.step.value||4,1,20); S.a.value = st.a; S.b.value = st.b; LS.set('sec.'+ex.key, st); drawHeat(); if(api.onChange) api.onChange(); };
  function drawHeat(){ const h = heatOf(ex.key);
    S.heat.innerHTML = starts.map((s,i)=>{ const v = h[i] ? h[i][0] : null, sel = i+1>=st.a && i+1<=st.b;
      return `<button class="cell${sel?' sel':''}" data-bar="${i+1}" style="background:${heatColor(v)}" title="Такт ${i+1}${v!=null?`: ${Math.round(v*100)}%`:''}">${(i+1)%4===1?i+1:''}</button>`; }).join('');
    S.heat.querySelectorAll('[data-bar]').forEach(c=>c.onclick = e=>{ const b = +c.dataset.bar;
      if(e.shiftKey){ S.a.value = Math.min(st.a, b); S.b.value = Math.max(st.b, b); } else { S.a.value = b; S.b.value = b; } save(); }); }
  ['a','b','loop','step'].forEach(k=>S[k].onchange = save);
  S.all.onclick = () => { S.a.value = 1; S.b.value = N; S.loop.checked = false; save(); };
  S.weak.onclick = () => { const h = heatOf(ex.key); let best = -1, bv = 2;
    for(let i=0;i<N-1;i++){ const v = ((h[i]?h[i][0]:1) + (h[i+1]?h[i+1][0]:1))/2; if(v < bv){ bv = v; best = i; } }
    if(best < 0 || bv >= 0.85){ toast('Слабких тактів поки немає: зіграй мелодію хоча б раз повністю.'); return; }
    S.a.value = best+1; S.b.value = best+2; S.loop.checked = true; save(); };
  drawHeat();
  api.range = () => (st.a===1 && st.b===N) ? null : [starts[st.a-1], st.b < N ? starts[st.b] : total];
  api.loop = () => st.loop; api.step = () => st.step;
  api.record = (items, marks, secStart) => { const h = heatOf(ex.key); let cum = secStart;
    const acc = {}; items.forEach((it,i)=>{ const at = cum; cum += it.d; if(it.n==null) return;
      let bar = 0; while(bar+1 < N && starts[bar+1] <= at + 1e-6) bar++;
      const c = marks[i] && marks[i].cls, v = c==='ok' ? 1 : c==='warn' ? 0.5 : 0; (acc[bar] = acc[bar] || []).push(v); });
    Object.entries(acc).forEach(([bar, vs])=>{ const v = mean(vs), old = h[bar]; h[bar] = old ? [old[0] + (v-old[0])/Math.min((old[1]||1)+1, 4), (old[1]||1)+1] : [v, 1]; });
    saveProgress(); drawHeat(); };
  return api;
}

// ---------- Мінусовка: аудіофайл як фонограма ----------
const MinusAudio = { el:null, node:null, timer:0,
  ensure(){ if(!this.el){ this.el = new window.Audio(); this.el.crossOrigin = 'anonymous'; this.el.preservesPitch = true; this.el.preload = 'auto';
    try{ this.node = ac().createMediaElementSource(this.el); this.gain = ac().createGain(); this.node.connect(this.gain).connect(bus()); }catch(e){} }
    if(this.gain) this.gain.gain.value = Settings.minusVol ?? 0.9; return this.el; },
  // audio: {url, offset — секунда першої долі, bpm — темп запису}
  startAt(audio, t0Perf, startBeat, bpm){ if(!audio || !audio.url) return; const el = this.ensure(); this.stop();
    if(el.src !== audio.url) el.src = audio.url;
    const pos = audio.offset + startBeat*60/audio.bpm, rate = bpm/audio.bpm; el.playbackRate = rate; el.preservesPitch = true;
    const lead = t0Perf - now();
    if(pos >= 0){ el.currentTime = pos; this.timer = setTimeout(()=>el.play().catch(()=>{}), Math.max(0, lead - 15)); }
    else { el.currentTime = 0; this.timer = setTimeout(()=>el.play().catch(()=>{}), Math.max(0, lead + (-pos/rate)*1000 - 15)); } },
  stop(){ clearTimeout(this.timer); if(this.el && !this.el.paused) this.el.pause(); }
};
// Сховище аудіо: настільна версія пише файл у «Мій репертуар», браузерна — в IndexedDB
const MediaStore = {
  db(){ return this._db || (this._db = new Promise((res, rej)=>{ const r = indexedDB.open('ewi-media', 1); r.onupgradeneeded = ()=>r.result.createObjectStore('f'); r.onsuccess = ()=>res(r.result); r.onerror = ()=>rej(r.error); })); },
  async put(name, blob){ if(DESKTOP) return window.ewiStore.saveMedia(name, new Uint8Array(await blob.arrayBuffer()));
    const db = await this.db(); await new Promise((res, rej)=>{ const tx = db.transaction('f','readwrite'); tx.objectStore('f').put(blob, name); tx.oncomplete = res; tx.onerror = ()=>rej(tx.error); }); return name; },
  async pick(a){ return a && a.semis && a.tfile ? a.tfile : a && a.file; },
  async url(name){ if(!name) return null; if(DESKTOP) return 'ewimedia://rep/' + encodeURIComponent(name);
    const db = await this.db(); const blob = await new Promise(res=>{ const r = db.transaction('f').objectStore('f').get(name); r.onsuccess = ()=>res(r.result); r.onerror = ()=>res(null); });
    return blob ? URL.createObjectURL(blob) : null; }
};
