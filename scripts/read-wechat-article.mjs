import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import crypto from "node:crypto";
import path from "node:path";
import os from "node:os";

const DEFAULT_PROXY = "http://127.0.0.1:33210";
const DEFAULT_TIMEOUT_MS = 45_000;

function parseArgs(argv) {
  const args = {
    url: "",
    outputDir: "wechat-articles",
    proxy: DEFAULT_PROXY,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    keepBrowser: false,
    headless: true,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--output-dir" || arg === "-o") {
      args.outputDir = argv[++i];
    } else if (arg === "--proxy") {
      args.proxy = argv[++i];
    } else if (arg === "--no-proxy") {
      args.proxy = "";
    } else if (arg === "--timeout-ms" || arg === "--timeout") {
      args.timeoutMs = Number(argv[++i]) || DEFAULT_TIMEOUT_MS;
    } else if (arg === "--keep-browser") {
      args.keepBrowser = true;
    } else if (arg === "--headless") {
      args.headless = true;
    } else if (arg === "--headed") {
      args.headless = false;
    } else if (!arg.startsWith("-") && !args.url) {
      args.url = arg;
    }
  }

  return args;
}

function validateWechatUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Unsupported URL: not a valid URL.");
  }

  if (parsed.protocol !== "https:" || parsed.hostname !== "mp.weixin.qq.com") {
    throw new Error("Unsupported URL: expected https://mp.weixin.qq.com/...");
  }

  const supportedPath = parsed.pathname === "/s/" || parsed.pathname === "/s";
  const hasBizQuery = parsed.pathname === "/s" && parsed.searchParams.has("__biz");
  const hasShortId = parsed.pathname.startsWith("/s/") && parsed.pathname.length > 3;
  if (!supportedPath && !hasBizQuery && !hasShortId) {
    throw new Error("Unsupported URL: expected /s/... or /s?__biz=...");
  }

  return parsed.toString();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close(() => reject(new Error("Unable to allocate a local port.")));
        return;
      }
      server.close((err) => (err ? reject(err) : resolve(addr.port)));
    });
  });
}

function findBrowser() {
  const candidates = [
    process.env.WECHAT_READER_CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function fetchJson(url, timeoutMs = 5000, method = "GET") {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });
    req.end();
    req.on("error", reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`HTTP timeout: ${url}`));
    });
  });
}

async function waitForDebugPort(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const version = await fetchJson(`http://127.0.0.1:${port}/json/version`, 3000);
      if (version.webSocketDebuggerUrl) return version;
    } catch (error) {
      lastError = error;
    }
    await sleep(250);
  }
  throw new Error(`Chrome debug port not ready${lastError ? `: ${lastError.message}` : ""}`);
}

async function waitForPageTarget(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastTargets = [];
  while (Date.now() < deadline) {
    try {
      const targets = await fetchJson(`http://127.0.0.1:${port}/json/list`, 3000);
      lastTargets = targets;
      const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
      if (page) return page;
    } catch {}
    await sleep(250);
  }
  throw new Error(`No debuggable page target found. Targets: ${JSON.stringify(lastTargets).slice(0, 500)}`);
}

async function createPageTarget(port, url) {
  try {
    return await fetchJson(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, 5000, "PUT");
  } catch {
    return null;
  }
}

class RawWebSocket {
  constructor(socket) {
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    this.onMessage = null;
    socket.on("data", (chunk) => this.handleData(chunk));
  }

  static connect(wsUrl, timeoutMs = 10_000) {
    return new Promise((resolve, reject) => {
      const parsed = new URL(wsUrl);
      const socket = net.createConnection({ host: parsed.hostname, port: Number(parsed.port) });
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error(`WebSocket connect timeout: ${wsUrl}`));
      }, timeoutMs);

