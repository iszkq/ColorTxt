import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../../resources/builtin/bible.json';
import { chapterVerses, passageLabel, verseRange } from '../src/bible';
import { validAnnotations } from '../src/core';
const lines = data.content.split('\n');

test('all 1189 chapter grids resolve the 31102 original verse lines, including Psalm 119', () => {
  const count = data.chapters.reduce((sum, chapter) => {
    const verses = chapterVerses(lines, data.chapters, chapter);
    assert.equal(verses[0].number, 1);
    assert.equal(new Set(verses.map(v => v.line)).size, verses.length);
    return sum + verses.length;
  }, 0);
  assert.equal(count, 31102);
  const psalm = data.chapters.find(c => c.book === '诗篇' && c.chapter === 119)!;
  assert.equal(chapterVerses(lines, data.chapters, psalm).length, 176);
});
test('verse ranges sort reversed taps and retain desktop-compatible original coordinates', () => {
  const chapter = data.chapters.find(c => c.book === '约翰福音' && c.chapter === 3)!;
  const verses = chapterVerses(lines, data.chapters, chapter);
  const range = verseRange(lines, verses[17].line, verses[15].line)!;
  assert.equal(passageLabel(lines, data.chapters, range), '约翰福音 3:16–18');
  assert.equal(validAnnotations([{...range, id:'test'}], lines).length, 1);
  assert.equal(range.text.split('\n').length, 3);
  assert.equal(verseRange(lines, chapter.line), null);
  assert.equal(verseRange(lines, -1), null);
});
test('excerpt references handle a single verse, partial text, and chapter boundaries', () => {
  const first = chapterVerses(lines, data.chapters, data.chapters[0]);
  const single = verseRange(lines, first[0].line)!;
  assert.equal(passageLabel(lines, data.chapters, single), '创世记 1:1');
  assert.equal(passageLabel(lines, data.chapters, {...single, startColumn:3}), '创世记 1:1');
  const second = chapterVerses(lines, data.chapters, data.chapters[1]);
  assert.equal(passageLabel(lines, data.chapters, verseRange(lines,first[30].line,second[0].line)!), '创世记 1:31–2:1');
});
