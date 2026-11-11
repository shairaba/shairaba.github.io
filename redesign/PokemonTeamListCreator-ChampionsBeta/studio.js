/* Team List Generator: UI layer.
   script.js (the original generator) is unchanged and still owns every
   form control by id. This file only adds:
   - a live preview: the real PDF, captured instead of downloaded
   - plain-language status in place of the generator's all-caps errors
   - a Pokémon count, and hints that follow the chosen sheet type        */
(function () {
  const $ = id => document.getElementById(id);

  /* ---------- plain-language messages ---------- */
  function friendly(raw) {
    const t = (raw || '').trim();
    if (!t) return '';
    if (t === 'NO PASTE DETECTED') return 'Add your team to see the sheet.';
    if (t === 'NO LANGUAGE SELECTED') return 'Pick a language for the sheet.';
    if (t === 'NO TEAM LIST SELECTED') return 'Pick which list you need.';
    if (t === 'ERROR IN PASTE') return "Part of your team couldn't be read. Check each Pokémon's lines in the paste.";
    const mega = t.match(/^MEGA EVOLVED FORMS \((.+?)\)/);
    if (mega) return `${mega[1]} is a Mega form, which can't be listed on a team sheet. List the base species instead; the Mega Stone stays as its item.`;
    return t.charAt(0) + t.slice(1).toLowerCase();
  }

  /* ---------- toast ---------- */
  let tt;
  function toast(msg, kind) {
    const el = $('toast'); el.textContent = msg; el.className = 'toast show' + (kind ? ' ' + kind : '');
    clearTimeout(tt); tt = setTimeout(() => el.classList.remove('show'), 3400);
  }

  /* ---------- your team: six slots, filled from the paste ---------- */
  const SPR = window.TL_SPRITES || { cdn: '', dex: {} };
  const lowerDex = {};
  Object.keys(SPR.dex).forEach(k => { lowerDex[k.toLowerCase()] = SPR.dex[k]; });
  const escape = t => String(t).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);

  function readTeam(text) {
    return text.trim().split(/\r?\n\s*\r?\n/).map(block => {
      const first = block.trim().split(/\r?\n/)[0] || '';
      if (!first || /^[-:]/.test(first) || /^(Ability|EVs|IVs|Level|Tera Type):/i.test(first)) return null;
      const [left, item = ''] = first.split('@').map(x => x.trim());
      // "Nickname (Species) (M)": the species is the last bracket that is not a gender
      const brackets = [...left.matchAll(/\(([^)]+)\)/g)].map(m => m[1].trim()).filter(x => !/^[MF]$/i.test(x));
      const species = brackets.length ? brackets[brackets.length - 1] : left.replace(/\s*\([MF]\)\s*$/i, '').trim();
      return { species, item };
    }).filter(Boolean);
  }
  function spriteFor(name) {
    const d = SPR.dex[name] || lowerDex[name.toLowerCase()] || lowerDex[name.toLowerCase().replace(/-mega(-[xy])?$/, '')];
    return d ? SPR.cdn + d + '.png' : '';
  }
  let lastTeam = '';
  function renderTeam() {
    const team = readTeam($('paste').value);
    const key = team.map(m => m.species + '@' + m.item).join('|');
    const count = $('team-count');
    count.textContent = team.length ? (team.length > 6 ? `${team.length} Pokémon, a team has 6` : `${team.length} of 6`) : '';
    count.classList.toggle('over', team.length > 6);
    if (key === lastTeam) return;
    const before = lastTeam.split('|').filter(Boolean);
    lastTeam = key;
    $('slots').innerHTML = Array.from({ length: 6 }, (_, i) => {
      const m = team[i];
      if (!m) return `<li class="slot"><span class="ph" aria-hidden="true">${i + 1}</span><b>Empty</b></li>`;
      const src = spriteFor(m.species);
      const fresh = before[i] !== m.species + '@' + m.item;
      return `<li class="slot on" data-species="${escape(m.species)}" title="${escape(m.species + (m.item ? ' @ ' + m.item : ''))}"${fresh ? '' : ' style="animation:none"'}>` +
        (src ? `<img src="${src}" alt="" crossorigin="anonymous" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'ph',textContent:'${escape(m.species.charAt(0))}'}))">`
             : `<span class="ph" aria-hidden="true">${escape(m.species.charAt(0))}</span>`) +
        `<div><b>${escape(m.species)}</b><small>${escape(m.item || 'No item')}</small></div></li>`;
    }).join('');
  }

  /* ---------- screenshot drop zones ---------- */
  document.querySelectorAll('.drop').forEach(zone => {
    const input = zone.querySelector('input'), thumb = zone.querySelector('.drop-thumb'), note = zone.querySelector('small');
    let url = null;
    function show() {
      const f = input.files && input.files[0];
      if (url) URL.revokeObjectURL(url);
      url = f ? URL.createObjectURL(f) : null;
      thumb.style.backgroundImage = url ? `url("${url}")` : '';
      zone.classList.toggle('has', !!f);
      note.textContent = f ? f.name : note.dataset.empty;
      input.title = f ? f.name : '';
    }
    input.addEventListener('change', show);
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('over'));
    zone.addEventListener('drop', e => {
      e.preventDefault(); zone.classList.remove('over');
      const f = [...(e.dataTransfer.files || [])].find(x => x.type.startsWith('image/'));
      if (!f) return toast('Drop an image of the game screen', 'warn');
      const dt = new DataTransfer(); dt.items.add(f); input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    input.title = '';
  });

  /* ---------- sheet-type hints ---------- */
  function sheetHints() {
    const v = (document.querySelector('input[name="sheet"]:checked') || {}).value;
    $('lang-legend').textContent = v === 'reg' ? 'Languages on the sheet' : 'Language of the sheet';
    $('sheet-note').textContent = v === 'reg'
      ? 'Untick any language you don’t need.'
      : 'Most events want both pages: download the staff list and the open list.';
    document.getElementById('listLang').classList.toggle('multi', v === 'reg');
  }

  /* ---------- live preview ---------- */
  let lastURL = null, timer = null, lastKey = '';
  const preview = window.matchMedia('(min-width: 1000px)');

  // jsPDF copies jsPDF.API methods onto every new document, over its own
  // built-in save(). So the capture is installed only while a preview
  // renders, then deleted: the Download button always gets the real save.
  function capturePdf() {
    const api = window.jspdf.jsPDF.API;
    let blob = null;
    api.save = function () { blob = this.output('blob'); return this; };
    try { window.generatePdf(); } catch (e) { console.error(e); }
    finally { delete api.save; }
    return blob;
  }

  function stateKey() {
    const f = document.querySelector('.form');
    const vals = [...f.querySelectorAll('input, textarea, select')].map(el =>
      el.type === 'radio' || el.type === 'checkbox' ? (el.checked ? el.id : '') : el.id + '=' + el.value);
    return vals.join('|') + '|' + document.documentElement.getAttribute('data-theme');
  }

  function render() {
    if (!window.generatePdf || !window.jspdf) { timer = setTimeout(render, 300); return; }
    const status = $('sheet-status'), empty = $('paper-empty'), frame = $('pdf');
    $('error').innerText = '';
    const blob = capturePdf();
    const msg = friendly($('error').innerText);
    const bad = ($('error').innerText.match(/\((.+?)\)/) || [])[1];
    document.querySelectorAll('.slot').forEach(el => el.classList.toggle('bad', !blob && !!bad && el.dataset.species === bad));
    if (blob) {
      if (lastURL) URL.revokeObjectURL(lastURL);
      lastURL = URL.createObjectURL(blob);
      frame.src = lastURL + '#toolbar=0&navpanes=0&statusbar=0&view=Fit';
      frame.hidden = false; empty.hidden = true;
      status.textContent = 'Ready to download.'; status.className = 'sheet-status ok';
    } else {
      frame.hidden = true; empty.hidden = false;
      $('paper-msg').textContent = $('paste').value.trim() ? 'The sheet appears as soon as the issue below is fixed.' : 'Add your team to see the sheet.';
      status.textContent = $('paste').value.trim() ? msg : ''; status.className = 'sheet-status' + ($('paste').value.trim() ? ' warn' : '');
    }
  }

  function schedule() {
    const key = stateKey();
    if (key === lastKey) return;
    lastKey = key;
    renderTeam(); sheetHints();
    clearTimeout(timer);
    if (preview.matches) timer = setTimeout(render, 450);
  }

  // Link import and screenshot reading write the paste box directly
  // (no input event), so watch for any change rather than listening only.
  document.addEventListener('input', schedule, true);
  document.addEventListener('change', schedule, true);
  setInterval(schedule, 500);
  preview.addEventListener('change', () => { lastKey = ''; schedule(); });

  /* ---------- download: report problems in words ---------- */
  $('print').addEventListener('click', () => {
    setTimeout(() => {
      const msg = friendly($('error').innerText);
      if (msg) toast(msg, 'warn');
    }, 60);
  });

  renderTeam(); sheetHints(); schedule();
})();
