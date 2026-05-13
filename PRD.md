# cloud189-cas-revealer PRD (v2)

## 一句话

Chrome 扩展，扫描天翼云盘目录中的 CAS 占位文件，解析其内容，通过秒传接口在原路径下还原为真实文件。

---

## 1. CAS 文件是什么

天翼云盘底层使用 CAS（Content Addressable Storage）。当一个文件的内容已存在于云盘存储中，云盘会生成一个 `.cas` 占位文件：几 KB、无实际数据，但保存了指向真实内容的指纹。

### CAS 文件内容（Base64 解码后）

```json
{
  "name": "S01E01.mp4",        // 文件真实名称（可能与 CAS 文件名不同）
  "size": 1227849175,           // 原始文件大小 (bytes)
  "md5": "4391F458623...",      // 文件 MD5
  "sliceMd5": "FB5410AB5D...", // 分片 MD5（秒传校验用）
  "create_time": "1777187951"   // 创建时间戳
}
```

> 已验证的样本文件：`Light+to+the+Night.2026.S01E01.2160p.SDR.60fps.10-bit.HEVC.DTS+5.1@HiveWeb.mp4.cas`（204 bytes，解码后 169 bytes）

---

## 2. 秒传还原流程

参考 `upload189-cas-web-14.js`（天翼云盘秒传助手），还原三步走：

```
① initMultiUpload      → POST upload.cloud.189.cn/person/initMultiUpload
                         上传参数: parentFolderId, fileName, fileSize, sliceSize, fileMd5, sliceMd5
                         返回: uploadFileId

② checkTransSecond     → POST upload.cloud.189.cn/person/checkTransSecond
                         校验: fileMd5, sliceMd5, uploadFileId
                         返回: fileDataExists = true/false

③ commitMultiUpload    → POST upload.cloud.189.cn/person/commitMultiUploadFile
                         提交: uploadFileId, fileMd5, sliceMd5
                         成功 → 真实文件在原路径生成
```

如果 `fileDataExists = false`，说明该文件的内容不在云端 CAS 中，无法秒传。

upload 接口需要 RSA/AES 加密的请求签名（SessionKey、EncryptionText、Signature），这部分密钥和 session 从 cloud.189.cn 页面获取。

---

## 3. 目标用户

- 天翼云盘用户，目录中存在大量 `.cas` 占位文件
- 希望将这些占位文件还原为真实可播放、可下载、可分享的文件

---

## 4. 功能范围

### Phase 1 — 最小可用（~400 行）

- [ ] Popup 面板：点击扩展图标打开
- [ ] 检测是否在 cloud.189.cn 页面，展示当前目录路径
- [ ] **扫描当前目录**：列出目录下所有 `.cas` 文件
- [ ] **解析并预览**：展示每个 CAS 文件的解析结果（真实文件名、大小、MD5）
- [ ] **一键还原**：选中 CAS 文件 → 批量执行秒传三步 → 显示结果（成功/失败/原因）
- [ ] 还原成功的 CAS 文件可选择自动删除

### Phase 2 — 增强（按需）

- [ ] 页面注入按钮（直接在云盘文件列表旁显示"还原"入口）
- [ ] 递归扫描子目录
- [ ] 还原进度条

### 不做的

- 不做上传新文件（只做秒传还原已有 CAS）
- 不做 STRM/Emby/转存/追更
- 不做 Telegram 机器人
- 不做数据库/持久化
- 不做多账号

---

## 5. 技术方案

```
cloud189-cas-revealer/           (Chrome Extension - Manifest V3)
├── manifest.json                ← permissions: storage, activeTab, host: cloud.189.cn
├── background.js                ← service_worker, 转发 API 请求（带 Cookie）
├── popup.html                   ← 主操作 UI
├── popup.js                     ← 操作逻辑 + API 封装
├── popup.css                    ← 样式
└── content.js                   ← 注入云盘页面，读取 session/公钥/当前目录
```

### 关键 API 封装（复用 upload189-cas-web-14.js 的接口路径）

| 接口 | 用途 |
|---|---|
| `api.cloud.189.cn/open/file/listFiles.action` | 获取目录文件列表 |
| 下载 CAS 文件内容 | 读取 Base64 解码 → JSON |
| `upload.cloud.189.cn/person/initMultiUpload` | 初始化秒传 |
| `upload.cloud.189.cn/person/checkTransSecond` | 校验秒传 |
| `upload.cloud.189.cn/person/commitMultiUploadFile` | 提交秒传 |

### 安全与权限

- 所有请求通过 background service_worker 转发，自动附加对应域名的 Cookie
- 不存储用户账号密码 / Token 到任何地方
- 只在 `cloud.189.cn` 和 `upload.cloud.189.cn` 域名下工作
- 不依赖任何外部 CDN（不用 Tampermonkey 的 `@require`）

---

## 6. 已知参考

- `upload189-cas-web-14.js`：完整的 Tampermonkey 实现，包含 RSA/AES 加密、签名生成、CAS 解析、秒传三步。这个脚本是唯一需要参考的外部来源。
- `cloud189-auto-save/`：不包含 CAS 或秒传相关的处理逻辑。
