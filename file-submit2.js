/******************************************************
 * script.js
 * 与 index.html 配合使用（单页，绿色简约风）
 * Classes: NewSubmitter / NewSystemStatus
 * 房主密码: 471695
 * Room ID: file_submit_system_room_001_v2
 ******************************************************/

/* ========== LeanCloud 初始化（请保持原有配置） ========== */
AV.init({
  appId: "awjrq2pnF6yDBX2QT7Sq1dHQ-gzGzoHsz",
  appKey: "WY6uq9q4hPthkwKX5JIHrlYk",
  serverURL: "https://awjrq2pn.lc-cn-n1-shared.com"
});

const CLASS_SUBMITTER = "NewSubmitter";
const CLASS_SYSTEM = "NewSystemStatus";
const OWNER_PASSWORD = "471695";
const ROOM_ID = "file_submit_system_room_001_v2";
const DEFAULT_MAX_FILES = 1;
const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15MB

/* ========== 辅助短函数 ========== */
const $ = id => document.getElementById(id);
const show = elOrId => { const e = typeof elOrId === 'string' ? $(elOrId) : elOrId; if (e) e.classList.remove('hidden'); };
const hide = elOrId => { const e = typeof elOrId === 'string' ? $(elOrId) : elOrId; if (e) e.classList.add('hidden'); };

/* ========== ZIP lazy loader ========== */
async function ensureZipReady() {
  return new Promise((resolve, reject) => {
    let need = 0, done = 0;
    function ok() { done++; if (done >= need) resolve(); }
    if (typeof JSZip === 'undefined') {
      need++;
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/jszip@3.10.1/dist/jszip.min.js';
      s.onload = ok; s.onerror = reject; document.head.appendChild(s);
    }
    if (typeof saveAs === 'undefined') {
      need++;
      const s2 = document.createElement('script');
      s2.src = 'https://unpkg.com/file-saver@2.0.5/dist/FileSaver.min.js';
      s2.onload = ok; s2.onerror = reject; document.head.appendChild(s2);
    }
    if (need === 0) resolve();
  });
}

/* ========== System 管理 (NewSystemStatus) ========== */
const system = {
  async _getSystemObj(createIfMissing = true) {
    const q = new AV.Query(CLASS_SYSTEM);
    q.equalTo('roomId', ROOM_ID);
    const exist = await q.first();
    if (exist) return exist;
    if (!createIfMissing) return null;

    const C = AV.Object.extend(CLASS_SYSTEM);
    const s = new C();
    s.set('roomId', ROOM_ID);
    s.set('status', 'not_started');
    s.set('maxFiles', DEFAULT_MAX_FILES);
    s.set('ownerPass', OWNER_PASSWORD);
    s.set('allowModify', true);

    const acl = new AV.ACL();
    acl.setPublicReadAccess(true);
    acl.setPublicWriteAccess(true);
    s.setACL(acl);

    await s.save();
    return s;
  },

  async getStatus() {
    const s = await this._getSystemObj(false);
    return s ? s.get('status') : 'not_started';
  },

  async updateUI() {
    const s = await this._getSystemObj(true);
    const status = s.get('status') || 'not_started';
    const maxFiles = s.get('maxFiles') || DEFAULT_MAX_FILES;
    const allowModify = s.get('allowModify') === true;

    if ($('sys-status-badge')) {
      $('sys-status-badge').textContent =
        status === 'running' ? '运行中' :
        status === 'paused' ? '已暂停' :
        status === 'ended' ? '已结束' : '未开始';
    }

    // 按钮显示逻辑
    ['btn-start','btn-pause','btn-resume','btn-end'].forEach(id => {
      if ($(id)) $(id).style.display = 'none';
    });
    if (status === 'not_started') $('btn-start') && ($('btn-start').style.display = '');
    if (status === 'running') {
      $('btn-pause') && ($('btn-pause').style.display = '');
      $('btn-end') && ($('btn-end').style.display = '');
    }
    if (status === 'paused') {
      $('btn-resume') && ($('btn-resume').style.display = '');
      $('btn-end') && ($('btn-end').style.display = '');
    }

    if ($('max-files-input')) $('max-files-input').value = maxFiles;
    if ($('visitor-max-files')) $('visitor-max-files').textContent = maxFiles;
    if ($('allow-modify-checkbox')) $('allow-modify-checkbox').checked = allowModify;
  },

  async updateStatus(newStatus) {
    const s = await this._getSystemObj(true);
    s.set('status', newStatus);
    await s.save();
    await this.updateUI();
    await refreshDashboard();
  },

  start() { if (confirm('确认开始系统？')) this.updateStatus('running'); },
  pause() { if (confirm('确认暂停系统？')) this.updateStatus('paused'); },
  resume(){ if (confirm('确认恢复系统？')) this.updateStatus('running'); },
  end(){ if (confirm('确认结束系统？结束后不可恢复')) this.updateStatus('ended'); },

  async setMaxFiles() {
    const v = parseInt($('max-files-input').value, 10) || DEFAULT_MAX_FILES;
    const s = await this._getSystemObj(true);
    s.set('maxFiles', v);
    await s.save();
    alert('已保存最大上传数：' + v);
    await this.updateUI();
  }
};

