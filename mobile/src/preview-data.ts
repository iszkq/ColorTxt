import { seedBuiltinBooks } from './builtin';
import { createBook, type Book, type Annotation } from './core';

/** Fresh in-memory examples; never merge preview notes into the user's library. */
export async function createPreviewBooks(): Promise<Book[]> {
  const books: Book[] = [];
  await seedBuiltinBooks(books, async () => {});
  const bible = books[0];
  const lines = bible.content.split('\n');
  const verse = lines.findIndex(line => /^1　/.test(line));
  const light = lines.findIndex(line => /^3　/.test(line));
  const now = Date.now();
  function annotation(index: number, content: string, colorIndex: number): Annotation {
    return { id: `preview-note-${index}`, startPhysicalLine: index + 1, endPhysicalLine: index + 1,
      startColumn: 1, endColumn: lines[index].length + 1, text: lines[index],
      lineation: { type: 'marker', colorIndex }, note: { content, createdAt: now, updatedAt: now }, createdAt: now, updatedAt: now };
  }
  bible.annotations = [annotation(verse, '从“起初”开始，再读一遍熟悉的文字。阅读时也给自己的思考留一点空白。', 2), annotation(light, '留意“光”在后文中的呼应。下次阅读时，可以把相同的词连起来看。', 0)];
  bible.keywords = [{ text: '光', color: 1 }, { text: '天地', color: 3 }];
  bible.bookmarks = [light + 1, bible.chapters[1].line];
  bible.lastOpened = now;
  const guide = createBook('彩读使用指南.txt', '第一章 把阅读留在身边\n欢迎来到彩读。\n“读到喜欢的句子，长按文字，就能留下自己的颜色。”\n你也可以写下想法，下次从这里继续。\n第二章 给文字一点颜色\n选择一种颜色，为在意的词语做标记。\n（阅读、思考、记录，都按自己的节奏。）\n第三章 带走你的笔记\n在本书笔记中导出 Markdown 或 JSON，保存自己的阅读记录。');
  guide.id = 'preview-guide'; guide.lastOpened = now - 60000; guide.line = 5;
  books.push(guide);
  return books;
}
