'use strict';

// Service worker: API proxy + upload crypto signing.
// HMAC-SHA1, AES-ECB → Web Crypto API. RSA → JSEncrypt via importScripts.

// JSEncrypt needs `window` global for initialization
self.window = self;
importScripts('lib/crypto-js.min.js', 'lib/jsencrypt.min.js');

const WEB_URL = 'https://cloud.189.cn';
const API_URL = 'https://api.cloud.189.cn';
const UPLOAD_URL = 'https://upload.cloud.189.cn';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36';

// ─── Simple MD5 (for RSA key request signing) ───
function pad32(x, n) {
  let h = (x >>> 0).toString(16);
  while (h.length < n * 2) h = '0' + h;
  return h;
}
function simpleMD5(str) {
  function nS(s, l) {
    var r = [1732584193, -271733879, -1732584194, 271733878], i;
    for (i = 64; i <= s.length; i += 64) { nC(r, nB(s.substring(i - 64, i))); }
    var t = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
    for (i = 0; i < s.length; i++) t[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
    t[i >> 2] |= 0x80 << ((i % 4) << 3);
    if (i > 55) { nC(r, t); for (i = 0; i < 16; i++) t[i] = 0; }
    t[14] = s.length * 8;
    nC(r, t);
    return r;
  }
  function nB(s) { var b = [], i; for (i = 0; i < 64; i += 4) b[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24); return b; }
  function a32(a, b) { return (a + b) & 0xFFFFFFFF; }
  function cF(q, a, b, x, s, t) { a = a32(a32(a, q), a32(x, t)); return a32((a << s) | (a >>> (32 - s)), b); }
  function ff(a,b,c,d,x,s,t){return cF((b&c)|((~b)&d),a,b,x,s,t);}
  function gg(a,b,c,d,x,s,t){return cF((b&d)|(c&(~d)),a,b,x,s,t);}
  function hh(a,b,c,d,x,s,t){return cF(b^c^d,a,b,x,s,t);}
  function ii(a,b,c,d,x,s,t){return cF(c^(b|(~d)),a,b,x,s,t);}
  function nC(x, k) {
    var a=x[0],b=x[1],c=x[2],d=x[3];
    a=ff(a,b,c,d,k[0],7,-680876936);d=ff(d,a,b,c,k[1],12,-389564586);c=ff(c,d,a,b,k[2],17,606105819);b=ff(b,c,d,a,k[3],22,-1044525330);
    a=ff(a,b,c,d,k[4],7,-176418897);d=ff(d,a,b,c,k[5],12,1200080426);c=ff(c,d,a,b,k[6],17,-1473231341);b=ff(b,c,d,a,k[7],22,-45705983);
    a=ff(a,b,c,d,k[8],7,1770035416);d=ff(d,a,b,c,k[9],12,-1958414417);c=ff(c,d,a,b,k[10],17,-42063);b=ff(b,c,d,a,k[11],22,-1990404162);
    a=ff(a,b,c,d,k[12],7,1804603682);d=ff(d,a,b,c,k[13],12,-40341101);c=ff(c,d,a,b,k[14],17,-1502002290);b=ff(b,c,d,a,k[15],22,1236535329);
    a=gg(a,b,c,d,k[1],5,-165796510);d=gg(d,a,b,c,k[6],9,-1069501632);c=gg(c,d,a,b,k[11],14,643717713);b=gg(b,c,d,a,k[0],20,-373897302);
    a=gg(a,b,c,d,k[5],5,-701558691);d=gg(d,a,b,c,k[10],9,38016083);c=gg(c,d,a,b,k[15],14,-660478335);b=gg(b,c,d,a,k[4],20,-405537848);
    a=gg(a,b,c,d,k[9],5,568446438);d=gg(d,a,b,c,k[14],9,-1019803690);c=gg(c,d,a,b,k[3],14,-187363961);b=gg(b,c,d,a,k[8],20,1163531501);
    a=gg(a,b,c,d,k[13],5,-1444681467);d=gg(d,a,b,c,k[2],9,-51403784);c=gg(c,d,a,b,k[7],14,1735328473);b=gg(b,c,d,a,k[12],20,-1926607734);
    a=hh(a,b,c,d,k[5],4,-378558);d=hh(d,a,b,c,k[8],11,-2022574463);c=hh(c,d,a,b,k[11],16,1839030562);b=hh(b,c,d,a,k[14],23,-35309556);
    a=hh(a,b,c,d,k[1],4,-1530992060);d=hh(d,a,b,c,k[4],11,1272893353);c=hh(c,d,a,b,k[7],16,-155497632);b=hh(b,c,d,a,k[10],23,-1094730640);
    a=hh(a,b,c,d,k[13],4,681279174);d=hh(d,a,b,c,k[0],11,-358537222);c=hh(c,d,a,b,k[3],16,-722521979);b=hh(b,c,d,a,k[6],23,76029189);
    a=hh(a,b,c,d,k[9],4,-640364487);d=hh(d,a,b,c,k[12],11,-421815835);c=hh(c,d,a,b,k[15],16,530742520);b=hh(b,c,d,a,k[2],23,-995338651);
    a=ii(a,b,c,d,k[0],6,-198630844);d=ii(d,a,b,c,k[7],10,1126891415);c=ii(c,d,a,b,k[14],15,-1416354905);b=ii(b,c,d,a,k[5],21,-57434055);
    a=ii(a,b,c,d,k[12],6,1700485571);d=ii(d,a,b,c,k[3],10,-1894986606);c=ii(c,d,a,b,k[10],15,-1051523);b=ii(b,c,d,a,k[1],21,-2054922799);
    a=ii(a,b,c,d,k[8],6,1873313359);d=ii(d,a,b,c,k[15],10,-30611744);c=ii(c,d,a,b,k[6],15,-1560198380);b=ii(b,c,d,a,k[13],21,1309151649);
    a=ii(a,b,c,d,k[4],6,-145523070);d=ii(d,a,b,c,k[11],10,-1120210379);c=ii(c,d,a,b,k[2],15,718787259);b=ii(b,c,d,a,k[9],21,-343485551);
    x[0]=a32(a,x[0]);x[1]=a32(b,x[1]);x[2]=a32(c,x[2]);x[3]=a32(d,x[3]);
  }
  var o = nS(str);
  return pad32(o[0],4) + pad32(o[1],4) + pad32(o[2],4) + pad32(o[3],4);
}

// ─── Utility ───
function randomString(n) {
  const chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678';
  let s = '';
  for (let i = 0; i < n; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

function randomUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function timestamp() {
  return Math.floor(Date.now() / 1000).toString();
}

function hexToArr(hex) {
  const arr = [];
  for (let i = 0; i < hex.length; i += 2) arr.push(parseInt(hex.substring(i, i + 2), 16));
  return arr;
}

function arrToHex(arr) {
  return arr.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

// ─── AES-ECB + HMAC-SHA1 (CryptoJS via importScripts) ───
function aesEncrypt(data, key) {
  // data: { key: val, ... }, key: uuid string
  const params = Object.entries(data).map(([k, v]) => `${k}=${v}`).join('&');
  return CryptoJS.AES.encrypt(
    CryptoJS.enc.Utf8.parse(params),
    CryptoJS.enc.Utf8.parse(key),
    { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 }
  ).ciphertext.toString().toUpperCase();
}

function hmacSha1Str(data, key) {
  // data: { key: val, ... }, key: uuid string
  const params = Object.entries(data).map(([k, v]) => `${k}=${v}`).join('&');
  return CryptoJS.HmacSHA1(params, key).toString().toUpperCase();
}

// ─── RSA PKCS1v1.5 encrypt (JSEncrypt via importScripts) ───
function rsaEncryptBase64(publicKey, data) {
  // Format PEM properly
  const body = publicKey
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace(/[\n\r ]/g, '');
  const pem = `-----BEGIN PUBLIC KEY-----\n${body}\n-----END PUBLIC KEY-----`;
  const jsEncrypt = new self.JSEncrypt();
  jsEncrypt.setPublicKey(pem);
  const encrypted = jsEncrypt.encrypt(data);
  if (!encrypted) throw new Error('RSA 加密失败');
  return encrypted;
}

// ─── Upload request builder ───
async function buildUploadRequest(sessionKey, rsaKey, requestUri, params, method) {
  method = method || 'GET';
  const uuid = randomString(16);
  const ts = timestamp();
  const encryptedParams = aesEncrypt(params, uuid);
  const encryptionText = rsaEncryptBase64(rsaKey.pubKey, uuid);
  const signature = hmacSha1Str({
    SessionKey: sessionKey,
    Operate: method,
    RequestURI: requestUri,
    Date: ts,
    params: encryptedParams
  }, uuid);

  return {
    url: `${UPLOAD_URL}${requestUri}?params=${encryptedParams}`,
    headers: {
      'X-Request-Date': ts,
      'X-Request-ID': randomUUID(),
      'SessionKey': sessionKey,
      'EncryptionText': encryptionText,
      'PkId': rsaKey.pkId,
      'Signature': signature,
      'User-Agent': UA
    }
  };
}

// ─── partSize ───
function partSize(fileSize) {
  const D = 10485760;
  if (fileSize > D * 2 * 999) return Math.max(Math.ceil(fileSize / 1999 / D), 5) * D;
  if (fileSize > D * 999) return D * 2;
  return D;
}

// ─── RSA key cache ───
let cachedRsaKey = null;

async function fetchRsaKey(sessionKey) {
  if (cachedRsaKey && cachedRsaKey.expire > Date.now()) return cachedRsaKey;

  const ts = timestamp();
  const signParams = { AppKey: '600100422', Timestamp: ts };
  const paramStr = Object.entries(signParams).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => `${k}=${v}`).join('&');
  const signature = simpleMD5(paramStr);

  const resp = await fetch(
    `${WEB_URL}/api/security/generateRsaKey.action?sessionKey=${encodeURIComponent(sessionKey)}`,
    {
      headers: {
        'Sign-Type': '1', 'Signature': signature, 'Timestamp': ts,
        'AppKey': '600100422', 'SessionKey': sessionKey,
        'User-Agent': UA, 'Accept': 'application/json'
      }, credentials: 'include'
    }
  );
  const text = await resp.text();
  let result;
  try { result = JSON.parse(text); } catch (e) { result = parseXmlRsa(text); }
  if (result.errorCode) throw new Error(result.errorCode === 'InvalidSessionKey' ? '登录已过期' : (result.errorMsg || result.errorCode));
  if (!result.pubKey) throw new Error('RSA 密钥无效');

  cachedRsaKey = {
    pubKey: result.pubKey,
    pkId: result.pkId,
    expire: result.expire || (Date.now() + 300000)
  };
  return cachedRsaKey;
}

function parseXmlRsa(xml) {
  const result = {};
  ['pubKey', 'pkId', 'expire', 'ver'].forEach(name => {
    const re = new RegExp(`<${name}[^>]*>([^<]*)</${name}>`, 'i');
    const m = xml.match(re);
    if (m) result[name] = name === 'expire' ? parseInt(m[1]) : m[1].trim();
  });
  return result;
}

// ─── Verify CAS existence (init + check only, no commit) ───
async function verifyCas(sessionKey, folderId, fileInfo) {
  const rsaKey = await fetchRsaKey(sessionKey);
  const sliceSize = partSize(fileInfo.size);

  const initParams = {
    parentFolderId: folderId,
    fileName: encodeURIComponent(fileInfo.name),
    fileSize: fileInfo.size,
    sliceSize: sliceSize,
    lazyCheck: '1'
  };
  const initReq = await buildUploadRequest(sessionKey, rsaKey, '/person/initMultiUpload', initParams, 'GET');
  const initResp = await fetch(initReq.url, { headers: initReq.headers });
  const initResult = await initResp.json();
  if (initResult.errorCode) return { exists: false, error: initResult.errorMsg || initResult.errorCode };
  if (initResult.code !== 'SUCCESS') return { exists: false, error: initResult.msg || '初始化失败' };

  const checkReq = await buildUploadRequest(sessionKey, rsaKey, '/person/checkTransSecond', {
    fileMd5: fileInfo.md5,
    sliceMd5: fileInfo.sliceMd5,
    uploadFileId: initResult.data.uploadFileId
  }, 'GET');
  const checkResp = await fetch(checkReq.url, { headers: checkReq.headers });
  const checkResult = await checkResp.json();
  if (checkResult.errorCode) return { exists: false, error: checkResult.errorMsg || checkResult.errorCode };
  return { exists: !!(checkResult.data && checkResult.data.fileDataExists), detail: JSON.stringify(checkResult) };
}

// ─── Rapid upload 3-step ───
async function rapidUpload(sessionKey, folderId, fileInfo) {
  const rsaKey = await fetchRsaKey(sessionKey);
  const sliceSize = partSize(fileInfo.size);

  // Step 1: initMultiUpload (match TM script: use lazyCheck, defer hash check to step 2)
  const initParams = {
    parentFolderId: folderId,
    fileName: encodeURIComponent(fileInfo.name),
    fileSize: fileInfo.size,
    sliceSize: sliceSize,
    lazyCheck: '1'
  };
  const initReq = await buildUploadRequest(sessionKey, rsaKey, '/person/initMultiUpload', initParams, 'GET');
  const initResp = await fetch(initReq.url, { headers: initReq.headers });
  const initResult = await initResp.json();
  if (initResult.errorCode) return { success: false, error: initResult.errorMsg || initResult.errorCode };
  if (initResult.code !== 'SUCCESS') return { success: false, error: initResult.msg || '初始化失败' };
  const uploadFileId = initResult.data.uploadFileId;

  // Step 2: checkTransSecond
  const checkReq = await buildUploadRequest(sessionKey, rsaKey, '/person/checkTransSecond', {
    fileMd5: fileInfo.md5,
    sliceMd5: fileInfo.sliceMd5,
    uploadFileId: uploadFileId
  }, 'GET');
  const checkResp = await fetch(checkReq.url, { headers: checkReq.headers });
  const checkResult = await checkResp.json();
  if (checkResult.errorCode) return { success: false, error: checkResult.errorMsg || checkResult.errorCode };
  if (!checkResult.data || !checkResult.data.fileDataExists) {
    return { success: false, error: '文件不存在于云端 CAS，无法秒传', detail: JSON.stringify(checkResult) };
  }

  // Step 3: commitMultiUpload
  const commitReq = await buildUploadRequest(sessionKey, rsaKey, '/person/commitMultiUploadFile', {
    uploadFileId: uploadFileId,
    fileMd5: fileInfo.md5,
    sliceMd5: fileInfo.sliceMd5,
    lazyCheck: 1,
    opertype: '3'
  }, 'GET');
  const commitResp = await fetch(commitReq.url, { headers: commitReq.headers });
  const commitResult = await commitResp.json();
  if (commitResult.errorCode) return { success: false, error: commitResult.errorMsg || commitResult.errorCode };
  if (commitResult.code !== 'SUCCESS') return { success: false, error: commitResult.msg || '提交失败' };

  return { success: true };
}

// Open side panel when extension icon clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// ─── Message handler ───
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  handleRequest(request).then(sendResponse).catch(e => sendResponse({ error: e.message }));
  return true;
});

async function handleRequest(req) {
  switch (req.type) {

    case 'listFiles': {
      const folderId = req.folderId || '-11';
      const pageNum = req.pageNum || 1;
      const resp = await fetch(
        `${WEB_URL}/api/open/file/listFiles.action?folderId=${folderId}&mediaType=0&orderBy=lastOpTime&descending=true&pageNum=${pageNum}&pageSize=60`,
        { headers: { 'Accept': 'application/json;charset=UTF-8', 'Sign-Type': '1', 'User-Agent': UA }, credentials: 'include' }
      );
      return await resp.json();
    }

    case 'downloadFileContent': {
      const fileId = req.fileId;
      const resp = await fetch(`${WEB_URL}/api/open/file/getFileDownloadUrl.action?fileId=${fileId}`, {
        headers: { 'Accept': 'application/json;charset=UTF-8', 'Sign-Type': '1', 'User-Agent': UA }, credentials: 'include'
      });
      const result = await resp.json();
      const downloadUrl = result.fileDownloadUrl || result.downloadUrl;
      if (!downloadUrl) throw new Error('无法获取下载链接');
      const dlResp = await fetch(downloadUrl, { headers: { 'User-Agent': UA } });
      return { content: await dlResp.text() };
    }

    case 'deleteFile': {
      const fileId = req.fileId;
      const parentId = req.parentId || '-11';
      const taskInfos = JSON.stringify([{ fileId, fileName: req.fileName, isFolder: 0 }]);
      const params = new URLSearchParams({ taskInfos, type: 'DELETE', targetFolderId: parentId });
      const resp = await fetch(`${WEB_URL}/api/open/batch/createBatchTask.action?noCache=${Math.random()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json;charset=UTF-8', 'Sign-Type': '1', 'User-Agent': UA },
        body: params.toString(),
        credentials: 'include'
      });
      return await resp.json();
    }

    case 'rapidUpload': {
      const { sessionKey, folderId, fileInfo } = req;
      return await rapidUpload(sessionKey, folderId, fileInfo);
    }

    case 'verifyCas': {
      const { sessionKey, folderId, fileInfo } = req;
      return await verifyCas(sessionKey, folderId, fileInfo);
    }

    default:
      return { error: 'Unknown request type: ' + req.type };
  }
}
