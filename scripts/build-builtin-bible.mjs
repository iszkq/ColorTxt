import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

// CSV is data only. Preserve verse text; quoted commas/newlines are supported.
export function parseCsv(raw) {
  const rows = []; let row = [], field = '', quoted = false;
  raw = raw.replace(/^\uFEFF/, '');
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '"') {
      if (quoted && raw[i + 1] === '"') { field += '"'; i++; }
      else if (quoted || field === '') quoted = !quoted;
      else field += ch;
    } else if (ch === ',' && !quoted) { row.push(field); field = ''; }
    else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && raw[i + 1] === '\n') i++;
      row.push(field); if (row.some(Boolean)) rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (quoted) throw new Error('CSV 引号未闭合');
  row.push(field); if (row.some(Boolean)) rows.push(row);
  return rows;
}

export async function buildBible(source) {
  const bytes = await readFile(source);
  const [header, ...rows] = parseCsv(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  const expected = ['约名', '大类', '卷名', '卷数', '章数', '节数', '内容'];
  if (!expected.every((v, i) => header[i] === v)) throw new Error('CSV 列不匹配');
  const chapters = []; const lines = []; const seen = new Set(); const volumes = new Set();
  let chapterKey = '', volume = '';
  for (const row of rows) {
    if (row.length !== 7 || !row[6]?.trim()) throw new Error(`正文列异常：${row.slice(0, 6)}`);
    const [testament, category, book, bookNo, chapterNo, verseNo, text] = row;
    const ref = `${bookNo}:${chapterNo}:${verseNo}`;
    if (seen.has(ref)) throw new Error(`重复经节 ${ref}`);
    seen.add(ref); volumes.add(book);
    if (volume !== book) { lines.push(`# ${book}`); volume = book; }
    const key = `${bookNo}:${chapterNo}`;
    if (chapterKey !== key) {
      chapters.push({ title: `${book} 第${chapterNo}章`, line: lines.length + 1, book, testament, category, chapter: +chapterNo });
      lines.push(`## 第${chapterNo}章`); chapterKey = key;
    }
    lines.push(`${verseNo}　${text}`);
  }
  const content = lines.join('\n');
  const data = { id: 'builtin-bible-v1', title: '圣经', fileName: '圣经.md', version: 1, content, chapters,
    source: { file: 'Bible1.csv', sha256: createHash('sha256').update(bytes).digest('hex'), verses: rows.length, volumes: volumes.size, chapters: chapters.length } };
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../resources/builtin');
  await mkdir(root, { recursive: true });
  await writeFile(resolve(root, 'bible.json'), JSON.stringify(data));
  await writeFile(resolve(root, '圣经.md'), content);
  await writeFile(resolve(root, 'provenance.json'), JSON.stringify(data.source, null, 2));
  console.log(JSON.stringify(data.source, null, 2));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) throw new Error('用法：node scripts/build-builtin-bible.mjs <Bible1.csv>');
  await buildBible(process.argv[2]);
}
