#!/usr/bin/env node
import { readdirSync, writeFileSync } from "fs";
import { join, basename } from "path";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
const docsDir = join(process.cwd(), "docs");

let files = [];
try {
  files = readdirSync(docsDir)
    .filter(f => f.startsWith("sensitivity-") && f.endsWith(".html"))
    .sort()
    .reverse();
} catch {}

let links = "";
for (const f of files.slice(0, 30)) {
  const date = f.replace("sensitivity-", "").replace(".html", "");
  let dateDisplay = date;
  let weekday = "";
  try {
    const d = new Date(date);
    dateDisplay = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    weekday = `週${WEEKDAYS[d.getDay()]}`;
  } catch {}
  links += `<li><a href="${f}">📅 ${dateDisplay}（${weekday}）</a></li>\n`;
}

const total = files.length;

const index = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Highly Sensitive · 高敏感研究文獻日報</title>
<style>
  :root { --bg: #f6f1e8; --surface: #fffaf2; --line: #d8c5ab; --text: #2b2118; --muted: #766453; --accent: #8c4f2b; --accent-soft: #ead2bf; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: radial-gradient(circle at top, #fff6ea 0, var(--bg) 55%, #ead8c6 100%); color: var(--text); font-family: "Noto Sans TC", "PingFang TC", "Helvetica Neue", Arial, sans-serif; min-height: 100vh; }
  .container { position: relative; z-index: 1; max-width: 640px; margin: 0 auto; padding: 80px 24px; }
  .logo { font-size: 48px; text-align: center; margin-bottom: 16px; }
  h1 { text-align: center; font-size: 24px; color: var(--text); margin-bottom: 8px; }
  .subtitle { text-align: center; color: var(--accent); font-size: 14px; margin-bottom: 48px; }
  .count { text-align: center; color: var(--muted); font-size: 13px; margin-bottom: 32px; }
  ul { list-style: none; }
  li { margin-bottom: 8px; }
  a { color: var(--text); text-decoration: none; display: block; padding: 14px 20px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; transition: all 0.2s; font-size: 15px; }
  a:hover { background: var(--accent-soft); border-color: var(--accent); transform: translateX(4px); }
  .clinic-links { margin-top: 40px; display: flex; flex-direction: column; gap: 8px; }
  .clinic-link { display: flex; align-items: center; gap: 12px; padding: 14px 20px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; text-decoration: none; color: var(--text); transition: all 0.2s; font-size: 14px; }
  .clinic-link:hover { background: var(--accent-soft); border-color: var(--accent); transform: translateX(4px); }
  .clinic-icon { font-size: 22px; }
  .clinic-label { font-weight: 600; }
  footer { margin-top: 56px; text-align: center; font-size: 12px; color: var(--muted); }
  footer a { display: inline; padding: 0; background: none; border: none; color: var(--muted); }
  footer a:hover { color: var(--accent); }
</style>
</head>
<body>
<div class="container">
  <div class="logo">🌸</div>
  <h1>Highly Sensitive</h1>
  <p class="subtitle">高敏感研究文獻日報 · 每日自動更新</p>
  <p class="count">共 ${total} 期日報</p>
  <ul>${links}</ul>
  <div class="clinic-links">
    <a href="https://www.leepsyclinic.com/" class="clinic-link" target="_blank">
      <span class="clinic-icon">🏥</span>
      <span class="clinic-label">李政洋身心診所</span>
    </a>
    <a href="https://blog.leepsyclinic.com/" class="clinic-link" target="_blank">
      <span class="clinic-icon">📬</span>
      <span class="clinic-label">訂閱電子報</span>
    </a>
    <a href="https://buymeacoffee.com/CYlee" class="clinic-link" target="_blank">
      <span class="clinic-icon">☕</span>
      <span class="clinic-label">Buy Me a Coffee</span>
    </a>
  </div>
  <footer>
    <p>Powered by PubMed + Zhipu AI · <a href="https://github.com/u8901006/highly-sensitive">GitHub</a></p>
  </footer>
</div>
</body>
</html>`;

writeFileSync(join(docsDir, "index.html"), index, "utf-8");
console.log("Index page generated");
