---
name: wechat-local-reader
description: Read WeChat Official Account articles from mp.weixin.qq.com locally via Chrome/Edge CDP, save the extracted article as Markdown, and then analyze the saved content. Use when the user provides a WeChat Official Account article URL and wants local-first extraction without third-party article APIs.
---

# WeChat Local Reader

Read public WeChat Official Account article pages locally and save them as Markdown.

## When To Use

Use this skill when the user asks to read, summarize, analyze, or extract a URL matching:

- `https://mp.weixin.qq.com/s/...`
- `https://mp.weixin.qq.com/s?__biz=...`

Do not use third-party article APIs unless the user explicitly asks for that fallback.

## Behavior

- Open the article in a temporary Chrome/Edge profile.
- Use Chrome DevTools Protocol on `127.0.0.1`.
- Use the local proxy `http://127.0.0.1:33210` by default.
- Extract title, author, publish time, description, and article body.
- Save Markdown under `wechat-articles/` in the current working directory.
- Read the generated Markdown before answering the user's content question.

## Run

From the user's current workspace:

```powershell
Get-Content "<SKILL_DIR>\scripts\read-wechat-article.mjs" -Raw -Encoding UTF8 | node --input-type=module - "https://mp.weixin.qq.com/s/..." --proxy "http://127.0.0.1:33210"
```

Replace `<SKILL_DIR>` with this skill directory.

On Windows Codex Desktop, prefer the `Get-Content ... | node --input-type=module -` form because direct `node script.mjs` can be blocked by sandbox realpath checks.

Useful options:

```powershell
--output-dir "wechat-articles"
--timeout-ms 45000
--no-proxy
--headed
--keep-browser
```

The script uses headless Chrome/Edge by default. Use `--headed` only for debugging.

## Failure Handling

This is automatic-only. If extraction fails because WeChat blocks the page, requires verification, or returns an empty/abnormal page, report the exact failure and do not ask the user to log in or manually copy text unless they request a manual fallback.

Common errors:

- `Unsupported URL`: the URL is not a supported WeChat article URL.
- `Chrome debug port not ready`: Chrome/Edge failed to launch or local debugging is blocked.
- `Article content not found`: page loaded, but no usable `#js_content`/`.rich_media_content` body was available.
- `WeChat block page detected`: page looks like a WeChat verification/risk/error page.

## Output

The script prints one JSON object:

```json
{
  "ok": true,
  "outputPath": "C:\\path\\wechat-articles\\article.md",
  "title": "Article title",
  "chars": 12345
}
```

After a successful run, open `outputPath` and use the Markdown content for the final answer.
