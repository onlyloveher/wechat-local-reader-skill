# WeChat Local Reader

**Language:** English | [中文](./README.zh-CN.md)

**Author contact:** `vx:190569625`

`wechat-local-reader` reads WeChat Official Account articles from `mp.weixin.qq.com` locally through Chrome or Edge DevTools Protocol, extracts metadata and article body, and saves the result as Markdown.

It is designed for local-first agent workflows where Codex, Hermes, OpenClaw, or another agent receives a WeChat article link and needs article text without using third-party article extraction APIs.

## Features

- Supports `https://mp.weixin.qq.com/s/...` and `https://mp.weixin.qq.com/s?__biz=...`.
- Uses local Chrome or Edge with a temporary browser profile.
- Uses `http://127.0.0.1:33210` as the default proxy.
- Extracts title, author, publish time, description, and body text.
- Writes Markdown files under `wechat-articles/` or a custom output directory.
- Prints a JSON status object to stdout for Hermes/OpenClaw integration.

## Quick Start

Run from this repository root:

```powershell
Get-Content ".\scripts\read-wechat-article.mjs" -Raw -Encoding UTF8 |
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

## Options

| Option | Description |
| --- | --- |
| `--proxy <url>` | Use a custom proxy. |
| `--no-proxy` | Disable proxy. |
| `--output-dir <path>` | Choose the output directory. |
| `--timeout-ms <number>` | Set startup timeout. |
| `--headed` | Run browser with a visible window for debugging. |
| `--keep-browser` | Keep the browser open after the run. |

## Requirements

- Windows
- Node.js 20+
- Chrome or Edge
- Local proxy if the target page requires it

## Agent Integration

- Codex can use [`SKILL.md`](./SKILL.md) as the local skill instruction file.
- Hermes and OpenClaw can call [`scripts/read-wechat-article.mjs`](./scripts/read-wechat-article.mjs) and parse the JSON result.
- Generic metadata is available in [`skill.json`](./skill.json).
