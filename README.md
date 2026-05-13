English | [简体中文](README_zh.md)

# ☁️ Cloud189 CAS Revealer

<div align="center">
  <h3>Restore placeholder files on Tianyi Cloud Drive with one click, via rapid upload.</h3>
  <p><strong>Scan • Verify • Restore • Chrome Side Panel</strong></p>
</div>

---

## 🙏 Acknowledgments

This project is deeply inspired by and built upon the remarkable **天翼云盘秒传助手** Tampermonkey userscript written by **liyk**. The core rapid upload (秒传) crypto signing flow, CAS file parsing logic, and API interaction patterns are adapted from that pioneering work.

**Special thanks to liyk for open-sourcing the underlying mechanisms that made this Chrome extension possible.** ❤️

---

## 🎯 The Pain it Solves

Tianyi Cloud Drive (cloud.189.cn) uses a CAS (Content Addressable Storage) backend. When you move or copy files between accounts, you often end up with **`.cas` placeholder files** — tiny stubs (~200 bytes) that hold the file's cryptographic fingerprint but contain no actual data. These files cannot be previewed, downloaded, or shared.

Cloud189 CAS Revealer automates the restore process:
1. **Scans** a directory for all `.cas` files
2. **Parses** the Base64-encoded JSON inside each CAS file to extract `md5`, `sliceMd5`, `size`, and original filename
3. **Verifies** whether the real content still exists in the cloud's CAS storage
4. **Restores** the real file in-place via the rapid upload (秒传) API — no data actually uploaded, the cloud just links the CAS blob to a real file node

---

## ✨ Features

- 🔍 **One-click Scan** — Lists all CAS files in the current cloud directory with file size and MD5 preview
- ✅ **Pre-flight Verification** — Checks if content exists in CAS before committing, so you know what's restorable
- ⚡ **Batch Rapid Upload** — Restores selected files via the cloud's native 秒传 (instant upload) API
- 🧹 **Auto Cleanup** — Optionally deletes the `.cas` stub after successful restores
- 🖥️ **Side Panel UI** — Stays open while you navigate the cloud drive, won't close on misclicks
- 🔒 **100% Local** — All API calls go directly from your browser to cloud.189.cn; no third-party server involved

---

## 🚀 Installation

### Download from GitHub Releases (Recommended)
1. Go to the [Releases](../../releases) page and download the latest `cloud189-cas-revealer-v1.0.0.zip`
2. Unzip the file
3. Open Chrome, navigate to `chrome://extensions/`
4. Enable **Developer Mode** (top-right toggle)
5. Click **Load unpacked** and select the unzipped folder

### Build from Source
1. Clone this repo
   ```bash
   git clone https://github.com/alanzhao0128/cloud189-cas-revealer.git
   ```
2. Open Chrome, navigate to `chrome://extensions/`
3. Enable **Developer Mode** (top-right toggle)
4. Click **Load unpacked** and select the `release/1.0.0/` directory
5. The extension icon appears in your toolbar

> Requires Chrome 114+ (for Side Panel API support).

### Usage
1. Log in to [cloud.189.cn](https://cloud.189.cn) and navigate to a directory with `.cas` files
2. Click the extension icon to open the side panel
3. Click **Scan CAS Files** to discover all `.cas` files
4. Select files and click **Verify** to check CAS existence
5. Click **Restore** to materialize real files from the verified ones

---

## 📂 Project Structure

```
cloud189-cas-revealer/
├── manifest.json          # Chrome MV3 extension manifest
├── background.js          # Service worker (API proxy + crypto signing)
├── content.js             # Content script (reads session/directory from cloud.189.cn)
├── popup/                 # Side panel UI
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── lib/                   # Vendored crypto libraries (MIT)
│   ├── crypto-js.min.js
│   └── jsencrypt.min.js
└── release/               # Packaged releases, load into Chrome directly
    └── 1.0.0/
```

---

## 📝 How CAS Files Work

A `.cas` file is a Base64-encoded JSON payload:
```json
{
  "name": "S01E01.mp4",
  "size": 1227849175,
  "md5": "4391F458623A5DD97C67A8BBAB1E1CC1",
  "sliceMd5": "FB5410AB5D9E80997FE7A0D7064D6E24",
  "create_time": "1777187951"
}
```

The rapid upload flow:
1. `initMultiUpload` → creates an upload session (with `lazyCheck`)
2. `checkTransSecond` → verifies the content exists in CAS via MD5 hashes
3. `commitMultiUpload` → links the CAS blob to a real file in your directory

---

## ☕️ Support

If this tool saves you time or helps recover important files, consider buying me a coffee!

[☕️ Support on Ko-fi](https://ko-fi.com/alanzhao) | [⚡️ Support on Aifadian](https://ifdian.net/a/alanzhao)

---

## 📜 License

This project is licensed under the [Creative Commons Attribution-NonCommercial 4.0 International License (CC BY-NC 4.0)](https://creativecommons.org/licenses/by-nc/4.0/).
You are free to use, modify, and share this software, but **commercial use is strictly prohibited**.

---

*Built with vanilla JavaScript, Chrome Extension APIs, and ❤️ for cloud drive users.*
