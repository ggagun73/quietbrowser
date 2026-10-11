const { app, BrowserWindow, BrowserView, ipcMain, session } = require('electron');
const fs = require('fs');
const path = require('path');

const HOME_URL = 'https://www.google.com';
const HEADER_HEIGHT = 52;
const TAB_BAR_HEIGHT = 36;
const SETTINGS_HEIGHT = 280;
let mainWindow;
let currentHost = '';
let settings;
let tickTimer;
let controlsHeight = HEADER_HEIGHT + TAB_BAR_HEIGHT;
let tabs = [];
let activeTabId;
let nextTabId = 1;

// Makes first-run behavior reliable on Windows VMs, remote desktops, and
// machines with problematic display drivers. This app does not need GPU work.
app.disableHardwareAcceleration();

const defaults = {
  blocked: [],
  limits: {},
  focusMode: false,
  allowed: [],
  usage: {}
};

function storePath() {
  return path.join(app.getPath('userData'), 'quiet-browse.json');
}

function loadSettings() {
  try {
    return { ...defaults, ...JSON.parse(fs.readFileSync(storePath(), 'utf8')) };
  } catch {
    return { ...defaults };
  }
}

function saveSettings() {
  fs.writeFileSync(storePath(), JSON.stringify(settings, null, 2));
}

function dateKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function normaliseHost(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return '';
  try {
    return new URL(text.includes('://') ? text : `https://${text}`).hostname.replace(/^www\./, '');
  } catch {
    return text.replace(/^www\./, '').split('/')[0];
  }
}

function matches(host, domain) {
  return host === domain || host.endsWith(`.${domain}`);
}

function hostFromUrl(value) {
  try { return new URL(value).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function secondsUsed(host) {
  return settings.usage[dateKey()]?.[host] || 0;
}

function decision(url) {
  const host = hostFromUrl(url);
  if (!host || url.startsWith('file:') || url.startsWith('data:')) return { allow: true };
  if (settings.blocked.some((domain) => matches(host, domain))) return { allow: false, reason: '이 사이트는 차단 목록에 있습니다.' };
  if (settings.focusMode && !settings.allowed.some((domain) => matches(host, domain))) return { allow: false, reason: '집중 모드에서는 허용된 사이트만 이용할 수 있습니다.' };
  const limit = settings.limits[host];
  if (limit && secondsUsed(host) >= limit * 60) return { allow: false, reason: `오늘의 ${limit}분 이용 시간을 모두 사용했습니다.` };
  return { allow: true };
}

function blockedPage(host, reason) {
  return `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><html lang="ko"><meta charset="utf-8"><style>body{margin:0;display:grid;place-items:center;height:100vh;background:#f6f3ed;color:#25332d;font-family:-apple-system,BlinkMacSystemFont,sans-serif}.card{text-align:center;max-width:470px;padding:40px}.leaf{font-size:42px}.host{font-size:20px;font-weight:700;margin:16px 0 9px}p{line-height:1.6;color:#5b6962}</style><main class="card"><div class="leaf">◌</div><div class="host">${host}</div><p>${reason}</p><p>잠시 멈추고, 지금 하려던 일을 떠올려 보세요.</p></main></html>`)}`;
}

function sendState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('state-changed', publicState());
}

function publicState() {
  const today = settings.usage[dateKey()] || {};
  return {
    ...settings,
    usage: today,
    currentHost,
    activeTabId,
    tabs: tabs.map((tab) => ({ id: tab.id, title: tab.title, url: tab.url }))
  };
}

function resizeView() {
  const tab = activeTab();
  if (!mainWindow || !tab) return;
  const { width, height } = mainWindow.getContentBounds();
  tab.view.setBounds({ x: 0, y: controlsHeight, width, height: Math.max(0, height - controlsHeight) });
}

function activeTab() {
  return tabs.find((tab) => tab.id === activeTabId);
}

function navigate(rawUrl, tab = activeTab()) {
  const url = String(rawUrl || '').trim();
  if (!url || !tab) return;
  const target = url.includes('://') ? url : `https://${url}`;
  tab.view.webContents.loadURL(target);
}

function updateCurrentHost() {
  currentHost = hostFromUrl(activeTab()?.url);
}