/* ========== 导航与页面切换 ========== */
function hideAllPages() {
  ['page-home','page-visitor-verify','page-visitor-submit','page-visitor-view','page-owner-login','page-owner-dashboard'].forEach(id => hide(id));
}
function goHome() {
  hideAllPages();
  show('page-home');
}
function goVisitor() {
  hideAllPages();
  show('page-visitor-verify');
}
function goOwnerLogin() {
  hideAllPages();
  show('page-owner-login');
}

/* ========== Owner API ========== */
const owner = {
  async login() {
    const pwd = ($('owner-pass-input').value || '').trim();
    if (pwd !== OWNER_PASSWORD) return alert('房主密码错误');
    hideAllPages();
    show('page-owner-dashboard');
    await system.updateUI();
    await refreshDashboard();
  },

  async addName() {
    const name = ($('add-name-input').value || '').trim();
    if (!name) return alert('请输入姓名');
    // check duplicates
    const q = new AV.Query(CLASS_SUBMITTER);
    q.equalTo('roomId', ROOM_ID);
    q.equalTo('name', name);
    if (await q.first()) return alert('该姓名已存在');
    const C = AV.Object.extend(CLASS_SUBMITTER);
    const o = new C();
    o.set('roomId', ROOM_ID);
    o.set('name', name);
    o.set('submitted', false);
    o.set('files', []);
    o.set('submitTime', '');
    o.set('order', Date.now());
    const acl = new AV.ACL(); acl.setPublicReadAccess(true); acl.setPublicWriteAccess(true); o.setACL(acl);
    await o.save();
    $('add-name-input').value = '';
    await refreshDashboard();
  },

  // show reset dialog
  showResetDialog() {
    show('reset-dialog');
  },
  hideResetDialog() {
    hide('reset-dialog');
  },

  // delete all: delete records in NewSubmitter
  async resetAll() {
    if (!confirm('最终确认：将删除所有名单与文件？此操作不可恢复')) return;
    try {
      const q = new AV.Query(CLASS_SUBMITTER);
      q.equalTo('roomId', ROOM_ID);
      const all = await q.find({ useMasterKey: true });
      for (const it of all) {
        await it.destroy();
      }
      // reset system fields
      const s = await system._getSystemObj(true);
      s.set('status', 'not_started');
      s.set('maxFiles', DEFAULT_MAX_FILES);
      s.set('allowModify', true);
      await s.save();
      alert('已删除所有名单与文件，系统重置');
      hide('reset-dialog');
      await refreshDashboard();
    } catch (e) {
      console.error(e);
      alert('重置失败：' + e.message);
    }
  },

  // reset files only
  async resetFilesOnly() {
    if (!confirm('确认仅删除所有已提交的文件与提交状态？名单将保留（保留房主输入顺序）')) return;
    try {
      const q = new AV.Query(CLASS_SUBMITTER);
      q.equalTo('roomId', ROOM_ID);
      const all = await q.find();
      for (const it of all) {
        it.set('files', []);
        it.set('submitted', false);
        it.set('submitTime', '');
        await it.save();
      }
      const s = await system._getSystemObj(true);
      s.set('status', 'not_started');
      await s.save();
      alert('已清空所有文件并将提交状态设置为未提交（名单保留）');
      hide('reset-dialog');
      await refreshDashboard();
    } catch (e) {
      console.error(e);
      alert('操作失败：' + e.message);
    }
  },

  // export single user (compatible AV.File / JSON)
  async exportOne(id, name) {
    await ensureZipReady();
    try {
      const obj = AV.Object.createWithoutData(CLASS_SUBMITTER, id);
      const it = await obj.fetch();
      const files = it.get('files') || [];
      if (!files.length) return alert('该用户没有提交文件');
      const zip = new JSZip();
      const folder = zip.folder(name || 'user');
      for (const f of files) {
        let fileUrl = '', fileName = '';
        if (typeof f.url === 'function') { fileUrl = f.url(); fileName = f.name(); }
        else { fileUrl = f.url; fileName = f.name; }
        try {
          const resp = await fetch(fileUrl);
          if (!resp.ok) { console.warn('fetch failed', fileUrl); continue; }
          const blob = await resp.blob();
          folder.file(fileName, blob);
        } catch (err) {
          console.warn('download fail', fileUrl, err);
        }
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, `${name || 'user'}_files.zip`);
    } catch (e) {
      console.error(e);
      alert('导出失败：' + e.message);
    }
  },

  // export all
  async exportAll() {
    await ensureZipReady();
    try {
      // get all, sort by order (owner input) but we'll place submitted first later in refresh; here export by order
      const q = new AV.Query(CLASS_SUBMITTER);
      q.equalTo('roomId', ROOM_ID);
      q.ascending('order');
      const rows = await q.find();
      if (!rows.length) return alert('暂无用户可导出');
      const zip = new JSZip();
      for (const it of rows) {
        const name = it.get('name') || 'unknown';
        const files = it.get('files') || [];
        const folder = zip.folder(name);
        if (!files.length) { folder.file('（无文件）.txt', '该用户未提交文件'); continue; }
        for (const f of files) {
          let fileUrl = '', fileName = '';
          if (typeof f.url === 'function') { fileUrl = f.url(); fileName = f.name(); }
          else { fileUrl = f.url; fileName = f.name; }
          try {
            const resp = await fetch(fileUrl);
            if (!resp.ok) { console.warn('fetch failed', fileUrl); continue; }
            const blob = await resp.blob();
            folder.file(fileName, blob);
          } catch (err) {
            console.warn('download fail', fileUrl, err);
          }
        }
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, '全部文件.zip');
    } catch (e) {
      console.error(e);
      alert('导出全部失败：' + e.message);
    }
  },

  // update allowModify from checkbox
  async updateAllowModify() {
    const checked = !!$('allow-modify-checkbox').checked;
    const s = await system._getSystemObj(true);
    s.set('allowModify', checked);
    await s.save();
    alert('已保存：提交后允许修改 = ' + (checked ? '是' : '否'));
  }
};

