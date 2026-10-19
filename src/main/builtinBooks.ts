import { app } from 'electron';
import { copyFile, mkdir, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';

/** Stable path keeps progress and annotations independent of upgrades. Never overwrite user edits. */
export async function ensureBuiltinBible(): Promise<{ name: string; path: string; size: number }> {
  const source = app.isPackaged
    ? path.join(process.resourcesPath, 'builtin', '圣经.md')
    : path.join(app.getAppPath(), 'resources', 'builtin', '圣经.md');
  const directory = path.join(app.getPath('userData'), 'BuiltinBooks');
  const destination = path.join(directory, '圣经.md');
  await mkdir(directory, { recursive: true });
  try { await copyFile(source, destination, constants.COPYFILE_EXCL); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
  return { name: '圣经.md', path: destination, size: (await stat(destination)).size };
}
