#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {validateId,assertRevision,replaceText,buildArticle,summarize,textComponent,resolveAssetFile} from './lib.mjs';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
async function loadChromium() {
  try {return (await import('playwright-core')).chromium;} catch(error) {
    if(error.code!=='ERR_MODULE_NOT_FOUND') throw error;
    const dependencyRoot=process.env.XIUMI_NODE_MODULES || path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
    try {return createRequire(path.join(dependencyRoot,'package.json'))('playwright-core').chromium;}
    catch {throw new Error('Missing playwright-core. Run npm ci or set XIUMI_NODE_MODULES.');}
  }
}
const [command='help',...argv]=process.argv.slice(2);
const options={};
for(let i=0;i<argv.length;i++) {
  if(!argv[i].startsWith('--') || !argv[i+1] || argv[i+1].startsWith('--')) throw new Error(`Expected --option value: ${argv[i]}`);
  options[argv[i].slice(2)]=argv[++i];
}
const endpoint=options.cdp || process.env.XIUMI_CDP || 'http://127.0.0.1:9222';
if(!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(endpoint)) throw new Error('Only a local CDP endpoint is allowed.');

async function writeJson(file,value) {
  const target=path.resolve(file);await fs.mkdir(path.dirname(target),{recursive:true});
  await fs.writeFile(target,JSON.stringify(value,null,2),'utf8');return target;
}
async function readJson(file) {return JSON.parse((await fs.readFile(path.resolve(file),'utf8')).replace(/^\uFEFF/,''));}
async function backup(snapshot) {return writeJson(path.join(ROOT,'backups',`${snapshot.showId}-${new Date().toISOString().replace(/[:.]/g,'-')}.json`),snapshot);}

async function connect() {
  let browser;
  const chromium=await loadChromium();
  try {browser=await chromium.connectOverCDP(endpoint);} catch {throw new Error('Cannot reach the controlled browser. Run bb-browser tab new https://xiumi.us/studio/v5 --json, then log in.');}
  const context=browser.contexts()[0];
  const pages=context.pages().filter(p=>p.url().startsWith('https://xiumi.us/studio/v5'));
  if(!pages.length) {await browser.close();throw new Error('Open https://xiumi.us/studio/v5 in the controlled browser first.');}
  const page=pages[0];
  try {await page.waitForFunction(()=>Boolean(window.angular?.element(document.body).injector()?.has('showsManager')),null,{timeout:15000});}
  catch(error) {await browser.close();throw error;}
  return {browser,page};
}

// Invoke only the documented-in-this-project ordinary editing services. Cookies
// remain in the browser; no storage, cookie, or credential export is performed.
async function rpc(page,operation,payload={}) {
  const result=await page.evaluate(async({operation,payload})=>{
    try {
      if(location.origin!=='https://xiumi.us') throw new Error('Unexpected origin.');
      const injector=window.angular.element(document.body).injector();
      const auth=injector.get('authManager');
      if(!auth.isUserReady()) await auth.loadUser();
      const manager=injector.get('showsManager');
      if(operation==='status') return {ok:true,value:{loggedIn:true,level:auth.authStatus().userInfo.level}};
      if(operation==='list') {
        const rows=await manager.shows('article',5,{search:payload.search||null},payload.limit||20,0,null);
        return {ok:true,value:rows.map(r=>({showId:r.show_id,title:r.title,savedAt:r.saved_at,type:r.type_text}))};
      }
      if(operation==='read') {
        const {showInfo,showData}=await manager.showInfoAndData(payload.showId);
        return {ok:true,value:{showId:showInfo.show_id,savedAt:showInfo.saved_at,title:showInfo.title,data:showData}};
      }
      if(operation==='create') {
        let data=payload.data;
        if(!data) {
          const generator=injector.get('showDataGenerator').paper;
          data=generator.initializedShow();const cube=generator.emptyCube();
          cube.pages.push(generator.emptyPage());data.cubes.push(cube);
          data.cubes[0].pages[0].layers[0].comps.items=payload.components||[];
          data.title=payload.title;data.desc=payload.desc||'';
          if(payload.cover) data.cover=payload.cover;
        }
        const info=await manager.create(data,'article');
        return {ok:true,value:{showId:info.show_id,title:info.title,savedAt:info.saved_at,url:`https://xiumi.us/studio/v5#/paper/for/${info.show_id}/cube/0`}};
      }
      if(operation==='update') {
        const info=await manager.show(payload.showId);
        if(payload.savedAt==null || String(info.saved_at)!==String(payload.savedAt)) throw new Error('CONFLICT: Remote draft changed.');
        const result=await manager.update(info,payload.data);
        return {ok:true,value:{showId:result.show_id||payload.showId,title:result.title,savedAt:result.saved_at}};
      }
      if(operation==='upload') {
        const result=await injector.get('imageAPI').uploadImageInBase64(payload.base64,payload.filename,null);
        const uri=result.target_uri?.startsWith('//')?'https:'+result.target_uri:result.target_uri;
        return {ok:true,value:{asset_id:result.asset_id,target_uri:uri,width:result.width,height:result.height,duplicated:result.duplicated||false}};
      }
      throw new Error('Unsupported operation.');
    } catch(error) {
      const message=error?.message||error?.error?.errmsg||error?.errmsg||'Xiumi operation failed. Check login and account permissions.';
      return {ok:false,error:String(message),status:error?.status};
    }
  },{operation,payload});
  if(!result.ok) throw new Error(result.error);
  return result.value;
}

