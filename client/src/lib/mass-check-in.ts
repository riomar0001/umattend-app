export const MAX_MASS_CHECK_IN_IDS = 1000;

// Parse CSV without converting IDs to numbers (leading zeroes are significant).
function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let closedQuote = false;
  const pushField = () => {
    row.push(field.trim());
    field = '';
    closedQuote = false;
  };
  const pushRow = () => {
    pushField();
    if (row.some(Boolean)) rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closedQuote = true;
        }
      } else field += char;
    } else if (char === ',') pushField();
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      pushRow();
    } else if (char === '"') {
      if (field.trim() || closedQuote) throw new Error('Invalid CSV quotes');
      field = '';
      quoted = true;
    } else {
      if (closedQuote && char.trim()) throw new Error('Invalid text after a CSV quote');
      field += char;
    }
  }
  if (quoted) throw new Error('Unclosed quote in CSV');
  pushRow();
  return rows;
}

export function parseMassCheckIn(text: string, csv = false) {
  const clean = text.replace(/^\uFEFF/, '').trim();
  let values: string[];
  if (csv) {
    const rows = csvRows(clean);
    const header = rows[0] ?? [];
    const column = header.findIndex((cell) => /^(studentid|studentidnumber|idnumber)$/.test(cell.toLowerCase().replace(/[\s_-]/g, '')));
    if (column >= 0) values = rows.slice(1).map((row) => row[column] ?? '');
    else {
      if (rows.some((row) => row.length !== 1)) throw new Error('CSV files with multiple columns need a student_id column.');
      values = rows.map((row) => row[0]);
    }
  } else values = clean ? clean.split(/[\s,;]+/) : [];
  const invalid = values.filter((id) => !/^\d{6}$/.test(id));
  const ids = [...new Set(values.filter((id) => /^\d{6}$/.test(id)))];
  if (ids.length > MAX_MASS_CHECK_IN_IDS) throw new Error(`Import at most ${MAX_MASS_CHECK_IN_IDS} unique student IDs at a time.`);
  return { ids, invalid, duplicates: values.length - invalid.length - ids.length };
}
