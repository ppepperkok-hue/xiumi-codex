import crypto from 'node:crypto';

export function validateId(value) {
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0) throw new Error('Invalid show ID.');
  return Number(value);
}

export function assertRevision(snapshot, current) {
  if (snapshot.savedAt == null || current.savedAt == null || String(snapshot.savedAt) !== String(current.savedAt)) {
    throw new Error('CONFLICT: The remote draft changed. Read a fresh snapshot before editing.');
  }
}

export function replaceText(data, from, to) {
  if (!from || typeof from !== 'string' || typeof to !== 'string') throw new Error('Replacement requires nonempty source text and a string target.');
  let count = 0;
  const copy = structuredClone(data);
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      if ((key === 'text' && node.type === 'text') || ['title', 'desc'].includes(key)) {
        if (typeof value === 'string') {
          if (key === 'text') {
            const needle=escapeHtml(from),replacement=escapeHtml(to);
            node[key]=value.split(/(<[^>]*>)/g).map(part=>{
              if(part.startsWith('<')) return part;
              count+=part.split(needle).length-1;
              return part.split(needle).join(replacement);
            }).join('');
          } else {
            count += value.split(from).length - 1;
            node[key] = value.split(from).join(to);
          }
        }
      } else if (typeof value === 'object') visit(value);
    }
  }
  visit(copy);
  if (!count) throw new Error('Source text was not found. No change was saved.');
  return {data: copy, replacements: count};
}

export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function comp(tplId, style, constraint) {
  return {_comp: {tplId, _$uuid: crypto.randomUUID(), pose: {position:'static'}, style, constraint}};
}

export function textComponent(text, style = {}) {
  return {...comp('paper-cp:header/1-txt-normal', {marginLeft:'20px',marginRight:'20px',marginTop:'10px',marginBottom:'14px'}, {opMenu:{'text-merged':true},pose:{resize:'h'}}),
    txt1:{type:'text',text:`<p>${escapeHtml(text)}</p>`,style:{fontSize:'16px',lineHeight:'1.95',color:'#363d46',textAlign:'justify',...style}}};
}

export function imageComponent(src, style = {}) {
  if (!/^https:\/\//i.test(src)) throw new Error('Images must have an HTTPS storage URL. Upload local assets first.');
  return {...comp('paper-cp:image/img-autowidth', {marginTop:'0px',marginBottom:'10px',...style}, {opMenu:{'crop-image-merged':true},pose:{resize:'h'}}),
    img1:{type:'image',src,style:{width:'100%'}}};
}

export function buildArticle(content, assets) {
  if (content.photos?.length !== content.greetings?.length || !content.photos?.length) throw new Error('Each photo requires one greeting.');
  const image = (name, style) => {
    if (!assets[name]?.target_uri) throw new Error(`Missing uploaded asset: ${name}`);
    return imageComponent(assets[name].target_uri, style);
  };
  const components = [image('brand-header.png'), image('activity-hero.png')];
  components.push(textComponent(content.intro[0], {textAlign:'center',color:'#A73527',fontSize:'18px',fontWeight:'bold'}));
  components.push(...content.intro.slice(1).map(t=>textComponent(t)));
  components.push(textComponent('入围作品展示',{textAlign:'center',color:'#18487F',fontSize:'18px',fontWeight:'bold'}));
  for (let i=0;i<content.photos.length;i++) {
    components.push(textComponent(`${String(i+1).padStart(2,'0')} / 入围作品`,{color:'#A73527',fontSize:'22px',fontWeight:'bold'}));
    components.push(image(content.photos[i],{marginLeft:'20px',marginRight:'20px'}));
    components.push(textComponent('青春寄语',{color:'#A73527',fontSize:'13px',fontWeight:'bold'}));
    components.push(textComponent(content.greetings[i],{fontSize:'15px'}));
  }
  components.push(textComponent('— ◆ —',{textAlign:'center',color:'#DBB129'}));
  components.push(...content.conclusion.map(t=>textComponent(t)));
  components.push(...content.credits.map(t=>textComponent(t.replace('：',' | '),{textAlign:'center',fontSize:'13px',color:'#7b838c'})));
  components.push(image('brand-footer.png'));
  return components;
}

export function summarize(data) {
  const result = {textCells:0,images:0,remoteImages:0,text:[]};
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (value.type === 'text' && typeof value.text === 'string') {result.textCells++;result.text.push(value.text);}
    if (value.type === 'image' && value.src) {result.images++;if (/^https:\/\//.test(value.src)) result.remoteImages++;}
    for (const child of Object.values(value)) if (typeof child === 'object') visit(child);
  }
  visit(data);
  return result;
}
