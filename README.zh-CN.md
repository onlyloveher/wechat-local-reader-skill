# 微信公众号本地读取器

**语言：** [English](./README.md) | 中文

**作者联系方式：** `vx:190569625`

把一个微信公众号文章链接丢给智能体，智能体就可以通过这个技能在本机打开文章、读取内容、提取标题、作者、发布时间和正文，并自动生成 Markdown 文档。

它解决的是这个真实场景：

```text
微信公众号文章链接 -> 智能体 -> wechat-local-reader -> Markdown -> 摘要、分析、笔记、任务拆解
```

你不需要手动打开公众号文章、复制正文、清理格式、再粘贴给 AI。只要把链接发给 Codex、Hermes、OpenClaw 或其他本地智能体，这个技能就能把文章转换成本地 Markdown，后续摘要、观点提炼、归档、知识库整理都可以继续自动化。

## 为什么需要这个技能

微信公众号文章有价值，但对智能体并不友好。它通常需要浏览器渲染，受本地网络和代理影响，也不像普通网页那样可以直接稳定抓取。

`wechat-local-reader` 面向本地优先的自动化流程：

- 文章读取发生在你的本机。
- 默认不把链接交给第三方文章解析 API。
- 智能体拿到的是干净的 Markdown 文件，可以继续总结、翻译、分类、归档或生成行动项。
- Hermes/OpenClaw 可以调用脚本并解析 JSON 结果，不需要你一直盯着浏览器。

## 典型使用场景

- 你把微信公众号文章链接发给钉钉机器人，由 Hermes 接收，再调用这个技能生成 Markdown。
- 你让 Codex 阅读一篇公众号文章，并输出摘要、观点分析或执行计划。
- 你把公众号文章沉淀成本地知识库。
- 你把文章链接转换成结构化笔记，方便后续搜索和检索。
- 你让智能体自动处理收到的文章链接，生成可读、可归档的 Markdown 文档。

## 输出内容

每篇成功读取的文章都会生成一个 Markdown 文件，包含：

- 文章标题
- 作者/公众号名称
- 发布时间
- 原文链接
- 页面摘要，如果存在
- 清理后的正文内容

脚本还会输出 JSON 状态，方便其他智能体或程序继续处理。

## 功能

- 支持 `https://mp.weixin.qq.com/s/...` 和 `https://mp.weixin.qq.com/s?__biz=...`。
- 通过 Chrome DevTools Protocol 使用本机 Chrome 或 Edge。
- 使用临时浏览器 profile，不污染你的日常浏览器环境。
- 默认使用代理 `http://127.0.0.1:33210`。
- 将 Markdown 文件写入 `wechat-articles/`，也可以指定输出目录。
- 向标准输出打印机器可读 JSON，方便 Hermes/OpenClaw/Codex 集成。

## 快速开始

在本仓库根目录下运行：

```powershell
Get-Content ".\scripts\read-wechat-article.mjs" -Raw -Encoding UTF8 |
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

## 智能体集成

Codex 可以把 [`SKILL.md`](./SKILL.md) 作为本地技能说明文件使用。

Hermes 或 OpenClaw 可以直接调用 [`scripts/read-wechat-article.mjs`](./scripts/read-wechat-article.mjs)，传入文章链接，然后从 JSON 结果里读取 `outputPath`。

通用技能元数据在 [`skill.json`](./skill.json) 中。

## 参数

| 参数 | 说明 |
| --- | --- |
| `--proxy <url>` | 使用指定代理。 |
| `--no-proxy` | 不使用代理。 |
| `--output-dir <path>` | 指定输出目录。 |
| `--timeout-ms <number>` | 设置启动超时时间。 |
| `--headed` | 显示浏览器窗口，便于调试。 |
| `--keep-browser` | 运行结束后保留浏览器。 |

## 环境要求

- Windows
- Node.js 20+
- Chrome 或 Edge
- 如果目标页面需要代理，则需要本机代理可用

## 限制

这个技能只能读取你的本机浏览器能够正常打开的页面。如果微信返回风控页、验证码、文章失效或空白页，技能会返回明确失败原因，而不是静默生成虚假内容。
