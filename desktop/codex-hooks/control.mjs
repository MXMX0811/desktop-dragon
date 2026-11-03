import {access, mkdir, writeFile, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {dataDirectory} from './store.mjs';

export async function isCaptureEnabled(directory = dataDirectory) {
  try { await access(join(directory, 'disabled')); return false; }
  catch (error) { if (error.code === 'ENOENT') return true; throw error; }
}

export async function setCaptureEnabled(directory, enabled) {
  const marker = join(directory, 'disabled');
  if (enabled) await rm(marker, {force:true});
  else {
    await mkdir(directory, {recursive:true, mode:0o700});
    await writeFile(marker, '', {mode:0o600});
  }
}
