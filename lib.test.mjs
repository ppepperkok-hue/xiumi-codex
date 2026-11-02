import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {validateId,assertRevision,replaceText,buildArticle,imageComponent,textComponent,summarize} from './lib.mjs';

test('Rejects invalid IDs and stale snapshots',()=>{
  assert.equal(validateId('123'),123);
  for(const id of ['',0,-1,'1/../../','NaN','999999999999999999']) assert.throws(()=>validateId(id));
  assertRevision({savedAt:12},{savedAt:12});
  assert.throws(()=>assertRevision({savedAt:12},{savedAt:13}),/CONFLICT/);
  assert.throws(()=>assertRevision({},{savedAt:13}),/CONFLICT/);
});
test('Text replacement preserves URLs, component IDs and input data',()=>{
  const original={title:'old',cubes:[{txt:{type:'text',text:'<p>old old</p>'},img:{type:'image',src:'https://example.org/old.png'},_comp:{tplId:'old'}}]};
  const result=replaceText(original,'old','new');
  assert.equal(result.replacements,3);
  assert.equal(result.data.cubes[0].img.src,original.cubes[0].img.src);
  assert.equal(result.data.cubes[0]._comp.tplId,'old');
  assert.equal(original.title,'old');
  assert.throws(()=>replaceText(original,'missing','new'),/not found/);
  assert.throws(()=>replaceText(original,'','new'));
  const html={txt:{type:'text',text:'<p style="color:old">old &amp; text</p>'}};
  assert.equal(replaceText(html,'old','<new>').data.txt.text,'<p style="color:old">&lt;new&gt; &amp; text</p>');
  assert.equal(replaceText(html,'&','and').data.txt.text,'<p style="color:old">old and text</p>');
});
test('Native components require uploaded URLs and escape plain text',()=>{
  assert.throws(()=>imageComponent('file:///photo.png'));
  assert.equal(textComponent('<script>x</script>').txt1.text,'<p>&lt;script&gt;x&lt;/script&gt;</p>');
});
test('Article builder preserves photos and greetings and detects missing assets',()=>{
  const content={photos:['photo.png'],greetings:['Greeting'],intro:['Intro','Body'],conclusion:['End'],credits:['图文：书院']};
  const assets=Object.fromEntries(['brand-header.png','activity-hero.png','photo.png','brand-footer.png'].map(n=>[n,{target_uri:'https://example.org/'+n}]));
  const stats=summarize(buildArticle(content,assets));
  assert.equal(stats.images,4);assert.equal(stats.remoteImages,4);
  assert.ok(stats.text.some(t=>t.includes('Greeting')));
  assert.throws(()=>buildArticle(content,{}),/Missing uploaded asset/);
  assert.throws(()=>buildArticle({...content,greetings:[]},assets));
});
test('CLI parser accepts arbitrary option string values and rejects missing values',()=>{
  const cli=fileURLToPath(new URL('./xiumi.mjs',import.meta.url));
  const parse=args=>spawnSync(process.execPath,[cli,'help','--cdp','http://127.0.0.1:9222',...args],{encoding:'utf8'});
  const leading=parse(['--from','--draft','--to','updated']);
  assert.equal(leading.status,0,leading.stderr);
  const empty=parse(['--from','old','--to','']);
  assert.equal(empty.status,0,empty.stderr);
  const missing=parse(['--from']);
  assert.equal(missing.status,1);
  assert.match(missing.stderr,/Expected --option value: --from/);
});