/* ========== Visitor 功能 ========== */
const visitor = {
  targetObj: null,
  selectedFiles: [],

  async verify() {
    const name = ($('visitor-name-input').value || '').trim();
    if (!name) return alert('请输入姓名');

    const sys = await system._getSystemObj(true);
    const status = sys.get('status');
    if (status === 'paused') return alert('系统已暂停，当前无法提交');

    const q = new AV.Query(CLASS_SUBMITTER);
    q.equalTo('roomId', ROOM_ID);
    q.equalTo('name', name);
    const it = await q.first();
    if (!it) return alert('姓名未在名单中，请联系房主');

    this.targetObj = it;

    // if submitted -> show view page; else go to submit page
    if (it.get('submitted')) {
      // show view page (allow download and maybe re-submit)
      hideAllPages();
      show('page-visitor-view');
      await this.renderSubmittedView();
    } else {
      hideAllPages();
      show('page-visitor-submit');
      // set visitor max
      $('visitor-max-files').textContent = sys.get('maxFiles') || DEFAULT_MAX_FILES;
      // clear selection
      this.selectedFiles = [];
      if ($('visitor-file-list')) $('visitor-file-list').innerHTML = '';
      if ($('selected-count')) $('selected-count').textContent = '0';
    }
  },

  async renderSubmittedView() {
    const it = this.targetObj;
    const sys = await system._getSystemObj(true);
    const allowModify = sys.get('allowModify') === true;
    const files = it.get('files') || [];
    const area = $('visitor-files-display');
    area.innerHTML = '';

    const title = document.createElement('div');
    title.style.fontWeight = '600';
    title.textContent = `你已提交 ${files.length} 个文件`;
    area.appendChild(title);

    files.forEach(f => {
      const link = document.createElement('a');
      let url = '', namef = '';
      if (typeof f.url === 'function') { url = f.url(); namef = f.name(); }
      else { url = f.url; namef = f.name; }
      link.href = url;
      link.textContent = namef;
      link.target = '_blank';
      const p = document.createElement('div');
      p.style.marginTop = '8px';
      p.appendChild(link);
      area.appendChild(p);
    });

    if (allowModify) {
      const note = document.createElement('div');
      note.className = 'small';
      note.style.marginTop = '10px';
      note.textContent = '系统允许修改，若需重新提交请点击“重新提交”按钮';
      area.appendChild(note);
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.style.marginTop = '10px';
      btn.textContent = '重新提交';
      btn.onclick = () => {
        // go to submit page and keep targetObj; show upload area
        hideAllPages();
        show('page-visitor-submit');
        $('visitor-max-files').textContent = sys.get('maxFiles') || DEFAULT_MAX_FILES;
      };
      area.appendChild(btn);
    } else {
      const note = document.createElement('div');
      note.className = 'small';
      note.style.marginTop = '10px';
      note.textContent = '系统设置为提交后不可修改。如需修改请联系房主';
      area.appendChild(note);
    }
  },

  onSelectFiles(files) {
    const arr = Array.from(files || []);
    const max = parseInt($('visitor-max-files').textContent, 10) || DEFAULT_MAX_FILES;
    if (arr.length > max) return alert(`最多允许上传 ${max} 个文件`);
    for (const f of arr) {
      if (f.size > MAX_FILE_BYTES) return alert(`文件 ${f.name} 超过 15MB`);
    }
    this.selectedFiles = arr;
    // render preview list (if exists)
    if ($('visitor-file-list')) $('visitor-file-list').innerHTML = '';
    arr.forEach(f => {
      const wrap = document.createElement('div');
      wrap.style.display = 'inline-block';
      wrap.style.marginRight = '10px';
      if (f.type && f.type.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(f);
        img.className = 'file-preview-img';
        wrap.appendChild(img);
      } else {
        const box = document.createElement('div');
        box.style.width = '100px';
        box.style.height = '100px';
        box.style.display = 'flex';
        box.style.alignItems = 'center';
        box.style.justifyContent = 'center';
        box.style.border = '1px solid #e5e7eb';
        box.style.borderRadius = '8px';
        box.textContent = f.name;
        wrap.appendChild(box);
      }
      if ($('visitor-file-list')) $('visitor-file-list').appendChild(wrap);
    });
  },

  async submit() {
    const sys = await system._getSystemObj(true);
    if (sys.get('status') === 'paused') return alert('系统已暂停，当前无法提交');
    if (!this.targetObj) return alert('未验证身份');
    if (!this.selectedFiles.length) return alert('请选择文件后提交');

    try {
      const it = this.targetObj;
      // upload each file to leancloud
      const uploaded = [];
      for (const f of this.selectedFiles) {
        const avf = new AV.File(f.name, f);
        const saved = await avf.save();
        uploaded.push(saved);
      }
      // set files (overwrite)
      it.set('files', uploaded);
      it.set('submitted', true);
      it.set('submitTime', new Date().toLocaleString());
      await it.save();
      alert('提交成功');
      // 显示感谢文案
const thanksBox = document.getElementById('visitor-thanks');
if (thanksBox) {
    const userName = this.targetObj.get('name');
    thanksBox.innerHTML = `
        感谢 <span style="color:#059669">${userName}</span>
        对本次收集的支持与理解，<br>
        下次访问，我们再会！
    `;
    thanksBox.classList.remove('hidden');
}

      // go to view page
      await this.renderSubmittedView();
      hideAllPages();
      show('page-visitor-view');
      await refreshDashboard();
    } catch (e) {
      console.error(e);
      alert('提交失败：' + e.message);
    }
  },

  cancel() {
    this.selectedFiles = [];
    goHome();
  }
};

