// ---------- Керування вправою: зупинити, почати заново, вчити без поспіху ----------
// Обгортає кожен тип вправи: над нею з'являється панель із кнопками «Зупинити» і «Почати заново»,
// а у вправах з метрономом ще й вибір «У темпі» або «Без поспіху» (режим очікування).
(function(){
  const base = Object.assign({}, RUNNERS);
  const wrap = type => function(box, ex, ctx){
    let stop = null, inner = null, bar = null;
    const canWait = type === 'rhythm' && !ex.anyPitch && parseSeq(ex.seq).some(i=>i.n!=null);
    const modeKey = 'mode.' + (ex.key || ex.title || type);
    let mode = canWait ? LS.get(modeKey, 'tempo') : 'tempo';
    const setMode = m => { mode = m; LS.set(modeKey, m); mount(); };
    let paused = false, how = null;
    // вправи, що чекають на ноту, просто ігнорують гру під час паузи; ті, що йдуть за часом, вміють зупинитись на такті;
    // короткі вправи за часом (динаміка, вібрато, імпровізація, луна) після паузи починаються спочатку
    const SELF = ['notes','long','wait'];
    function doPause(){ if(paused || !stop) return; MinusAudio.stop();
      if(stop.pause && stop.pause()) how = 'runner'; else if(SELF.includes(type) || type === 'rhythm') how = 'hub';
      else { stop(); stop = null; how = 'restart'; }
      Hub.paused = true; paused = true; setUI(); }
    function doResume(){ if(!paused) return; Hub.paused = false; paused = false; setUI();
      if(how === 'runner' && stop && stop.resume) stop.resume(); else if(how === 'restart') mount(); }
    function setUI(){ const pb = box.querySelector('[data-a=pause]'), s = box.querySelector('.pb-state'); if(!pb) return;
      pb.textContent = paused ? '▶ Продовжити' : '⏸ Пауза'; pb.classList.toggle('primary', paused);
      s.textContent = paused ? (how === 'restart' ? 'Пауза. Ця вправа коротка, тож продовжиться спочатку.' : 'Пауза. Гра на інструменті зараз не зараховується.') : ''; }
    const hot = e => { if(e.code !== 'KeyP' || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || !document.body.contains(box)) return; e.preventDefault(); paused ? doResume() : doPause(); };
    addEventListener('keydown', hot);
    function mount(){
      if(stop){ stop(); stop = null; } Hub.paused = false; paused = false;
      box.innerHTML = `<div class="practice-bar">
        ${canWait ? `<span class="muted">Як вчити:</span><button data-m="tempo" aria-current="${mode==='tempo'}">У темпі</button><button data-m="wait" aria-current="${mode==='wait'}">Без поспіху: чекає на ноту</button>` : ''}
        <span class="pb-state muted"></span><span class="sp"></span><button data-a="pause">⏸ Пауза</button><button data-a="restart">↺ Почати заново</button></div>
        ${canWait && mode==='wait' ? '<p class="muted pb-note">Тут немає темпу: застосунок чекає, поки ти знайдеш потрібну ноту, і лише тоді грає далі. Оцінка в цьому режимі не зараховується, для заліку перемкнись на «У темпі».</p>' : ''}
        <div class="pb-inner"></div>`;
      bar = box.querySelector('.practice-bar'); inner = box.querySelector('.pb-inner');
      bar.querySelectorAll('[data-m]').forEach(b=>b.onclick = () => setMode(b.dataset.m));
      bar.querySelector('[data-a=restart]').onclick = () => { Resume.clear(Resume.key(ex)); Resume.clear((ex.key||'x') + '.wait'); mount(); };
      const pb = bar.querySelector('[data-a=pause]'), stateEl = bar.querySelector('.pb-state');
      pb.onclick = () => paused ? doResume() : doPause();
      if(canWait && mode === 'wait'){
        const exW = {...ex, type:'wait', key:(ex.key||'x') + '.wait', how:'Грай по одній ноті: супровід і метроном чекають на тебе.'};
        stop = base.wait(inner, exW, { done:()=>{ toast('Ноти вивчено. Тепер спробуй у темпі, можна з нижчим темпом.', [['Грати в темпі', ()=>setMode('tempo')]]); }, again:mount, next:()=>setMode('tempo') });
      } else stop = base[type](inner, ex, Object.assign({}, ctx, { again:mount }));
    }
    mount();
    return () => { removeEventListener('keydown', hot); Hub.paused = false; if(stop){ stop(); stop = null; } };
  };
  Object.keys(base).forEach(k => { RUNNERS[k] = wrap(k); });
})();
