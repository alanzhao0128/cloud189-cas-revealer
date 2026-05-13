'use strict';

// ─── State ───
const state = {
  sessionKey: null,
  accessToken: null,
  folderId: '-11',
  tabId: null,
  casList: [],
  selectedCas: new Set()
};

// ─── DOM ───
const $ = (id) => document.getElementById(id);
const scanBtn = $('scan-btn');
const uploadBtn = $('upload-btn');
const verifyBtn = $('verify-btn');
const deleteCasCheckbox = $('delete-cas-checkbox');
const resultsList = $('results-list');
const resultsCount = $('results-count');
const resultsSection = $('results-section');
const uploadSection = $('upload-section');
const progressSection = $('progress-section');
const progressFill = $('progress-fill');
const progressText = $('progress-text');
const logSection = $('log-section');
const logOutput = $('log-output');
const errorMsg = $('error-msg');
const sessionStatus = $('session-status');
const folderPathEl = $('folder-path');
const selectAllBtn = $('select-all-btn');
const refreshBtn = $('refresh-btn');

// ─── Send message with timeout ───
function sendBg(msg, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('与后台通信超时，请刷新 cloud.189.cn 后重试')), timeoutMs);
    chrome.runtime.sendMessage(msg, (resp) => {
      clearTimeout(timer);
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(resp);
    });
  });
}

// ─── Init ───
(async function init() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  let match = tab.url && tab.url.match(/https:\/\/(?:m\.)?cloud\.189\.cn/);
  if (!match) {
    showError('请在 cloud.189.cn 页面打开此扩展');
    return;
  }
  state.tabId = tab.id;
  await refreshSessionInfo();
})();

async function refreshSessionInfo() {
  try {
    const info = await chrome.tabs.sendMessage(state.tabId, { type: 'getSessionInfo' });
    if (info && info.sessionKey) {
      state.sessionKey = info.sessionKey;
      state.accessToken = info.accessToken || null;
      state.folderId = info.folderId || '-11';
      sessionStatus.textContent = '已连接';
      sessionStatus.className = 'value status-badge connected';
      folderPathEl.textContent = state.folderId;
      scanBtn.disabled = false;
      hideError();
    } else {
      sessionStatus.textContent = '未登录';
      sessionStatus.className = 'value status-badge disconnected';
      folderPathEl.textContent = state.folderId || '—';
      showError('未能获取 SessionKey，请先登录 cloud.189.cn');
    }
  } catch (e) {
    sessionStatus.textContent = '连接失败';
    sessionStatus.className = 'value status-badge disconnected';
    showError('无法连接到云盘页面，请刷新 cloud.189.cn 后重试');
  }
}

// ─── Refresh session / folder ───
refreshBtn.addEventListener('click', async () => {
  refreshBtn.classList.add('spinning');
  await refreshSessionInfo();
  setTimeout(() => refreshBtn.classList.remove('spinning'), 600);
});

