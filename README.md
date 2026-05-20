# WeChat Local Reader

**Language:** English | [中文](./README.zh-CN.md)

**Author contact:** `vx:190569625`

Give an agent a WeChat Official Account article link. The agent uses this skill to open the article locally, read the content, extract the title, author, publish time, and body, then save everything as a Markdown file.

This is the missing bridge for workflows like:

```text
WeChat article link -> Agent -> wechat-local-reader -> Markdown -> summary, analysis, notes, tasks
```

Instead of manually opening a WeChat article, copying text, cleaning formatting, and pasting it into an AI chat, you can drop the link into Codex, Hermes, OpenClaw, or another local agent. The skill turns the article into a local Markdown document that the agent can continue working with.

## Why This Skill Exists

WeChat Official Account articles are valuable, but they are awkward for agents to consume directly. They often require browser rendering, may depend on local network/proxy conditions, and are not as simple as fetching a normal web page.

`wechat-local-reader` is built for local-first automation:

- You keep the article extraction on your own machine.
- You avoid sending article links to third-party extraction APIs by default.
- Your agent gets a clean Markdown file it can summarize, translate, classify, archive, or turn into action items.
- Hermes/OpenClaw can call the script and parse a JSON result without needing a human to watch the browser.

## Typical Use Cases

- Send a WeChat article link to a DingTalk bot, route it to Hermes, and let Hermes call this skill to create a Markdown copy.
- Ask Codex to read a WeChat article and produce a summary, viewpoint analysis, or implementation plan.
- Build a local knowledge base from WeChat Official Account articles.
- Convert article links into structured notes for later search and retrieval.
- Let an agent monitor incoming links and prepare readable Markdown documents automatically.

## What It Produces

For every readable article, the skill writes a Markdown file containing:

- Article title
- Author/account name
- Publish time
- Source URL
- Meta description when available
- Clean article body text

It also prints a JSON status object so other agents or programs can decide what to do next.

## Features

- Supports `https://mp.weixin.qq.com/s/...` and `https://mp.weixin.qq.com/s?__biz=...`.
- Uses local Chrome or Edge through Chrome DevTools Protocol.
- Uses a temporary browser profile so it does not pollute your daily browser profile.
- Uses `http://127.0.0.1:33210` as the default proxy.
- Writes Markdown files under `wechat-articles/` or a custom output directory.
- Prints machine-readable JSON for Hermes/OpenClaw/Codex integration.

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

## Agent Integration

For Codex, install or copy this repository as a skill and let Codex read [`SKILL.md`](./SKILL.md).

For Hermes or OpenClaw, call [`scripts/read-wechat-article.mjs`](./scripts/read-wechat-article.mjs), pass the article URL, then read `outputPath` from the JSON result.

Generic metadata is available in [`skill.json`](./skill.json).

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

## Limitations

This skill can only read pages that your local browser can load. If WeChat returns a risk-control page, CAPTCHA, expired article, or blank page, the skill reports the failure instead of silently fabricating content.
