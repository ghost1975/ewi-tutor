// ---------- Доріжки супроводу з MIDI ----------
// Доріжка: {name, kind, notes:[[нота, початок у долях, тривалість у долях, гучність 0..1], ...]}
const KIND_LABEL = { piano:'клавішні', bass:'бас', pad:'струнні / пед', lead:'мелодичний', drums:'ударні', other:'інше' };
function guessKind(name, program, drums){
  if(drums) return 'drums';
  const n = (name||'').toLowerCase();
  if(/drum|perc|kit|удар/.test(n)) return 'drums';
  if(/bass|бас/.test(n)) return 'bass';
  if(/string|pad|choir|ensemble|струн|орган|organ/.test(n)) return 'pad';
  if(/piano|keys|rhodes|guitar|клав|фортеп|гітар/.test(n)) return 'piano';
  if(/sax|solo|melody|lead|vocal|voice|trumpet|flute|clarinet|сакс|мелод|вокал/.test(n)) return 'lead';
  if(program!=null){ if(program<16 || (program>=24 && program<32)) return 'piano'; if(program<24) return 'pad'; if(program<40) return 'bass';
    if(program<56) return 'pad'; if(program<88) return 'lead'; if(program<96) return 'pad'; }
  return 'other';
}
function drumKind(n){ if(n===35||n===36) return 'kick'; if(n>=37&&n<=40) return 'snare'; if(n===42||n===44) return 'hat'; if(n===46) return 'ohat';
  if(n===49||n===52||n===55||n===57) return 'ohat'; if(n===51||n===53||n===59) return 'ride'; return 'rim'; }
// найближчий до нуля зсув у межах октави, щоб супровід звучав у тій самій тональності, що й підказка
const trackShift = () => { let k = ((Settings.offset%12)+12)%12; if(k>6) k -= 12; return k; };
function scheduleTracks(t0, spb, list, muted){
  const a = ac(), k = trackShift(), live = [], vol = Settings.backVol ?? 0.7;
  const gains = list.map((t,i)=>{ const g = a.createGain(); g.gain.value = muted[i] ? 0 : 1; g.connect(bus()); return g; });
  const ptr = list.map(()=>0);
  const play = (t, g, [n, s, d, v]) => { const ct = t0 + s*spb, dur = Math.max(0.06, d*spb), vv = (v ?? 0.8)*vol;
    if(t.kind==='drums'){ live.push(...drum(drumKind(n), ct, (v ?? 0.8)*0.9, g)); return; }
    const o = { piano:[0.055, {bright:3, decay:true, att:0.005}, Math.min(dur, 2.5)], bass:[0.15, {bright:2.2}, dur*0.95],
      pad:[0.03, {bright:1.4, att:0.18}, dur], lead:[0.06, {bright:2}, dur*0.95], other:[0.05, {bright:2}, dur*0.95] }[t.kind] || [0.05, {bright:2}, dur];
    live.push(...tone(n + k, ct, Math.max(0.06, o[2]), o[0]*vv, {...o[1], out:g, inst:t.kind==='other'?'piano':t.kind})); };
  const tick = () => { const now = a.currentTime, horizon = now + 1.5;
    list.forEach((t,i)=>{ while(ptr[i] < t.notes.length){ const nt = t.notes[ptr[i]], ct = t0 + nt[1]*spb; if(ct > horizon) break; ptr[i]++;
      if(ct < now - 0.03 || muted[i]) continue; play(t, gains[i], nt); } });
    while(live.length > 600) live.shift(); };
  tick(); const iv = setInterval(tick, 200);
  return { set(i, on){ muted[i] = !on; gains[i].gain.setTargetAtTime(on ? 1 : 0, a.currentTime, 0.02); },
    stop(){ clearInterval(iv); live.forEach(x=>{ try{ x.stop(); }catch(e){} }); gains.forEach(g=>{ try{ g.disconnect(); }catch(e){} }); } };
}
const tracksEnd = list => Math.max(0, ...list.map(t=>t.notes.reduce((m,x)=>Math.max(m, x[1]+x[2]), 0)));
// рядок перемикачів доріжок; getMix повертає поточне відтворення (або null)
function trackChips(host, ex, getMix){
  if(!ex.tracks || !ex.tracks.length) return;
  ex.muted = ex.muted || ex.tracks.map(()=>false);
  const row = document.createElement('div'); row.className = 'tracks';
  row.innerHTML = `<span class="muted">Доріжки:</span>` + ex.tracks.map((t,i)=>`<label class="chip"><input type="checkbox" data-t="${i}" ${ex.muted[i]?'':'checked'}> ${esc(t.name)} <span class="muted">· ${KIND_LABEL[t.kind]||''}</span></label>`).join('');
  host.before(row);
  row.querySelectorAll('[data-t]').forEach(cb=>cb.onchange = ()=>{ const i = +cb.dataset.t; ex.muted[i] = !cb.checked;
    const m = getMix(); if(m) m.set(i, cb.checked); if(ex.onMute) ex.onMute(ex.muted.slice()); });
}
