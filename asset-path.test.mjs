import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {resolveAssetFile} from './lib.mjs';

async function makeFixture() {
  const base=await fs.mkdtemp(path.join(os.tmpdir(),'xiumi-assets-'));
  const assets=path.join(base,'assets');
  await fs.mkdir(path.join(assets,'nested'),{recursive:true});
  await fs.writeFile(path.join(assets,'photo.png'),'inside');
  await fs.writeFile(path.join(assets,'nested','photo.png'),'nested');
  await fs.writeFile(path.join(base,'outside.png'),'outside');
  const sibling=path.join(base,'assets-evil');
  await fs.mkdir(sibling);
  await fs.writeFile(path.join(sibling,'photo.png'),'sibling');
  return {base,assets};
}

test('Asset resolver keeps relative files inside --assets and rejects escapes', async () => {
  const {base,assets}=await makeFixture();
  try {
    assert.equal(await resolveAssetFile(assets,'photo.png'),await fs.realpath(path.join(assets,'photo.png')));
    assert.equal(await resolveAssetFile(assets,'nested/photo.png'),await fs.realpath(path.join(assets,'nested','photo.png')));
    assert.equal(await resolveAssetFile(assets,'nested\\photo.png'),await fs.realpath(path.join(assets,'nested','photo.png')));

    for (const filename of ['../outside.png','..\\outside.png','../assets-evil/photo.png','..\\assets-evil\\photo.png']) {
      await assert.rejects(resolveAssetFile(assets,filename),/must stay within --assets/,filename);
    }

    for (const filename of [path.join(base,'outside.png'),'C:\\Windows\\win.ini','C:photo.png','/etc/passwd','\\\\server\\share\\photo.png']) {
      await assert.rejects(resolveAssetFile(assets,filename),/must be relative/,filename);
    }

    await assert.rejects(resolveAssetFile(assets,'missing.png'),/not found within --assets/);
    await assert.rejects(resolveAssetFile(assets,'nested'),/not a file/);
  } finally {
    await fs.rm(base,{recursive:true,force:true});
  }
});

test('Asset resolver rejects symlinks escaping --assets', async (t) => {
  const {base,assets}=await makeFixture();
  try {
    const link=path.join(assets,'escape.png');
    try { await fs.symlink(path.join(base,'outside.png'),link,'file'); }
    catch (error) {
      if (['EPERM','EACCES','ENOSYS'].includes(error.code)) return t.skip(`File symlinks unavailable: ${error.code}`);
      throw error;
    }
    await assert.rejects(resolveAssetFile(assets,'escape.png'),/must stay within --assets/);

    const insideLink=path.join(assets,'alias.png');
    await fs.symlink(path.join(assets,'photo.png'),insideLink,'file');
    assert.equal(await resolveAssetFile(assets,'alias.png'),await fs.realpath(path.join(assets,'photo.png')));
  } finally {
    await fs.rm(base,{recursive:true,force:true});
  }
});

test('Asset resolver rejects directory junctions escaping --assets', async (t) => {
  const {base,assets}=await makeFixture();
  try {
    // Junctions are reparse points, so they cover the symlink cases on Windows without Developer Mode or extra privileges.
    const escape=path.join(assets,'junction-escape');
    try { await fs.symlink(path.join(base,'assets-evil'),escape,'junction'); }
    catch (error) {
      if (['EPERM','EACCES','ENOSYS'].includes(error.code)) return t.skip(`Directory junctions unavailable: ${error.code}`);
      throw error;
    }
    await assert.rejects(resolveAssetFile(assets,'junction-escape/photo.png'),/must stay within --assets/);

    const insideAlias=path.join(assets,'junction-alias');
    await fs.symlink(path.join(assets,'nested'),insideAlias,'junction');
    assert.equal(await resolveAssetFile(assets,'junction-alias/photo.png'),await fs.realpath(path.join(assets,'nested','photo.png')));
  } finally {
    await fs.rm(base,{recursive:true,force:true});
  }
});
