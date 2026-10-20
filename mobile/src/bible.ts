import { chapterAt, type Annotation, type Chapter } from './core';

export type TextSelection = Pick<Annotation, 'startPhysicalLine'|'endPhysicalLine'|'startColumn'|'endColumn'|'text'>;
export function verseNumber(text: string) { return /^(\d+)　/.exec(text)?.[1]; }
export function chapterVerses(lines: string[], chapters: Chapter[], chapter: Chapter) {
  const index = chapters.findIndex(c => c.line === chapter.line);
  const end = chapters[index + 1]?.line ?? lines.length + 1;
  return lines.slice(chapter.line - 1, end - 1).flatMap((text, i) => {
    const number = verseNumber(text);
    return number ? [{ number: Number(number), line: chapter.line + i }] : [];
  });
}
export function verseRange(lines: string[], first: number, last = first): TextSelection | null {
  const start = Math.min(first, last), end = Math.max(first, last);
  if (start < 1 || end > lines.length || !verseNumber(lines[start - 1]) || !verseNumber(lines[end - 1])) return null;
  return { startPhysicalLine: start, startColumn: 1, endPhysicalLine: end, endColumn: lines[end - 1].length + 1, text: lines.slice(start - 1, end).join('\n') };
}
export function passageLabel(lines: string[], chapters: Chapter[], range: TextSelection) {
  const a = chapters[chapterAt(chapters, range.startPhysicalLine)], b = chapters[chapterAt(chapters, range.endPhysicalLine)];
  if (!a?.book || !a.chapter) return a?.title ?? '';
  const first = verseNumber(lines[range.startPhysicalLine - 1] ?? ''), last = verseNumber(lines[range.endPhysicalLine - 1] ?? '');
  const head = `${a.book} ${a.chapter}`;
  if (!first) return `${head}章`;
  if (a === b) return `${head}:${first}${last && last !== first ? '–' + last : ''}`;
  return `${head}:${first}–${a.book === b?.book ? '' : (b?.book ?? '') + ' '}${b?.chapter ?? ''}${last ? ':' + last : ''}`;
}
