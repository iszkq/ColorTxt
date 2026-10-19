import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import JSZip from 'jszip';
import { createBook, decodeText, validAnnotations, type Book } from './core';

export async function importBook(file: File): Promise<Book> {
  if (file.size > 25 * 1024 * 1024) throw new Error('首版支持 25 MB 以内的文件。');
  if (/\.(txt|md)$/i.test(file.name)) {
    const book = createBook(file.name, decodeText(await file.arrayBuffer()));
    if (!book.content.trim()) throw new Error('这个文件没有正文。'); return book;
  }
  if (!/\.ctz$/i.test(file.name)) throw new Error('请选择 TXT、Markdown 或未加密的 CTZ 书包。');
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) throw new Error('书包缺少 manifest.json。');
  const manifest = JSON.parse(await manifestFile.async('string'));
  if (manifest.kind !== 'readerBook' || manifest.schemaVersion !== 1 || typeof manifest.contentFileName !== 'string' || /[/\\]|\.\./.test(manifest.contentFileName) || !/\.(txt|md)$/i.test(manifest.contentFileName)) throw new Error('暂不支持这个版本的书包。');
  const entry = zip.file('content/' + manifest.contentFileName);
  if (!entry) throw new Error('书包缺少正文。');
  // Check ZIP metadata before decompression to avoid unexpectedly large imports.
  const expanded = Object.values(zip.files).reduce((n, f) => n + ((f as unknown as { _data?: { uncompressedSize: number } })._data?.uncompressedSize ?? 0), 0);
  if (expanded > 50 * 1024 * 1024) throw new Error('解压后超过 50 MB，请先在桌面端导出较小的文本。');
  const book = createBook(manifest.contentFileName, decodeText(await entry.async('arraybuffer')));
  const notes = zip.file('notes.json');
  if (notes) book.annotations = validAnnotations(JSON.parse(await notes.async('string')).annotations, book.content.split('\n'));
  book.line = Math.max(1, Math.min(book.content.split('\n').length, Number(manifest.viewportTopPhysicalLine) || 1));
  return book;
}
export async function exportText(name: string, text: string, mime = 'text/plain') {
  name = name.replace(/[\\/:*?"<>|]/g, '_');
  if (Capacitor.isNativePlatform()) {
    const result = await Filesystem.writeFile({ path: `exports/${name}`, data: text, directory: Directory.Cache, encoding: Encoding.UTF8, recursive: true });
    await Share.share({ title: name, files: [result.uri] });
  } else {
    const url = URL.createObjectURL(new Blob([text], { type: mime + ';charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
}