      socket.on("connect", () => {
        const key = crypto.randomBytes(16).toString("base64");
        const request = [
          `GET ${parsed.pathname}${parsed.search} HTTP/1.1`,
          `Host: ${parsed.host}`,
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Key: ${key}`,
          "Sec-WebSocket-Version: 13",
          "Origin: http://127.0.0.1",
          "",
          "",
        ].join("\r\n");
        socket.write(request);
      });

      let header = Buffer.alloc(0);
      const onData = (chunk) => {
        header = Buffer.concat([header, chunk]);
        const idx = header.indexOf("\r\n\r\n");
        if (idx < 0) return;

        clearTimeout(timer);
        const text = header.slice(0, idx).toString("utf8");
        if (!text.includes(" 101 ")) {
          socket.destroy();
          reject(new Error(`WebSocket handshake failed: ${text.split("\r\n")[0]}`));
          return;
        }

        socket.off("data", onData);
        const ws = new RawWebSocket(socket);
        const rest = header.slice(idx + 4);
        if (rest.length) ws.handleData(rest);
        resolve(ws);
      };

      socket.on("data", onData);
      socket.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  sendText(text) {
    const payload = Buffer.from(text);
    let header;
    if (payload.length < 126) {
      header = Buffer.from([0x81, 0x80 | payload.length]);
    } else if (payload.length < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x81;
      header[1] = 0x80 | 126;
      header.writeUInt16BE(payload.length, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x81;
      header[1] = 0x80 | 127;
      header.writeBigUInt64BE(BigInt(payload.length), 2);
    }

    const mask = crypto.randomBytes(4);
    const masked = Buffer.alloc(payload.length);
    for (let i = 0; i < payload.length; i++) masked[i] = payload[i] ^ mask[i % 4];
    this.socket.write(Buffer.concat([header, mask, masked]));
  }

  handleData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 2) {
      const b0 = this.buffer[0];
      const b1 = this.buffer[1];
      let length = b1 & 0x7f;
      let offset = 2;

      if (length === 126) {
        if (this.buffer.length < 4) return;
        length = this.buffer.readUInt16BE(2);
        offset = 4;
      } else if (length === 127) {
        if (this.buffer.length < 10) return;
        length = Number(this.buffer.readBigUInt64BE(2));
        offset = 10;
      }

      const masked = Boolean(b1 & 0x80);
      const maskOffset = offset;
      if (masked) offset += 4;
      if (this.buffer.length < offset + length) return;

      let payload = this.buffer.slice(offset, offset + length);
      if (masked) {
        const mask = this.buffer.slice(maskOffset, maskOffset + 4);
        payload = Buffer.from(payload.map((value, idx) => value ^ mask[idx % 4]));
      }
      this.buffer = this.buffer.slice(offset + length);

      const opcode = b0 & 0x0f;
      if (opcode === 1) this.onMessage?.(payload.toString("utf8"));
      if (opcode === 8) this.socket.end();
    }
  }

  close() {
    try {
      this.socket.end();
    } catch {}
  }
}

class CdpClient {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    ws.onMessage = (text) => {
      const message = JSON.parse(text);
      if (message.id && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id);
        clearTimeout(pending.timer);
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
      }
    };
  }

  send(method, params = {}, timeoutMs = 30_000) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.ws.sendText(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.ws.close();
  }
}

function sanitizeSlug(text, fallback) {
  const base = (text || fallback || "wechat-article")
    .toLowerCase()
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/[^\p{L}\p{N}\s._-]+/gu, " ")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
  return base || "wechat-article";
}

function detectBlockPage(data) {
  const haystack = [data.title, data.description, data.content, data.bodyPreview].filter(Boolean).join("\n");
  const blockPatterns = [
    "环境异常",
    "访问过于频繁",
    "验证码",
    "当前页面无法访问",
    "该内容已被发布者删除",
    "此内容因违规无法查看",
    "请在微信客户端打开",
    "WeChat verification",
  ];
  return blockPatterns.find((pattern) => haystack.includes(pattern)) || "";
}

async function main() {
  const args = parseArgs(process.argv);
  const articleUrl = validateWechatUrl(args.url);
  const browser = findBrowser();
  if (!browser) throw new Error("Chrome/Edge executable not found.");

  const port = await getFreePort();
  const profileDir = path.join(os.tmpdir(), `wechat-local-reader-${process.pid}-${Date.now()}`);
  await mkdir(profileDir, { recursive: true });

  const chromeArgs = [
    `--remote-debugging-port=${port}`,
    "--remote-debugging-address=127.0.0.1",
    "--remote-allow-origins=*",
    `--user-data-dir=${profileDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-popup-blocking",
    "--disable-background-networking",
    "--disable-gpu",
    "--no-sandbox",
  ];
  if (args.proxy) chromeArgs.push(`--proxy-server=${args.proxy}`);
  if (args.headless) chromeArgs.push("--headless=new");
  chromeArgs.push(articleUrl);

  const child = spawn(browser, chromeArgs, { stdio: "ignore", windowsHide: true });
  let cdp = null;

  try {
    await waitForDebugPort(port, args.timeoutMs);
    await sleep(3500);
    await createPageTarget(port, articleUrl);
    const page = await waitForPageTarget(port, 10_000);
    let lastError = null;

    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const currentPage = attempt === 1 ? page : await waitForPageTarget(port, 5000);
        const ws = await RawWebSocket.connect(currentPage.webSocketDebuggerUrl, 10_000);
        cdp = new CdpClient(ws);
        break;
      } catch (error) {
        lastError = error;
        await sleep(750);
      }
    }

    if (!cdp) throw new Error(`Unable to connect to page CDP: ${lastError?.message || "unknown error"}`);

    await cdp.send("Runtime.enable");
    await sleep(8000);

    const expression = `(() => {
      const text = (selector) => document.querySelector(selector)?.innerText?.trim() || "";
      const meta = (name) => document.querySelector('meta[property="' + name + '"], meta[name="' + name + '"]')?.content || "";
      const title = text("#activity-name") || meta("og:title") || document.title || "";
      const author = text("#js_name") || text(".rich_media_meta_text") || meta("author") || "";
      const published = text("#publish_time") || "";
      const description = meta("og:description") || meta("description") || "";
      const content = text("#js_content") || text(".rich_media_content") || "";
      const bodyPreview = document.body?.innerText?.trim()?.slice(0, 1200) || "";
      return {
        url: location.href,
        title,
        author,
        published,
        description,
        content,
        bodyPreview,
        htmlLength: document.documentElement.outerHTML.length
      };
    })()`;

    const result = await cdp.send("Runtime.evaluate", { expression, returnByValue: true }, 30_000);
    const data = result.result?.value;
    if (!data) throw new Error("Failed to evaluate page content.");

    const blockReason = detectBlockPage(data);
    if (blockReason) throw new Error(`WeChat block page detected: ${blockReason}`);
    if (!data.content || data.content.length < 200) {
      throw new Error(`Article content not found. Page title: ${data.title || "(empty)"}. Preview: ${(data.bodyPreview || "").slice(0, 240)}`);
    }

    const outputDir = path.resolve(args.outputDir);
    await mkdir(outputDir, { recursive: true });
    const urlId = new URL(articleUrl).pathname.split("/").filter(Boolean).pop() || "s";
    const slug = sanitizeSlug(data.title, urlId);
    const outputPath = path.join(outputDir, `${slug}.md`);
    const markdown = [
      "---",
      `url: ${JSON.stringify(data.url)}`,
      `title: ${JSON.stringify(data.title)}`,
      `author: ${JSON.stringify(data.author)}`,
      `published: ${JSON.stringify(data.published)}`,
      `description: ${JSON.stringify(data.description)}`,
      `captured_at: ${JSON.stringify(new Date().toISOString())}`,
      `proxy: ${JSON.stringify(args.proxy || "")}`,
      "---",
      "",
      `# ${data.title || "Untitled"}`,
      "",
      data.author ? `作者：${data.author}` : "",
      data.published ? `发布时间：${data.published}` : "",
      "",
      data.content,
      "",
    ].filter((line, idx, arr) => line !== "" || arr[idx - 1] !== "").join("\n");

    await writeFile(outputPath, markdown, "utf8");
    console.log(JSON.stringify({
      ok: true,
      outputPath,
      title: data.title,
      author: data.author,
      published: data.published,
      chars: data.content.length,
    }, null, 2));
  } finally {
    cdp?.close();
    if (!args.keepBrowser) {
      try {
        child.kill();
      } catch {}
      await sleep(500);
      await rm(profileDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
});
