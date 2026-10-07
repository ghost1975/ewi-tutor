// Репетитор EWI — основний процес Electron
const { app, BrowserWindow, ipcMain, shell, dialog, session, Menu, protocol, net, Notification } = require('electron');
const { spawn } = require('child_process');
const os = require('os');
const { pathToFileURL } = require('url');
const path = require('path');
const fs = require('fs');

let autoUpdater = null;
try { autoUpdater = require('electron-updater').autoUpdater; } catch (e) { autoUpdater = null; }

if (!app.requestSingleInstanceLock()) { app.quit(); }
// власна схема для аудіофайлів мінусовок з папки «Мій репертуар»
protocol.registerSchemesAsPrivileged([{ scheme: 'ewimedia', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } }]);

// ---------- Де лежать дані ----------
// config.json у системній папці застосунку пам'ятає, де зберігати дані.
// Самі дані за замовчуванням у Документах: «Репетитор EWI».
// Ні установка, ні оновлення цих папок не торкаються.
const CONFIG = path.join(app.getPath('userData'), 'config.json');
const readJSON = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return d; } };
const writeJSON = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); const tmp = f + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(v, null, 1), 'utf8'); fs.renameSync(tmp, f); };
let config = readJSON(CONFIG, {});
const dataDir = () => config.dataDir || path.join(app.getPath('documents'), 'Репетитор EWI');
const DIRS = { data: 'Дані', rep: 'Мій репертуар', backup: 'Резервні копії', takes: 'Записи' };
const dir = k => { const d = path.join(dataDir(), DIRS[k]); fs.mkdirSync(d, { recursive: true }); return d; };

// ---------- Сховище ----------
const slug = s => (s || 'Без назви').replace(/[<>:"/\\|?*\x00-\x1f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Без назви';
function readRepertoire() {
  const d = dir('rep'), out = [];
  for (const f of fs.readdirSync(d)) {
    if (!f.toLowerCase().endsWith('.json')) continue;
    const s = readJSON(path.join(d, f), null); if (!s || !s.seq) continue;
    if (!s.id) s.id = 'f' + Buffer.from(f).toString('hex').slice(0, 16);
    s._file = f; out.push(s);
  }
  return out.sort((a, b) => (b.created || 0) - (a.created || 0));
}
function writeRepertoire(list) {
  const d = dir('rep'), keep = new Set();
  const existing = readRepertoire();
  list.forEach((s, i) => {
    const old = existing.find(x => x.id === s.id);
    const file = old ? old._file : `${slug(s.title)} (${s.id.slice(-5)}).json`;
    const { _file, ...clean } = s; if (!clean.created) clean.created = Date.now() - i;
    writeJSON(path.join(d, file), clean); keep.add(file);
  });
  existing.forEach(x => { if (!keep.has(x._file)) { try { fs.unlinkSync(path.join(d, x._file)); } catch (e) {} } });
}
function storeGet(key) {
  if (key === 'songs') return readRepertoire();
  return readJSON(path.join(dir('data'), key + '.json'), null);
}
function storeSet(key, value) {
  if (key === 'songs') return writeRepertoire(value || []);
  writeJSON(path.join(dir('data'), key + '.json'), value);
}
// MIDI-файли, покладені в папку репертуару вручну, ще не перетворені на мелодії
function newMidis() {
  const d = dir('rep'), known = new Set(readRepertoire().map(s => s.source).filter(Boolean));
  return fs.readdirSync(d).filter(f => /\.midi?$/i.test(f) && !known.has(f))
    .map(f => ({ name: f, data: fs.readFileSync(path.join(d, f)).toString('base64') }));
}
// Щоденна резервна копія прогресу, зберігаються 14 останніх
function backup() {
  const src = dir('data'), day = new Date().toISOString().slice(0, 10), dst = path.join(dir('backup'), day);
  if (fs.existsSync(dst) || !fs.readdirSync(src).length) return;
  fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(src)) fs.copyFileSync(path.join(src, f), path.join(dst, f));
  const all = fs.readdirSync(dir('backup')).sort();
  all.slice(0, Math.max(0, all.length - 14)).forEach(f => fs.rmSync(path.join(dir('backup'), f), { recursive: true, force: true }));
}

ipcMain.on('store:get', (e, key) => { try { e.returnValue = storeGet(key); } catch (err) { e.returnValue = null; } });
ipcMain.on('store:set', (e, key, value) => { try { storeSet(key, value); e.returnValue = true; } catch (err) { e.returnValue = false; } });
ipcMain.on('store:newMidis', e => { try { e.returnValue = newMidis(); } catch (err) { e.returnValue = []; } });
ipcMain.on('app:info', e => { e.returnValue = { version: require('./package.json').version, dataDir: dataDir(), repDir: dir('rep') }; });
ipcMain.handle('app:openDir', (e, which) => shell.openPath(which === 'rep' ? dir('rep') : which === 'backup' ? dir('backup') : dataDir()));
ipcMain.handle('app:chooseDir', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Папка для даних Репетитора EWI', properties: ['openDirectory', 'createDirectory'] });
  if (r.canceled || !r.filePaths[0]) return null;
  const from = dataDir(), to = path.join(r.filePaths[0], 'Репетитор EWI');
  if (path.resolve(from) !== path.resolve(to)) { fs.mkdirSync(to, { recursive: true }); if (fs.existsSync(from)) fs.cpSync(from, to, { recursive: true, force: false, errorOnExist: false }); }
  config.dataDir = to; writeJSON(CONFIG, config); return to;
});

