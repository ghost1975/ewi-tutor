// ---------- Вчитель на Claude ----------
// Настільна версія викликає встановлений Claude Code (claude -p), який працює через твою підписку.
// Браузерна версія копіює запит і відкриває Claude.ai.
function buildReport(){
  const days = []; for(let i=6;i>=0;i--){ const d = new Date(); d.setDate(d.getDate()-i); days.push(Progress.days[d.toISOString().slice(0,10)]||0); }
  const weak = Object.entries(Progress.wrong||{}).sort((a,b)=>b[1]-a[1]).slice(0,8), nl = nextLesson(), rd = (Progress.reading||[])[0];
  const heat = Object.entries(Progress.heat||{}).map(([k,h])=>{ const bad = Object.entries(h).filter(([,v])=>v[0] < 0.6).map(([b])=>+b+1); return bad.length ? `${k}: слабкі такти ${bad.slice(0,6).join(', ')}` : ''; }).filter(Boolean);
  return [`Звіт EWI-репетитора, ${new Date().toLocaleDateString('uk-UA')}`,
    `Практика: сьогодні ${Math.round(Progress.days[today()]||0)} хв, за 7 днів ${Math.round(days.reduce((a,b)=>a+b,0))} хв, серія ${streak()} дн., усього ${(totalMin()/60).toFixed(1)} год.`,
    `Пройдено уроків: ${LESSONS.filter(lessonDone).length}/${LESSONS.length}. Наступний: ${nl ? nl.id+' '+nl.title : '—'}.`,
    weak.length ? 'Найчастіші помилки: '+weak.map(([k,c])=>`${withKeys(parseNote(k.replace('♯','#').replace('♭','b')).midi)} ×${c}`).join('; ')+'.' : '',
    rd ? `Читання нот: ${rd.avg} с на ноту, точність ${rd.acc}%.` : '',
    heat.length ? 'Карта тактів: '+heat.join('; ')+'.' : '',
    (Progress.journal||[]).length ? 'Нотатки учня: '+(Progress.journal||[]).slice(0,5).map(j=>`${new Date(j.at).toLocaleDateString('uk-UA')}: ${j.text}`).join(' | ') : '',
    (()=>{ const tr = typeof transStats==='function' ? transStats(5).filter(r=>r.rate>0.1).slice(0,5) : []; return tr.length ? 'Переходи з проміжними нотами: '+tr.map(r=>`${pcName(r.a)}→${pcName(r.b)} ${Math.round(r.rate*100)}%`).join(', ')+'.' : ''; })(),
    'Останні спроби:', ...(Progress.log||[]).slice(0,25).map(r=>`  ${new Date(r.at).toLocaleString('uk-UA',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})} · ${r.lesson} ${r.ex}: ${r.score}${r.bpm?' на '+r.bpm+' bpm':''}`)].filter(Boolean).join('\n');
}
function teacherContext(){ const L = Settings.labels;
  return `Ти досвідчений викладач саксофона й електронного духового інструмента Akai EWI Solo. Учень — дорослий, займається самостійно за застосунком «Репетитор EWI». Відповідай українською, коротко, конкретно, доброзичливо, без води.
Аплікатура стандартна для EWI (як у саксофона), октави перемикаються роликами під великим пальцем лівої руки. Назви клавіш у застосунку: ${L.L1}, ${L.L2}, ${L.L3} — ліва рука (вказівний, середній, безіменний), ${L.R1}, ${L.R2}, ${L.R3} — права рука, ${L.GS} — лівий мізинець, ${L.EB} і ${L.LC} — правий мізинець.
Коли згадуєш ноту, завжди пиши її разом з клавішами у форматі «G (${L.L1} ${L.L2} ${L.L3})».
Запис нот у застосунку: нота:тривалість у долях, наприклад G4:1 A4:0.5 B4:0.5 r:1 C5:2 (r — пауза, # — дієз, b — бемоль). Акорди: G:4 Am:2 D7:2.

${buildReport()}${(()=>{ const prev = TeacherLog.get().slice(0,3); return prev.length ? '\n\nТвої попередні поради цьому учневі (від нових до старих). Звір зі звітом, що з них виконано, і скажи про це одним-двома реченнями:\n' + prev.map(x=>`— ${new Date(x.at).toLocaleDateString('uk-UA')}, «${x.q.slice(0,60)}»: ${x.a.replace(/\s+/g,' ').slice(0,500)}`).join('\n') : ''; })()}`; }

