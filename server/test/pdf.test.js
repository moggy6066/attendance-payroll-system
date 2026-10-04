const test = require('node:test');
const assert = require('node:assert/strict');
const { splitRuns, tokens, renderTablePdf } = require('../src/utils/pdf');

test('splitRuns keeps numbers, dates and emails as LTR runs inside Arabic text', () => {
  assert.deepEqual(splitRuns('8س 30د'), [
    { text: '8', rtl: false },
    { text: 'س ', rtl: true },
    { text: '30', rtl: false },
    { text: 'د', rtl: true }
  ]);
  assert.deepEqual(splitRuns('الفترة: 2026-10'), [
    { text: 'الفترة: ', rtl: true },
    { text: '2026-10', rtl: false }
  ]);
  assert.deepEqual(splitRuns('a@b.com'), [{ text: 'a@b.com', rtl: false }]);
});

test('tokens split Arabic runs into words and spaces', () => {
  assert.deepEqual(
    tokens('الغياب والتأخير').map((t) => t.text),
    ['الغياب', ' ', 'والتأخير']
  );
});

test('renderTablePdf produces a valid multi-page PDF', async () => {
  const rows = Array.from({ length: 60 }, (_, i) => ({ n: `EMP-${i}`, name: 'محمد الحربي', v: i }));
  const doc = renderTablePdf({
    title: 'تقرير تجريبي',
    subtitle: 'الفترة: 2026-10',
    columns: [
      { header: 'الرقم', width: 10, value: (r) => r.n },
      { header: 'الاسم', width: 20, value: (r) => r.name },
      { header: 'القيمة', width: 10, value: (r) => r.v }
    ],
    rows,
    footer: 'اختبار'
  });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  await new Promise((resolve) => doc.on('end', resolve));
  const pdf = Buffer.concat(chunks);
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  const pages = (pdf.toString('latin1').match(/\/Type \/Page\b/g) || []).length;
  assert.ok(pages >= 2, `expected >= 2 pages, got ${pages}`);
});