// ─── Scan CAS files ───
scanBtn.addEventListener('click', async () => {
  resetScan();
  logSection.classList.remove('hidden');
  resultsSection.classList.remove('hidden');
  addLog('正在获取文件列表...');

  try {
    const allFiles = await sendBg({ type: 'listFiles', folderId: state.folderId, pageNum: 1 });
    if (!allFiles || allFiles.error) {
      throw new Error(allFiles?.error || '获取文件列表失败');
    }
    if (!allFiles.fileListAO) {
      // Try raw response - maybe it's the list directly?
      if (Array.isArray(allFiles)) {
        // Unexpected format
        throw new Error('响应格式异常，请确认已登录云盘');
      }
      throw new Error('响应中没有文件列表：' + JSON.stringify(allFiles).substring(0, 100));
    }
    const casFiles = (allFiles.fileListAO.fileList || []).filter(f => f.name && f.name.toLowerCase().endsWith('.cas'));

    if (casFiles.length === 0) {
      resultsList.innerHTML = '<div class="empty">当前目录没有 .cas 文件</div>';
      resultsCount.textContent = '0 个 CAS 文件';
      restoreScanBtn();
      logSection.classList.add('hidden');
      return;
    }

    addLog(`找到 ${casFiles.length} 个 CAS 文件`);
    resultsCount.textContent = `${casFiles.length} 个 CAS 文件`;
    resultsList.innerHTML = '';
    state.casList = [];
    state.selectedCas.clear();

    for (let i = 0; i < casFiles.length; i++) {
      const casFile = casFiles[i];

      // Show placeholder while downloading
      appendResultItem(i, { name: casFile.name, size: 0, md5: '...' }, false, true);

      let parsed = null;
      addLog(`[${i + 1}/${casFiles.length}] 解析: ${casFile.name}`);

      try {
        const resp = await sendBg({ type: 'downloadFileContent', fileId: casFile.id });
        if (resp && resp.error) throw new Error(resp.error);
        const content = (resp && resp.content) || resp;
        parsed = parseCasContent(content ? String(content) : '');
      } catch (e) {
        addLog(`  ✗ 下载失败: ${e.message}`, 'err');
        updateResultItem(i, null, 'fail');
        continue;
      }

      if (parsed && parsed.md5 && parsed.sliceMd5) {
        parsed.name = mergeCasFileName(casFile.name, parsed.name);
        parsed._casFile = casFile.name;
        parsed._casFileId = casFile.id;
        parsed._index = i;
        state.casList.push(parsed);
        state.selectedCas.add(i);
        updateResultItem(i, parsed, 'ok');
      } else {
        addLog(`  ⚠ 解析失败，缺少必要字段`);
        updateResultItem(i, null, 'fail');
      }
    }

    selectAllBtn.textContent = state.casList.length > 0 ? '取消全选' : '全选';
    restoreScanBtn();
    if (state.casList.length === 0) {
      resultsList.innerHTML += '<div class="empty">未能解析任何 CAS 文件</div>';
      uploadSection.classList.add('hidden');
    } else {
      uploadSection.classList.remove('hidden');
      updateUploadBtn();
    }
  } catch (e) {
    addLog(`✗ 扫描失败: ${e.message}`, 'err');
    resultsList.innerHTML = `<div class="error">扫描失败: ${e.message}</div>`;
    restoreScanBtn();
  }
});

function resetScan() {
  scanBtn.disabled = true;
  scanBtn.textContent = '扫描中...';
  hideError();
  resultsList.innerHTML = '<div class="loading">正在扫描目录...</div>';
}

function restoreScanBtn() {
  scanBtn.disabled = false;
  scanBtn.textContent = '扫描 CAS 文件';
}

function appendResultItem(index, cas, checked, loading) {
  const div = document.createElement('div');
  div.className = 'result-item';
  div.id = `cas-item-${index}`;
  const meta = loading
    ? '<span class="spinner"></span> 解析中...'
    : `${formatSize(cas.size)} | MD5: ${(cas.md5 || '').substring(0, 8)}...`;
  div.innerHTML = `
    <input type="checkbox" class="cas-checkbox" data-index="${index}" ${checked ? 'checked' : ''} ${loading ? 'disabled' : ''}>
    <div class="result-info">
      <div class="result-name" title="${cas.name}">${cas.name}</div>
      <div class="result-meta">${meta}</div>
    </div>
  `;
  resultsList.appendChild(div);

  if (!loading) {
    div.querySelector('.cas-checkbox').addEventListener('change', (e) => {
      if (e.target.checked) state.selectedCas.add(index);
      else state.selectedCas.delete(index);
      updateUploadBtn();
    });
  }
}

function updateResultItem(index, cas, status) {
  const item = document.getElementById(`cas-item-${index}`);
  if (!item) return;
  if (status === 'fail') {
    item.classList.add('result-fail');
    item.querySelector('.result-meta').textContent = '解析失败';
    item.querySelector('.cas-checkbox').disabled = true;
    item.querySelector('.cas-checkbox').checked = false;
    state.selectedCas.delete(index);
  } else if (cas) {
    item.querySelector('.result-name').textContent = cas.name;
    item.querySelector('.result-name').title = cas.name;
    item.querySelector('.result-meta').textContent = `${formatSize(cas.size)} | MD5: ${(cas.md5 || '').substring(0, 8)}...`;
    const cb = item.querySelector('.cas-checkbox');
    cb.disabled = false;
    cb.checked = true;
    cb.addEventListener('change', (e) => {
      if (e.target.checked) state.selectedCas.add(index);
      else state.selectedCas.delete(index);
      updateUploadBtn();
    });
  }
}

