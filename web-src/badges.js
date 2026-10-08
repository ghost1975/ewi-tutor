// ---------- Досягнення ----------
const BADGES = [
  ['first', 'Перший урок', 'Пройти перший урок', () => LESSONS.some(lessonDone)],
  ...LEVELS.map(L => ['lvl'+L.n, `Рівень ${L.n}`, `Пройти всі уроки рівня «${L.title}»`, () => LESSONS.filter(l=>l.lvl===L.n).every(lessonDone)]),
  ['s3', 'Три дні поспіль', 'Займатися від 5 хвилин три дні поспіль', () => streak() >= 3],
  ['s7', 'Тиждень без пропусків', 'Серія 7 днів', () => streak() >= 7],
  ['s30', 'Місяць практики', 'Серія 30 днів', () => streak() >= 30],
  ['h1', 'Перша година', 'Разом 1 година практики', () => totalMin() >= 60],
  ['h10', 'Десять годин', 'Разом 10 годин практики', () => totalMin() >= 600],
  ['h50', 'П\'ятдесят годин', 'Разом 50 годин практики', () => totalMin() >= 3000],
  ['perfect', 'Ідеально', '100 балів у будь-якій вправі', () => (Progress.log||[]).some(r=>r.score >= 100)],
  ['songs5', 'П\'ять мелодій', 'Зіграти 5 популярних мелодій на прохідний бал', () => songsPassed() >= 5],
  ['songs20', 'Двадцять мелодій', 'Зіграти 20 популярних мелодій на прохідний бал', () => songsPassed() >= 20],
  ['rep1', 'Свій репертуар', 'Додати першу мелодію в «Мій репертуар»', () => LS.get('songs', []).length > 0],
  ['read1', 'Швидке читання', 'Тренажер нот: менше 1,5 с на ноту при точності від 90%', () => (Progress.reading||[]).some(r=>r.avg < 1.5 && r.acc >= 90)],
  ['read2', 'Читання з листа', 'Тренажер нот: менше 0,8 с на ноту при точності від 90%', () => (Progress.reading||[]).some(r=>r.avg < 0.8 && r.acc >= 90)],
  ['daily5', 'П\'ять занять дня', 'Завершити 5 занять дня', () => Object.keys(Progress.daily||{}).length >= 5],
];


function checkBadges(){
  Progress.badges = Progress.badges || {}; const fresh = [];
  for(const [id, title, , test] of BADGES){ if(Progress.badges[id]) continue; let ok = false; try{ ok = test(); }catch(e){} if(ok){ Progress.badges[id] = Date.now(); fresh.push(title); } }
  if(fresh.length){ LS.set('progress', Progress); toast('Нове досягнення: ' + fresh.join(', ')); }
}
function badgesHTML(){ const b = Progress.badges || {};
  return `<div class="badges">${BADGES.map(([id, title, desc])=>`<div class="badge${b[id]?' got':''}" title="${esc(desc)}"><b>${esc(title)}</b><span>${b[id] ? new Date(b[id]).toLocaleDateString('uk-UA') : esc(desc)}</span></div>`).join('')}</div>`; }