async function askClaude(prompt){
  if(DESKTOP && window.ewiStore.claudeAsk) return window.ewiStore.claudeAsk(prompt);
  try{ await navigator.clipboard.writeText(prompt); }catch(e){}
  window.open('https://claude.ai/new', '_blank');
  return {ok:false, web:true, text:'Запит скопійовано. Встав його в чат Claude, що відкрився в новій вкладці.'};
}
function mdLite(t){ return esc(t).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/^#{1,4}\s*(.+)$/gm,'<b>$1</b>').replace(/^\s*[-•]\s+/gm,'• ').split(/\n{2,}/).map(p=>`<p>${p.replace(/\n/g,'<br>')}</p>`).join(''); }
function viewTeacher(v){
  v.innerHTML = `<h2 class="title">Вчитель</h2>
    <p class="sub">${DESKTOP ? 'Вчитель працює через Claude Code, встановлений на цьому комп\'ютері, і використовує твою підписку Claude: окремий ключ API не потрібен, запити рахуються в межах лімітів підписки.' : 'У браузерній версії запит копіюється в буфер і відкривається Claude.ai. Автоматичні відповіді працюють у настільній версії через Claude Code.'}</p>
    <div class="panel" id="tStat"></div>
    <div class="panel" style="margin-top:14px"><div class="row"><button class="primary" id="tRev">Розбір мого прогресу</button><button id="tEt">Етюд під мої слабкі місця</button></div>
      <textarea class="report" id="tQ" style="min-height:70px;margin-top:10px" placeholder="Запитай вчителя: як грати legato на переході роликів, що робити з вібрато…"></textarea>
      <div class="row" style="margin-top:8px"><button id="tAsk">Запитати</button><span class="muted" id="tBusy"></span></div></div>
    <div id="tOut" style="margin-top:14px"></div><h3>Попередні відповіді</h3><div id="tHist"></div>`;
  const hist = () => { const l = TeacherLog.get(); $('tHist').innerHTML = l.length ? l.map(x=>`<details class="panel" style="margin-bottom:8px"><summary><b>${esc(x.q.slice(0,90))}</b> <span class="muted">${new Date(x.at).toLocaleString('uk-UA',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span></summary><div class="theory">${mdLite(x.a)}</div></details>`).join('') : '<p class="muted">Ще немає.</p>'; };
  hist();
  if(DESKTOP && window.ewiStore.claudeCheck){ $('tStat').innerHTML = '<span class="muted">Перевіряю Claude Code…</span>';
    window.ewiStore.claudeCheck().then(r=>{ $('tStat').innerHTML = r.ok ? `<span class="muted">Claude Code знайдено: ${esc(r.version)}. Відповідь зазвичай займає 10–60 секунд.</span>`
      : `<b>Claude Code не знайдено.</b><p class="muted" style="margin:6px 0 0">Встанови Claude Code за <a href="https://docs.claude.com/en/docs/claude-code/overview" target="_blank">інструкцією Anthropic</a>, запусти в терміналі <code>claude</code> і увійди своїм обліковим записом із підпискою. Якщо Claude Code встановлено в нестандартне місце, вкажи шлях у налаштуваннях.</p>`; }); }
  else $('tStat').innerHTML = '<span class="muted">Браузерна версія: відповідь отримаєш у вкладці Claude.ai.</span>';
  const run = async (label, prompt, after) => { $('tBusy').textContent = 'Вчитель думає…'; ['tRev','tEt','tAsk'].forEach(i=>$(i).disabled = true);
    try{ const r = await askClaude(prompt);
      if(r.web){ $('tOut').innerHTML = `<div class="panel">${esc(r.text)}</div>`; return; }
      if(!r.ok){ $('tOut').innerHTML = `<div class="panel"><b>Не вдалося отримати відповідь.</b><p class="muted">${esc(r.error||'')}</p></div>`; return; }
      const text = after ? after(r.text) : r.text; TeacherLog.add(label, text); $('tOut').innerHTML = `<div class="panel theory">${mdLite(text)}</div>`; hist(); }
    finally{ $('tBusy').textContent = ''; ['tRev','tEt','tAsk'].forEach(i=>$(i).disabled = false); } };
  $('tRev').onclick = () => { Progress.lastReview = Date.now(); saveProgress(); run('Розбір прогресу', teacherContext() + `\n\nЗроби розбір мого прогресу: що виходить добре, що гальмує, і дай конкретний план на наступні 7 днів по 20–30 хвилин на день із прив'язкою до уроків і вправ застосунку. Без загальних порад.`); };
  if(UI.autoReview){ UI.autoReview = false; setTimeout(()=>$('tRev').click(), 300); }
  $('tAsk').onclick = () => { const q = $('tQ').value.trim(); if(!q) return; run(q, teacherContext() + `\n\nПитання учня: ${q}`); };
  $('tEt').onclick = () => run('Етюд під слабкі місця', teacherContext() + `\n\nСклади ОРИГІНАЛЬНИЙ короткий етюд (8 тактів, розмір 4/4), який тренує мої слабкі ноти й переходи зі звіту. Не використовуй і не імітуй відомі мелодії. Діапазон D4–D5, темп 60–90.
Відповідай ЛИШЕ JSON без пояснень і без markdown: {"title":"…","bpm":72,"beats":4,"seq":"G4:1 …","chords":"G:4 …","style":"pop","tips":["…","…"]}.
Сума тривалостей seq має дорівнювати 32 долям, сума тривалостей chords теж 32. style: pop, folk, ballad, swing або classical.`, text => {
    try{ const j = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}')+1)), items = parseSeq(j.seq);
      if(!items.length || items.some(i=>i.s!=='r' && i.n==null)) throw new Error('ноти');
      const tot = items.reduce((a,b)=>a+b.d,0); let ch = j.chords || null;
      if(ch){ const cs = parseChords(ch); if(cs.some(c=>c.bad) || Math.abs(cs.reduce((a,c)=>a+c.beats,0) - tot) > 1e-6) ch = null; }
      const ss = LS.get('songs', []); ss.unshift({id:'s'+Date.now(), title:'Етюд: '+(j.title||'від вчителя'), seq:j.seq, bpm:clamp(+j.bpm||72,40,160), beats:+j.beats||4, chords:ch, style:STYLES[j.style]?j.style:'pop', created:Date.now()}); LS.set('songs', ss);
      return `**Етюд «${j.title}» додано в «Мій репертуар».**\n\n${(j.tips||[]).map(t=>'- '+t).join('\n')}`;
    }catch(e){ return 'Вчитель відповів, але етюд не вдалося розібрати. Спробуй ще раз.\n\n' + text; } });
}

// раз на тиждень пропонуємо розбір, якщо була практика
setTimeout(()=>{ try{
  const last = Progress.lastReview || 0, week = Object.entries(Progress.days||{}).filter(([d])=>Date.now() - new Date(d).getTime() < 7*864e5).reduce((a,[,m])=>a+m,0);
  if(Date.now() - last > 7*864e5 && week >= 30) toast(`За тиждень ${Math.round(week)} хв практики. Вчитель може зробити розбір і план на наступний тиждень.`, [['Отримати розбір', ()=>{ UI.autoReview = true; go('teacher'); }]]);
}catch(e){} }, 6000);