function updateUploadBtn() {
  const count = state.selectedCas.size;
  verifyBtn.textContent = `验证 (${count})`;
  verifyBtn.disabled = count === 0;
  uploadBtn.textContent = `秒传还原 (${count})`;
  uploadBtn.disabled = count === 0;
}

// ─── Select all ───
selectAllBtn.addEventListener('click', () => {
  const anyChecked = document.querySelectorAll('.cas-checkbox:checked').length > 0;
  if (anyChecked) {
    state.selectedCas.clear();
    document.querySelectorAll('.cas-checkbox:not(:disabled)').forEach(cb => { cb.checked = false; });
  } else {
    state.casList.forEach((_item, i) => {
      state.selectedCas.add(i);
      const cb = document.querySelector(`.cas-checkbox[data-index="${i}"]`);
      if (cb && !cb.disabled) cb.checked = true;
    });
  }
  selectAllBtn.textContent = anyChecked ? '全选' : '取消全选';
  updateUploadBtn();
});

// ─── Verify CAS existence ───
verifyBtn.addEventListener('click', async () => {
  const selected = state.casList.filter((_item, i) => state.selectedCas.has(i));
  if (selected.length === 0 || !state.sessionKey) return;

  verifyBtn.disabled = true;
  uploadBtn.disabled = true;
  scanBtn.disabled = true;
  progressSection.classList.remove('hidden');
  logSection.classList.remove('hidden');
  logOutput.innerHTML = '';

  let existCount = 0, failCount = 0;
  for (let i = 0; i < selected.length; i++) {
    const cas = selected[i];
    updateProgress(i + 1, selected.length);
    addLog(`验证: ${cas.name}`);
    try {
      const result = await sendBg({ type: 'verifyCas', sessionKey: state.sessionKey, folderId: state.folderId, fileInfo: { name: cas.name, size: cas.size, md5: cas.md5, sliceMd5: cas.sliceMd5 } }, 60000);
      if (result.exists) {
        existCount++;
        addLog(`  ✓ 存在`, 'ok');
        markResultItem(cas._index, 'verify-ok');
      } else {
        failCount++;
        addLog(`  ✗ 不存在`, 'err');
        if (result.detail) addLog(`  响应: ${result.detail}`, 'err');
        markResultItem(cas._index, 'verify-fail');
      }
    } catch (e) {
      failCount++;
      addLog(`  ✗ ${e.message}`, 'err');
      markResultItem(cas._index, 'verify-fail');
    }
  }

  updateProgress(selected.length, selected.length);
  addLog(`验证完成: ${existCount} 存在, ${failCount} 不存在`);
  scanBtn.disabled = false;
  verifyBtn.disabled = false;
  updateUploadBtn();
});