function selectTab(id) {
  const tab = tabs.find((item) => item.id === id);
  if (!tab || !mainWindow) return;
  activeTabId = id;
  mainWindow.setBrowserView(tab.view);
  updateCurrentHost();
  resizeView();
  sendState();
}

function createTab(url = HOME_URL) {
  const tab = { id: nextTabId++, title: '새 탭', url, view: new BrowserView({ webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } }) };
  const contents = tab.view.webContents;
  contents.on('will-navigate', (event, targetUrl) => {
    const result = decision(targetUrl);
    if (!result.allow) { event.preventDefault(); contents.loadURL(blockedPage(hostFromUrl(targetUrl), result.reason)); }
  });
  contents.on('did-navigate', (_event, targetUrl) => {
    tab.url = targetUrl;
    tab.title = hostFromUrl(targetUrl) || '차단됨';
    if (tab.id === activeTabId) updateCurrentHost();
    sendState();
  });
  contents.on('page-title-updated', (_event, title) => { tab.title = title || hostFromUrl(tab.url) || '새 탭'; sendState(); });
  contents.setWindowOpenHandler(({ url: targetUrl }) => { createTab(targetUrl); return { action: 'deny' }; });
  tabs.push(tab);
  selectTab(tab.id);
  contents.loadURL(url);
}

function closeTab(id) {
  const index = tabs.findIndex((tab) => tab.id === id);
  if (index < 0) return;
  const [tab] = tabs.splice(index, 1);
  tab.view.webContents.close();
  if (!tabs.length) return createTab();
  if (id === activeTabId) selectTab(tabs[Math.max(0, index - 1)].id);
  else sendState();
}

function trackUsage() {
  if (!mainWindow || !mainWindow.isFocused() || !currentHost) return;
  const allowed = decision(`https://${currentHost}`).allow;
  if (!allowed) return;
  const day = dateKey();
  settings.usage[day] ||= {};
  settings.usage[day][currentHost] = (settings.usage[day][currentHost] || 0) + 1;
  saveSettings();
  const limit = settings.limits[currentHost];
  if (limit && settings.usage[day][currentHost] >= limit * 60) {
    activeTab()?.view.webContents.loadURL(blockedPage(currentHost, `오늘의 ${limit}분 이용 시간을 모두 사용했습니다.`));
  }
  sendState();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 850,
    minWidth: 1000,
    minHeight: 600,
    title: 'Quiet Browse',
    backgroundColor: '#f6f3ed',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.on('resize', resizeView);
  createTab();
}

app.whenReady().then(() => {
  settings = loadSettings();
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    if (details.resourceType !== 'mainFrame') return callback({});
    const result = decision(details.url);
    callback(result.allow ? {} : { redirectURL: blockedPage(hostFromUrl(details.url), result.reason) });
  });
  createWindow();
  tickTimer = setInterval(trackUsage, 1000);
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => clearInterval(tickTimer));

ipcMain.handle('get-state', () => publicState());
ipcMain.handle('navigate', (_event, url) => navigate(url));
ipcMain.handle('back', () => {
  const history = activeTab()?.view.webContents.navigationHistory;
  if (!history) return;
  if (history.canGoBack()) history.goBack();
});
ipcMain.handle('forward', () => {
  const history = activeTab()?.view.webContents.navigationHistory;
  if (!history) return;
  if (history.canGoForward()) history.goForward();
});
ipcMain.handle('reload', () => activeTab()?.view.webContents.reload());
ipcMain.handle('new-tab', () => createTab());
ipcMain.handle('select-tab', (_event, id) => selectTab(id));
ipcMain.handle('close-tab', (_event, id) => closeTab(id));
ipcMain.handle('set-settings-open', (_event, isOpen) => {
  controlsHeight = HEADER_HEIGHT + TAB_BAR_HEIGHT + (isOpen ? SETTINGS_HEIGHT : 0);
  resizeView();
});
ipcMain.handle('update-settings', (_event, patch) => {
  settings = { ...settings, ...patch };
  settings.blocked = (settings.blocked || []).map(normaliseHost).filter(Boolean);
  settings.allowed = (settings.allowed || []).map(normaliseHost).filter(Boolean);
  settings.limits = Object.fromEntries(Object.entries(settings.limits || {}).map(([host, minutes]) => [normaliseHost(host), Math.max(1, Number(minutes) || 1)]));
  saveSettings();
  sendState();
  return publicState();
});
