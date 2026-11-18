function escapeCsvCell(val: string | number | boolean | null | undefined): string {
  const str = val === null || val === undefined ? '' : String(val);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
): void {
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ];
  const bom = '\uFEFF';
  const blob = new Blob([bom + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  triggerBlobDownload(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}

export function downloadExcelHtml(
  filename: string,
  reportTitle: string,
  subtitle: string,
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
): void {
  const headerHtml = headers.map((h) => `<th style="background:#172554;color:#ffffff;padding:8px;border:1px solid #cbd5e1;">${escapeHtml(String(h))}</th>`).join('');
  const bodyHtml = rows
    .map(
      (row) =>
        `<tr>${row
          .map(
            (cell) =>
              `<td style="padding:6px 8px;border:1px solid #cbd5e1;">${escapeHtml(
                cell === null || cell === undefined ? '' : String(cell),
              )}</td>`,
          )
          .join('')}</tr>`,
    )
    .join('');

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="UTF-8" /></head>
      <body>
        <table>
          <tr><td colspan="${headers.length}" style="font-size:16px;font-weight:bold;color:#172554;">TKA SMART — ${escapeHtml(reportTitle)}</td></tr>
          <tr><td colspan="${headers.length}" style="font-size:12px;color:#475569;">${escapeHtml(subtitle)}</td></tr>
          <tr><td colspan="${headers.length}"></td></tr>
          <thead><tr>${headerHtml}</tr></thead>
          <tbody>${bodyHtml}</tbody>
        </table>
      </body>
    </html>
  `;
  const blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  triggerBlobDownload(blob, filename.endsWith('.xls') ? filename : `${filename}.xls`);
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8;' });
  triggerBlobDownload(blob, filename.endsWith('.json') ? filename : `${filename}.json`);
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function printReportPdf(reportTitle: string): void {
  const prevTitle = document.title;
  document.title = `TKA SMART - ${reportTitle}`;
  window.print();
  setTimeout(() => {
    document.title = prevTitle;
  }, 500);
}