// ─── Batch upload ───
uploadBtn.addEventListener('click', async () => {
  const selected = state.casList.filter((_item, i) => state.selectedCas.has(i));
  if (selected.length === 0 || !state.sessionKey) return;

  uploadBtn.disabled = true;
  scanBtn.disabled = true;
  progressSection.classList.remove('hidden');
  logSection.classList.remove('hidden');
  logOutput.innerHTML = '';

  const deleteCas = deleteCasCheckbox.checked;
  let successCount = 0, failCount = 0;

  for (let i = 0; i < selected.length; i++) {
    const cas = selected[i];
    updateProgress(i + 1, selected.length);
    addLog(`秒传: ${cas.name}`);
    try {
      const result = await sendBg({ type: 'rapidUpload', sessionKey: state.sessionKey, folderId: state.folderId, fileInfo: { name: cas.name, size: cas.size, md5: cas.md5, sliceMd5: cas.sliceMd5 } }, 60000);
      if (result.success) {
        successCount++;
        addLog(`✓ ${cas.name}`, 'ok');
        markResultItem(cas._index, 'success');
        if (deleteCas && cas._casFileId) {
          try {
            await sendBg({ type: 'deleteFile', fileId: cas._casFileId, fileName: cas._casFile, parentId: state.folderId });
            addLog(`  已删除: ${cas._casFile}`, 'ok');
          } catch (e) { addLog(`  删除失败: ${e.message}`, 'err'); }
        }
      } else {
        failCount++;
        addLog(`✗ ${cas.name}: ${result.error || '未知错误'}`, 'err');
        if (result.detail) addLog(`  响应: ${result.detail}`, 'err');
        markResultItem(cas._index, 'fail');
      }
    } catch (e) {
      failCount++;
      addLog(`✗ ${cas.name}: ${e.message}`, 'err');
      markResultItem(cas._index, 'fail');
    }
  }

  updateProgress(selected.length, selected.length);
  addLog(`完成: ${successCount} 成功, ${failCount} 失败`);
  scanBtn.disabled = false;
  uploadBtn.textContent = '秒传还原 (0)';
  uploadBtn.disabled = true;
  state.selectedCas.clear();
});

// ─── CAS content parser ───
function parseCasContent(content) {
  content = content.trim();
  if (content.startsWith('{')) {
    try { return normalize(JSON.parse(content)); } catch (e) {}
  }
  try {
    const decoded = atob(content);
    if (decoded.startsWith('{')) return normalize(JSON.parse(decoded));
  } catch (e) {}
  const lines = content.split(/[\n\r]+/).filter(l => l.trim());
  for (const line of lines) {
    try {
      const decoded = atob(line.trim());
      if (decoded.startsWith('{')) return normalize(JSON.parse(decoded));
    } catch (e) {}
    try {
      if (line.trim().startsWith('{')) return normalize(JSON.parse(line.trim()));
    } catch (e) {}
  }
  if (content.includes('|')) {
    const parts = content.split('|');
    if (parts.length >= 4) {
      return { md5: parts[2].toUpperCase(), sliceMd5: parts[3].toUpperCase(), size: parseInt(parts[1]), name: parts[0] };
    }
  }
  return null;
}

function normalize(jsonData) {
  const md5 = (jsonData.md5 || '').toUpperCase();
  const sliceMd5 = (jsonData.slice_md5 || jsonData.sliceMd5 || jsonData.SliceMd5 || '').toUpperCase();
  const size = jsonData.size || jsonData.fileSize || 0;
  const name = jsonData.name || '';
  if (md5 && sliceMd5 && size && name) return { md5, sliceMd5, size: parseInt(size), name };
  return null;
}

function mergeCasFileName(casFileName, parsedName) {
  const base = String(casFileName || '').replace(/\.cas$/i, '');
  const baseSuffix = (base.lastIndexOf('.') > 0 ? base.substring(base.lastIndexOf('.')) : '');
  const parsedSuffix = (parsedName.lastIndexOf('.') > 0 ? parsedName.substring(parsedName.lastIndexOf('.')) : '');
  if (!parsedSuffix || baseSuffix.toLowerCase() === parsedSuffix.toLowerCase()) return base;
  return base + parsedSuffix;
}

function markResultItem(index, status) {
  const item = document.getElementById(`cas-item-${index}`);
  if (!item) return;
  if (status === 'success') item.classList.add('result-success');
  if (status === 'fail') item.classList.add('result-fail');
  if (status === 'verify-ok') item.classList.add('result-verify-ok');
  if (status === 'verify-fail') item.classList.add('result-verify-fail');
}

// ─── UI helpers ───
function updateProgress(current, total) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  progressFill.style.width = pct + '%';
  progressText.textContent = `${current}/${total}`;
}

function addLog(msg, cls) {
  const line = document.createElement('div');
  line.className = 'log-line' + (cls ? ' ' + cls : '');
  line.textContent = msg;
  logOutput.appendChild(line);
  logOutput.scrollTop = logOutput.scrollHeight;
}

function formatSize(bytes) {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return bytes + ' B';
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.remove('hidden');
}

function hideError() {
  errorMsg.classList.add('hidden');
  errorMsg.textContent = '';
}
