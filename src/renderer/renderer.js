let state;
const $ = (selector) => document.querySelector(selector);
const host = (value) => value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];

function update(patch) { return window.quietBrowse.updateSettings(patch); }
function chip(text, remove) { const el = document.createElement('span'); el.className = 'chip'; el.textContent = text; const button = document.createElement('button'); button.textContent = '×'; button.onclick = remove; el.append(button); return el; }
function duration(seconds) { const minutes = Math.floor(seconds / 60); return minutes ? `${minutes}분` : '1분 미만'; }
const chartColors = ['#4b7b5f', '#d18a55', '#6e83b7', '#b76e87', '#8b9e50', '#7b6b9e'];
function render(next) {
  state = next;
  $('#focus-toggle').checked = state.focusMode;
  const tabs = $('#tabs');
  tabs.replaceChildren(...state.tabs.map((tab) => {
    const element = document.createElement('button');
    element.className = `tab${tab.id === state.activeTabId ? ' active' : ''}`;
    element.title = tab.url;
    const title = document.createElement('span'); title.textContent = tab.title;
    const close = document.createElement('span'); close.className = 'tab-close'; close.textContent = '×';
    close.onclick = (event) => { event.stopPropagation(); window.quietBrowse.closeTab(tab.id); };
    element.append(title, close);
    element.onclick = () => window.quietBrowse.selectTab(tab.id);
    return element;
  }));
  const draw = (selector, values, format, remove) => { const box = $(selector); box.replaceChildren(...values.map((value) => chip(format(value), () => remove(value)))); };
  draw('#blocked-list', state.blocked, (x) => x, (x) => update({ blocked: state.blocked.filter((item) => item !== x) }));
  draw('#allowed-list', state.allowed, (x) => x, (x) => update({ allowed: state.allowed.filter((item) => item !== x) }));
  draw('#limits-list', Object.entries(state.limits), ([x, mins]) => `${x} · ${mins}분`, ([x]) => { const copy = { ...state.limits }; delete copy[x]; update({ limits: copy }); });
  const entries = Object.entries(state.usage).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, seconds]) => sum + seconds, 0);
  $('#stats-total').textContent = `총 ${duration(total)}`;
  $('#pie-center').textContent = duration(total);
  $('#stats-sites').textContent = `이용 사이트 ${entries.length}개`;
  $('#stats-top').textContent = entries.length ? `가장 오래 이용: ${entries[0][0]}` : '아직 이용 기록이 없습니다';
  const pie = $('#pie-chart');
  if (total) {
    let cursor = 0;
    const segments = entries.slice(0, 6).map(([, seconds], index) => {
      const next = cursor + (seconds / total) * 360;
      const segment = `${chartColors[index]} ${cursor}deg ${next}deg`;
      cursor = next;
      return segment;
    });
    if (entries.length > 6) segments.push(`#c9c6bf ${cursor}deg 360deg`);
    pie.style.background = `conic-gradient(${segments.join(',')})`;
  } else pie.style.background = '#e0ddd5';
  const maximum = entries[0]?.[1] || 1;
  const list = $('#stats-list');
  list.replaceChildren(...entries.map(([domain, seconds]) => {
    const row = document.createElement('div'); row.className = 'chart-row';
    const index = entries.findIndex(([name]) => name === domain);
    const label = document.createElement('div'); label.className = 'chart-label'; label.textContent = `${domain} · ${duration(seconds)} · ${Math.round((seconds / total) * 100)}%`;
    const bar = document.createElement('div'); bar.className = 'chart-bar';
    const fill = document.createElement('div'); fill.className = 'chart-fill'; fill.style.width = `${Math.max(3, (seconds / maximum) * 100)}%`; fill.style.background = chartColors[index % chartColors.length];
    bar.append(fill); row.append(label, bar); return row;
  }));
}

$('#address-form').onsubmit = (event) => { event.preventDefault(); window.quietBrowse.navigate($('#address').value); };
$('#back').onclick = () => window.quietBrowse.back(); $('#forward').onclick = () => window.quietBrowse.forward(); $('#reload').onclick = () => window.quietBrowse.reload();
$('#new-tab').onclick = () => window.quietBrowse.newTab();
$('#focus-toggle').onchange = (event) => update({ focusMode: event.target.checked });
$('#panel-toggle').onclick = () => {
  const panel = $('#settings-panel');
  const isOpen = panel.classList.toggle('is-open');
  $('#panel-toggle').setAttribute('aria-expanded', String(isOpen));
  window.quietBrowse.setSettingsOpen(isOpen);
};
$('#block-form').onsubmit = (event) => { event.preventDefault(); const value = host($('#block-input').value); if (value && !state.blocked.includes(value)) update({ blocked: [...state.blocked, value] }); $('#block-input').value = ''; };
$('#allow-form').onsubmit = (event) => { event.preventDefault(); const value = host($('#allow-input').value); if (value && !state.allowed.includes(value)) update({ allowed: [...state.allowed, value] }); $('#allow-input').value = ''; };
$('#limit-form').onsubmit = (event) => { event.preventDefault(); const value = host($('#limit-input').value); const minutes = Number($('#minutes-input').value); if (value && minutes > 0) update({ limits: { ...state.limits, [value]: minutes } }); $('#limit-input').value = ''; $('#minutes-input').value = ''; };
window.quietBrowse.onStateChanged(render);
window.quietBrowse.getState().then(render);
