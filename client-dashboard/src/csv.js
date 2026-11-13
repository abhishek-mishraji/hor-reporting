/**
 * @file csv.js
 * Client-side CSV for rows the page already holds, following the service CSVs (docs/03):
 * UTF-8 BOM so Excel reads UTF-8, CRLF line ends, values unformatted (ISO dates and times, plain numbers),
 * a value quoted only when it holds a comma, quote or line break. Headers are the column labels.
 */

const BOM = '﻿';

function cell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * @param {Array<{key: string, label: string, type?: string, labels?: Record<string,string>}>} columns
 * @param {Array<object>} rows
 * @returns {string}
 */
export function toCsv(columns, rows) {
  const lines = [columns.map((c) => cell(c.label)).join(',')];
  for (const row of rows || []) {
    lines.push(
      columns
        .map((c) => {
          const v = row[c.key];
          return cell(c.type === 'label' && v != null ? (c.labels?.[v] ?? v) : v);
        })
        .join(',')
    );
  }
  return `${BOM}${lines.join('\r\n')}\r\n`;
}

/**
 * Saves CSV text as a file download in the browser.
 * @param {string} text
 * @param {string} fileName
 */
export function downloadCsv(text, fileName) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