/* ========== 刷新房主列表（已提交优先，未提交按 order） ========== */
async function refreshDashboard() {
  const container = $('owner-list');
  container.innerHTML = '';
  // fetch all submitters
  const q = new AV.Query(CLASS_SUBMITTER);
  q.equalTo('roomId', ROOM_ID);
  const rows = await q.find();

  // separate submitted / unsubmitted
  const submitted = rows.filter(r => r.get('submitted') === true).sort((a,b) => {
    // try submitTime descending (newest first)
    const ta = a.get('submitTime') || '';
    const tb = b.get('submitTime') || '';
    if (ta && tb) return ta < tb ? 1 : (ta > tb ? -1 : 0);
    return (b.get('order') || 0) - (a.get('order') || 0);
  });
  const unsubmitted = rows.filter(r => !r.get('submitted')).sort((a,b) => (a.get('order')||0) - (b.get('order')||0));
  let combined = [...submitted, ...unsubmitted];

  // apply search filter
  const kw = ($('owner-search-input').value || '').trim().toLowerCase();
  if (kw) combined = combined.filter(r => (r.get('name') || '').toLowerCase().includes(kw));

  for (const it of combined) {
    const name = it.get('name') || '';
    const submittedFlag = !!it.get('submitted');
    const submitTime = it.get('submitTime') || '';
    const files = it.get('files') || [];

    const row = document.createElement('div');
    row.className = 'grid-row';

    const c1 = document.createElement('div'); c1.style.gridColumn = 'span 2'; c1.textContent = name;
    const c2 = document.createElement('div'); c2.style.gridColumn = 'span 1'; c2.style.textAlign = 'center';
    c2.innerHTML = submittedFlag ? '<span style="background:#10b981;padding:6px;border-radius:6px;color:white;font-weight:600">已提交</span>' : '<span style="background:#e5f6ee;padding:6px;border-radius:6px;color:#065f46;font-weight:600">未提交</span>';
    const c3 = document.createElement('div'); c3.style.gridColumn = 'span 1'; c3.style.textAlign = 'center'; c3.textContent = submitTime;
    const c4 = document.createElement('div'); c4.style.gridColumn = 'span 1'; c4.style.textAlign = 'center'; c4.textContent = files.length;
    const c5 = document.createElement('div'); c5.style.gridColumn = 'span 2'; c5.style.textAlign = 'center';

    const btnExport = document.createElement('button'); btnExport.className = 'btn-small'; btnExport.textContent = '导出'; btnExport.onclick = () => owner.exportOne(it.id, name);
    const btnDelete = document.createElement('button'); btnDelete.className = 'btn-small btn-danger'; btnDelete.textContent = '删除'; btnDelete.style.marginLeft = '8px'; btnDelete.onclick = () => { if (confirm('确认删除该用户？')) owner.delete(it.id); };

    c5.appendChild(btnExport);
    c5.appendChild(btnDelete);

    row.appendChild(c1); row.appendChild(c2); row.appendChild(c3); row.appendChild(c4); row.appendChild(c5);
    container.appendChild(row);
  }
}

