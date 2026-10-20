import type { TextSelection } from './bible';

// Source positions are one-based UTF-16 columns, as in desktop annotation exports.
export type TextPoint = { line: number; column: number };
export const comparePoints = (a: TextPoint, b: TextPoint) => a.line - b.line || a.column - b.column;

export function textRange(lines: string[], a: TextPoint, b: TextPoint): TextSelection | null {
  const [start, end] = comparePoints(a, b) <= 0 ? [a, b] : [b, a];
  if (start.line < 1 || end.line > lines.length || start.column < 1 || end.column < 1 ||
    start.column > lines[start.line - 1].length + 1 || end.column > lines[end.line - 1].length + 1 || !comparePoints(start, end)) return null;
  const text = lines.slice(start.line - 1, end.line).map((line, i) =>
    line.slice(i === 0 ? start.column - 1 : 0, i === end.line - start.line ? end.column - 1 : undefined)).join('\n');
  return text.trim() ? { startPhysicalLine: start.line, startColumn: start.column, endPhysicalLine: end.line, endColumn: end.column, text } : null;
}

export function graphemes(text: string): { index: number; segment: string }[] {
  return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)];
}

export function characterAt(text: string, offset: number) {
  const parts = graphemes(text);
  const part = parts.find(p => p.index + p.segment.length > offset) ?? parts.at(-1);
  return part ? { start: part.index, end: part.index + part.segment.length } : null;
}
