import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyMaharashtraPublication as classify } from '../scripts/lib/maharashtra-publication.ts';

const INDEX = 'https://finance.maharashtra.gov.in/en/document-category/program-budget-2026-27-part-1/';
const PDF = 'https://cdnbbsr.s3waas.gov.in/s349d4b2faeb4b7b9e745775793141e2b2/uploads/2026/03/20260312793729190.pdf';

test('six source-observed numbered PDF rows are retained', () => {
  const rows = [
    'Publication No. 1 Accessible Version : View(330 KB)',
    'Publication No. 2 Accounts and Treasury Accessible Version : View(3 MB)',
    'Publication No. 3 Goods and Services Tax Accessible Version : View(646 KB)',
    'Publication 4 State Lottery Directorate Accessible Version : View(805 KB)',
    'प्रकाशन क्रमांक ५ विमा संचालनालय Accessible Version : View(665 KB)',
    'Publication No. 6 Local Fund Accessible Version : View(303 KB)'
  ];
  assert.equal(rows.filter(row => classify(PDF, row, INDEX)).length, 6);
});

test('navigation Documents link is rejected despite ancestor Publications text', () => {
  assert.equal(classify('https://finance.maharashtra.gov.in/en/documents/', '', INDEX), null);
  assert.equal(classify('https://finance.maharashtra.gov.in/en/documents/', 'Publications Handbook RTI Documents', INDEX), null);
});

test('generic PDF without numbered publication row is rejected', () => {
  assert.equal(classify(PDF, 'Publications Handbook RTI', INDEX), null);
  assert.equal(classify(PDF, '', INDEX), null);
});

test('non-official and non-PDF destinations fail closed', () => {
  assert.equal(classify('https://example.com/report.pdf', 'Publication No. 1', INDEX), null);
  assert.equal(classify('http://finance.maharashtra.gov.in/report.pdf', 'Publication No. 1', INDEX), null);
  assert.equal(classify('javascript:alert(1)', 'Publication No. 1', INDEX), null);
  assert.equal(classify('https://finance.maharashtra.gov.in/report.html', 'Publication No. 1', INDEX), null);
});

test('relative official PDF link is resolved and query strings do not bypass extension check', () => {
  assert.equal(classify('/wp-content/uploads/report.pdf?download=1', 'Publication No. 7', INDEX)?.sourceUrl,
    'https://finance.maharashtra.gov.in/wp-content/uploads/report.pdf?download=1');
  assert.equal(classify('/report.pdf.exe', 'Publication No. 7', INDEX), null);
});

test('numbered-looking text in a very long ancestor is rejected', () => {
  assert.equal(classify(PDF, 'Publication No. 1 ' + 'x'.repeat(500), INDEX), null);
});
