// Neutralize spreadsheet formulas in user-entered cells, then apply RFC 4180 quoting.
export function csvCell(value) {
  let text=value==null?'':String(value);
  if(/^[=+@\-\t\r]/.test(text.trimStart()))text="'"+text;
  return `"${text.replaceAll('"','""')}"`;
}
export function csvDocument(headers,rows){return '\uFEFF'+[headers,...rows].map(r=>r.map(csvCell).join(',')).join('\r\n')+'\r\n';}
