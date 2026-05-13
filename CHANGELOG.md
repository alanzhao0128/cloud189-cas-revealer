# Changelog

## 1.0.0 (2026-05-13)

### Initial Release

- 🔍 Scan directories for `.cas` placeholder files on cloud.189.cn
- 📋 Parse CAS file contents (Base64 JSON → md5, sliceMd5, size, filename)
- ✅ Pre-flight CAS existence verification via `checkTransSecond`
- ⚡ Batch rapid upload (秒传) restore via `initMultiUpload` → `checkTransSecond` → `commitMultiUpload`
- 🧹 Auto-delete `.cas` stubs after successful restore
- 🖥️ Chrome Side Panel UI (stays open during navigation)
- 🔄 Refresh button to re-sync folder path after directory changes
- 🎨 Dark log console with success/failure color coding
- 🔐 RSA/AES/HMAC crypto via bundled `crypto-js` + `jsencrypt` (MIT)
- 🌐 Supports all Tianyi Cloud CDN subdomains
