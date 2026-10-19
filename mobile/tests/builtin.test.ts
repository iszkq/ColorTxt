import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { seedBuiltinBooks, BIBLE_ID } from '../src/builtin';
import type { Book } from '../src/core';

test('all clients use identical bundled text with complete volume/chapter navigation', async () => {
  const data = JSON.parse(await readFile(new URL('../../resources/builtin/bible.json', import.meta.url), 'utf8'));
  const desktopText = await readFile(new URL('../../resources/builtin/圣经.md', import.meta.url), 'utf8');
  assert.equal(desktopText, data.content);
  assert.equal(data.id, BIBLE_ID);
  assert.equal(data.source.verses, 31102);
  assert.equal(new Set(data.chapters.map((c: { book: string }) => c.book)).size, 66);
  assert.equal(data.chapters.length, 1189);
  const lines = data.content.split('\n');
  assert.equal(lines.filter((line: string) => /^\d+　/.test(line)).length, 31102);
  for (const chapter of data.chapters) assert.equal(lines[chapter.line - 1], `## 第${chapter.chapter}章`);
});

test('first launch seeds once and upgrades preserve progress, notes and bookmarks', async () => {
  const books: Book[] = [];
  let saves = 0;
  await seedBuiltinBooks(books, async () => { saves++; });
  assert.equal(books.length, 1);
  assert.equal(books[0].id, BIBLE_ID);
  books[0].line = 123;
  books[0].bookmarks = [123];
  books[0].annotations = [{ id: 'note', text: '摘录', startPhysicalLine: 123, endPhysicalLine: 123,
    startColumn: 1, endColumn: 3, createdAt: 1, updatedAt: 1,
    note: { content: '我的笔记', createdAt: 1, updatedAt: 1 } }];
  const snapshot = structuredClone(books);
  await seedBuiltinBooks(books, async () => { saves++; });
  assert.equal(saves, 1);
  assert.deepEqual(books, snapshot);
});

test('a failed first save can retry without retaining an unsaved book', async () => {
  const books: Book[] = [];
  await assert.rejects(seedBuiltinBooks(books, async () => { throw new Error('storage full'); }));
  assert.equal(books.length, 0);
  await seedBuiltinBooks(books, async () => {});
  assert.equal(books.length, 1);
});
