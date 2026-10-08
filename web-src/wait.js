// ---------- Режим очікування ----------
// Супровід грає відрізками від ноти до ноти: застосунок чекає правильну ноту і лише тоді грає далі.
function runWait(box, ex, ctx){
  const items = parseSeq(ex.seq), beats = ex.beats||4, total = items.reduce((a,b)=>a+b.d,0), pickup = ex.pickup ?? pickupOf(ex.chords, beats);
  const R = exShell(box, ex, `<label class="muted">Темп <input type="number" data-c="bpm" min="30" max="260" value="${LS.get('tempo.'+ex.key, null) || ex.bpm}"></label>
    ${ex.chords?`<label class="muted"><input type="checkbox" data-c="back" ${ex.tracks&&ex.tracks.length?'':'checked'}> фонограма</label>`:''}
    <button class="primary" data-c="go">Почати</button>`);
  const C = {}; box.querySelectorAll('[data-c]').forEach(e=>C[e.dataset.c]=e);
  const starts = []; { let c = 0; items.forEach(it=>{ starts.push(c); c += it.d; }); }
  const idx = items.map((it,i)=>i).filter(i=>items[i].n!=null);
  const marks = items.map(()=>({}));
  const vopts = () => ({rhythmic:true, beats, den:ex.den, pickup, marks, chordLabels: chordLabelsOf(ex.chords)});
  let layout = scoreView(R.staff, items, vopts()); viewToggle(R.staff, ()=>{ layout = scoreView(R.staff, items, vopts()); layout.update(cur>=0 ? starts[idx[cur]] : 0); });
  trackChips(box.querySelector('.focus'), ex, ()=> seg ? seg.mix : null);
  prepareSound({seq:items, chords:ex.chords, tracks:ex.tracks});
  let cur = -1, seg = null, segTimer = 0, active = false, misses = 0, firstTry = 0, waitFrom = 0; const waits = [];
  const bpm = () => clamp(+C.bpm.value || ex.bpm, 30, 260);
  const segEnd = k => k+1 < idx.length ? starts[idx[k+1]] : total;
  const show = () => { layout.setMarks && layout.setMarks(marks); if(cur >= 0 && cur < idx.length){ const i = idx[cur]; marks.forEach((m,j)=>{ if(m.cls==='cur') delete m.cls; }); if(!marks[i].cls) marks[i].cls = 'cur';
      layout = scoreView(R.staff, items, vopts()); layout.update(starts[i]); setFocus(R, items[i].n); } };
  // зіграти відрізок супроводу [a, b) у долях
  function playSeg(a, b, onEnd){ if(seg){ seg.stop(); clearTimeout(segTimer); }
    if(b - a < 0.01){ seg = null; onEnd && onEnd(); return; }
    const r = sliceSection(items, ex, a, b);
    seg = schedule({bpm:bpm(), beats, countIn:0, totalBeats:r.total, clickOn:!ex.chords && !(ex.tracks && ex.tracks.length),
      backing: C.back && C.back.checked && r.chords ? {chords:r.chords, style:ex.style} : null, tracks: r.tracks && r.tracks.length ? {list:r.tracks, muted:ex.muted||r.tracks.map(()=>false)} : null});
    segTimer = setTimeout(()=>{ onEnd && onEnd(); }, seg.endPerf - now()); }
  function waitNote(k){ cur = k; if(k >= idx.length){ finish(); return; } waitFrom = now(); misses = 0; show();
    setHint(R, `Чекаю ${withKeys(items[idx[k]].n)}.`); }
  C.go.onclick = () => { if(active){ stop(); return; } active = true; C.go.textContent = '■ Стоп'; Object.keys(marks).forEach(k=>marks[k] = {}); firstTry = 0; waits.length = 0; R.result.innerHTML = '';
    const intro = idx.length ? starts[idx[0]] : 0;
    if(intro > 0){ setHint(R, 'Вступ…'); playSeg(0, intro, ()=>waitNote(0)); } else waitNote(0); };
  function stop(){ active = false; if(seg){ seg.stop(); seg = null; } clearTimeout(segTimer); C.go.textContent = 'Почати'; cur = -1; }
  let pending = -1; // наступна нота, поки ще грає відрізок попередньої
  const off = listen((type, d)=>{ if(!active || type!=='on') return;
    // гра випереджає супровід: правильну наступну ноту приймаємо одразу, відрізок обриваємо
    if(cur === -2 && pending >= 0 && pending < idx.length && matchNote(d.n, items[idx[pending]].n).ok){ if(seg){ seg.stop(); seg = null; } clearTimeout(segTimer); cur = pending; waitFrom = now(); misses = 0; }
    if(cur < 0 || cur >= idx.length) return;
    const i = idx[cur], m = matchNote(d.n, items[i].n);
    if(!m.ok){ misses++; noteWrong(items[i].n); setHint(R, missTip(d.n, items[i].n), 'bad'); return; }
    waits.push(now() - waitFrom); marks[i] = {cls: misses ? 'warn' : 'ok'}; if(!misses) firstTry++;
    const k = cur; cur = -2; pending = k + 1; // поки грає відрізок, наступну ноту можна взяти й раніше
    setHint(R, 'Добре, далі…', 'ok'); show();
    playSeg(starts[i], segEnd(k), ()=>{ if(active) waitNote(k+1); }); });
  function finish(){ active = false; seg = null; C.go.textContent = 'Почати'; layout = scoreView(R.staff, items, vopts()); layout.update(total);
    const n = idx.length, score = n ? firstTry/n*100 : 0, avgWait = mean(waits)/1000;
    if(score >= 90){ const nb = bpm() + 4; LS.set('tempo.'+ex.key, nb); C.bpm.value = nb; }
    showResult(R, {score, pass: ex.pass||80, bpm: bpm(), advice: score >= 90 ? 'Майже без зупинок. Можна переходити до гри з метрономом.' : 'Повтори кілька разів, поки ноти не підуть з першої спроби, потім перейди до режиму з метрономом.',
      stats:[['з першої спроби', firstTry+'/'+n], ['середнє очікування', avgWait.toFixed(1)+' с'], ['темп', bpm()+' bpm']]}, ctx); }
  setFocus(R, items[idx[0]] ? items[idx[0]].n : null); setHint(R, 'Натисни «Почати». Супровід гратиме, щойно ти візьмеш правильну ноту, і чекатиме, поки не знайдеш наступну.');
  let paused = false;
  const cleanup = () => { off(); stop(); };
  cleanup.pause = () => { if(!active) return false; paused = true; if(seg){ seg.stop(); seg = null; } clearTimeout(segTimer); setHint(R, 'Пауза.'); return true; };
  cleanup.resume = () => { if(!paused) return false; paused = false; if(cur === -2 && pending >= 0) waitNote(pending); else if(cur >= 0) waitNote(cur); return true; };
  return cleanup;
}
RUNNERS.wait = runWait;
