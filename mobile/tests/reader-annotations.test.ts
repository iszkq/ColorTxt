import assert from 'node:assert/strict';
import test from 'node:test';
import { lineationsForRange, rangesOverlap, updateLineation, type AnnotationRange } from '../src/reader-annotations';
import type { Annotation } from '../src/core';

const range: AnnotationRange = { startPhysicalLine: 4, startColumn: 3, endPhysicalLine: 4, endColumn: 9, text: '摘录内容' };
const annotation = (overrides: Partial<Annotation> = {}): Annotation => ({
  ...range, id: 'a1', lineation: { type: 'marker', colorIndex: 2 }, createdAt: 1, updatedAt: 1, ...overrides,
});

test('range matching uses half-open text positions and supports cross-line selection', () => {
  assert.equal(rangesOverlap(range, { ...range, startColumn: 9, endColumn: 12 }), false);
  assert.equal(rangesOverlap(range, { ...range, startColumn: 8, endColumn: 12 }), true);
  assert.equal(rangesOverlap(
    { ...range, endPhysicalLine: 5, endColumn: 4 },
    { ...range, startPhysicalLine: 5, startColumn: 1, endPhysicalLine: 5, endColumn: 2 },
  ), true);
});

test('selecting another lineation replaces the existing style without duplicating it', () => {
  const result = updateLineation([annotation()], range, { type: 'wavy', colorIndex: 1 }, 10);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].lineation, { type: 'wavy', colorIndex: 1 });
  assert.equal(result[0].updatedAt, 10);
});

test('clearing lineation removes a mark but keeps an attached note', () => {
  const noted = annotation({ note: { content: 'note', createdAt: 2, updatedAt: 2 } });
  const result = updateLineation([noted], range, null, 10);
  assert.equal(result.length, 1);
  assert.equal(result[0].lineation, undefined);
  assert.equal(result[0].note?.content, 'note');
});

test('adding a lineation reuses a note on the exact same range', () => {
  const noted = annotation({ lineation: undefined, note: { content: 'note', createdAt: 2, updatedAt: 2 } });
  const result = updateLineation([noted], range, { type: 'straight', colorIndex: 4 }, 10);
  assert.equal(result.length, 1);
  assert.equal(result[0].note?.content, 'note');
  assert.deepEqual(result[0].lineation, { type: 'straight', colorIndex: 4 });
});

test('only annotations with lineations are returned for a selected range', () => {
  assert.deepEqual(lineationsForRange([annotation(), annotation({ id: 'note', lineation: undefined })], range).map(a => a.id), ['a1']);
});