// ---------- Аудіо мінусовок ----------
ipcMain.handle('media:save', (e, name, bytes) => {
  const safe = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').slice(0, 120) || ('audio-' + Date.now() + '.mp3');
  fs.writeFileSync(path.join(dir('rep'), safe), Buffer.from(bytes)); return safe;
});
function serveMedia(req) {
  const name = decodeURIComponent(new URL(req.url).pathname.replace(/^\/+/, ''));
  const file = path.join(dir('rep'), path.basename(name));
  return net.fetch(pathToFileURL(file).toString(), { headers: req.headers }).then(r => {
    const h = new Headers(r.headers); h.set('Access-Control-Allow-Origin', '*');
    return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h });
  });
}

// ---------- Вчитель: Claude Code через підписку користувача ----------
// Викликаємо офіційний CLI Claude Code в неінтерактивному режимі. Він сам використовує вхід
// користувача; ключ API прибираємо з оточення, щоб запити не тарифікувались через API.
function claudeCmd() { return (config.claudePath || '').trim() || 'claude'; }
function claudeEnv() { const env = { ...process.env }; delete env.ANTHROPIC_API_KEY; delete env.ANTHROPIC_AUTH_TOKEN; return env; }
function runClaude(args, input, timeoutMs) {
  return new Promise(resolve => {
    const cwd = path.join(os.tmpdir(), 'ewi-teacher'); fs.mkdirSync(cwd, { recursive: true });
    const cmd = claudeCmd(), quoted = /\s/.test(cmd) ? `"${cmd}"` : cmd;
    let out = '', err = '', done = false;
    let p; try { p = spawn(quoted, args, { cwd, env: claudeEnv(), shell: true, windowsHide: true }); }
    catch (e) { return resolve({ code: -1, out: '', err: String(e.message || e) }); }
    const t = setTimeout(() => { if (!done) { done = true; try { p.kill(); } catch (e) {} resolve({ code: -2, out, err: 'Час очікування вичерпано' }); } }, timeoutMs);
    p.stdout.on('data', d => out += d); p.stderr.on('data', d => err += d);
    p.on('error', e => { if (!done) { done = true; clearTimeout(t); resolve({ code: -1, out, err: String(e.message || e) }); } });
    p.on('close', code => { if (!done) { done = true; clearTimeout(t); resolve({ code, out, err }); } });
    if (input != null) { p.stdin.write(input, 'utf8'); } p.stdin.end();
  });
}
ipcMain.handle('claude:check', async () => {
  const r = await runClaude(['--version'], null, 20000);
  return r.code === 0 ? { ok: true, version: r.out.trim().split('\n')[0] } : { ok: false, error: (r.err || r.out || '').trim().slice(0, 300) };
});
ipcMain.handle('claude:ask', async (e, prompt) => {
  const r = await runClaude(['-p', '--output-format', 'json', '--max-turns', '1'], prompt, 240000);
  if (r.code !== 0 && !r.out) return { ok: false, error: (r.err || 'Claude Code завершився з помилкою').trim().slice(0, 500) };
  try { const j = JSON.parse(r.out.trim().split('\n').filter(Boolean).pop()); if (j.is_error) return { ok: false, error: String(j.result || j.subtype || 'помилка') };
    return { ok: true, text: String(j.result || '').trim() }; }
  catch (err) { return r.out.trim() ? { ok: true, text: r.out.trim() } : { ok: false, error: r.err.trim() || 'порожня відповідь' }; }
});