/* ========== 页面初始化 ========== */
document.addEventListener('DOMContentLoaded', async () => {
  // initial show home
  goHome();

  // ensure system object exists and UI updated
  try { await system._getSystemObj(true); await system.updateUI(); } catch (e) { console.error(e); }

  // hook up buttons that were inline in HTML (start/pause/resume/end)
  $('btn-start') && ($('btn-start').onclick = () => system.start());
  $('btn-pause') && ($('btn-pause').onclick = () => system.pause());
  $('btn-resume') && ($('btn-resume').onclick = () => system.resume());
  $('btn-end') && ($('btn-end').onclick = () => system.end());

  // reset dialog buttons
  // The HTML buttons call owner.resetAll / owner.resetFilesOnly / owner.hideResetDialog directly

  // drag/drop area
  const area = $('upload-area');
  if (area) {
    area.addEventListener('dragover', e => { e.preventDefault(); area.style.borderColor = '#10b981'; });
    area.addEventListener('dragleave', e => { e.preventDefault(); area.style.borderColor = '#9ca3af'; });
    area.addEventListener('drop', e => {
      e.preventDefault(); area.style.borderColor = '#9ca3af';
      const files = e.dataTransfer.files;
      if (files && files.length) visitor.onSelectFiles(files);
    });
  }

  // file input
  const fileInput = $('visitor-file-input');
  if (fileInput) fileInput.onchange = function() { visitor.onSelectFiles(this.files); };

  // import file input (if present)
  const imp = $('import-file');
  if (imp) imp.onchange = function() {
    const f = this.files && this.files[0];
    if (!f) return;
    readFileAsText(f).then(async txt => {
      // split lines
      const rows = txt.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      // create new entries if not exist
      const q = new AV.Query(CLASS_SUBMITTER);
      q.equalTo('roomId', ROOM_ID);
      const exist = await q.find();
      const names = exist.map(x => x.get('name'));
      const toCreate = [];
      for (const n of rows) {
        if (!names.includes(n)) {
          const C = AV.Object.extend(CLASS_SUBMITTER);
          const o = new C();
          o.set('roomId', ROOM_ID);
          o.set('name', n);
          o.set('submitted', false);
          o.set('files', []);
          o.set('submitTime', '');
          o.set('order', Date.now() + Math.floor(Math.random() * 1000));
          const acl = new AV.ACL(); acl.setPublicReadAccess(true); acl.setPublicWriteAccess(true); o.setACL(acl);
          toCreate.push(o);
        }
      }
      if (toCreate.length) await AV.Object.saveAll(toCreate);
      alert('导入完成：新增 ' + toCreate.length + ' 条');
      imp.value = '';
      await refreshDashboard();
    }).catch(err => { console.error(err); alert('读取导入文件失败'); });
  };

  // initial refresh of dashboard (if owner logged in)
  await refreshDashboard();
});

/* ========== 小工具函数 ========== */
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsText(file);
  });
}

/* expose for debugging */
window.goHome = goHome;
window.goVisitor = goVisitor;
window.goOwnerLogin = goOwnerLogin;
window.owner = owner;
window.visitor = visitor;
window.system = system;
window.refreshDashboard = refreshDashboard;
