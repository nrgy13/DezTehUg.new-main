// Простой CSV-конвертер. Excel умеет открывать UTF-8 CSV если есть BOM.
// Разделитель — точка с запятой (;) чтобы Excel правильно парсил числа с запятой.

export function toCSV(headers: string[], rows: Array<Array<string | number | null>>): string {
  const escape = (v: string | number | null): string => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (s.includes(';') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines = [headers.map(escape).join(';')];
  for (const row of rows) {
    lines.push(row.map(escape).join(';'));
  }
  // BOM для корректного чтения Excel'ом UTF-8 кириллицы
  return '﻿' + lines.join('\r\n');
}

export type CSVPayload = { filename: string; content: string };

export function csvResponse(payload: CSVPayload): Response {
  return new Response(payload.content, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(payload.filename)}"`,
    },
  });
}