async function upload(page,file) {
  const filename=path.basename(file),extension=path.extname(filename).toLowerCase();
  const mime={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp'}[extension];
  if(!mime) throw new Error('Supported uploads: PNG, JPEG, GIF, WebP.');
  const bytes=await fs.readFile(path.resolve(file));
  if(bytes.length>20*1024*1024) throw new Error('Local upload limit is 20 MiB per image.');
  return rpc(page,'upload',{base64:`data:${mime};base64,${bytes.toString('base64')}`,filename});
}

async function main() {
  if(command==='help') return {usage:'node xiumi.mjs <status|list|read|create|update|replace|upload|create-article> [--id ID] [--file JSON] [--out JSON] [--title TITLE] [--from TEXT --to TEXT] [--content JSON --assets DIR]',note:'Start BB Browser and log in to Xiumi. Draft editing only; no paid importer, publishing, deletion, or credential export.'};
  const {browser,page}=await connect();
  try {
    let result;
    if(command==='status') result=await rpc(page,'status');
    else if(command==='list') result=await rpc(page,'list',{search:options.search,limit:Number(options.limit)||20});
    else if(command==='read') {
      const snapshot=await rpc(page,'read',{showId:validateId(options.id)});
      if(options.out) {const file=await writeJson(options.out,snapshot);result={file,showId:snapshot.showId,savedAt:snapshot.savedAt,...summarize(snapshot.data)};delete result.text;}
      else result=snapshot;
    }
    else if(command==='create') result=await rpc(page,'create',{title:options.title||'Codex editing test',components:[textComponent('Codex draft editing verification.')]});
    else if(command==='update') {
      const snapshot=await readJson(options.file);validateId(snapshot.showId);
      const current=await rpc(page,'read',{showId:snapshot.showId});assertRevision(snapshot,current);
      const backupFile=await backup(current);
      result={...await rpc(page,'update',snapshot),backup:backupFile};
    }
    else if(command==='replace') {
      const current=await rpc(page,'read',{showId:validateId(options.id)});
      const edited=replaceText(current.data,options.from,options.to);
      const backupFile=await backup(current);
      result={...await rpc(page,'update',{...current,data:edited.data}),replacements:edited.replacements,backup:backupFile};
    }
    else if(command==='upload') result=await upload(page,options.file);
    else if(command==='create-article') {
      const content=await readJson(options.content);const assetDir=options.assets;
      const cacheFile=path.join(ROOT,'artifacts','uploaded-assets.json');
      let assets={};try {assets=await readJson(cacheFile);} catch(error) {if(error.code!=='ENOENT') throw error;}
      const filenames=['brand-header.png','activity-hero.png',...content.photos,'brand-footer.png','cover-wide.png'];
      const files=await Promise.all(filenames.map(filename=>resolveAssetFile(assetDir,filename)));
      for(let i=0;i<filenames.length;i++) {
        const filename=filenames[i];
        // Always use the current account's storage and current input bytes.
        assets[filename]=await upload(page,files[i]);
        await writeJson(cacheFile,assets);
        process.stderr.write(`Uploaded ${filename}\n`);
      }
      const components=buildArticle(content,assets);
      result=await rpc(page,'create',{title:options.title||content.title,desc:'与国旗同框，向祖国告白。中和书院“我与国旗合个影”主题活动入围作品展示。',components,cover:assets['cover-wide.png'].target_uri});
      const saved=await rpc(page,'read',{showId:result.showId});
      const stats=summarize(saved.data);
      if(stats.images!==content.photos.length+3 || stats.remoteImages!==stats.images) throw new Error(`Created draft ${result.showId}, but image verification failed. Inspect it before retrying.`);
      const snapshot=await writeJson(path.join(ROOT,'artifacts',`article-${result.showId}.json`),saved);
      result={...result,images:stats.images,textCells:stats.textCells,snapshot};
    }
    else throw new Error('Unknown command. Run node xiumi.mjs help.');
    if(options.out && command!=='read') await writeJson(options.out,result);
    return result;
  } finally {await browser.close();}
}

main().then(result=>console.log(JSON.stringify(result,null,2))).catch(error=>{console.error(JSON.stringify({error:error.message}));process.exitCode=1;});
