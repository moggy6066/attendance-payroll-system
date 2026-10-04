// Minimal RTL table PDF renderer for Arabic reports (pdfkit + fontkit shaping).
//
// fontkit shapes Arabic (joining forms, ligatures) and returns RTL glyph runs in visual order,
// but pdfkit has no bidi support. Mixed text such as "8س 30د" or "EMP-0001 أحمد" is therefore
// split into directional runs here; runs are placed right-to-left, Latin/digit runs are drawn
// left-to-right with Helvetica, Arabic runs with Noto Naskh Arabic.

const path = require('path');
const PDFDocument = require('pdfkit');

const FONT_DIR = path.join(__dirname, '..', '..', 'assets', 'fonts');
const AR_REGULAR = path.join(FONT_DIR, 'NotoNaskhArabic-Regular.ttf');
const AR_BOLD = path.join(FONT_DIR, 'NotoNaskhArabic-Bold.ttf');

const ARABIC = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
const LTR = /[A-Za-z0-9\u00C0-\u024F]/;

// Splits text into [{ text, rtl }] runs in logical order. Neutral characters (spaces, punctuation)
// between two LTR characters stay in the LTR run (e.g. "2026-10-04", "a@b.com", "08:30");
// everything else belongs to the surrounding RTL text.
function splitRuns(input) {
  const text = String(input ?? '');
  const types = [...text].map((ch) => (ARABIC.test(ch) ? 'R' : LTR.test(ch) ? 'L' : 'N'));
  const chars = [...text];
  const resolved = types.map((t, i) => {
    if (t !== 'N') return t;
    let prev = null;
    for (let j = i - 1; j >= 0; j -= 1) if (types[j] !== 'N') { prev = types[j]; break; }
    let next = null;
    for (let j = i + 1; j < types.length; j += 1) if (types[j] !== 'N') { next = types[j]; break; }
    return prev === 'L' && next === 'L' ? 'L' : 'R';
  });
  const runs = [];
  chars.forEach((ch, i) => {
    const rtl = resolved[i] === 'R';
    const last = runs[runs.length - 1];
    if (last && last.rtl === rtl) last.text += ch;
    else runs.push({ text: ch, rtl });
  });
  return runs;
}

function fontFor(run, bold) {
  if (run.rtl) return bold ? 'ar-bold' : 'ar';
  return bold ? 'Helvetica-Bold' : 'Helvetica';
}

// pdfkit lays out an Arabic run word by word, left to right, and drops the spaces, which
// reverses word order. Each RTL run is therefore split into words and space gaps that are
// placed individually from right to left.
function tokens(text) {
  const out = [];
  for (const run of splitRuns(text)) {
    if (!run.rtl) {
      out.push({ text: run.text, rtl: false });
      continue;
    }
    for (const part of run.text.split(/(\s+)/)) {
      if (!part) continue;
      out.push({ text: part, rtl: true, space: /^\s+$/.test(part) });
    }
  }
  return out;
}

function tokenWidth(doc, tok, size, bold) {
  if (tok.space) return doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).widthOfString(' ') * tok.text.length;
  return doc.font(fontFor(tok, bold)).fontSize(size).widthOfString(tok.text);
}

function measure(doc, text, size, bold) {
  return tokens(text).reduce((w, tok) => w + tokenWidth(doc, tok, size, bold), 0);
}

// Truncates (with …) so the text fits `maxWidth`.
function fit(doc, text, size, bold, maxWidth) {
  let t = String(text ?? '');
  if (measure(doc, t, size, bold) <= maxWidth) return t;
  while (t.length > 1 && measure(doc, `${t}…`, size, bold) > maxWidth) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

// Draws `text` right-aligned inside [x, x + width] (RTL paragraph direction).
function drawRtl(doc, text, x, y, width, { size = 10, bold = false, align = 'right' } = {}) {
  const value = fit(doc, text, size, bold, width);
  const total = measure(doc, value, size, bold);
  let cursor = align === 'center' ? x + (width + total) / 2 : x + width; // right edge of first token
  for (const tok of tokens(value)) {
    const w = tokenWidth(doc, tok, size, bold);
    cursor -= w;
    if (!tok.space) {
      doc.font(fontFor(tok, bold)).fontSize(size);
      // Shared alphabetic baseline: Noto Naskh and Helvetica have very different ascents.
      doc.text(tok.text, cursor, y + size * 0.85, { lineBreak: false, baseline: 'alphabetic' });
    }
  }
}

// columns: [{ header, width (relative), value(row) -> string }]
function renderTablePdf({ title, subtitle, columns, rows, footer }) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36, info: { Title: title } });
  doc.registerFont('ar', AR_REGULAR);
  doc.registerFont('ar-bold', AR_BOLD);

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const tableWidth = right - left;
  const totalRel = columns.reduce((a, c) => a + c.width, 0);
  const widths = columns.map((c) => (c.width / totalRel) * tableWidth);
  const rowH = 20;
  const pad = 4;
  let page = 1;

  const header = () => {
    let y = doc.page.margins.top;
    drawRtl(doc, title, left, y, tableWidth, { size: 18, bold: true });
    y += 28;
    if (subtitle) {
      doc.fillColor('#475569');
      drawRtl(doc, subtitle, left, y, tableWidth, { size: 10 });
      doc.fillColor('#000000');
      y += 20;
    }
    // header row (first column on the right)
    doc.rect(left, y, tableWidth, rowH).fill('#e2e8f0');
    doc.fillColor('#0f172a');
    let x = right;
    columns.forEach((c, i) => {
      x -= widths[i];
      drawRtl(doc, c.header, x + pad, y + 4, widths[i] - pad * 2, { size: 9.5, bold: true });
    });
    return y + rowH;
  };

  const pageFooter = () => {
    doc.fillColor('#64748b');
    drawRtl(doc, `${footer || ''}  صفحة ${page}`, left, doc.page.height - doc.page.margins.bottom - 4, tableWidth, { size: 8, align: 'center' });
    doc.fillColor('#000000');
  };

  let y = header();
  if (!rows.length) {
    drawRtl(doc, 'لا توجد بيانات', left, y + 8, tableWidth, { size: 11, align: 'center' });
  }
  rows.forEach((row, r) => {
    if (y + rowH > doc.page.height - doc.page.margins.bottom - 16) {
      pageFooter();
      doc.addPage();
      page += 1;
      y = header();
    }
    if (r % 2 === 1) doc.rect(left, y, tableWidth, rowH).fill('#f8fafc');
    doc.fillColor('#0f172a');
    let x = right;
    columns.forEach((c, i) => {
      x -= widths[i];
      const v = c.value(row);
      drawRtl(doc, v === null || v === undefined ? '' : String(v), x + pad, y + 4, widths[i] - pad * 2, { size: 9 });
    });
    doc.moveTo(left, y + rowH).lineTo(right, y + rowH).lineWidth(0.3).strokeColor('#cbd5e1').stroke();
    y += rowH;
  });
  pageFooter();
  doc.end();
  return doc;
}

module.exports = { splitRuns, tokens, renderTablePdf };
