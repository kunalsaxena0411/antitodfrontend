/**
 * Shared client-side export utilities for ANTITODE.
 */

export function escapeCsv(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function buildCsv(
  headers: string[],
  rows: Array<Array<unknown>>,
): string {
  return [
    headers.map(escapeCsv).join(','),
    ...rows.map((row) => row.map(escapeCsv).join(',')),
  ].join('\n');
}

export function downloadFile(
  filename: string,
  content: string,
  mimeType: string,
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function exportAsCsv(
  filenamePrefix: string,
  headers: string[],
  rows: Array<Array<unknown>>,
): void {
  const dateStr = new Date().toISOString().slice(0, 10);
  const csv = buildCsv(headers, rows);
  downloadFile(
    `${filenamePrefix}-${dateStr}.csv`,
    csv,
    'text/csv;charset=utf-8',
  );
}

export function exportAsJson(
  filenamePrefix: string,
  dataset: string,
  data: unknown,
  filters?: Record<string, unknown>,
): void {
  const dateStr = new Date().toISOString().slice(0, 10);
  const payload = {
    product: 'ANTITODE',
    dataset,
    exportedAt: new Date().toISOString(),
    ...(filters ? { filters } : {}),
    data,
  };

  downloadFile(
    `${filenamePrefix}-${dateStr}.json`,
    JSON.stringify(payload, null, 2),
    'application/json;charset=utf-8',
  );
}
