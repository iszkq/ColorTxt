import { CHAPTER_MATCH_BUILTIN_MAIN_PATTERN, CHAPTER_MATCH_BUILTIN_ALT_PATTERN } from '../../src/shared/chapterMatchBuiltinPatterns';
export { DEFAULT_LINEATION_COLORS_LIGHT as annotationColors } from '../../src/renderer/src/constants/lineationColors';
export { DEFAULT_HIGHLIGHT_COLORS_LIGHT as wordColors, DEFAULT_HIGHLIGHT_COLORS_DARK as darkWordColors } from '../../src/renderer/src/constants/highlightColors';

export type Annotation = {
  id: string; startPhysicalLine: number; startColumn: number; endPhysicalLine: number; endColumn: number;
  text: string; lineation?: { type: 'marker' | 'wavy' | 'straight'; colorIndex: number };
  note?: { content: string; createdAt: number; updatedAt: number };
  createdAt: number; updatedAt: number;
};
export type Chapter = { title: string; line: number; book?: string; testament?: string; chapter?: number };
export type Book = {
  id: string; title: string; fileName: string; content: string; chapters: Chapter[];
  annotations: Annotation[]; keywords: { text: string; color: number }[];
  bookmarks: number[]; line: number; lastOpened: number; builtin?: boolean;
};
export type Settings = { theme: 'paper' | 'light' | 'dark'; fontSize: number; lineHeight: number; colorize: boolean; serif: boolean };
export const defaultSettings: Settings = { theme: 'paper', fontSize: 21, lineHeight: 1.95, colorize: true, serif: true };
const chapterPatterns = [new RegExp(CHAPTER_MATCH_BUILTIN_MAIN_PATTERN), new RegExp(CHAPTER_MATCH_BUILTIN_ALT_PATTERN), /^#{1,6}\s+\S/];
export function detectChapters(content: string): Chapter[] {
  const result: Chapter[] = [];
  content.split('\n').forEach((line, i) => {
    if (chapterPatterns.some(re => re.test(line))) result.push({ title: line.trim().replace(/^#+\s*/, ''), line: i + 1 });
  });
  if (!result.length || result[0].line !== 1) result.unshift({ title: result.length ? '开篇' : '正文', line: 1 });
  return result;
}
export function normalizeContent(text: string) { return text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n'); }
export function createBook(fileName: string, content: string): Book {
  content = normalizeContent(content);
  return { id: crypto.randomUUID(), title: fileName.replace(/\.(txt|md)$/i, ''), fileName, content,
    chapters: detectChapters(content), annotations: [], keywords: [], bookmarks: [], line: 1, lastOpened: Date.now() };
}
export function decodeText(bytes: ArrayBuffer): string {
  const a = new Uint8Array(bytes);
  if (a[0] === 0xff && a[1] === 0xfe) return new TextDecoder('utf-16le').decode(a);
  if (a[0] === 0xfe && a[1] === 0xff) return new TextDecoder('utf-16be').decode(a);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(a); }
  catch { return new TextDecoder('gb18030').decode(a); }
}
export function chapterAt(chapters: Chapter[], line: number) {
  let low = 0, high = chapters.length - 1;
  while (low < high) { const mid = Math.ceil((low + high) / 2); if (chapters[mid].line <= line) low = mid; else high = mid - 1; }
  return low;
}
export type Segment = { text: string; start: number; end: number; color?: number | 'dialogue' | 'bracket'; annotations: Annotation[] };
// Text-only segments: Vue escapes imported text; no book content is executed as HTML.
export function segmentsForLine(text: string, line: number, annotations: Annotation[], keywords: Book['keywords'], colorize: boolean): Segment[] {
  const colors: { start: number; end: number; color: Segment['color'] }[] = [];
  if (colorize) {
    for (const m of text.matchAll(/[“「『][^”」』]*[”」』]?|[（(][^）)]*[）)]/gu)) {
      colors.push({ start: m.index!, end: m.index! + m[0].length, color: /^[“「『]/u.test(m[0]) ? 'dialogue' : 'bracket' });
    }
    for (const keyword of [...keywords].sort((a,b) => b.text.length - a.text.length)) {
      if (!keyword.text) continue;
      let from = 0, at = -1;
      while ((at = text.indexOf(keyword.text, from)) >= 0) { colors.unshift({ start: at, end: at + keyword.text.length, color: keyword.color }); from = at + keyword.text.length; }
    }
  }
  const ranges = annotations.filter(a => a.startPhysicalLine <= line && a.endPhysicalLine >= line).map(a => ({
    start: a.startPhysicalLine === line ? a.startColumn - 1 : 0,
    end: a.endPhysicalLine === line ? a.endColumn - 1 : text.length, annotation: a,
  }));
  const breaks = [...new Set([0, text.length, ...colors.flatMap(c => [c.start, c.end]), ...ranges.flatMap(r => [Math.max(0, Math.min(text.length, r.start)), Math.max(0, Math.min(text.length, r.end))])])].sort((a,b) => a-b);
  return breaks.slice(0, -1).map((start, i) => { const end = breaks[i+1]; return { start, end, text: text.slice(start,end), color: colors.find(c => c.start <= start && c.end >= end)?.color,
    annotations: ranges.filter(r => r.start <= start && r.end >= end).map(r => r.annotation) }; });
}
export function validAnnotations(raw: unknown, lines: string[]): Annotation[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((a): a is Annotation => {
    if (!a || typeof a !== 'object' || typeof a.id !== 'string' || typeof a.text !== 'string') return false;
    const { startPhysicalLine: s, endPhysicalLine: e, startColumn: sc, endColumn: ec } = a;
    if (![s,e,sc,ec].every(Number.isInteger) || s < 1 || e < s || e > lines.length || sc < 1 || ec < 1 || sc > lines[s-1].length+1 || ec > lines[e-1].length+1 || (s === e && sc >= ec)) return false;
    const quote = lines.slice(s-1,e).map((text,i) => text.slice(i === 0 ? sc-1 : 0, i === e-s ? ec-1 : undefined)).join('\n');
    return quote === a.text && (!a.note || typeof a.note.content === 'string') && (!a.lineation || (['marker','wavy','straight'].includes(a.lineation.type) && Number.isInteger(a.lineation.colorIndex)));
  });
}
export function annotationJson(book: Book) {
  return JSON.stringify({ schemaVersion: 1, exportedAt: Date.now(), bookPath: book.fileName, bookName: book.fileName, annotations: book.annotations }, null, 2);
}
export function notesMarkdown(book: Book) {
  return `# ${book.title} · 阅读笔记\n\n` + book.annotations.map(a => `## ${book.chapters[chapterAt(book.chapters, a.startPhysicalLine)]?.title ?? '正文'}\n\n${a.text.split('\n').map(l => '> '+l).join('\n')}\n\n${a.note?.content ?? ''}\n`).join('\n');
}
