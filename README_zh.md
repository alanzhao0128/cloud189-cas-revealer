[English](README.md) | 简体中文

# ☁️ Cloud189 CAS Revealer

<div align="center">
  <h3>一键扫描还原天翼云盘中的 CAS 占位文件，基于秒传接口。</h3>
  <p><strong>扫描 • 验证 • 还原 • Chrome 侧边栏</strong></p>
</div>

---

## 🙏 特别鸣谢

本项目深度参考了由 **liyk** 编写的 **天翼云盘秒传助手** Tampermonkey 用户脚本。核心秒传加密签名流程、CAS 文件解析逻辑及 API 交互模式均基于该脚本的实现。

**特别感谢 liyk 开放了这些底层机制，使此 Chrome 扩展得以成为可能。** ❤️

---

## 🎯 解决的痛点

天翼云盘（cloud.189.cn）底层使用 CAS（Content Addressable Storage）存储。跨账号转存文件时，常常会产生 **`.cas` 占位文件**——只有约 200 字节的空壳，内部存储了文件的加密指纹（MD5），但不包含任何实际数据。这些文件无法预览、下载或分享。

Cloud189 CAS Revealer 自动化还原流程：
1. **扫描** 目录下所有 `.cas` 文件
2. **解析** CAS 文件中的 Base64 JSON，提取 `md5`、`sliceMd5`、`size` 和原始文件名
3. **验证** 源内容是否仍存在于云端 CAS 存储中
4. **秒传还原** 真实文件——无需实际上传数据，云端直接将 CAS 数据块链接为真实文件节点

---

## ✨ 功能特点

- 🔍 **一键扫描** — 列出当前目录下所有 CAS 文件，预览文件大小和 MD5
- ✅ **还原前验证** — 先检查 CAS 中是否存在源内容，确认可还原后再提交
- ⚡ **批量秒传** — 通过天翼云盘原生秒传接口批量还原选中文件
- 🧹 **自动清理** — 还原成功后可自动删除 `.cas` 占位文件
- 🖥️ **侧边栏面板** — 浏览云盘时面板始终保留，不会因误点其他地方而关闭
- 🔒 **100% 本地运行** — 所有 API 请求直接在浏览器与 cloud.189.cn 之间通信，不经任何第三方服务器

---

## 🚀 安装

### 从 GitHub Releases 下载（推荐）
1. 前往 [Releases](../../releases) 页面下载最新版 `cloud189-cas-revealer-v1.0.0.zip`
2. 解压文件
3. 打开 Chrome，访问 `chrome://extensions/`
4. 开启右上角 **开发者模式**
5. 点击 **加载已解压的扩展程序**，选择解压后的文件夹

### 从源码构建
1. 克隆本仓库
   ```bash
   git clone https://github.com/alanzhao0128/cloud189-cas-revealer.git
   ```
2. 打开 Chrome，访问 `chrome://extensions/`
3. 开启右上角 **开发者模式**
4. 点击 **加载已解压的扩展程序**，选择 `release/1.0.0/` 目录
5. 扩展图标出现在工具栏

> 需要 Chrome 114+（侧边栏 API）。

### 使用方式
1. 登录 [cloud.189.cn](https://cloud.189.cn)，进入有 `.cas` 文件的目录
2. 点击扩展图标打开侧边栏
3. 点击 **扫描 CAS 文件** 发现所有 `.cas` 文件
4. 勾选文件，点击 **验证** 检查 CAS 中是否存在
5. 对验证通过的文件点击 **秒传还原** 创建真实文件

---

## 📂 项目结构

```
cloud189-cas-revealer/
├── manifest.json          # Chrome MV3 扩展清单
├── background.js          # Service Worker（API 代理 + 加密签名）
├── content.js             # 内容脚本（从 cloud.189.cn 页面读取会话/目录）
├── popup/                 # 侧边栏 UI
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── lib/                   # 第三方加密库（MIT 协议）
│   ├── crypto-js.min.js
│   └── jsencrypt.min.js
└── release/               # 按版本打包，可直接加载到 Chrome
    └── 1.0.0/
```

---

## 📝 CAS 文件原理

`.cas` 文件内容是 Base64 编码的 JSON：
```json
{
  "name": "S01E01.mp4",
  "size": 1227849175,
  "md5": "4391F458623A5DD97C67A8BBAB1E1CC1",
  "sliceMd5": "FB5410AB5D9E80997FE7A0D7064D6E24",
  "create_time": "1777187951"
}
```

秒传三步流程：
1. `initMultiUpload` → 创建上传会话（带 `lazyCheck` 延迟校验）
2. `checkTransSecond` → 通过 MD5 哈希验证内容在 CAS 中存在
3. `commitMultiUpload` → 将 CAS 数据块链接为目录中的真实文件

---

## ☕️ 支持开源

如果这个工具帮你节省了时间或恢复了重要文件，不妨请作者喝杯咖啡！

[⚡️ 在爱发电支持我](https://ifdian.net/a/alanzhao) | [☕️ 请作者喝杯咖啡 (Ko-fi)](https://ko-fi.com/alanzhao)

---

## 📜 开源协议

本项目采用 [Creative Commons Attribution-NonCommercial 4.0 International License (CC BY-NC 4.0)](https://creativecommons.org/licenses/by-nc/4.0/) 协议。
您可以自由使用、修改和分享本软件，但 **严禁任何形式的商业用途**。

---

*基于原生 JavaScript 与 Chrome Extension API 构建，献给所有云盘用户。*