// ---------- Налаштування застосунку, нагадування, автозапуск ----------
let practiceToday = { day: '', min: 0 }, notifiedDay = '';
ipcMain.on('cfg:get', e => { e.returnValue = { remind: !!config.remind, remindAt: config.remindAt || '19:00', autostart: !!config.autostart, claudePath: config.claudePath || '' }; });
ipcMain.handle('cfg:set', (e, c) => {
  Object.assign(config, c); writeJSON(CONFIG, config);
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: !!config.autostart, args: ['--hidden'] });
  return true;
});
ipcMain.on('practice:report', (e, min) => { practiceToday = { day: new Date().toISOString().slice(0, 10), min: +min || 0 }; });
function reminderTick() {
  if (!config.remind || !Notification.isSupported()) return;
  const now = new Date(), day = now.toISOString().slice(0, 10), [h, m] = (config.remindAt || '19:00').split(':').map(Number);
  if (notifiedDay === day || now.getHours() * 60 + now.getMinutes() < h * 60 + m) return;
  if (practiceToday.day === day && practiceToday.min >= 5) return;
  notifiedDay = day;
  const n = new Notification({ title: 'Репетитор EWI', body: 'Сьогодні ще не було практики. Заняття дня займе близько 20 хвилин.', icon: path.join(__dirname, 'app', 'icon.png') });
  n.on('click', () => { if (win) { win.show(); if (win.isMinimized()) win.restore(); win.focus(); win.webContents.executeJavaScript("go('daily')").catch(() => {}); } }); n.show();
}

// ---------- Оновлення ----------
function sendUpdate(state, extra = {}) { if (win && !win.isDestroyed()) win.webContents.send('update', { state, ...extra }); }
function setupUpdater() {
  if (!autoUpdater || !app.isPackaged) return;
  autoUpdater.autoDownload = true; autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => sendUpdate('checking'));
  autoUpdater.on('update-available', i => sendUpdate('available', { version: i.version }));
  autoUpdater.on('update-not-available', () => sendUpdate('none'));
  autoUpdater.on('download-progress', p => sendUpdate('progress', { percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', i => sendUpdate('ready', { version: i.version }));
  autoUpdater.on('error', err => sendUpdate('error', { message: String(err && err.message || err) }));
  setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 4000);
}
ipcMain.handle('update:check', () => {
  if (!autoUpdater || !app.isPackaged) { sendUpdate('dev'); return; }
  return autoUpdater.checkForUpdates().catch(err => sendUpdate('error', { message: String(err.message || err) }));
});
ipcMain.handle('update:install', () => { if (autoUpdater) { backup(); autoUpdater.quitAndInstall(false, true); } });

// ---------- Вікно ----------
let win = null;
function createWindow() {
  win = new BrowserWindow({
    width: 1400, height: 900, minWidth: 1000, minHeight: 640, title: 'Репетитор EWI', backgroundColor: '#E6EAEE',
    icon: path.join(__dirname, 'app', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: false, autoplayPolicy: 'no-user-gesture-required' }
  });
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  if (process.argv.includes('--hidden')) win.once('ready-to-show', () => win.minimize());
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  // MIDI-інструмент і мікрофон дозволені без запитів
  const ok = new Set(['midi', 'midiSysex', 'media', 'audioCapture', 'clipboard-sanitized-write']);
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(ok.has(perm)));
  session.defaultSession.setPermissionCheckHandler((wc, perm) => ok.has(perm));
  // збережені дублі одразу лягають у папку «Записи»
  session.defaultSession.on('will-download', (e, item) => {
    const p = path.join(dir('takes'), item.getFilename()); item.setSavePath(p);
    item.once('done', (ev, state) => { if (state === 'completed' && win) win.webContents.send('saved', p); });
  });
  protocol.handle('ewimedia', serveMedia);
  if (process.platform === 'win32') app.setAppUserModelId('com.ewitutor.app');
  try { backup(); } catch (e) {}
  createWindow(); setupUpdater(); setInterval(reminderTick, 60000);
});
app.on('window-all-closed', () => app.quit());
