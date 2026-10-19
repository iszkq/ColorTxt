import { createBook, type Book } from './core';

export const BIBLE_ID = 'builtin-bible-v1';

/** Only seed a missing book. Existing progress, annotations and text win on upgrades. */
export async function seedBuiltinBooks(books: Book[], save: (book: Book) => Promise<unknown>) {
  if (books.some(book => book.id === BIBLE_ID)) return;
  const data = (await import('../../resources/builtin/bible.json')).default;
  const book: Book = {
    ...createBook(data.fileName, data.content),
    id: BIBLE_ID, title: data.title, chapters: data.chapters, builtin: true, lastOpened: 0,
  };
  await save(book);
  books.push(book);
}
