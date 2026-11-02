// Gera docs/relatorio/relatorio.pdf a partir de docs/relatorio/relatorio.md (npm run relatorio:pdf).
// Usa o Chromium do Playwright (já instalado para o E2E); o conversor cobre apenas o
// subconjunto de Markdown usado no relatório: títulos, parágrafos, listas, tabelas,
// citações, blocos de código, figuras e marcações inline.

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const DIR = fileURLToPath(new URL("../docs/relatorio/", import.meta.url));
const SOURCE = join(DIR, "relatorio.md");
const OUTPUT = join(DIR, "relatorio.pdf");

const escape = (text) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/** Marcações inline: código, negrito, itálico, links e campos ⟨a preencher⟩. */
function inline(text) {
  const codes = [];
  let html = escape(text.replaceAll("\\|", "|")).replace(/`([^`]+)`/g, (_, code) => {
    codes.push(`<code>${code}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  html = html
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/⟨([^⟩]+)⟩/g, "<mark>⟨$1⟩</mark>");
  return html.replace(/\u0000(\d+)\u0000/g, (_, index) => codes[Number(index)]);
}

function markdownToHtml(markdown) {
  const lines = markdown.split(/\r?\n/);
  const out = [];
  let i = 0;
  const collect = (test) => {
    const block = [];
    while (i < lines.length && test(lines[i])) block.push(lines[i++]);
    return block;
  };

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      i++;
    } else if (line.startsWith("```")) {
      i++;
      const code = collect((current) => !current.startsWith("```"));
      i++;
      out.push(`<pre><code>${escape(code.join("\n"))}</code></pre>`);
    } else if (/^#{1,3} /.test(line)) {
      const level = line.indexOf(" ");
      const text = line.slice(level + 1);
      const id = text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-");
      out.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
      i++;
    } else if (line.startsWith("|")) {
      const rows = collect((current) => current.startsWith("|")).map((row) =>
        row.slice(1, -1).split(" | ").map((cell) => inline(cell.trim())),
      );
      const [head, , ...body] = rows;
      out.push(
        `<table><thead><tr>${head.map((cell) => `<th>${cell}</th>`).join("")}</tr></thead><tbody>` +
          body.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("") +
          "</tbody></table>",
      );
    } else if (/^!\[/.test(line)) {
      const [, alt, src] = /^!\[([^\]]*)\]\(([^)]+)\)/.exec(line);
      out.push(`<figure><img src="${pathToFileURL(join(DIR, src)).href}" alt=""><figcaption>${inline(alt)}</figcaption></figure>`);
      i++;
    } else if (line.startsWith("> ")) {
      const quote = collect((current) => current.startsWith("> ")).map((current) => current.slice(2));
      out.push(`<blockquote>${inline(quote.join(" "))}</blockquote>`);
    } else if (/^- /.test(line)) {
      const items = collect((current) => /^- /.test(current)).map((item) => `<li>${inline(item.slice(2))}</li>`);
      out.push(`<ul>${items.join("")}</ul>`);
    } else if (/^\d+\. /.test(line)) {
      const items = collect((current) => /^\d+\. /.test(current)).map((item) => `<li>${inline(item.replace(/^\d+\. /, ""))}</li>`);
      out.push(`<ol>${items.join("")}</ol>`);
    } else {
      const paragraph = collect((current) => current.trim() !== "" && !/^(#|\||!\[|> |- |\d+\. |```)/.test(current));
      out.push(`<p>${inline(paragraph.join(" "))}</p>`);
    }
  }
  return out.join("\n");
}

const STYLE = `
  @page { size: A4; margin: 22mm 20mm 20mm 20mm; }
  body { font-family: Georgia, "Times New Roman", serif; font-size: 10.5pt; line-height: 1.5; color: #1a2132; font-variant-numeric: lining-nums; }
  h1, h2, h3, th, figcaption { font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif; }
  h1 { font-size: 30pt; margin: 70mm 0 4mm; letter-spacing: 0.01em; }
  h1 + p { font-size: 13pt; margin-bottom: 18mm; }
  h2 { font-size: 16pt; margin-top: 0; padding-bottom: 2mm; border-bottom: 1.5pt solid #1a2132; break-before: page; }
  h3 { font-size: 12.5pt; margin-top: 7mm; break-after: avoid; }
  p, li { text-align: justify; hyphens: auto; }
  code, pre { font-family: Consolas, "Courier New", monospace; font-size: 9pt; }
  code { background: #f1eee6; padding: 0 2px; border-radius: 2px; }
  pre { background: #f6f4ee; border: 0.5pt solid #c9c2b1; padding: 3mm; white-space: pre-wrap; break-inside: avoid; }
  pre code { background: none; padding: 0; }
  table { width: 100%; border-collapse: collapse; margin: 3mm 0 5mm; font-size: 9pt; break-inside: avoid; }
  th { text-align: left; background: #ece8de; font-size: 8.5pt; }
  th, td { border: 0.5pt solid #b9b3a5; padding: 1.5mm 2mm; vertical-align: top; text-align: left; }
  figure { margin: 4mm 0 6mm; break-inside: avoid; text-align: center; }
  figure img { max-width: 100%; max-height: 120mm; border: 0.5pt solid #b9b3a5; }
  figcaption { font-size: 8.5pt; color: #545b6b; margin-top: 2mm; }
  blockquote { margin: 4mm 8mm; font-style: italic; }
  mark { background: #ffe680; }
  a { color: #1f5fcf; text-decoration: none; }
`;

const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>NeoCore Computer Lab — Relatório técnico</title><style>${STYLE}</style></head><body>${markdownToHtml(readFileSync(SOURCE, "utf8"))}</body></html>`;

const work = mkdtempSync(join(tmpdir(), "neocore-relatorio-"));
const page = join(work, "relatorio.html");
writeFileSync(page, html);
// Opcional: RELATORIO_HTML=caminho guarda também o HTML intermediário, para revisar no navegador.
if (process.env.RELATORIO_HTML) writeFileSync(process.env.RELATORIO_HTML, html);

const browser = await chromium.launch();
try {
  const tab = await browser.newPage();
  await tab.goto(pathToFileURL(page).href, { waitUntil: "load" });
  await tab.pdf({
    path: OUTPUT,
    format: "A4",
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate:
      '<div style="width:100%;font-size:8pt;color:#545b6b;text-align:center;font-family:Arial,sans-serif">NeoCore Computer Lab — relatório técnico · página <span class="pageNumber"></span> de <span class="totalPages"></span></div>',
  });
  console.log(`PDF gerado: ${OUTPUT}`);
} finally {
  await browser.close();
  rmSync(work, { recursive: true, force: true });
}
