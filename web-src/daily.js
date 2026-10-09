// ---------- Заняття дня ----------
function dailyPlan(){
  const steps = [];
  steps.push({title:'Розминка: довгі ноти', min:3, why:'Рівне дихання на початку кожного заняття.',
    ex:{type:'long', title:'Довгі ноти', how:'Кожна нота 4 секунди, лінія дихання в смузі.', seq:'G4 D4 D5', hold:4, band:[50,90], pass:70}});
  const weak = Object.entries(Progress.wrong||{}).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([k])=>k.replace('♯','#').replace('♭','b'));
  if(weak.length){ const seq = weak.flatMap(w=>{ const m = parseNote(w).midi, nb = m >= 67 ? 'G4' : 'D4'; return [w, nb, w, w]; });
    steps.push({title:'Повторення проблемних нот', min:3, why:'Ноти, на яких ти найчастіше помиляєшся: '+weak.map(w=>withKeys(parseNote(w).midi)).join(', ')+'.',
      ex:{type:'notes', title:'Проблемні ноти', how:'Кожну проблемну ноту чергуєш з опорною.', seq:seq.join(' '), pass:85}}); }
  else steps.push({title:'Хроматика', min:3, why:'Помилок поки мало, тож тренуємо всі півтони.', ex:{type:'notes', title:'Хроматична гама', how:'Вгору і вниз.', seq:'D4 Eb4 E4 F4 F#4 G4 G#4 A4 Bb4 B4 C5 C#5 D5 C#5 C5 B4 Bb4 A4 G#4 G4 F#4 F4 E4 Eb4 D4', pass:80}});
  const tw = transStats(5).filter(r=>r.rate > 0.1)[0];
  if(tw) steps.push({title:`Перехід ${pcName(tw.a)} → ${pcName(tw.b)}`, min:2, why:`На цьому переході ${Math.round(tw.rate*100)}% разів проскакує проміжна нота: ${transTip(tw.a, tw.b)}.`, ex:transDrill(tw.a, tw.b)});
  const done = LESSONS.filter(lessonDone).length;
  steps.push({title:'Читання нот', min:3, why:'Швидкість реакції: бачиш ноту — граєш.', reading:{range: done < 8 ? 'base' : done < 20 ? 'two' : 'wide', acc: done >= 10, count:12, hint:true}});
  const l = nextLesson();
  if(l){ const p = lp(l.id), i = l.ex.findIndex((e,k)=>(p.best[k]||0) < passOf(e));
    if(i >= 0) steps.push({title:`Урок ${l.id}: ${l.ex[i].title}`, min:6, why:`Наступна непройдена вправа уроку «${l.title}».`, ex:l.ex[i], lesson:l, idx:i}); }
  const reps = LS.get('songs', []);
  const rep = reps.map(s=>({s, h:Object.values((Progress.heat||{})['song.'+s.id]||{}).map(x=>x[0])})).filter(x=>x.h.length).sort((a,b)=>Math.min(...a.h)-Math.min(...b.h))[0];
  if(rep){ const s = rep.s, h = (Progress.heat||{})['song.'+s.id]; let wi = 0, wv = 2; Object.entries(h).forEach(([k,v])=>{ if(v[0] < wv){ wv = v[0]; wi = +k; } });
    LS.set('sec.song.'+s.id, Object.assign({}, LS.get('sec.song.'+s.id, {}), {a:wi+1, b:wi+2, loop:true}));
    steps.push({title:`Репертуар: «${s.title}», такти ${wi+1}–${wi+2}`, min:5, why:'Найслабше місце в мелодії з твого репертуару, у петлі зі сходинками темпу.',
      ex:{type:'rhythm', title:s.title, how:'Петля на слабких тактах. Темп підніметься після кожного чистого проходу.', seq:s.seq, bpm:Math.round(s.bpm*0.8), beats:s.beats, maxBpm:s.bpm, key:'song.'+s.id, tol:85, chords:s.chords, style:s.style, tracks:s.tracks, muted:s.muted, allowLoop:true, pass:80}}); }
  else { const sg = SONGS.filter(songUnlocked).find(x=>!(songBest(x.id).play && songBest(x.id).play.score >= 75));
    if(sg) steps.push({title:`Мелодія: ${sg.title}`, min:5, why:'Відкрита мелодія, яку ти ще не зіграв на прохідний бал.',
      ex:{type:'rhythm', title:sg.title, how:'З фонограмою.', seq:sg.seq, beats:sg.beats, den:sg.den, bpm:Math.round(sg.bpm*0.85), maxBpm:sg.maxBpm, tol:85, chords:sg.chords, style:sg.style, key:'songs.'+sg.id, pass:75, allowLoop:true}, song:sg}); }
  return steps;
}
// план дня зберігається, щоб після переходу в інший розділ продовжити з того самого кроку
function saveDaily(st){ Progress.dailyState = st; LS.set('progress', Progress); }
function hydrateStep(s){ const x = {...s}; if(x.lessonId){ x.lesson = LESSONS.find(l=>l.id===x.lessonId); if(x.lesson) x.ex = x.lesson.ex[x.idx]; } if(x.songId) x.song = SONGS.find(z=>z.id===x.songId); return x; }
function dryStep(s){ const x = {...s}; if(x.lesson){ x.lessonId = x.lesson.id; delete x.lesson; delete x.ex; } if(x.song){ x.songId = x.song.id; delete x.song; } return x; }
function viewDaily(v, opts){
  let saved = Progress.dailyState && Progress.dailyState.date === today() && !(opts && opts.fresh) ? Progress.dailyState : null;
  if(saved && saved.k >= saved.plan.length) saved = null;
  const steps = saved ? saved.plan.map(hydrateStep).filter(s=>s.ex || s.reading) : dailyPlan();
  const t0 = now() - (saved ? saved.elapsed||0 : 0), results = saved ? saved.results.slice() : []; let k = -1, stop = null;
  const persist = () => saveDaily({date:today(), plan:steps.map(dryStep), k, results, elapsed: now() - t0});
  const total = steps.reduce((a,s)=>a+s.min,0);
  v.innerHTML = `<h2 class="title">Заняття дня</h2><p class="sub">${steps.length} кроків, близько ${total} хвилин. План складено з твого прогресу: проблемні ноти, наступний урок і слабкі такти репертуару.</p>
    <div class="steps" id="dSteps">${steps.map((s,i)=>`<button data-d="${i}" disabled>${i+1}. ${esc(s.title)}</button>`).join('')}</div>
    <div class="row" style="justify-content:space-between;margin:6px 0"><span class="muted" id="dWhy"></span><span class="row"><span class="muted" id="dClock">0:00</span><button class="small" id="dSkip">Пропустити крок</button><button class="small" id="dNew">Новий план</button></span></div>
    <div class="grid2"><div id="dBox"></div><aside id="side"></aside></div>`;
  Side.mount($('side'));
  const clock = setInterval(()=>{ const s = Math.floor((now()-t0)/1000); const c = $('dClock'); if(c) c.textContent = `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; }, 1000);
  const step = i => { if(stop) stop(); stop = null; k = i; persist(); document.querySelectorAll('[data-d]').forEach(b=>{ const j = +b.dataset.d; b.setAttribute('aria-current', j===i); b.disabled = j > i && j > (saved ? saved.maxK||0 : 0); b.onclick = () => { if(j <= Math.max(k, maxK)) step(j); }; });
    if(i >= steps.length){ finish(); return; }
    const s = steps[i]; $('dWhy').textContent = s.why;
    maxK = Math.max(maxK, i);
    const ctx = { done:res=>{ results[i] = Math.round(res.score ?? res.acc ?? 0); persist();
        if(s.lesson){ const p = lp(s.lesson.id); p.best[s.idx] = Math.max(p.best[s.idx]||0, Math.round(res.score)); Progress.log.unshift({at:Date.now(), lesson:s.lesson.id, ex:s.ex.title, score:Math.round(res.score), bpm:res.bpm}); saveProgress(); }
        if(s.song) saveSongBest(s.song.id, 'play', res.score, res.bpm); },
      again:()=>step(i), next:()=>step(i+1) };
    if(s.reading){ stop = runReading($('dBox'), s.reading, r=>{ results[i] = Math.round(r.acc); $('dBox').innerHTML = `<div class="result pass"><div><span class="score">${r.avg.toFixed(2)} с</span><span class="muted"> на ноту, точність ${Math.round(r.acc)}%</span></div><div class="row" style="margin-top:8px"><button class="primary" id="dNext">Далі</button></div></div>`; $('dNext').onclick = ()=>step(i+1); }); }
    else stop = RUNNERS[s.ex.type]($('dBox'), s.ex, ctx); };
  function finish(){ const min = Math.round((now()-t0)/60000); saveDaily({date:today(), plan:steps.map(dryStep), k:steps.length, results, elapsed: now() - t0}); Progress.daily = Progress.daily || {}; Progress.daily[today()] = {min, steps:steps.length, done:results.filter(x=>x!=null).length}; saveProgress(); checkBadges();
    $('dWhy').textContent = ''; $('dBox').innerHTML = `<div class="result pass"><div><span class="score">Готово</span><span class="muted"> · ${min} хв</span></div>
      <table class="fing">${steps.map((s,i)=>`<tr><td>${esc(s.title)}</td><td>${results[i]!=null?results[i]:'пропущено'}</td></tr>`).join('')}</table>
      <textarea class="report" id="dJ" style="min-height:60px;margin-top:10px" placeholder="Нотатка до заняття: що вийшло, що заважало…"></textarea>
      <div class="row" style="margin-top:8px"><button class="primary" id="dT">Розбір з вчителем</button><button id="dP">До програми</button></div></div>`;
    const saveJ = () => { const tx = $('dJ') && $('dJ').value.trim(); if(tx){ journalAdd(tx); $('dJ').value = ''; } };
    $('dT').onclick = ()=>{ saveJ(); go('teacher'); }; $('dP').onclick = ()=>{ saveJ(); go('program'); }; }
  $('dSkip').onclick = () => step(k+1);
  $('dNew').onclick = () => { if(confirm('Скласти новий план заняття? Поточний прогрес кроків буде скинуто.')){ Progress.dailyState = null; LS.set('progress', Progress); go('daily', {fresh:true}); } };
  let maxK = saved ? saved.k : 0;
  if(saved){ step(saved.k); toast(`Продовжуємо заняття з кроку ${saved.k+1}: «${steps[saved.k].title}».`); } else step(0);
  const tick = setInterval(()=>{ if(k >= 0 && k < steps.length) persist(); }, 15000);
  UI.cleanup = () => { if(k >= 0 && k < steps.length) persist(); if(stop) stop(); clearInterval(clock); clearInterval(tick); };
}
