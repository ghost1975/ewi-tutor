// ---------- Каркас ----------
const VIEWS = [['program','Програма'],['daily','Заняття дня'],['songs','Популярні мелодії'],['reading','Тренажер нот'],['rhythm','Тренажер ритму'],['trans','Переходи'],['teacher','Вчитель'],['analyzer','Аналізатор звуку'],['metro','Метроном'],['rep','Мій репертуар'],['takes','Записи'],['stats','Прогрес'],['settings','Налаштування']];
const UI = { view:'program', lesson:null, step:0, cleanup:null };
const DEF_PASS = {notes:80, long:70, rhythm:75, dyn:65, vibrato:70, echo:70, improv:70};
const passOf = ex => ex.pass || DEF_PASS[ex.type];

function shell(){
  document.body.innerHTML = `
  <header class="top">
    <h1>Репетитор EWI</h1>
    <div class="src"><span class="dot" id="midiDot"></span><span id="midiTxt">MIDI…</span></div>
    <div class="src"><span class="dot" id="micDot"></span><button class="small" id="micBtn">Увімкнути мікрофон</button></div>
    <button class="small rec" id="recBtn" title="Записати дубль з мікрофона">● Запис</button>
    <div class="src" title="Дихання"><span>Дихання</span><div class="meter"><i id="topMeter"></i></div></div>
  </header>
  <div class="app"><nav class="side" id="nav"></nav><main class="view" id="view"></main></div>`;
  VIEWS.forEach(([id,label])=>{ const b = document.createElement('button'); b.textContent = label; b.dataset.v = id; b.onclick = ()=>go(id); $('nav').appendChild(b); });
  $('micBtn').onclick = async ()=>{ if(Live.micOn){ micStop(); return; } try{ await micStart(Settings.micId); }catch(e){ alert('Мікрофон недоступний: '+e.message+'. Дозволь доступ у налаштуваннях сайту Chrome.'); } };
  $('recBtn').onclick = ()=>{ if(Rec.mr){ recStop(); return; } if(!Live.micOn){ alert('Для запису увімкни мікрофон або підключи вихід EWI до аудіовходу.'); return; } recStart(UI.view==='lesson' && UI.lesson ? 'Урок '+UI.lesson.id : 'Вільна гра'); };
  Hub.on(type=>{ if(type==='status') status(); });
  status();
  const tick = t => { simTick(t); $('topMeter').style.width = (Live.breath/127*100)+'%'; Side.tick(); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}
function status(){
  const on = Live.midiNames.length>0;
  $('midiDot').classList.toggle('on', on);
  $('midiTxt').textContent = on ? (Live.midiNames.find(n=>/ewi/i.test(n)) || Live.midiNames[0]) : (Live.midiErr || 'EWI не підключено');
  $('micDot').classList.toggle('on', Live.micOn);
  $('micBtn').textContent = Live.micOn ? 'Вимкнути мікрофон' : 'Увімкнути мікрофон';
  const mg = $('micGo'); if(mg) mg.textContent = Live.micOn?'Перезапустити мікрофон':'Увімкнути мікрофон';
  $('recBtn').classList.toggle('on', !!Rec.mr); $('recBtn').textContent = Rec.mr ? '■ Зупинити' : '● Запис';
}
function go(view, arg){
  if(UI.cleanup){ UI.cleanup(); UI.cleanup = null; }
  UI.view = view;
  document.querySelectorAll('#nav button').forEach(b=>b.setAttribute('aria-current', b.dataset.v===(view==='lesson'?'program':view)));
  const v = $('view'); v.innerHTML = ''; scrollTo(0,0);
  ({program:viewProgram, daily:viewDaily, reading:viewReading, rhythm:viewRhythmTrainer, trans:viewTrans, teacher:viewTeacher, perform:viewPerform, songs:viewSongs, lesson:(v,a)=>a && a.lesson ? viewLesson(v, a.lesson, a.step) : viewLesson(v, a), analyzer:viewAnalyzer, metro:viewMetro, rep:viewRep, takes:viewTakes, stats:viewStats, settings:viewSettings})[view](v, arg);
}

// ---------- Прогрес уроків ----------
const lp = id => Progress.lessons[id] || (Progress.lessons[id] = {best:{}});
function lessonDone(l){ const p = lp(l.id); return l.ex.every((e,i)=>(p.best[i]||0) >= passOf(e)); }
function nextLesson(){ return LESSONS.find(l=>!lessonDone(l)); }
function recordResult(l, i, res){
  const p = lp(l.id); p.best[i] = Math.max(p.best[i]||0, Math.round(res.score)); p.last = Date.now();
  Progress.log.unshift({at:Date.now(), lesson:l.id, ex:l.ex[i].title, score:Math.round(res.score), bpm:res.bpm||null});
  Progress.log = Progress.log.slice(0,300); saveProgress();
}

// ---------- Програма ----------
function viewProgram(v){
  const next = nextLesson(), done = LESSONS.filter(lessonDone).length;
  const last = Progress.last && LESSONS.find(l=>l.id===Progress.last.id), here = last || next;
  const resume = last && !lessonDone(last) ? {lesson:last, step:Progress.last.step} : next ? {lesson:next, step:0} : null;
  v.innerHTML = `<h2 class="title">Програма навчання</h2>
    <p class="sub">${done} з ${LESSONS.length} уроків пройдено. ${next?`Наступний: <a href="#" id="goNext">${esc(next.id+' '+next.title)}</a>.`:'Програму завершено.'}</p>
    <div class="progressbar"><i style="width:${done/LESSONS.length*100}%"></i></div>
    ${resume?`<div class="callout here-call row" style="justify-content:space-between"><span>${last?`Ти зупинився на уроці <b>${esc(last.id+' '+last.title)}</b>${lessonDone(last)?', його пройдено':`, ${last.ex.filter((e,i)=>(lp(last.id).best[i]||0)>=passOf(e)).length} з ${last.ex.length} вправ`}.`:'Почни з першого уроку.'}${resume.lesson!==last?` Далі: ${esc(resume.lesson.id+' '+resume.lesson.title)}.`:''}</span><button class="primary" id="goResume">Продовжити</button></div>`:''}
    ${(()=>{ const last = TeacherLog.get().find(x=>x.q==='Розбір прогресу'); const stale = !last || Date.now() - last.at > 7*864e5; return stale && totalMin() >= 60 ? `<div class="callout row" style="justify-content:space-between"><span>${last?'Минуло понад тиждень від останнього розбору з вчителем.':'Ти вже маєш понад годину практики: час для першого розбору з вчителем.'}</span><button id="goTeach">Розбір з вчителем</button></div>` : ''; })()}
    <div class="callout row" style="justify-content:space-between"><span>${(Progress.daily||{})[today()] ? 'Заняття дня вже пройдено. Можна продовжити урок або пограти мелодії.' : 'Не знаєш, з чого почати? Заняття дня на 20 хвилин зібране з твого прогресу.'}</span><button class="primary" id="goDaily">Заняття дня</button></div>
    ${!Live.midiNames.length && !Live.micOn ? '<div class="callout">Підключи EWI кабелем USB-C або увімкни мікрофон угорі. Без інструмента можна перевірити все з клавіатури: A S D F грають D E F F♯, 1–8 грають G4…G5, [ і ] змінюють силу «дихання».</div>':''}
    <div id="levels"></div>`;
  $('goDaily').onclick = ()=>go('daily');
  if($('goTeach')) $('goTeach').onclick = ()=>go('teacher');
  if(resume) $('goResume').onclick = ()=>go('lesson', resume);
  if(next) $('goNext').onclick = e=>{ e.preventDefault(); go('lesson', next); };
  LEVELS.forEach(L=>{
    const ls = LESSONS.filter(l=>l.lvl===L.n);
    const sec = document.createElement('section'); sec.className = 'level';
    sec.innerHTML = `<h3>Рівень ${L.n}. ${esc(L.title)}</h3><p class="lvdesc">${esc(L.desc)}</p><div class="lessons"></div>`;
    ls.forEach(l=>{ const b = document.createElement('button'); const d = lessonDone(l), isNext = next===l;
      const bests = l.ex.map((e,i)=>lp(l.id).best[i]||0), started = bests.some(x=>x>0);
      const isHere = here===l, passed = l.ex.filter((e,i)=>(bests[i]||0)>=passOf(e)).length;
      b.className = 'lesson-btn'+(d?' done':'')+(isNext?' next':'')+(isHere?' here':'');
      b.innerHTML = `<span class="num">${d?'✓':l.id.split('.')[1]}</span><div><b>${esc(l.title)}</b><span>${isHere?`Ти зупинився тут${d?' · пройдено':` · ${passed} з ${l.ex.length} вправ`}`:d?'Пройдено':isNext?'Наступний урок':started?`Розпочато · ${passed} з ${l.ex.length} вправ`:esc(l.goal)}</span>${isHere||started&&!d?`<i class="mini"><i style="width:${passed/l.ex.length*100}%"></i></i>`:''}</div>`;
      b.onclick = ()=>go('lesson', isHere && last===l && !d ? {lesson:l, step:Progress.last.step} : l); sec.querySelector('.lessons').appendChild(b); });
    $('levels').appendChild(sec);
  });
  const hb = v.querySelector('.lesson-btn.here'); if(hb) setTimeout(()=>hb.scrollIntoView({block:'center', behavior:'smooth'}), 60);
}

// ---------- Урок ----------
function viewLesson(v, l, startStep){
  UI.lesson = l; UI.step = 0;
  const steps = [{k:'theory', t:'Теорія'}, ...l.ex.map((e,i)=>({k:'ex', i, t:(i+1)+'. '+e.title})), {k:'sum', t:'Підсумок'}];
  v.innerHTML = `<div class="muted">Рівень ${l.lvl}. ${esc(LEVELS[l.lvl-1].title)} · урок ${l.id}</div>
    <h2 class="title">${esc(l.title)}</h2><p class="sub">${esc(l.goal)}</p>
    <div class="steps" id="steps"></div>
    <div class="grid2"><div id="stepBox"></div><aside id="side"></aside></div>`;
  Side.mount($('side'));
  const renderSteps = () => { const p = lp(l.id); $('steps').innerHTML = '';
    steps.forEach((s,k)=>{ const b = document.createElement('button'); b.textContent = s.t; b.setAttribute('aria-current', k===UI.step);
      if(s.k==='ex' && (p.best[s.i]||0) >= passOf(l.ex[s.i])) b.classList.add('passed');
      b.onclick = ()=>show(k); $('steps').appendChild(b); }); };
  let stop = null;
  const show = k => {
    if(stop){ stop(); stop = null; }
    UI.step = k; renderSteps(); Progress.last = {id:l.id, step:k, at:Date.now()}; saveProgress(); const s = steps[k], box = $('stepBox'); Side.show([],0);
    if(s.k==='theory'){
      box.innerHTML = `<div class="theory">${l.theory.map(p=>`<p>${noteText(esc(p))}</p>`).join('')}
        ${l.callout?`<div class="callout">${noteText(esc(l.callout))}</div>`:''}
        ${l.listen?`<div class="row" style="margin:16px 0"><button id="lsn">▶ Послухати: ${esc(l.listen.label)}</button>${l.listen.chords?'<span class="muted">з фонограмою</span>':''}<span class="muted">${l.listen.bpm} bpm</span></div><div class="staffwrap" id="lsnStaff"></div>`:''}
        <h3>Ноти й аплікатура уроку</h3>${lessonNotesTable(l)}
        ${l.mistakes&&l.mistakes.length?`<h3>На що звернути увагу</h3><ul>${l.mistakes.map(m=>`<li>${noteText(esc(m))}</li>`).join('')}</ul>`:''}
        ${l.plan&&l.plan.length?`<h3>План заняття</h3><ol>${l.plan.map(m=>`<li>${noteText(esc(m))}</li>`).join('')}</ol>`:''}
        <h3>Що буде в практиці</h3><ul>${l.ex.map(e=>`<li><b>${esc(e.title)}.</b> ${noteText(esc(e.how))}</li>`).join('')}</ul></div>
        <div class="navrow"><span></span><button class="primary" id="toEx">До вправ</button></div>`;
      if(l.listen){ const items = parseSeq(l.listen.seq); mountStaff($('lsnStaff'), items, {rhythmic:true, beats:3===l.ex.find(e=>e.beats)?.beats?3:4});
        prepareSound({seq:items, chords:l.listen.chords}); let h = null; $('lsn').onclick = ()=>{ if(h) h.stop(); h = l.listen.chords ? schedule({bpm:l.listen.bpm, beats:l.ex.find(e=>e.beats)?.beats||4, countIn:0, totalBeats:items.reduce((a,b)=>a+b.d,0), seq:items, guide:true, swing:l.listen.swing, clickOn:false, backing:{chords:l.listen.chords, style:l.listen.style}}) : playSeq(items, l.listen.bpm, {swing:l.listen.swing, vibrato:l.listen.vibrato}); };
        stop = ()=>{ if(h) h.stop(); }; }
      $('toEx').onclick = ()=>show(1);
    } else if(s.k==='ex'){
      const ex = l.ex[s.i];
      stop = RUNNERS[ex.type](box, ex, {
        done:(res)=>{ recordResult(l, s.i, res); renderSteps(); },
        again:()=>show(k), next:()=>show(k+1) });
    } else {
      const p = lp(l.id), d = lessonDone(l), idx = LESSONS.indexOf(l), nx = LESSONS[idx+1];
      box.innerHTML = `<div class="result ${d?'pass':''}"><div class="score">${d?'Урок пройдено':'Ще не всі вправи пройдено'}</div></div>
        <table style="margin-top:14px"><tr><th>Вправа</th><th>Найкращий результат</th><th>Прохідний</th></tr>
        ${l.ex.map((e,i)=>`<tr><td>${esc(e.title)}</td><td>${p.best[i]!=null?p.best[i]:'—'}</td><td>${passOf(e)}</td></tr>`).join('')}</table>
        <h3>Типові помилки</h3><ul class="theory">${l.mistakes.map(m=>`<li>${noteText(esc(m))}</li>`).join('')}</ul>
        ${l.plan&&l.plan.length?`<h3>План заняття на кожен день</h3><ol class="theory">${l.plan.map(m=>`<li>${noteText(esc(m))}</li>`).join('')}</ol>`:''}
${(()=>{ const ss = SONGS.filter(s=>s.unlock===l.id); return ss.length ? `<h3>${d?'Відкрито мелодії':'Після цього уроку відкриються мелодії'}</h3><ul class="theory">${ss.map(s=>`<li>${d?`<a href="#" data-song="${s.id}">${esc(s.title)}</a>`:esc(s.title)}</li>`).join('')}</ul>` : ''; })()}
        <h3>Домашнє завдання</h3><p class="theory">${noteText(esc(l.home))}</p>
        <div class="navrow"><button id="back">До програми</button>${nx?`<button class="primary" id="nxt">Наступний урок: ${esc(nx.title)}</button>`:''}</div>`;
      box.querySelectorAll('[data-song]').forEach(a=>a.onclick = e=>{ e.preventDefault(); go('songs', a.dataset.song); });
      $('back').onclick = ()=>go('program'); if(nx) $('nxt').onclick = ()=>go('lesson', nx);
    }
  };
  show(Math.max(0, Math.min(steps.length-1, startStep||0)));
  UI.cleanup = ()=>{ if(stop) stop(); };
}

function lessonNotesTable(l){
  const set = new Map();
  l.ex.forEach(e=>{ const seqs = [e.seq, e.note, e.scaleSeq, ...(e.phrases||[])].filter(Boolean);
    seqs.forEach(sq=>parseSeq(sq).forEach(it=>{ if(it.n!=null && !set.has(it.n)) set.set(it.n, it); })); });
  const ns = [...set.keys()].sort((a,b)=>a-b); if(!ns.length) return '';
  return `<table class="fing"><tr><th>Нота</th><th>Клавіші</th></tr>${ns.map(n=>`<tr><td><b>${esc(nameOf(n))}</b></td><td>${esc(withKeys(n))}</td></tr>`).join('')}</table>`;
}
// ---------- Аналізатор ----------
function viewAnalyzer(v){
  v.innerHTML = `<h2 class="title">Аналізатор звуку</h2>
    <p class="sub">Висота, строй, гучність, яскравість і вібрато в реальному часі. Найточніше працює, коли звук EWI іде на аудіовхід ноутбука; мікрофон біля динаміка теж підходить.</p>
    <div class="row" style="margin-bottom:12px"><select id="micSel"><option value="">Пристрій за замовчуванням</option></select><button id="micGo" class="primary">${Live.micOn?'Перезапустити мікрофон':'Увімкнути мікрофон'}</button></div>
    <div class="grid2"><div>
      <div class="tuner"><div class="big" id="aBig">–</div><div style="flex:1;min-width:240px"><div class="keys" id="aKeys"></div><div class="muted" id="aHz"></div><canvas class="needle" id="needle" style="height:60px"></canvas></div></div>
      <div class="stats" id="aStats"></div>
      <div class="cv"><div class="lbl"><span>Висота відносно найближчої ноти, 8 секунд</span><span>±50 центів</span></div><canvas id="pTrace" class="tall"></canvas></div>
      <div class="cv"><div class="lbl"><span>Спектр</span><span>50 Гц – 8 кГц</span></div><canvas id="spec"></canvas></div>
      <div id="ccHost"></div>
    </div><aside id="side"></aside></div>`;
  Side.mount($('side')); ccPanel($('ccHost'));
  (async()=>{ try{ const ds = (await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='audioinput');
    ds.forEach(d=>{ const o = document.createElement('option'); o.value = d.deviceId; o.textContent = d.label || 'Вхід '+d.deviceId.slice(0,6); $('micSel').appendChild(o); }); $('micSel').value = Settings.micId||''; }catch(e){} })();
  $('micGo').onclick = async()=>{ Settings.micId = $('micSel').value; saveSettings(); try{ await micStart(Settings.micId); $('micGo').textContent='Перезапустити мікрофон'; }catch(e){ alert('Мікрофон недоступний: '+e.message); } };
  const trace = []; let lastNote = null;
  const off = Hub.on((type,d)=>{ if(type==='frame'){ trace.push(d); while(trace.length && trace[0].t < d.t-8000) trace.shift(); } });
  const stopLoop = loopFrames(t=>{
    const n = Live.micOn && Live.cents!=null ? Math.round(hz2midi(Live.hz)) : Live.note;
    if(n!=null){ const w = n - Settings.offset; $('aBig').textContent = pcName(w); $('aKeys').textContent = withKeys(w); if(lastNote!==n){ Side.show(keysOf(w), rollerOf(w)); lastNote = n; } }
    $('aHz').textContent = Live.micOn && Live.hz ? `${Live.hz.toFixed(1)} Гц · ${nameOf(Math.round(hz2midi(Live.hz)))}` : Live.micOn ? 'тиша' : 'мікрофон вимкнено';
    // стрілка строю
    { const {c,w,h} = prepCanvas($('needle')); c.fillStyle = cssv('--line'); c.fillRect(0,h/2-1,w,2);
      [-50,-25,0,25,50].forEach(x=>{ const px = w/2 + x/50*(w/2-6); c.fillStyle = cssv('--muted'); c.fillRect(px-0.5, h/2-(x?8:14), 1, x?16:28); });
      c.fillStyle = cssv('--ok'); c.fillRect(w/2-(w/2-6)*0.1, h/2-3, (w/2-6)*0.2, 6);
      if(Live.cents!=null){ const px = w/2 + clamp(Live.cents,-50,50)/50*(w/2-6); c.fillStyle = Math.abs(Live.cents)<=10?cssv('--ok'):Math.abs(Live.cents)<=25?cssv('--warn'):cssv('--bad'); c.beginPath(); c.arc(px, h/2, 9, 0, 7); c.fill(); } }
    const vib = Live.vib;
    $('aStats').innerHTML = [['строй', Live.cents!=null?(Live.cents>0?'+':'')+Math.round(Live.cents)+' ц':'—'], ['гучність', Live.db>-90?Math.round(Live.db)+' дБ':'—'],
      ['дихання', Live.breath], ['яскравість', Live.micOn && Live.hz ? Math.round(Live.centroid)+' Гц':'—'], ['вібрато', vib?vib.rate.toFixed(1)+' Гц, '+Math.round(vib.depth)+' ц':'—']]
      .map(s=>`<div class="stat"><b>${s[1]}</b><span>${s[0]}</span></div>`).join('');
    { const {c,w,h} = prepCanvas($('pTrace')); const t1 = t, t0 = t-8000, X = tt=>(tt-t0)/8000*w, Y = cc=>h/2 - cc/50*(h/2-6);
      c.fillStyle = cssv('--brass-soft'); c.fillRect(0, Y(10), w, Y(-10)-Y(10)); c.fillStyle = cssv('--line'); c.fillRect(0,h/2,w,1);
      c.strokeStyle = cssv('--breath'); c.lineWidth = 2; c.beginPath(); let prev = null;
      trace.forEach(f=>{ if(f.cents==null){ prev=null; return; } const x = X(f.t), y = Y(clamp(f.cents,-50,50)); if(!prev || prev.midi!==f.midi) c.moveTo(x,y); else c.lineTo(x,y); prev = f; }); c.stroke();
      c.fillStyle = cssv('--ink'); c.font = '12px '+cssv('--sans'); let lastM = null, lastX = -99;
      trace.forEach(f=>{ if(f.midi!=null && f.midi!==lastM){ const x = X(f.t); if(x-lastX>26){ c.fillText(pcName(f.midi-Settings.offset), x+2, 14); lastX = x; } } lastM = f.midi; }); }
    if(Audio.an){ const {c,w,h} = prepCanvas($('spec')); Audio.an.getFloatFrequencyData(Audio.fbuf); const bin = AC.sampleRate/Audio.an.fftSize;
      c.fillStyle = cssv('--breath'); for(let x=0;x<w;x+=2){ const f = 50*Math.pow(160, x/w), i = Math.round(f/bin), db = Audio.fbuf[i]||-140; const hh = clamp((db+110)/90,0,1)*h; c.fillRect(x, h-hh, 2, hh); } }
  });
  UI.cleanup = ()=>{ off(); stopLoop(); };
}

// ---------- Метроном ----------
function viewMetro(v){
  const st = Object.assign({bpm:80, beats:4, sub:1}, LS.get('metro', {}));
  v.innerHTML = `<h2 class="title">Метроном</h2><p class="sub">Окремий метроном для розминки і вивчення нових мелодій.</p>
    <div class="panel"><div class="row">
      <label>Темп <input type="number" id="mBpm" min="30" max="260" value="${st.bpm}"></label>
      <label>Розмір <select id="mBeats">${[2,3,4,5,6,7].map(b=>`<option ${b===st.beats?'selected':''}>${b}</option>`).join('')}</select>/4</label>
      <label>Поділ <select id="mSub"><option value="1">четвертні</option><option value="2">восьмі</option><option value="3">тріолі</option><option value="4">шістнадцяті</option></select></label>
      <button class="primary" id="mGo">Старт</button><button id="mTap">Тап-темп</button></div>
      <div class="big" id="mBeat" style="margin-top:18px">·</div></div>`;
  $('mSub').value = st.sub;
  let timer = null, next = 0, k = 0, taps = [];
  const save = () => { st.bpm = clamp(+$('mBpm').value||80,30,260); st.beats = +$('mBeats').value; st.sub = +$('mSub').value; LS.set('metro', st); };
  const stopM = () => { clearInterval(timer); timer = null; $('mGo').textContent = 'Старт'; $('mBeat').textContent = '·'; };
  $('mGo').onclick = () => { if(timer){ stopM(); return; } save(); const a = ac(); next = a.currentTime + 0.1; k = 0; $('mGo').textContent = 'Стоп';
    timer = setInterval(()=>{ while(next < a.currentTime + 0.12){ const step = 60/st.bpm/st.sub, beat = Math.floor(k/st.sub) % st.beats, isBeat = k % st.sub === 0;
        if(isBeat) click(next, beat===0); else { const o = a.createOscillator(), g = a.createGain(); o.frequency.value = 800; g.gain.setValueAtTime(0.08*Settings.metroVol, next); g.gain.exponentialRampToValueAtTime(0.0001, next+0.03); o.connect(g).connect(bus()); o.start(next); o.stop(next+0.04); }
        if(isBeat){ const b = beat+1, when = (next - a.currentTime)*1000; setTimeout(()=>{ if(timer) $('mBeat').textContent = b; }, when); }
        next += step; k++; } }, 25); };
  ['mBpm','mBeats','mSub'].forEach(id=>$(id).onchange = save);
  $('mTap').onclick = () => { const t = now(); taps = taps.filter(x=>t-x<3000); taps.push(t); if(taps.length>=3){ const d = mean(taps.slice(1).map((x,i)=>x-taps[i])); $('mBpm').value = Math.round(60000/d); save(); } };
  UI.cleanup = stopM;
}

// ---------- Мій репертуар (MIDI-файли і ручний ввід) ----------
function midiTrackToBeats(t, div){ return { name:t.name, kind:guessKind(t.name, t.program, t.drums),
  notes:t.notes.map(x=>[x.n, +(x.s/div).toFixed(3), +Math.max(0.05,(x.e-x.s)/div).toFixed(3), +(x.v ?? 0.8).toFixed(2)]) }; }
const LEAD_RX = /sax|solo|melody|lead|vocal|voice|trumpet|flute|clarinet|ewi|сакс|мелод|вокал|соло/i;
function readMidiFile(buf){
  const d = new DataView(buf); let p = 0;
  const str = n => { let s=''; for(let i=0;i<n;i++) s += String.fromCharCode(d.getUint8(p+i)); p += n; return s; };
  const u32 = () => { const v = d.getUint32(p); p += 4; return v; }, u16 = () => { const v = d.getUint16(p); p += 2; return v; };
  const vlq = () => { let v = 0, b; do { b = d.getUint8(p++); v = (v<<7)|(b&0x7f); } while(b&0x80); return v; };
  if(str(4)!=='MThd') throw new Error('Це не MIDI-файл');
  const hl = u32(); u16(); const nt = u16(), div = u16(); p += hl-6;
  if(div & 0x8000) throw new Error('SMPTE-час не підтримується');
  const tracks = []; let tempo = 500000, tsig = 4;
  for(let k=0;k<nt;k++){
    if(str(4)!=='MTrk') break; const len = u32(), end = p+len; let t = 0, run = 0; const on = {}, notes = [], drums = [], don = {}; let name = '', program = null;
    while(p<end){ t += vlq(); let st = d.getUint8(p);
      if(st===0xFF){ p++; const type = d.getUint8(p++), l = vlq(); if(type===0x51 && tempo===500000) tempo = (d.getUint8(p)<<16)|(d.getUint8(p+1)<<8)|d.getUint8(p+2);
        if(type===0x58 && tsig===4) tsig = d.getUint8(p) || 4; if(type===0x03) name = str(l); else p += l; continue; }
      if(st===0xF0||st===0xF7){ p++; p += vlq(); continue; }
      if(st & 0x80){ run = st; p++; } else st = run;
      const type = st & 0xf0, ch = st & 15;
      if(type===0xC0){ const pr = d.getUint8(p++); if(program==null && ch!==9) program = pr; continue; }
      if(type===0xD0){ p++; continue; }
      const a = d.getUint8(p++), b = d.getUint8(p++);
      const O = ch===9 ? don : on, L = ch===9 ? drums : notes;
      if(type===0x90 && b>0) O[a] = [t, b];
      else if(type===0x80 || (type===0x90 && b===0)){ if(O[a]){ L.push({n:a, s:O[a][0], e:t, v:O[a][1]/127}); delete O[a]; } }
    }
    p = end; const nm = name || 'Доріжка '+(k+1);
    if(notes.length) tracks.push({name:nm, program, notes:notes.sort((x,y)=>x.s-y.s||y.n-x.n)});
    if(drums.length) tracks.push({name: notes.length ? nm+' (ударні)' : nm, drums:true, notes:drums.sort((x,y)=>x.s-y.s)});
  }
  return { tracks, div, tsig, bpm: Math.round(60000000/tempo) };
}
function midiToSeq(track, div, q, fromZero){
  const mono = []; track.notes.forEach(nn=>{ const last = mono[mono.length-1]; if(last && nn.s===last.s) return; if(last && nn.s < last.e) last.e = nn.s; mono.push({...nn}); });
  // зсув октави в зручний діапазон EWI
  const med = mono.map(x=>x.n).sort((a,b)=>a-b)[Math.floor(mono.length/2)]; const shift = Math.round((69 - med)/12)*12;
  const Q = x => Math.round(x/div/q)*q; const out = []; let cur = fromZero ? 0 : Q(mono[0].s);
  mono.forEach((nn,i)=>{ const s = Q(nn.s), e = Math.max(s+q, Q(nn.e)); if(s > cur) out.push('r:'+(+(s-cur).toFixed(3))); if(s < cur) return;
    const nx = mono[i+1] ? Q(mono[i+1].s) : e; const dur = Math.min(e, Math.max(nx, s+q)) - s;
    out.push(nameOf(nn.n+shift).replace('♯','#').replace('♭','b')+':'+(+dur.toFixed(3))); cur = s+dur; });
  return out.join(' ');
}
let PendingTracks = [];
function viewRep(v, open){
  const songs = LS.get('songs', []);
  if(open){ const s = songs.find(x=>x.id===open); if(s){ return repPlay(v, s); } }
  v.innerHTML = `<h2 class="title">Мій репертуар</h2>
    <p class="sub">Додай мелодії, які хочеш вивчити: MIDI-файл або ручний запис нот. Кожна мелодія стає вправою з метрономом, авто-темпом і аналізом.</p>
    <div class="panel"><h3 style="margin-top:0">Імпорт MIDI або MusicXML</h3>
      <div class="row"><input type="file" id="mf" accept=".mid,.midi,.musicxml,.xml,.mxl"><label class="muted">Квантування <select id="mq"><option value="0.5">восьмі</option><option value="0.25" selected>шістнадцяті</option></select></label></div>
      <div id="mfOut"></div><p class="hint" id="mfInfo"></p>
      <h3>Ручний запис</h3>
      <p class="muted">Формат: нота:тривалість у долях. Наприклад <code>G4:1 A4:0.5 B4:0.5 r:1 C5:2</code>, де r означає паузу, # дієз, b бемоль.</p>
      <div class="row"><input type="text" id="sTitle" placeholder="Назва" style="flex:1;min-width:180px"><label class="muted">Темп <input type="number" id="sBpm" value="80"></label><label class="muted">Розмір <select id="sBeats"><option>4</option><option>3</option><option>2</option><option>6</option></select>/4</label></div>
      <textarea class="report" id="sSeq" style="min-height:90px;margin-top:8px"></textarea>
      <p class="muted" style="margin-bottom:4px">Акорди для фонограми, необов'язково. Формат: акорд:тривалість у долях, N означає без акорду. Наприклад <code>N:1 G:4 C:4 D7:4 G:4</code>. Підтримуються мажор, m, 7, m7, maj7, dim, sus4, 6, m6.</p>
      <div class="row"><input type="text" id="sCh" placeholder="G:4 C:4 D7:4 G:4" style="flex:1;min-width:220px"><label class="muted">Стиль <select id="sSt">${Object.entries(STYLES).map(([k,t])=>`<option value="${k}">${t}</option>`).join('')}</select></label></div>
      <div class="row" style="margin-top:8px"><button class="primary" id="sSave">Зберегти мелодію</button><span class="muted" id="sErr"></span></div></div>
    <h3>Мелодії</h3><div id="sList"></div>`;
  if(DESKTOP){ const info = window.ewiStore.info(); const p = document.createElement('div'); p.className = 'panel'; p.style.marginBottom = '14px';
    p.innerHTML = `<div class="row" style="justify-content:space-between"><span class="muted">Мелодії зберігаються файлами в папці <code>${esc(info.repDir)}</code>. MIDI-файл, покладений туди, з'явиться тут автоматично.</span><button id="repOpen">Відкрити папку</button></div>`;
    v.querySelector('.sub').after(p); $('repOpen').onclick = ()=>window.ewiStore.openDir('rep'); importFolderMidis(); }
  const list = () => { const ss = LS.get('songs', []); $('sList').innerHTML = ss.length ? '' : '<p class="muted">Поки порожньо.</p>';
    ss.forEach(s=>{ const r = document.createElement('div'); r.className = 'row panel'; r.style.marginBottom = '8px';
      r.innerHTML = `<b style="flex:1">${esc(s.title)}</b><span class="muted">${s.bpm} bpm · ${parseSeq(s.seq).filter(x=>x.n!=null).length} нот${s.tracks&&s.tracks.length?` · супровід: ${s.tracks.length} дор.`:''} · найкраще ${s.best??'—'}</span><button class="primary small" data-a="p">Грати</button><button class="small" data-a="d">Видалити</button>`;
      r.querySelector('[data-a=p]').onclick = ()=>go('rep', s.id);
      r.querySelector('[data-a=d]').onclick = ()=>{ if(confirm('Видалити «'+s.title+'»?')){ LS.set('songs', LS.get('songs',[]).filter(x=>x.id!==s.id)); list(); } };
      $('sList').appendChild(r); }); };
  list();
  $('mf').onchange = async e => { const f = e.target.files[0]; if(!f) return;
    try{ const m = await readScoreFile(f); if(!m.tracks.length) throw new Error('У файлі немає нот');
      const cand = m.tracks.map((t,i)=>i).filter(i=>!m.tracks[i].drums);
      let lead = cand.find(i=>LEAD_RX.test(m.tracks[i].name)); if(lead==null) lead = cand.reduce((bi,i)=>m.tracks[i].notes.length>m.tracks[bi].notes.length?i:bi, cand[0]);
      $('mfOut').innerHTML = `<table class="fing" style="margin-top:10px"><tr><th>Моя партія</th><th>Супровід</th><th>Доріжка</th><th>Нот</th></tr>
        ${m.tracks.map((t,i)=>`<tr><td>${t.drums?'':`<input type="radio" name="mlead" value="${i}" ${i===lead?'checked':''}>`}</td><td><input type="checkbox" data-acc="${i}" ${i!==lead?'checked':''}></td><td>${esc(t.name)} <span class="muted">· ${KIND_LABEL[guessKind(t.name, t.program, t.drums)]}</span></td><td>${t.notes.length}</td></tr>`).join('')}</table>
        <p class="muted">Моя партія стане нотами для навчання. Позначені доріжки супроводу збережуться разом з мелодією і гратимуть з тобою; кожну можна вимкнути під час гри.</p>
        <div class="row"><button id="mUse" class="primary">Перенести в редактор</button></div>`;
      $('mfOut').querySelectorAll('[name=mlead]').forEach(r=>r.onchange = ()=>{ $('mfOut').querySelectorAll('[data-acc]').forEach(c=>{ if(+c.dataset.acc===+r.value) c.checked = false; }); });
      $('mUse').onclick = ()=>{ const li = +$('mfOut').querySelector('[name=mlead]:checked').value;
        const acc = [...$('mfOut').querySelectorAll('[data-acc]:checked')].map(c=>+c.dataset.acc).filter(i=>i!==li);
        PendingTracks = acc.map(i=>midiTrackToBeats(m.tracks[i], m.div));
        $('sSeq').value = midiToSeq(m.tracks[li], m.div, +$('mq').value, PendingTracks.length>0); $('sBpm').value = m.bpm; $('sTitle').value = f.name.replace(/\.(midi?|musicxml|xml|mxl)$/i,'');
        if([2,3,4,6].includes(m.tsig)) $('sBeats').value = String(m.tsig);
        const seqTotal = parseSeq($('sSeq').value).reduce((x,y)=>x+y.d,0);
        const ch = m.chords || (PendingTracks.length ? detectChords(PendingTracks, seqTotal, m.tsig||4) : null);
        if(ch && !$('sCh').value.trim()){ $('sCh').value = ch; }
        $('mfInfo').textContent = (PendingTracks.length ? `Разом з мелодією збережеться супровід: ${PendingTracks.map(t=>t.name).join(', ')}. ` : '') + ($('sCh').value.trim() ? (m.chords ? 'Акорди взято з партитури.' : 'Акорди визначено автоматично з доріжок, їх можна поправити.') : ''); };
    }catch(err){ $('mfOut').innerHTML = `<p class="hint bad">${esc(err.message)}</p>`; } };
  $('sSave').onclick = () => { const seq = $('sSeq').value.trim(), items = parseSeq(seq);
    if(!items.length || items.some(i=>i.s!=='r' && i.n==null) || items.some(i=>!(i.d>0))){ $('sErr').textContent = 'Перевір запис: кожна нота має бути у форматі G4:1.'; return; }
    const ss = LS.get('songs', []); const ch = $('sCh').value.trim(); if(ch && parseChords(ch).some(c=>c.bad || !(c.beats>0))){ $('sErr').textContent = 'Перевір акорди: формат G:4 Am:2 D7:2.'; return; }
    ss.unshift({id:'s'+Date.now(), title:$('sTitle').value.trim()||'Без назви', seq, bpm:+$('sBpm').value||80, beats:+$('sBeats').value, chords:ch||null, style:$('sSt').value, tracks:PendingTracks.length?PendingTracks:undefined}); LS.set('songs', ss); $('sCh').value=''; PendingTracks = []; $('mfInfo').textContent='';
    $('sSeq').value=''; $('sTitle').value=''; $('sErr').textContent=''; list(); };
}
function importFolderMidis(){
  if(!DESKTOP) return 0; let added = 0; const ss = LS.get('songs', []);
  for(const f of window.ewiStore.newMidis()){
    try{ const bin = Uint8Array.from(atob(f.data), ch=>ch.charCodeAt(0)); const m = readMidiFile(bin.buffer); if(!m.tracks.length) continue;
      const tr = m.tracks.reduce((b,t)=>t.notes.length>b.notes.length?t:b, m.tracks[0]);
      ss.unshift({id:'s'+Date.now()+added, title:f.name.replace(/\.midi?$/i,''), seq:midiToSeq(tr, m.div, 0.25), bpm:m.bpm, beats:4, chords:null, style:'pop', source:f.name, created:Date.now()}); added++;
    }catch(e){}
  }
  if(added){ LS.set('songs', ss); toast(`Додано з папки: ${added} MIDI`); }
  return added;
}
// ---------- Записи ----------
function viewTakes(v){
  const render = () => {
    v.innerHTML = `<h2 class="title">Записи</h2><p class="sub">Дублі з мікрофона разом із супроводом, що грав у цей момент: фонограма, доріжки, мінусовка. Кнопка «Запис» угорі працює в будь-якому розділі. Записи живуть до закриття застосунку, тож потрібні збережи в MP3.</p><div id="tl"></div>`;
    if(!Takes.length){ $('tl').innerHTML = '<p class="muted">Записів ще немає.</p>'; return; }
    Takes.forEach((t,i)=>{ const s = t.stats; const d = document.createElement('div'); d.className = 'panel'; d.style.marginBottom = '10px';
      d.innerHTML = `<div class="row" style="justify-content:space-between"><b>${esc(t.label)}</b><span class="muted">${t.at.toLocaleTimeString('uk-UA')} · ${t.dur.toFixed(0)} с</span></div>
        <audio controls src="${t.url}" style="width:100%;margin:8px 0"></audio>
        ${s?`<div class="stats">${[['нот', s.notes], ['діапазон', s.range||'—'], ['динамічний діапазон', s.dynRange.toFixed(0)+' дБ'], ['середнє відхилення строю', s.intonation.toFixed(0)+' ц'], ['яскравість', Math.round(s.bright)+' Гц']].map(x=>`<div class="stat"><b>${esc(x[1])}</b><span>${x[0]}</span></div>`).join('')}</div>`:'<p class="muted">Звуку з висотою не знайдено.</p>'}
        <div class="row" style="margin-top:8px"><button class="primary small" data-mp3="${i}">Зберегти MP3</button><a href="${t.url}" download="ewi-${i+1}.webm">Зберегти WebM</a></div>`;
      d.querySelector('[data-mp3]').onclick = async e=>{ const b = e.target; b.disabled = true; b.textContent = 'Кодую MP3…';
        try{ const blob = await toMp3(t.url); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${t.label.replace(/[<>:"/\\|?*·]/g,'').trim().slice(0,60) || 'ewi'} ${t.at.toISOString().slice(0,16).replace(/[T:]/g,'-')}.mp3`; a.click(); b.textContent = 'Збережено'; }
        catch(err){ b.textContent = 'Не вдалося'; toast('MP3: '+err.message); } b.disabled = false; };
      $('tl').appendChild(d); });
  };
  render(); const off = Hub.on(type=>{ if(type==='takes') render(); }); UI.cleanup = off;
}

// ---------- Прогрес ----------
function viewStats(v){
  const days = []; for(let i=6;i>=0;i--){ const d = new Date(); d.setDate(d.getDate()-i); const k = d.toISOString().slice(0,10); days.push([d.toLocaleDateString('uk-UA',{weekday:'short'}), Progress.days[k]||0]); }
  const maxM = Math.max(10, ...days.map(d=>d[1])), total = Object.values(Progress.days).reduce((a,b)=>a+b,0);
  const weak = Object.entries(Progress.wrong).sort((a,b)=>b[1]-a[1]).slice(0,8);
  v.innerHTML = `<h2 class="title">Прогрес</h2>
    <div class="stats" style="margin-bottom:18px">${[['сьогодні, хв', Math.round(Progress.days[today()]||0)], ['усього, год', (total/60).toFixed(1)], ['днів поспіль від 5 хв', streak()], ['уроків пройдено', LESSONS.filter(lessonDone).length+'/'+LESSONS.length]].map(s=>`<div class="stat"><b>${s[1]}</b><span>${s[0]}</span></div>`).join('')}</div>
    <h3>Останні 7 днів</h3><div class="row" style="align-items:flex-end;height:120px;gap:14px">${days.map(d=>`<div style="text-align:center;flex:1;max-width:60px"><div style="background:var(--brass);height:${Math.max(2,d[1]/maxM*90)}px;border-radius:4px 4px 0 0"></div><div class="muted">${esc(d[0])}</div><div class="muted">${Math.round(d[1])}</div></div>`).join('')}</div>
    <h3>Рівні</h3>${LEVELS.map(L=>{ const ls = LESSONS.filter(l=>l.lvl===L.n), d = ls.filter(lessonDone).length; return `<div>${L.n}. ${esc(L.title)} <span class="muted">${d}/${ls.length}</span><div class="progressbar"><i style="width:${d/ls.length*100}%"></i></div></div>`; }).join('')}
    <h3>Ноти, на яких найчастіше помилки</h3>${weak.length?`<table><tr><th>Нота з клавішами</th><th>Помилок</th></tr>${weak.map(([k,c])=>`<tr><td>${esc(withKeys(parseNote(k.replace('♯','#').replace('♭','b')).midi))} <span class="muted">${esc(k)}</span></td><td>${c}</td></tr>`).join('')}</table>`:'<p class="muted">Поки немає даних.</p>'}
    <h3>Журнал занять</h3><div class="row"><textarea class="report" id="jT" style="min-height:56px;flex:1" placeholder="Що сьогодні вийшло, що заважало, що помітив у звуці…"></textarea><button id="jS">Зберегти</button></div>
    <div id="jL">${(Progress.journal||[]).slice(0,10).map(j=>`<p class="muted" style="margin:6px 0"><b>${new Date(j.at).toLocaleDateString('uk-UA')}</b> ${esc(j.text)}</p>`).join('') || '<p class="muted">Записів поки немає. Нотатки бачить вчитель у звіті.</p>'}</div>
    <h3>Досягнення</h3>${badgesHTML()}
    <h3>Звіт для розбору</h3><p class="muted">Цей звіт бачить вчитель. Його можна й скопіювати в будь-який чат.</p>
    <textarea class="report" id="rep" readonly></textarea><div class="row" style="margin-top:8px"><button id="cp">Скопіювати звіт</button></div>`;
  $('rep').value = buildReport();
  $('jS').onclick = () => { const tx = $('jT').value.trim(); if(!tx) return; journalAdd(tx); go('stats'); };
  $('cp').onclick = async()=>{ try{ await navigator.clipboard.writeText($('rep').value); }catch(e){ $('rep').select(); document.execCommand('copy'); } $('cp').textContent = 'Скопійовано'; setTimeout(()=>$('cp').textContent='Скопіювати звіт',1500); };
}

// ---------- Налаштування ----------
function viewSettings(v){
  const L = Settings.labels;
  v.innerHTML = `<h2 class="title">Налаштування</h2>
  ${DESKTOP?`<div class="panel" style="margin-bottom:14px"><h3 style="margin-top:0">Застосунок</h3>
    <p class="muted" style="margin:0 0 8px">Версія ${esc(window.ewiStore.info().version)}. Прогрес, налаштування і «Мій репертуар» зберігаються в папці <code id="dDir">${esc(window.ewiStore.info().dataDir)}</code>. Оновлення цієї папки не торкаються, а щодня робиться резервна копія прогресу.</p>
    <div class="row"><button id="dOpen">Відкрити папку даних</button><button id="dBak">Резервні копії</button><button id="dMove">Змінити папку</button><button id="dUpd">Перевірити оновлення</button><span class="muted" id="dUpdT">${esc(UpdateState.text||'')}</span></div>
    <div class="row" style="margin-top:10px"><label class="muted"><input type="checkbox" id="dRem" ${window.ewiStore.getConfig().remind?'checked':''}> нагадувати про практику о</label><input type="time" id="dRemT" value="${esc(window.ewiStore.getConfig().remindAt||'19:00')}">
      <label class="muted"><input type="checkbox" id="dAuto" ${window.ewiStore.getConfig().autostart?'checked':''}> запускати разом з Windows (згорнутим)</label></div>
    <div class="row" style="margin-top:10px"><label class="muted">Шлях до Claude Code <input type="text" id="dCl" placeholder="claude" value="${esc(window.ewiStore.getConfig().claudePath||'')}" style="width:280px"></label><span class="muted">Залиш порожнім, якщо команда claude працює в терміналі.</span></div></div>`:''}
  <div class="panel"><h3 style="margin-top:0">Вхід</h3>
    <div class="row"><label>Джерело нот <select id="sSrc"><option value="auto">автоматично</option><option value="midi">тільки MIDI</option><option value="audio">тільки мікрофон</option></select></label>
    <label><input type="checkbox" id="sAny"> зараховувати будь-яку октаву</label></div>
    <div class="row" style="margin-top:10px"><button id="sCal">Калібрувати октаву</button><span class="muted" id="sCalT">Зсув: ${Settings.offset} півтонів</span></div>
    <h3>Затримка</h3><p class="muted">Компенсує час між звуком і реакцією застосунку. «Виміряти» дає 8 клацань: грай коротку ноту точно на кожне.</p>
    <div class="row"><label>MIDI, мс <input type="number" id="sLm" value="${Settings.latMidi}"></label><label>Мікрофон, мс <input type="number" id="sLa" value="${Settings.latAudio}"></label><button id="sLat">Виміряти</button><span class="muted" id="sLatT"></span></div>
    <h3>Дихання</h3><div class="row"><button id="sBC">Калібрувати дихання</button><span class="muted" id="sBCT">${Settings.breathCal ? `Тихо ${Settings.breathCal.soft}, звичайно ${Settings.breathCal.mid}, гучно ${Settings.breathCal.loud}.` : 'Не калібровано: використовуються типові значення.'}</span></div><div id="sBCbox"></div>
    <h3>Вигляд нот</h3><div class="row"><label class="muted">За замовчуванням <select id="sView">${Object.entries(VIEW_NAMES).map(([k,t])=>`<option value="${k}" ${k===(Settings.view||'staff')?'selected':''}>${t}</option>`).join('')}</select></label><span class="muted">Перемикається й прямо над нотами у вправах.</span></div>
    <h3>Відлік перед грою</h3><div class="row"><label class="muted">Рахунок метронома перед вступом, щонайменше <input type="number" id="sCnt" min="0" max="20" value="${Settings.countInSec ?? 5}" style="width:60px"> с</label><span class="muted">0 означає один такт.</span></div>
    <h3>Вивід звуку</h3><div class="row"><label class="muted">Пристрій <select id="sOut"><option value="">Типовий пристрій Windows</option></select></label><button id="sTest">Перевірити звук</button><span class="muted" id="sTestT"></span></div>
    <h3>Звук і аналіз</h3>
    <div class="row"><label>Камертон A4, Гц <input type="number" id="sA4" value="${Settings.a4}"></label><label>Діапазон pitch bend, півтонів <input type="number" id="sBr" value="${Settings.bendRange}"></label><label>Поріг тиші, дБ <input type="number" id="sGate" value="${Settings.gate}"></label><label>Гучність метронома <input type="number" id="sMv" step="0.1" min="0" max="1" value="${Settings.metroVol}"></label></div>
    <div class="row" style="margin-top:8px"><label><input type="checkbox" id="sGuide"> звук-підказка у вправах за замовчуванням</label><label class="muted" style="margin-left:14px"><input type="checkbox" id="sRecMix" ${Settings.recMix!==false?'checked':''}> записувати разом із супроводом</label></div></div>
  <div class="panel" style="margin-top:14px"><h3 style="margin-top:0">Назви клавіш</h3><p class="muted">Підпиши клавіші так, як тобі звично. Усі уроки і підказки одразу підхоплять нові назви.</p>
    <div class="row">${Object.keys(DEFAULT_SETTINGS.labels).map(k=>`<label class="muted">${({L1:'ліва, вказівний',L2:'ліва, середній',L3:'ліва, безіменний',R1:'права, вказівний',R2:'права, середній',R3:'права, безіменний',GS:'лівий мізинець',EB:'правий мізинець, E♭',LC:'правий мізинець, C'})[k]} <input type="text" data-k="${k}" value="${esc(L[k])}" style="width:60px"></label>`).join('')}</div></div>
  <div class="panel" style="margin-top:14px"><h3 style="margin-top:0">Дані</h3>
    <label class="muted" style="display:block;margin:8px 0"><input type="checkbox" id="sReal" ${Settings.realistic?'checked':''}> реалістичні інструменти (семпли фортепіано, баса, струнних і саксофона)</label><span class="muted" style="display:block;font-size:12px">Семпли: Fluid R3 GM SoundFont (Frank Wen), ліцензія CC BY 3.0, у підготовці проєкту midi-js-soundfonts. Кодер MP3: lamejs (LGPL).</span><label class="muted" style="display:block;margin:8px 0"><input type="checkbox" id="sUnl" ${Settings.unlockAll?'checked':''}> відкрити всі мелодії без проходження уроків</label>
    <div class="row"><button id="sReset">Скинути прогрес</button><button id="sExp">Експорт прогресу</button><label class="muted">Імпорт <input type="file" id="sImp" accept=".json"></label></div></div>`;
  $('sSrc').value = Settings.noteSource; $('sAny').checked = Settings.anyOct; $('sGuide').checked = Settings.guide;
  const num = (id,key)=>$(id).onchange = ()=>{ Settings[key] = +$(id).value; saveSettings(); };
  num('sLm','latMidi'); num('sLa','latAudio'); num('sA4','a4'); num('sBr','bendRange'); num('sGate','gate'); num('sMv','metroVol');
  $('sSrc').onchange = ()=>{ Settings.noteSource = $('sSrc').value; saveSettings(); };
  $('sAny').onchange = ()=>{ Settings.anyOct = $('sAny').checked; saveSettings(); };
  $('sGuide').onchange = ()=>{ Settings.guide = $('sGuide').checked; saveSettings(); };
  v.querySelectorAll('[data-k]').forEach(i=>i.onchange = ()=>{ Settings.labels[i.dataset.k] = i.value.trim() || DEFAULT_SETTINGS.labels[i.dataset.k]; saveSettings(); });
  let off = null;
  $('sCal').onclick = ()=>{ $('sCalT').textContent = 'Зіграй '+withKeys(67)+' з основної позиції…'; if(off) off();
    off = Hub.on((type,d)=>{ if(type==='on'){ Settings.offset = d.n - 67; saveSettings(); $('sCalT').textContent = `Готово. Зсув: ${Settings.offset} півтонів.`; off(); off = null; } }); };
  $('sLat').onclick = ()=>{ const bpm = 80, run = schedule({bpm, beats:4, countIn:1, totalBeats:8}), ons = []; $('sLatT').textContent = 'Слухай рахунок і грай на кожне клацання…';
    if(off) off(); off = Hub.on((type,d)=>{ if(type==='on') ons.push(d); });
    setTimeout(()=>{ off(); off = null; const errs = [];
      for(let b=0;b<8;b++){ const tb = run.t0Perf + b*run.spbMs; const o = ons.reduce((best,x)=>Math.abs(x.t-tb)<Math.abs((best?.t??1e12)-tb)?x:best, null); if(o && Math.abs(o.t-tb)<run.spbMs/2) errs.push({e:o.t-tb, src:o.src}); }
      if(errs.length<5){ $('sLatT').textContent = 'Замало нот для виміру, спробуй ще раз.'; return; }
      const med = errs.map(x=>x.e).sort((a,b)=>a-b)[Math.floor(errs.length/2)], audio = errs.filter(x=>x.src==='audio').length > errs.length/2;
      const key = audio?'latAudio':'latMidi'; Settings[key] = Math.round(Settings[key] + med); saveSettings();
      $(audio?'sLa':'sLm').value = Settings[key]; $('sLatT').textContent = `Середнє відхилення ${Math.round(med)} мс. Нова затримка ${audio?'мікрофона':'MIDI'}: ${Settings[key]} мс.`;
    }, run.endPerf - now() + 600); };
  if(DESKTOP){ $('dOpen').onclick = ()=>window.ewiStore.openDir('data'); $('dBak').onclick = ()=>window.ewiStore.openDir('backup');
    $('dMove').onclick = async ()=>{ const p = await window.ewiStore.chooseDir(); if(p){ toast('Дані скопійовано. Нова папка: '+p); go('settings'); } };
    $('dUpd').onclick = ()=>{ $('dUpdT').textContent = 'Перевіряю…'; window.ewiStore.checkUpdate(); }; }
  if(DESKTOP){ const sc = () => window.ewiStore.setConfig({remind:$('dRem').checked, remindAt:$('dRemT').value, autostart:$('dAuto').checked, claudePath:$('dCl').value.trim()});
    ['dRem','dRemT','dAuto','dCl'].forEach(id=>$(id).onchange = sc); }
  if($('sRecMix')) $('sRecMix').onchange = e=>{ Settings.recMix = e.target.checked; saveSettings(); };
  $('sReal').onchange = e=>{ Settings.realistic = e.target.checked; saveSettings(); };
  audioOutputs().then(ds=>{ const sel = $('sOut'); if(!sel) return; ds.filter(d=>d.deviceId && d.deviceId!=='default').forEach(d=>{ const o = document.createElement('option'); o.value = d.deviceId; o.textContent = d.label || 'Пристрій '+d.deviceId.slice(0,6); sel.appendChild(o); }); sel.value = Settings.sinkId || ''; });
  $('sOut').onchange = async e=>{ const ok = await setOutput(e.target.value); $('sTestT').textContent = ok ? 'Пристрій змінено. Натисни «Перевірити звук».' : 'Не вдалося перемкнути пристрій.'; };
  $('sTest').onclick = async ()=>{ $('sTestT').textContent = 'Граю три ноти…'; const r = await soundTest();
    $('sTestT').textContent = r.peak > 0.01 ? `Застосунок відтворює звук (рівень ${r.peak}, ${r.rate} Гц, затримка ${r.latency} мс, вивід: ${r.sink}). Якщо не чути, вибери інший пристрій вище або перевір мікшер гучності Windows.` : `Звуку немає всередині застосунку: стан аудіо «${r.state}». Перезапусти застосунок і повідом про це.`; };
  $('sBC').onclick = () => breathCalibration($('sBCbox'), c=>{ $('sBCT').textContent = `Тихо ${c.soft}, звичайно ${c.mid}, гучно ${c.loud}.`; });
  $('sView').onchange = e=>{ Settings.view = e.target.value; saveSettings(); };
  $('sCnt').onchange = e=>{ Settings.countInSec = clamp(+e.target.value||0, 0, 20); saveSettings(); };
  $('sUnl').onchange = e=>{ Settings.unlockAll = e.target.checked; saveSettings(); };
  $('sReset').onclick = ()=>{ if(confirm('Скинути весь прогрес уроків і статистику?')){ Progress.lessons = {}; Progress.days = {}; Progress.wrong = {}; Progress.log = []; saveProgress(); go('settings'); } };
  $('sExp').onclick = ()=>{ const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({progress:Progress, settings:Settings, songs:LS.get('songs',[])}, null, 1)], {type:'application/json'})); a.download = 'ewi-progress.json'; a.click(); };
  $('sImp').onchange = async e=>{ try{ const j = JSON.parse(await e.target.files[0].text()); if(j.progress){ Object.assign(Progress, j.progress); saveProgress(); } if(j.settings){ Object.assign(Settings, j.settings); saveSettings(); } if(j.songs) LS.set('songs', j.songs); alert('Імпортовано.'); go('settings'); }catch(err){ alert('Не вдалося прочитати файл.'); } };
  UI.cleanup = ()=>{ if(off) off(); };
}

// ---------- Старт ----------
shell(); initMidi(); go('program');

// ---------- Сповіщення і оновлення ----------
function toast(msg, actions){ let t = document.getElementById('toast'); if(!t){ t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.innerHTML = `<span>${esc(msg)}</span>`; (actions||[]).forEach(([label, fn])=>{ const b = document.createElement('button'); b.className = 'primary small'; b.textContent = label; b.onclick = ()=>{ t.hidden = true; fn(); }; t.appendChild(b); });
  const x = document.createElement('button'); x.className = 'small'; x.textContent = '×'; x.onclick = ()=>t.hidden = true; t.appendChild(x);
  t.hidden = false; clearTimeout(t._h); if(!actions) t._h = setTimeout(()=>t.hidden = true, 5000); }
const UpdateState = {text:''};
if(DESKTOP){
  window.ewiStore.onUpdate(d=>{
    const T = {checking:'Перевіряю оновлення…', none:'У тебе остання версія.', dev:'Оновлення працюють лише у встановленій версії.',
      available:`Знайдено версію ${d.version}, завантажую…`, progress:`Завантаження оновлення: ${d.percent}%`, ready:`Версія ${d.version} готова до встановлення.`, error:'Не вдалося перевірити оновлення: '+(d.message||'')};
    UpdateState.text = T[d.state]||''; const el = document.getElementById('dUpdT'); if(el) el.textContent = UpdateState.text;
    if(d.state==='ready') toast(`Оновлення до версії ${d.version} завантажено. Прогрес і репертуар збережуться.`, [['Перезапустити й оновити', ()=>window.ewiStore.installUpdate()]]);
  });
  window.ewiStore.onSaved(p=>toast('Збережено: '+p));
}

if(DESKTOP && window.ewiStore.reportPractice){ const rp = () => window.ewiStore.reportPractice(Math.round(Progress.days[today()]||0)); rp(); setInterval(rp, 60000); }
setTimeout(()=>{ try{ checkBadges(); }catch(e){} }, 2000);

function journalAdd(text){ Progress.journal = Progress.journal || []; Progress.journal.unshift({at:Date.now(), text:text.slice(0,500)}); Progress.journal = Progress.journal.slice(0,200); saveProgress(); }
