# WeChat Local Reader / 微信公众号本地读取器

Author contact / 作者联系方式: `vx:190569625`

## English

`wechat-local-reader` reads WeChat Official Account articles from `mp.weixin.qq.com` locally through Chrome or Edge DevTools Protocol, extracts metadata and article body, and saves the result as Markdown.

It is designed for local-first agent workflows where Codex, Hermes, OpenClaw, or another agent receives a WeChat article link and needs article text without using third-party article extraction APIs.

### Features

- Supports `https://mp.weixin.qq.com/s/...` and `https://mp.weixin.qq.com/s?__biz=...`.
- Uses local Chrome or Edge with a temporary profile.
- Uses `http://127.0.0.1:33210` as the default proxy.
- Extracts title, author, publish time, description, and body text.
- Writes Markdown files under `wechat-articles/` or a custom output directory.
- Prints a JSON status object to stdout for Hermes/OpenClaw integration.

### Usage

```powershell
Get-Content ".\scripts\read-wechat-article.mjs" -Raw -Encoding UTF8 |
  node --input-type=module - "https://mp.weixin.qq.com/s/..." --proxy "http://127.0.0.1:33210"
```

From the repository root:

```powershell
Get-Content ".\skills\wechat-local-reader\scripts\read-wechat-article.mjs" -Raw -Encoding UTF8 |
  node --input-type=module - "https://mp.weixin.qq.com/s/..." --proxy "http://127.0.0.1:33210"
```

Successful output:

```json
{
  "ok": true,
  "outputPath": "C:\\path\\wechat-articles\\article.md",
  "title": "Article title",
  "author": "Author",
  "published": "2026年5月17日 08:30",
  "chars": 2673
}
```

### Options

- `--proxy <url>`: use a custom proxy.
- `--no-proxy`: disable proxy.
- `--output-dir <path>`: choose output directory.
- `--timeout-ms <number>`: set startup timeout.
- `--headed`: run browser with a visible window for debugging.
- `--keep-browser`: keep the browser open after the run.

### Requirements

- Windows
- Node.js 20+
- Chrome or Edge
- Local proxy if the target page requires it

## 中文

`wechat-local-reader` 用本机 Chrome 或 Edge 的 DevTools Protocol 读取微信公众号文章页面，提取文章元数据和正文，并保存成 Markdown 文件。

它面向本地优先的智能体工作流：Codex、Hermes、OpenClaw 或其他智能体拿到公众号文章链接后，可以在本机读取正文，而不是默认调用第三方文章解析 API。

### 功能

- 支持 `https://mp.weixin.qq.com/s/...` 和 `https://mp.weixin.qq.com/s?__biz=...`。
- 使用本机 Chrome 或 Edge，并创建临时浏览器 profile。
- 默认使用代理 `http://127.0.0.1:33210`。
- 提取标题、作者、发布时间、摘要和正文。
- 将 Markdown 文件写入 `wechat-articles/`，也可指定输出目录。
- 向标准输出打印 JSON，方便 Hermes/OpenClaw 解析和集成。

### 使用方式

```powershell
Get-Content ".\scripts\read-wechat-article.mjs" -Raw -Encoding UTF8 |
  node --input-type=module - "https://mp.weixin.qq.com/s/..." --proxy "http://127.0.0.1:33210"
```

在仓库根目录下运行：

```powershell
Get-Content ".\skills\wechat-local-reader\scripts\read-wechat-article.mjs" -Raw -Encoding UTF8 |
  node --input-type=module - "https://mp.weixin.qq.com/s/..." --proxy "http://127.0.0.1:33210"
```

成功时输出：

```json
{
  "ok": true,
  "outputPath": "C:\\path\\wechat-articles\\article.md",
  "title": "文章标题",
  "author": "作者",
  "published": "2026年5月17日 08:30",
  "chars": 2673
}
```

### 参数

- `--proxy <url>`：使用指定代理。
- `--no-proxy`：不使用代理。
- `--output-dir <path>`：指定输出目录。
- `--timeout-ms <number>`：设置启动超时时间。
- `--headed`：显示浏览器窗口，便于调试。
- `--keep-browser`：运行结束后保留浏览器。

### 环境要求

- Windows
- Node.js 20+
- Chrome 或 Edge
- 如果目标页面需要代理，则需要本机代理可用
