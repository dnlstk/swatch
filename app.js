
// ===================== DEV NOTES =====================
// Last updated: 2026-04-05
//
// KNOWN BUGS / IN PROGRESS:
//   - Trigger words UX for LoRAs with many tags - open design question
//   - LoRA in one collection max (currently can be in multiple - looks buggy)
//
// PLANNED / DISCUSSED BUT NOT BUILT:
//   - Drag LoRAs between collections (within same col works now)
//   - Electron + menubar app (Option C) - tabled until UI is polished
//   - App name brainstorm
//   - Settings tab (future pass)
//   - Per-category model scope (e.g. photo-only categories skipping Illus/Pony)
//
// RECENTLY FIXED/BUILT:
//   - FIXED: ctxToggleEnable was orphaned function body (syntax error)
//   - FIXED: cycleVerifiedFilter was orphaned function body (syntax error)
//   - FIXED: Drag to reorder within collections now works correctly
//   - FIXED: Duplicate handleLoraImgPick function removed
//   - FIXED: Context menu now closes when clicking card or anywhere outside
//   - FIXED: Context menu fav item shows star with amber color when favorited
//   - FIXED: Context menu enable item shows correct icon
//   - FIXED: White browser tooltip on card name hover (removed title attr)
//   - ADDED: Card/chip view toggle buttons in sticky toolbar
//   - UPDATED: Fav star is now bright gold #FFD700 with glow for visibility
// =====================================================

// ===================== BUILT-IN CATEGORIES =====================
const BUILTIN_CATS = [
  {id:'quality',label:'Quality & Rating',color:'#4ade80',
    tags:['masterpiece','best quality','newest','highres','4k','8k','16k','absurdres','HDR','ultra detailed','sharp detail','rating safe','rating sensitive','rating explicit'],
    pony:['masterpiece','best quality','newest','highres','4k','8k','16k','absurdres','HDR','ultra detailed','sharp detail','rating safe','rating sensitive','rating explicit']},
  {id:'physical',label:'Physical Descriptors',color:'#38bdf8',
    tags:['1boy','2boys','lean','athletic','muscular','buff','bodybuilder','broad shoulders','defined pecs','thick thighs','slim waist','pale skin','fair skin','tan skin','olive skin','brown skin','dark skin','ebony skin','young adult','20s','30s','mature','older man','short messy hair','buzzcut','long hair','stubble','beard','sharp jawline','handsome','nude','shirtless','clothed','partially undressed','underwear'],
    pony:['1boy','2boys','lean','athletic','muscular','buff','bodybuilder','broad shoulders','defined pecs','thick thighs','slim waist','pale skin','fair skin','tan skin','olive skin','brown skin','dark skin','ebony skin','young adult','20s','30s','mature','older man','short messy hair','buzzcut','long hair','stubble','beard','sharp jawline','handsome','nude','shirtless','clothed','partially undressed','underwear']},
  {id:'subject',label:'Subject / Action',color:'#a78bfa',tags:['solitary figure','two figures','close-up face','full body shot','silhouette','standing still','in motion','seated','floating','crouching','hands extended','back to viewer','partially obscured','emerging from shadow','dissolving into smoke'],pony:['solitary figure','close-up face','full body shot','1boy','solo','upper body','cowboy shot']},
  {id:'style',label:'Style / Type',color:'#818cf8',tags:['dark fantasy illustration','modern comic book art','graphic novel panel','underground comix','body horror aesthetic','surrealist painting','painterly brushwork','concept art','street photography','hyperrealistic photography','cinematic still from a film','fine art photography','high fashion editorial photography'],pony:['dark fantasy illustration','graphic novel style','concept art','detailed illustration','painterly','comic book art']},
  {id:'lighting',label:'Lighting',color:'#f59e0b',tags:['dramatic studio lighting','neon lit street at night','candlelight','golden hour sunlight','bioluminescent light','rim lighting','deep shadows','harsh overhead light','soft diffused light','moonlight','fire light','light from below','colored gel lighting','split lighting','chiaroscuro','volumetric fog','overcast light','dappled sunlight','twilight','window light','fluorescent light','screen glow','underwater caustics','backlighting','high key lighting','low key lighting','silhouette lighting','light painting','butterfly lighting','Rembrandt lighting']},
  {id:'camera',label:'Camera / Focus',color:'#34d399',tags:['sharp focus','shallow depth of field','motion blur','wide angle lens','extreme close up','low angle shot','birds eye view','dutch angle','anamorphic lens flare','double exposure','over-the-shoulder','worm\'s eye view','top-down','eye level','three-quarter view','bokeh','macro','tilt-shift']},
  {id:'mood',label:'Mood / Atmosphere',color:'#f472b6',tags:['oppressive atmosphere','existential dread','electric tension','sublime terror','quiet devastation','euphoric chaos','brooding intensity','otherworldly calm','barely contained violence','beautiful wrongness','sensual tension','raw visceral power','transcendent horror','melancholic beauty','profound loneliness']},
  {id:'color',label:'Color Palette',color:'#fb923c',tags:['deep jewel tones','desaturated with neon accents','monochromatic red','black and white with single color pop','rich crimson and deep violet','electric teal and black','burnt orange and shadow','ice blue and white','toxic green and black','gold and obsidian','acid colors','muted earth tones','high contrast black and white']},
  {id:'details',label:'Details / Texture',color:'#6366f1',tags:['intricate tattoos','flowing fabric','weathered skin','cracked surface','organic tendrils','geometric patterns','smoke and embers','dripping liquid','shattered glass','glowing runes','heavy chains','torn clothing','iridescent scales','circuit board veins','bone structure visible']},
  {id:'negative',label:'Negative (avoid)',color:'#f87171',neg:true,selectAll:true,tags:['blurry','low quality','jpeg artifacts','watermark','text','signature','deformed hands','extra limbs','bad anatomy','disfigured','cropped','out of frame','ugly','duplicate','error','worst quality','lowres','bad proportions','mutated','oversaturated']}
];
const CAT_COLORS=['#a78bfa','#818cf8','#f59e0b','#34d399','#f472b6','#fb923c','#94a3b8','#38bdf8','#4ade80','#e879f9'];

// ===================== STATE =====================
let model='illustrious';
let categories=[...BUILTIN_CATS];
let activeTags={};
let remixNegBase=null; // when set, buildNeg() returns this verbatim (from gallery remix)
let _img2imgSource=null; // { file, folder } when img2img mode active
let tagWeights={};
let parenWraps={};  // cid::tag → true when wrapped in bare ( ) for emphasis
let customTags={};
let editModes={};
let loraList=[];
let activeLoRAs={};
let loraFilter='all';
let verifiedFilter='all'; // 'all' | 'verified' | 'unverified'
let cleanedFilter='all'; // 'all' | 'cleaned' | 'uncleaned'
let loraView='card';
let loraCols=[];
let _activeColTab='__all';
let showAdult=false;
let loraPanelOpen=false;
let currentWPTag=null,currentWPCat=null;
let currentLPKey=null;
let lpTwEdited=false;
// Persistent data (loaded from server)
// loraData[filename] is the unified per-lora blob:
//   { strength, cfg, steps, sampler, checkpoint, prefix, suffix,
//     notes, triggers, overrides, name, image, status, favorite, adult }
let appData={loraData:{},checkpointNotes:{},history:[],presets:[]};

// ===================== LORA DATA HELPERS =====================
function getLora(key){
  return (appData.loraData&&appData.loraData[key])||{};
}
function setLora(key,patch){
  if(!appData.loraData)appData.loraData={};
  if(!appData.loraData[key])appData.loraData[key]={};
  Object.assign(appData.loraData[key],patch);
}

// One-time-per-LoRA migration: if a LoRA has no custom triggers field set AND
// CivitAI has exactly one trainedWord, populate triggers with "*<word>" so it
// auto-injects when the LoRA is enabled. Runs on every loadLoras() — idempotent
// because once we set the field, future runs see it as customized and skip.
// Catches both existing library and any newly installed LoRAs on next load.
function migrateSingleTriggerLoras(){
  let changed=0;
  loraList.forEach(l=>{
    const key=l.file_name;
    const d=getLora(key);
    if(d.triggers!=null&&d.triggers!=='')return; // user (or prior run) has touched this
    const tw=l.civitai&&l.civitai.trainedWords;
    if(!tw||tw.length!==1)return;
    const w=String(tw[0]||'').trim();
    if(!w)return;
    setLora(key,{triggers:'*'+w});
    changed++;
  });
  if(changed){
    saveAppData();
    console.log(`[migration] Auto-marked ${changed} single-trigger LoRA(s) as required.`);
  }
}
// One-time migration: fold the old top-level loraX maps into loraData[key].
// Runs every load but is idempotent — after the first run the legacy keys
// are gone and the loop does nothing.
function migrateLegacyLoraData(){
  if(!appData.loraData)appData.loraData={};
  const legacy={
    loraNotes:'notes', loraTriggers:'triggers', loraOverrides:'overrides',
    loraNames:'name', loraImages:'image', loraStatus:'status',
    loraFavorites:'favorite', loraAdult:'adult',
  };
  let dirty=false;
  for(const lk in legacy){
    const src=appData[lk];
    if(!src||typeof src!=='object')continue;
    const field=legacy[lk];
    for(const k in src){
      const v=src[k];
      if(v===undefined||v===null)continue;
      if(!appData.loraData[k])appData.loraData[k]={};
      if(appData.loraData[k][field]===undefined)appData.loraData[k][field]=v;
    }
    delete appData[lk];
    dirty=true;
  }
  // loraVerified is deprecated — derivable from status==='verified'
  if(appData.loraVerified){delete appData.loraVerified;dirty=true;}
  if(dirty)saveAppData();
}

// ===================== INIT =====================
async function init(){
  categories.forEach(c=>{activeTags[c.id]=new Set();customTags[c.id]=[];});
  await loadAppData();
  // Restore custom tags
  if(appData.customTags){
    Object.keys(appData.customTags).forEach(cid=>{
      customTags[cid]=appData.customTags[cid]||[];
    });
  }
  // Restore LoRA collections
  if(appData.loraCols)loraCols=[...appData.loraCols];
  // Restore gallery categories
  if(appData.galleryCats)galleryCats=[...appData.galleryCats];
  // Auto-select default negative tags
  initAutoNeg();
  // Restore tag accordion + seed lock UI state
  restoreTagAccordion();
  restoreSeedLock();
  restoreVideoSeedLock();
  const savedGenMode = localStorage.getItem('cpg-gen-mode');
  if (savedGenMode === 'video') switchGenMode('video');
  restoreRecentStripState();
  renderRecentStrip();
  startRecentPoll();
  connectComfyWS();
  updateSendMeta();
  migrateAutoTags();
  // Apply brut visibility setting
  applyBrutSetting();
  // Apply tab visibility
  applyTabVisibility();
  // Restore tag brut filter
  if(localStorage.getItem('cpg-tag-brut-show')!=='1'){
    document.body.classList.add('hide-tag-brut');
  }else{
    const tb=document.getElementById('tags-brut-btn');
    if(tb){tb.classList.add('adult-active');tb.classList.add('active');}
  }
  // Restore theme
  if(localStorage.getItem('cpg-theme')==='light'){
    document.body.classList.add('light');
    const btn=document.getElementById('theme-btn');
    if(btn)btn.classList.add('active');
  }
  renderTagSections();
  renderHistory();
  renderPresets();
  // Start on Generate tab (override via ?tab= for testing)
  const _urlTab = new URLSearchParams(window.location.search).get('tab');
  switchTab(_urlTab || 'tags');
  updateFooterH();
  // Restore layout preference
  const savedLayout=localStorage.getItem('cpg-layout');
  if(savedLayout)layoutOverride=savedLayout;
  checkLayout();
  // Watch for window resize to auto-switch layout
  const _ro=new ResizeObserver(()=>{if(!layoutOverride)checkLayout();updateFooterH();});
  _ro.observe(document.body);
  window.addEventListener('resize',updateFooterH);
  document.addEventListener('click',closePopups);
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      if(document.getElementById('compare-overlay')?.classList.contains('open')){closeCompareMode();return;}
      closeLightbox();closeLoraMetaPopover();
    }
    if(e.key==='ArrowLeft'||e.key==='ArrowRight')galleryNavigate(e);
  });
  renderColorPicks();
  // Set initial view toggle state
  document.getElementById('lview-card')?.classList.add('active');
  // Auto-load LoRAs on startup
  loadLoras();
  // Init embeddings
  initEmbeddings();
  renderEmbeddingChips();
  initMaleBias();
  // Init Send-to-ComfyUI panel
  initSendPanel();
  loadComfyCheckpoints();
  checkGalleryBacklog();
}

function updateFooterH(){
  // v5 redesign: footer is grid-column:3 — the grid controls its width entirely.
  // Never set f.style.width here or it fights the grid and shrinks the panel.
  const f=document.getElementById('footer');
  if(f)f.style.width='';
  document.documentElement.style.setProperty('--footer-h','0px');
}
// Inline prompt/confirm dialogs (replaces window.prompt/confirm blocked by Electron)
function showInlinePrompt(message,defaultVal,onConfirm){
  const existing=document.getElementById('inline-dialog');
  if(existing)existing.remove();
  const d=document.createElement('div');
  d.id='inline-dialog';
  d.tabIndex=-1;
  d.style.cssText='position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);outline:none;';
  d.innerHTML=`<div style="background:var(--surface);border:1px solid var(--border3);border-radius:10px;padding:20px;width:320px;box-shadow:0 16px 48px rgba(0,0,0,.6);display:flex;flex-direction:column;gap:12px;">
    <div style="font-size:13px;color:var(--text);font-family:var(--sans);">${message}</div>
    <input id="inline-dialog-input" style="background:var(--surface2);border:1px solid var(--border2);border-radius:6px;padding:7px 10px;color:var(--text);font-size:13px;font-family:var(--sans);outline:none;width:100%;box-sizing:border-box;" value="${(defaultVal||'').replace(/"/g,'&quot;')}">
    <div style="display:flex;gap:8px;justify-content:flex-end;">
      <button onclick="document.getElementById('inline-dialog').remove()" style="padding:6px 14px;background:transparent;border:1px solid var(--border2);border-radius:6px;color:var(--muted);font-size:12px;cursor:pointer;font-family:var(--sans);">Cancel</button>
      <button id="inline-dialog-ok" style="padding:6px 14px;background:var(--text);border:1px solid var(--text);border-radius:6px;color:var(--bg);font-size:12px;font-weight:500;cursor:pointer;font-family:var(--sans);">OK</button>
    </div>
  </div>`;
  document.body.appendChild(d);
  const input=document.getElementById('inline-dialog-input');
  input.focus();input.select();
  const confirm=()=>{const v=input.value;d.remove();onConfirm(v);};
  document.getElementById('inline-dialog-ok').onclick=confirm;
  input.onkeydown=e=>{if(e.key==='Enter')confirm();if(e.key==='Escape')d.remove();};
}
function showInlineConfirm(message,onConfirm,opts){
  const existing=document.getElementById('inline-dialog');
  if(existing)existing.remove();
  const okLabel=(opts&&opts.okLabel)||'Delete';
  const okColor=(opts&&opts.okColor)||'var(--red)';
  const cancelLabel=(opts&&opts.cancelLabel)||'Cancel';
  const onCancel=opts&&opts.onCancel;
  const d=document.createElement('div');
  d.id='inline-dialog';
  d.tabIndex=-1;
  d.style.cssText='position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);outline:none;';
  d.innerHTML=`<div style="background:var(--surface);border:1px solid var(--border3);border-radius:10px;padding:20px;width:320px;box-shadow:0 16px 48px rgba(0,0,0,.6);display:flex;flex-direction:column;gap:12px;">
    <div style="font-size:13px;color:var(--text);font-family:var(--sans);">${message}</div>
    <div style="display:flex;gap:8px;justify-content:flex-end;">
      <button id="inline-dialog-cancel" style="padding:6px 14px;background:transparent;border:1px solid var(--border2);border-radius:6px;color:var(--muted);font-size:12px;cursor:pointer;font-family:var(--sans);">${cancelLabel}</button>
      <button id="inline-dialog-ok" style="padding:6px 14px;background:${okColor};border:1px solid ${okColor};border-radius:6px;color:#fff;font-size:12px;font-weight:500;cursor:pointer;font-family:var(--sans);">${okLabel}</button>
    </div>
  </div>`;
  document.body.appendChild(d);
  document.getElementById('inline-dialog-ok').onclick=()=>{d.remove();onConfirm();};
  document.getElementById('inline-dialog-cancel').onclick=()=>{d.remove();if(onCancel)onCancel();};
  d.onkeydown=e=>{if(e.key==='Escape')d.remove();};
  d.focus();
}

function toggleSidebar(){
  const app=document.querySelector('.app');
  if(app.classList.contains('gallery-tab-active'))return;
  app.classList.toggle('sidebar-collapsed');
  const collapsed=app.classList.contains('sidebar-collapsed');
  localStorage.setItem('cpg-sidebar-collapsed',collapsed?'1':'0');
  document.querySelector('.sidebar-toggle').textContent=collapsed?'▶':'◀';
  updateFooterH();
}

// ===================== PERSISTENCE =====================
async function loadAppData(){
  try{
    const r=await fetch('/app-data');
    if(r.ok){const d=await r.json();if(d&&typeof d==='object')appData=Object.assign(appData,d);}
  }catch(e){}
  migrateLegacyLoraData();
}
let _saveTimer=null;
async function saveAppData(){
  if(_saveTimer)clearTimeout(_saveTimer);
  _saveTimer=setTimeout(async()=>{
    try{await fetch('/app-data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(appData)});}catch(e){}
  },300);
}

// ===================== MODEL =====================
function setModel(m){
  model=m;
  document.querySelectorAll('.mbtn,.cmbtn,.titlebar-btn[data-m]').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll(`[data-m="${m}"]`).forEach(b=>b.classList.add('active'));
  const mn=document.getElementById('model-notice');if(mn)mn.classList.toggle('visible',m!=='sdxl');
  renderTagSections();
  renderLoraGrid();
  renderLoraTab();
  renderCheckpoints();
  refreshSendCkpts();
  updateOutput();
}
function syncSearchAndRenderBrowse(){
  const sb=document.getElementById('lsearch-browse');
  const s=document.getElementById('lsearch');
  if(s&&sb)s.value=sb.value;
  renderLoraBrowse();
}
function setLoraFilterBrowse(f){
  loraFilter=f;
  document.getElementById('lbf-all')?.classList.toggle('active',f==='all');
  document.getElementById('lbf-fav')?.classList.toggle('active',f==='fav');
  document.getElementById('lf-all')?.classList.toggle('active',f==='all');
  document.getElementById('lf-fav')?.classList.toggle('active',f==='fav');
  renderLoraBrowse();
}
function renderLoraBrowse(){
  const gr=document.getElementById('lgrid-browse');
  const stb=document.getElementById('lrstatus-browse');
  if(!gr)return;
  // Sync status
  const st=document.getElementById('lrstatus');
  if(st&&stb)stb.textContent=st.textContent;
  if(!loraList.length){
    gr.innerHTML='<span style="font-size:11px;color:var(--muted);font-family:var(--mono);">Click ↺ Reload to scan LoRAs</span>';
    return;
  }
  const search=(document.getElementById('lsearch-browse')?.value||'').toLowerCase();
  const items=loraList.filter(l=>{
    const models=getLoraModels(l);
    if(!models.includes(model))return false;
    if(loraFilter==='fav'&&!l.favorite)return false;
    if(search&&!l.model_name.toLowerCase().includes(search)&&!(l.folder||'').toLowerCase().includes(search))return false;
    return true;
  });
  if(!items.length){gr.innerHTML='<span style="font-size:11px;color:var(--muted);font-family:var(--mono);">No LoRAs match</span>';return;}
  gr.innerHTML=items.map(l=>{
    const key=l.file_name;
    const isActive=!!activeLoRAs[key];
    const weight=activeLoRAs[key]?.weight||0.8;
    const folder=(l.folder||'').split('/').pop()||'';
    const type=getLoraType(l);
    return `<div class="lchip${isActive?' active':''}" id="lbc-${sl(key)}"
      onclick="toggleLoraBrowse('${key}','${eq(l.model_name)}',event)"
      oncontextmenu="openLpPopup('${key}',event)">
      <span class="lchip-name">${l.model_name}</span>
      ${folder?`<span class="lchip-folder">${folder}</span>`:''}
      ${type?`<span class="lchip-type">${type}</span>`:''}
      <input type="range" class="lchip-wslider" min="0.1" max="1.5" step="0.05" value="${weight}"
        onclick="event.stopPropagation()" oninput="updateLoraW('${key}',this.value,event)">
      <span class="lchip-wval" id="lbw-${sl(key)}">${parseFloat(weight).toFixed(2)}</span>
    </div>`;
  }).join('');
}
function toggleLoraBrowse(key,name,e){
  e&&e.stopPropagation();
  if(activeLoRAs[key])delete activeLoRAs[key];
  else activeLoRAs[key]={name,weight:0.8};
  // Update both grids
  const chip=document.getElementById('lc-'+sl(key));
  if(chip)chip.classList.toggle('active',!!activeLoRAs[key]);
  const chipB=document.getElementById('lbc-'+sl(key));
  if(chipB)chipB.classList.toggle('active',!!activeLoRAs[key]);
  refreshEnabledSection();
  updateOutput();updateLoraStats();
}

// ===================== NAV =====================
function renderNav(){
  const nav=document.getElementById('nav');
  const app=document.querySelector('.app');
  const isLoraTab=app?.classList.contains('lora-tab-active');
  const isGalleryTab=app?.classList.contains('gallery-tab-active');
  const labelEl=document.getElementById('sidebar-label');
  const addBtn=document.getElementById('sidebar-add-btn');
  const isUtilTab=!isLoraTab&&!isGalleryTab&&document.querySelector('.panel.active')?.id==='panel-settings';
  if(isUtilTab){
    if(labelEl)labelEl.style.display='none';
    if(addBtn)addBtn.style.display='none';
    nav.innerHTML='';
    return;
  }
  if(labelEl)labelEl.style.display='';
  if(isLoraTab){
    if(labelEl)labelEl.textContent='Collections';
    if(addBtn){addBtn.style.display='';addBtn.title='New collection';addBtn.onclick=showAddLoraCol;}
    renderLoraNav();
    return;
  }
  if(isGalleryTab){
    if(labelEl)labelEl.style.display='none';
    if(addBtn)addBtn.style.display='none';
    nav.innerHTML='';
    renderGalleryAlbumTabs();
    return;
  }
  if(labelEl)labelEl.textContent='Categories';
  if(addBtn){addBtn.style.display='';addBtn.title='New category';addBtn.onclick=showCatForm;}
  nav.innerHTML=categories.map(c=>{
    const n=activeTags[c.id]?activeTags[c.id].size:0;
    return `
    <div class="nitem" id="nav-${c.id}" onclick="scrollToCategory('${c.id}')"
      draggable="true"
      ondragstart="navDragStart(event,'${c.id}')"
      ondragover="navDragOver(event,'${c.id}')"
      ondragleave="navDragLeave(event)"
      ondrop="navDrop(event,'${c.id}')"
      ondragend="navDragEnd(event)">
      <span class="ndot" style="background:${c.color}"></span>
      <span>${c.label}</span>
      <span class="ncount" id="nc-${c.id}">${n}</span>
    </div>`;}).join('');
}

function isColBrut(colId){
  return !!(appData.loraColBrut&&appData.loraColBrut[colId]);
}
function toggleLoraColBrut(colId){
  if(!appData.loraColBrut)appData.loraColBrut={};
  appData.loraColBrut[colId]=!appData.loraColBrut[colId];
  if(!appData.loraColBrut[colId])delete appData.loraColBrut[colId];
  saveAppData();
  renderLoraNav();
  renderLoraTab();
}

function renderLoraNav(){
  const nav=document.getElementById('nav');
  const demoMode=document.body.classList.contains('hide-brut');
  const hideBrut=!showAdult||demoMode;
  const uncatCount=loraList.filter(l=>{
    if(!getLoraModels(l).includes(model))return false;
    return !loraCols.some(c=>c.keys.includes(l.file_name));
  }).length;
  const allCount=loraList.filter(l=>getLoraModels(l).includes(model)).length;
  let html='';
  // Collections
  loraCols.forEach((col,i)=>{
    const brutActive=isColBrut(col.id);
    if(hideBrut&&brutActive)return;
    const count=col.keys.filter(k=>loraList.find(l=>l.file_name===k&&getLoraModels(l).includes(model))).length;
    html+=`<div class="nitem" id="lcnav-${col.id}" onclick="scrollToLoraSection('${col.id}')"
      draggable="true"
      ondragstart="loraNavDragStart(event,'${col.id}')"
      ondragover="loraNavDragOver(event,'${col.id}')"
      ondragleave="navDragLeave(event)"
      ondrop="loraNavDrop(event,'${col.id}')"
      ondragend="navDragEnd(event)">
      <span class="ndot" style="background:var(--orange)"></span>
      <span style="font-size:13px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${col.label}</span>${brutActive&&!demoMode?`<button onclick="event.stopPropagation();toggleLoraColBrut('${col.id}')" title="Unmark Brut" class="ncol-btn ncol-brut-active" style="font-size:10px;">⍜</button>`:''}
      <span class="ncount">${count}</span>
      <span class="ncol-actions">
        ${brutActive||demoMode?'':`<button onclick="event.stopPropagation();toggleLoraColBrut('${col.id}')" title="Mark Brut" class="ncol-btn" style="font-size:10px;">⍜</button>`}
        <button onclick="event.stopPropagation();renameLoraCol('${col.id}')" title="Rename" class="ncol-btn">✎</button>
        <button onclick="event.stopPropagation();deleteLoraCol('${col.id}')" title="Delete" class="ncol-btn ncol-del">✕</button>
      </span>
    </div>`;
  });
  // Uncategorized
  if(uncatCount>0){
    html+=`<div class="nitem" onclick="scrollToLoraSection('__uncat')">
      <span class="ndot" style="background:var(--muted2)"></span>
      <span style="font-size:13px">Uncategorized</span>
      <span class="ncount">${uncatCount}</span>
    </div>`;
  }
  nav.innerHTML=html;
  renderLoraCollectionTabs();
}

function renderLoraCollectionTabs(){
  const el=document.getElementById('lora-collection-tabs');
  if(!el)return;
  const hideBrut=!showAdult||document.body.classList.contains('hide-brut');
  const allCount=loraList.filter(l=>getLoraModels(l).includes(model)).length;
  const enabledCount=Object.keys(activeLoRAs).filter(k=>loraList.find(l=>l.file_name===k)).length;
  const uncatCount=loraList.filter(l=>{
    if(!getLoraModels(l).includes(model))return false;
    return !loraCols.some(c=>c.keys.includes(l.file_name));
  }).length;
  const a=_activeColTab;
  let html=`<button class="lora-col-tab${a==='__all'?' active':''}" onclick="colTabClick('__all')"><span class="ndot" style="background:var(--muted2)"></span>All LoRAs <span class="ncount">${allCount}</span></button>`;
  html+=`<button class="lora-col-tab${a==='__enabled'?' active':''}" onclick="colTabClick('__enabled')"><span class="ndot" style="background:var(--green)"></span>Enabled <span class="ncount">${enabledCount}</span></button>`;
  loraCols.forEach(col=>{
    const brutActive=isColBrut(col.id);
    if(hideBrut&&brutActive)return;
    const count=col.keys.filter(k=>loraList.find(l=>l.file_name===k&&getLoraModels(l).includes(model))).length;
    const dot=brutActive?'#EF4444':'var(--orange)';
    html+=`<button class="lora-col-tab${a===col.id?' active':''}" draggable="true" data-colid="${col.id}" onclick="colTabClick('${col.id}')" oncontextmenu="colTabCtx('${col.id}',event)" ondragstart="colTabDragStart(event,'${col.id}')" ondragover="colTabDragOver(event)" ondrop="colTabDrop(event,'${col.id}')" ondragend="colTabDragEnd(event)"><span class="ndot" style="background:${dot}"></span>${col.label} <span class="ncount">${count}</span></button>`;
  });
  if(uncatCount>0){
    html+=`<button class="lora-col-tab${a==='__uncat'?' active':''}" onclick="colTabClick('__uncat')"><span class="ndot" style="background:var(--muted2)"></span>Uncategorized <span class="ncount">${uncatCount}</span></button>`;
  }
  html+=`<button class="lora-col-add" onclick="showAddLoraCol()">+ collection</button>`;
  el.innerHTML=html;
}
function colTabClick(id){
  _activeColTab=id;
  document.querySelectorAll('.lora-col-tab').forEach(t=>t.classList.remove('active'));
  document.querySelector('.lora-col-tab[onclick*="\''+id+'\'"]')?.classList.add('active');
  scrollToLoraSection(id);
}
function colTabCtx(colId,e){
  e.preventDefault();e.stopPropagation();
  closeColTabCtx();
  const menu=document.createElement('div');
  menu.id='col-tab-ctx';
  menu.className='col-tab-ctx';
  menu.innerHTML=`<button onclick="closeColTabCtx();renameLoraCol('${colId}')">✎ Rename</button><button onclick="closeColTabCtx();deleteLoraCol('${colId}')">✕ Delete</button>`;
  menu.style.left=e.clientX+'px';
  menu.style.top=e.clientY+'px';
  document.body.appendChild(menu);
  setTimeout(()=>document.addEventListener('click',closeColTabCtx,{once:true}),0);
}
function closeColTabCtx(){
  const m=document.getElementById('col-tab-ctx');
  if(m)m.remove();
}
let _colTabDragId=null;
function colTabDragStart(e,id){
  _colTabDragId=id;
  e.dataTransfer.effectAllowed='move';
  e.currentTarget.classList.add('dragging');
}
function colTabDragOver(e){
  e.preventDefault();
  e.dataTransfer.dropEffect='move';
  const tgt=e.currentTarget;
  if(!tgt||tgt.dataset.colid===_colTabDragId)return;
  // Show drop indicator
  document.querySelectorAll('.lora-col-tab.drag-over').forEach(el=>el.classList.remove('drag-over'));
  tgt.classList.add('drag-over');
}
function colTabDrop(e,targetId){
  e.preventDefault();
  document.querySelectorAll('.lora-col-tab.drag-over,.lora-col-tab.dragging').forEach(el=>{el.classList.remove('drag-over');el.classList.remove('dragging');});
  if(!_colTabDragId||_colTabDragId===targetId)return;
  const fi=loraCols.findIndex(c=>c.id===_colTabDragId);
  const ti=loraCols.findIndex(c=>c.id===targetId);
  if(fi===-1||ti===-1)return;
  const [moved]=loraCols.splice(fi,1);
  loraCols.splice(ti,0,moved);
  appData.loraCols=[...loraCols];
  saveAppData();
  renderLoraNav();
  renderLoraTab();
  _colTabDragId=null;
}
function colTabDragEnd(e){
  _colTabDragId=null;
  document.querySelectorAll('.lora-col-tab.drag-over,.lora-col-tab.dragging').forEach(el=>{el.classList.remove('drag-over');el.classList.remove('dragging');});
}

function scrollToCategory(id){
  const el=document.getElementById('sec-'+id);
  if(!el)return;
  const main=document.querySelector('.main');
  if(!main)return;
  const mainTop=main.getBoundingClientRect().top;
  const elTop=el.getBoundingClientRect().top;
  main.scrollTo({top:main.scrollTop+(elTop-mainTop)-12,behavior:'smooth'});
}

function scrollToLoraSection(id){
  const el=document.getElementById('lsec-'+id);
  if(!el)return;
  const container=document.getElementById('panel-loras')||document.querySelector('.main');
  if(!container)return;
  const containerTop=container.getBoundingClientRect().top;
  const elTop=el.getBoundingClientRect().top;
  container.scrollTo({top:container.scrollTop+(elTop-containerTop)-12,behavior:'smooth'});
}// LoRA collection nav drag
let _loraNavDragSrc=null;
function loraNavDragStart(e,id){_loraNavDragSrc=id;e.dataTransfer.effectAllowed='move';}
function loraNavDragOver(e,id){e.preventDefault();if(id===_loraNavDragSrc)return;document.querySelectorAll('.nitem.drag-over').forEach(el=>el.classList.remove('drag-over'));document.getElementById('lcnav-'+id)?.classList.add('drag-over');}
function loraNavDrop(e,id){
  e.preventDefault();
  document.querySelectorAll('.nitem.drag-over').forEach(el=>el.classList.remove('drag-over'));
  if(!_loraNavDragSrc||_loraNavDragSrc===id)return;
  const fi=loraCols.findIndex(c=>c.id===_loraNavDragSrc);
  const ti=loraCols.findIndex(c=>c.id===id);
  if(fi===-1||ti===-1)return;
  const [moved]=loraCols.splice(fi,1);
  loraCols.splice(ti,0,moved);
  appData.loraCols=[...loraCols];
  saveAppData();
  renderLoraNav();
  renderLoraTab();
  _loraNavDragSrc=null;
}

// Add LoRA collection
function showAddLoraCol(){
  showInlinePrompt('New collection name:','',name=>{
    if(!name||!name.trim())return;
    const id='lcol_'+Date.now();
    loraCols.push({id,label:name.trim(),keys:[]});
    appData.loraCols=[...loraCols];
    saveAppData();
    renderLoraNav();
    renderLoraTab();
  });
}
let _navDragSrc=null;
function navDragStart(e,cid){_navDragSrc=cid;e.dataTransfer.effectAllowed='move';}
function navDragEnd(e){document.querySelectorAll('.nitem.drag-over').forEach(el=>el.classList.remove('drag-over'));}
function navDragOver(e,cid){e.preventDefault();if(cid===_navDragSrc)return;document.querySelectorAll('.nitem.drag-over').forEach(el=>el.classList.remove('drag-over'));document.getElementById('nav-'+cid)?.classList.add('drag-over');}
function navDragLeave(e){e.currentTarget.classList.remove('drag-over');}
function navDrop(e,cid){
  e.preventDefault();
  document.querySelectorAll('.nitem.drag-over').forEach(el=>el.classList.remove('drag-over'));
  if(!_navDragSrc||_navDragSrc===cid)return;
  const fi=categories.findIndex(c=>c.id===_navDragSrc);
  const ti=categories.findIndex(c=>c.id===cid);
  if(fi===-1||ti===-1)return;
  const [moved]=categories.splice(fi,1);
  categories.splice(ti,0,moved);
  // Persist order
  if(!appData.catOrder)appData.catOrder=[];
  appData.catOrder=categories.map(c=>c.id);
  saveAppData();
  renderNav();renderTagSections();
  _navDragSrc=null;
}
function scrollTo(id){
  const el=document.getElementById('sec-'+id);
  if(!el)return;
  const main=document.querySelector('.main');
  if(!main)return;
  const mainTop=main.getBoundingClientRect().top;
  const elTop=el.getBoundingClientRect().top;
  main.scrollTo({top:main.scrollTop+(elTop-mainTop)-12,behavior:'smooth'});
}
// ===================== TAG SECTIONS =====================
function getCollapsedCats(){
  try{return JSON.parse(localStorage.getItem('cpg-collapsed-cats')||'{}');}catch(e){return{};}
}
function toggleCatCollapse(cid){
  const saved=getCollapsedCats();
  saved[cid]=!saved[cid];
  localStorage.setItem('cpg-collapsed-cats',JSON.stringify(saved));
  const grp=document.getElementById('sec-'+cid);
  if(grp)grp.classList.toggle('collapsed',!!saved[cid]);
}

function renderTagSections(){
  const con=document.getElementById('tag-sections');
  if(!con)return;
  con.innerHTML='';
  const collapsed=getCollapsedCats();
  categories.forEach((cat,i)=>{
    const base=(model!=='sdxl'&&cat.pony)?cat.pony:cat.tags;
    const deleted=(appData.deletedBuiltins&&appData.deletedBuiltins[cat.id])||[];
    let all=[...base.filter(t=>!deleted.includes(t)),...(customTags[cat.id]||[])];
    if(appData.tagOrder&&appData.tagOrder[cat.id]){
      const o=appData.tagOrder[cat.id];
      all=o.filter(t=>all.includes(t)).concat(all.filter(t=>!o.includes(t)));
    }
    const isEdit=editModes[cat.id];
    const isCollapsed=!!collapsed[cat.id];
    const activeCount=activeTags[cat.id]?activeTags[cat.id].size:0;
    const div=document.createElement('div');
    div.className='tgroup'+(isCollapsed?' collapsed':'');div.id='sec-'+cat.id;
    div.innerHTML=`
      <div class="theader">
        <span class="cat-group-chev" onclick="toggleCatCollapse('${cat.id}')">▾</span>
        <div class="ttitle" onclick="toggleCatCollapse('${cat.id}')"><span class="ttitle-dot" style="background:${cat.color}"></span>${cat.label}<span class="cat-active-badge" id="cat-badge-${cat.id}" style="background:${cat.color}22;color:${cat.color};${activeCount>0?'':'display:none;'}">${activeCount}</span></div>
        <div class="tactions" onclick="event.stopPropagation()">
          <div class="tbtn" onclick="if(!editModes['${cat.id}'])toggleEdit('${cat.id}');setTimeout(()=>{const i=document.getElementById('ai-${cat.id}');if(i)i.focus();},50)">+ tag</div>
          <div class="tbtn ${isEdit?'eactive':''}" onclick="toggleEdit('${cat.id}')">✎</div>
          <div class="tbtn" onclick="deleteCat('${cat.id}')" title="Delete category">—</div>
        </div>
      </div>
      <div class="tags tags-wrap" id="tags-${cat.id}">${all.map(t=>mkTag(cat.id,t)).join('')}</div>
      ${isEdit?`<div class="addrow"><input class="addinput" id="ai-${cat.id}" placeholder="add tag..." onkeydown="if(event.key==='Enter')addTag('${cat.id}');if(event.key==='Escape')toggleEdit('${cat.id}')"><button class="addbtn" onclick="addTag('${cat.id}')">+ Add</button></div>`:''}
    `;
    con.appendChild(div);
    if(editModes[cat.id])initDragOnContainer(cat.id);
  });
}

function isBuiltinTag(cid,tag){
  const cat=BUILTIN_CATS.find(c=>c.id===cid);
  if(!cat)return false;
  return (cat.tags||[]).includes(tag)||(cat.pony||[]).includes(tag);
}
function mkTag(cid,tag){
  const isEdit=editModes[cid];
  const isActive=activeTags[cid]&&activeTags[cid].has(tag);
  const builtin=isBuiltinTag(cid,tag);
  const w=tagWeights[cid+'::'+tag];
  const wb=(isActive&&w&&w!==1.0)?':'+parseFloat(w).toFixed(2):'';
  const ac=isActive?' active':'';
  const ec=isEdit?' emode':'';
  const bc=isEdit&&builtin?' builtin':'';
  const brutc=isTagBrut(cid,tag)?' tag-brut':'';
  const oc=isEdit?'':'toggleTag(\'' +cid+ '\',\'' +eq(tag)+ '\',event)';
  const ox=isEdit?'return false':'openWP(\'' +cid+ '\',\'' +eq(tag)+ '\',event)';
  const ds=isEdit?'<span class="dx" onclick="delTag(\'' +cid+ '\',\'' +eq(tag)+ '\',event)">&#x2715;</span>':'';
  const dataAttrs=isEdit?' data-cid="'+cid+'" data-tag="'+eq(tag)+'" draggable="true"':'';
  let style='';
  if(isActive){
    const cat=categories.find(c=>c.id===cid);
    if(cat&&cat.color){
      const c=cat.color;
      style=` style="border-color:${c};color:${c};background:${c}18;box-shadow:0 0 0 1px ${c}30;"`;
    }
  }
  const brutLabel=isTagBrut(cid,tag)?' <span class="brut-mark">⍜</span>':'';
  return '<div class="tag tag-chip'+ec+ac+bc+brutc+'" id="t-'+cid+'-'+sl(tag)+'"'+dataAttrs+' onclick="'+oc+'" oncontextmenu="'+ox+'"'+style+'>'+tag+'<span class="wb">'+wb+'</span>'+brutLabel+ds+'</div>';
}
function sl(s){return s.replace(/[^a-zA-Z0-9]/g,'_');}
function eq(s){return s.replace(/\\/g,'\\\\').replace(/'/g,"\\'");}
function formatDuration(s){return s<60?s+'s':Math.floor(s/60)+'m '+((s%60)+'s');}

// ===================== TAG TOGGLE =====================
// Tag clicks now write into the Subject (positive cats) or Extra neg (negative cats)
// textbox so the user has full control over ordering. The active-state on the chip
// stays as a visual indicator. Toggling off does a best-effort removal of the last
// occurrence of that tag string from the field.
function tagTargetField(cid){
  const cat=categories.find(c=>c.id===cid);
  return (cat&&cat.neg)?'extra-neg':'subject-input';
}
function appendTagToField(fieldId,tag){
  const el=document.getElementById(fieldId);
  if(!el)return;
  const cur=el.value;
  const trimmed=cur.replace(/[\s,]+$/,'');
  el.value=trimmed?`${trimmed}, ${tag}`:tag;
  el.dispatchEvent(new Event('input',{bubbles:true}));
}
function removeTagFromField(fieldId,tag){
  const el=document.getElementById(fieldId);
  if(!el)return false;
  const esc=tag.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  // Try wrapped forms first: (tag:X.XX) or bare (tag)
  const reW=new RegExp('(^|,)\\s*\\('+esc+'(?::\\d+(?:\\.\\d+)?)?\\)\\s*(?=,|$)','i');
  if(reW.test(el.value)){
    el.value=el.value.replace(reW,'$1').replace(/\s*,\s*,+/g,', ').replace(/^\s*,\s*|\s*,\s*$/g,'').trim();
    el.dispatchEvent(new Event('input',{bubbles:true}));
    return true;
  }
  // Plain form
  const re=new RegExp('(^|,)\\s*'+esc+'\\s*(?=,|$)','i');
  if(!re.test(el.value))return false;
  el.value=el.value.replace(re,'$1').replace(/\s*,\s*,+/g,', ').replace(/^\s*,\s*|\s*,\s*$/g,'').trim();
  el.dispatchEvent(new Event('input',{bubbles:true}));
  return true;
}
function toggleTag(cid,tag,e){
  e&&e.stopPropagation();
  if(editModes[cid])return;
  if(!activeTags[cid])activeTags[cid]=new Set();
  const target=tagTargetField(cid);
  if(activeTags[cid].has(tag)){
    // Shift+click on active tag: toggle ( ) paren emphasis instead of deactivating
    if(e&&e.shiftKey){toggleParen(cid,tag);return;}
    activeTags[cid].delete(tag);
    delete tagWeights[`${cid}::${tag}`];
    delete parenWraps[`${cid}::${tag}`];
    removeTagFromField(target,tag);
  }else{
    activeTags[cid].add(tag);
    appendTagToField(target,tag);
  }
  refreshTag(cid,tag);updateOutput();updateNav();
}
function refreshTag(cid,tag){
  const el=document.getElementById(`t-${cid}-${sl(tag)}`);
  if(!el)return;
  const act=activeTags[cid]&&activeTags[cid].has(tag);
  el.classList.toggle('active',act);
  const cat=categories.find(c=>c.id===cid);
  const c=cat&&cat.color;
  if(act&&c){
    el.style.borderColor=c;el.style.color=c;
    el.style.background=c+'18';el.style.boxShadow='0 0 0 1px '+c+'30';
  }else{
    el.style.borderColor='';el.style.color='';
    el.style.background='';el.style.boxShadow='';
  }
  const isParen=act&&!!parenWraps[`${cid}::${tag}`];
  el.classList.toggle('paren-wrapped',isParen);
  const wb=el.querySelector('.wb');
  if(wb){
    const w=tagWeights[`${cid}::${tag}`];
    wb.textContent=act&&!isParen&&w&&w!==1.0?`:${parseFloat(w).toFixed(2)}`:'';
  }
  updateCatBadge(cid);
}
function updateCatBadge(cid){
  const badge=document.getElementById('cat-badge-'+cid);
  if(!badge)return;
  const count=activeTags[cid]?activeTags[cid].size:0;
  badge.textContent=count;
  badge.style.display=count>0?'':'none';
}
function toggleParen(cid,tag){
  const key=`${cid}::${tag}`;
  const fieldId=tagTargetField(cid);
  const el=document.getElementById(fieldId);
  const esc=tag.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  if(parenWraps[key]){
    // Remove paren wrap → plain tag
    delete parenWraps[key];
    if(el){
      const re=new RegExp('\\('+esc+'\\)','i');
      if(re.test(el.value))el.value=el.value.replace(re,tag);
      el.dispatchEvent(new Event('input',{bubbles:true}));
    }
  }else{
    // Add paren wrap; remove any explicit weight first
    parenWraps[key]=true;
    delete tagWeights[key];
    if(el){
      // Replace weighted (tag:X.XX) or plain tag → (tag)
      const rwt=new RegExp('\\('+esc+':\\d+(?:\\.\\d+)?\\)','i');
      const rpl=new RegExp('(^|,)(\\s*)'+esc+'(\\s*)(?=,|$)','i');
      if(rwt.test(el.value)){
        el.value=el.value.replace(rwt,`(${tag})`);
      }else{
        el.value=el.value.replace(rpl,(m,pre,sp1,sp2)=>pre+sp1+`(${tag})`+sp2);
      }
      el.dispatchEvent(new Event('input',{bubbles:true}));
    }
  }
  // Sync the popup button state if open
  const popupBtn=document.getElementById('wp-paren-btn');
  if(popupBtn)popupBtn.classList.toggle('paren-active',!!parenWraps[key]);
  refreshTag(cid,tag);updateOutput();
}

function isTagBrut(cid,tag){return!!(appData.brutTags&&appData.brutTags[cid+'::'+tag]);}

function toggleTagBrut(cid,tag){
  if(!appData.brutTags)appData.brutTags={};
  const key=cid+'::'+tag;
  if(appData.brutTags[key])delete appData.brutTags[key];
  else appData.brutTags[key]=true;
  saveAppData();
  renderTagSections();
}

function toggleTagBrutFilter(){
  const isHidden=document.body.classList.contains('hide-tag-brut');
  document.body.classList.toggle('hide-tag-brut',!isHidden);
  document.querySelectorAll('#tags-brut-btn').forEach(b=>{
    b.classList.toggle('adult-active',isHidden);
    b.classList.toggle('active',isHidden);
  });
  localStorage.setItem('cpg-tag-brut-show',isHidden?'1':'0');
}

function clearSec(cid){
  const target=tagTargetField(cid);
  if(activeTags[cid]){
    activeTags[cid].forEach(t=>{
      delete tagWeights[`${cid}::${t}`];
      delete parenWraps[`${cid}::${t}`];
      removeTagFromField(target,t);
    });
  }
  activeTags[cid]=new Set();
  renderTagSections();updateOutput();updateNav();
}
function selectAllSec(cid){
  const cat=categories.find(c=>c.id===cid);
  if(!cat)return;
  const base=(model!=='sdxl'&&cat.pony)?cat.pony:cat.tags;
  const deleted=(appData.deletedBuiltins&&appData.deletedBuiltins[cid])||[];
  const all=[...base.filter(t=>!deleted.includes(t)),...(customTags[cid]||[])];
  if(!activeTags[cid])activeTags[cid]=new Set();
  const target=tagTargetField(cid);
  all.forEach(t=>{
    if(!activeTags[cid].has(t)){
      activeTags[cid].add(t);
      appendTagToField(target,t);
    }
  });
  renderTagSections();updateOutput();updateNav();
}
function toggleEdit(cid){editModes[cid]=!editModes[cid];renderTagSections();}
function addTag(cid){
  const el=document.getElementById('ai-'+cid);
  if(!el)return;const v=el.value.trim();if(!v)return;
  if(!customTags[cid])customTags[cid]=[];
  if(!customTags[cid].includes(v)){
    customTags[cid].push(v);
    if(!appData.customTags)appData.customTags={};
    appData.customTags[cid]=customTags[cid];
    saveAppData();
  }
  el.value='';renderTagSections();
}
function delTag(cid,tag,e){
  e&&e.stopPropagation();
  if(customTags[cid]){
    customTags[cid]=customTags[cid].filter(t=>t!==tag);
    if(!appData.customTags)appData.customTags={};
    appData.customTags[cid]=customTags[cid];
  }
  if(activeTags[cid])activeTags[cid].delete(tag);
  delete tagWeights[`${cid}::${tag}`];
  if(isBuiltinTag(cid,tag)){
    if(!appData.deletedBuiltins)appData.deletedBuiltins={};
    if(!appData.deletedBuiltins[cid])appData.deletedBuiltins[cid]=[];
    if(!appData.deletedBuiltins[cid].includes(tag))appData.deletedBuiltins[cid].push(tag);
    saveAppData();
  }
  renderTagSections();updateOutput();updateNav();
}

// ===================== ADD CATEGORY =====================
function renderColorPicks(){
  const con=document.getElementById('color-picks');
  con.innerHTML=CAT_COLORS.map((c,i)=>`<div class="cpick${i===0?' sel':''}" style="background:${c}" onclick="selectColor(this,'${c}')"></div>`).join('');
}
let selectedColor=CAT_COLORS[0];
function selectColor(el,c){selectedColor=c;document.querySelectorAll('.cpick').forEach(e=>e.classList.remove('sel'));el.classList.add('sel');}
function showCatForm(){document.getElementById('cat-form').classList.add('visible');document.getElementById('cat-name-input').focus();}
function hideCatForm(){document.getElementById('cat-form').classList.remove('visible');document.getElementById('cat-name-input').value='';}
function createCategory(){
  const name=document.getElementById('cat-name-input').value.trim();
  if(!name)return;
  const id='custom_'+Date.now();
  const cat={id,label:name,color:selectedColor,tags:[],custom:true};
  categories.push(cat);activeTags[id]=new Set();customTags[id]=[];
  hideCatForm();renderNav();renderTagSections();
}
function deleteCat(cid){
  categories=categories.filter(c=>c.id!==cid);
  delete activeTags[cid];delete customTags[cid];delete editModes[cid];
  renderNav();renderTagSections();updateOutput();updateNav();
}

// ===================== WEIGHT POPUP =====================
function openWP(cid,tag,e){
  e.preventDefault();e.stopPropagation();
  const popup=document.getElementById('wpopup');
  if(popup.classList.contains('visible')&&currentWPTag===tag&&currentWPCat===cid){popup.classList.remove('visible');return;}
  if(!activeTags[cid])activeTags[cid]=new Set();
  currentWPTag=tag;currentWPCat=cid;
  const cur=tagWeights[`${cid}::${tag}`]||1.0;
  document.getElementById('wpslider').value=cur;
  document.getElementById('wpval').textContent=parseFloat(cur).toFixed(2);
  document.getElementById('wpname').textContent=tag.length>18?tag.slice(0,16)+'...':tag;
  const popupBtn=document.getElementById('wp-paren-btn');
  if(popupBtn)popupBtn.classList.toggle('paren-active',!!parenWraps[`${cid}::${tag}`]);
  const brutBtn=document.getElementById('wp-brut-btn');
  if(brutBtn)brutBtn.classList.toggle('brut-active',isTagBrut(cid,tag));
  // Always clear example section first to prevent flash from previous tag
  const exSec=document.getElementById('wp-ex-section');
  document.getElementById('wp-ex-img-wrap').innerHTML='';
  document.getElementById('wp-ex-desc').textContent='';
  exSec.style.display='none';
  // Inject example if available (custom descriptions override built-ins)
  const customDesc=(appData.tagDescriptions||{})[tag];
  const exData=customDesc?{desc:customDesc}:(typeof TAG_EXAMPLES!=='undefined'&&TAG_EXAMPLES[tag]);
  if(exData){
    exSec.style.display='block';
    document.getElementById('wp-ex-desc').textContent=exData.desc||'';
    const q=encodeURIComponent(tag+' photography example');
    document.getElementById('wp-ex-more').href='https://www.pinterest.com/search/pins/?q='+q;
    const imgWrap=document.getElementById('wp-ex-img-wrap');
    const localSrc='/tag-images/'+tag.replace(/ /g,'_')+'.jpg';
    const img=new Image();
    img.onload=()=>{imgWrap.innerHTML='<img class="wp-ex-img" src="'+localSrc+'">';repositionWP();};
    img.onerror=()=>{if(exData.img){imgWrap.innerHTML='<img class="wp-ex-img" src="'+exData.img+'" onerror="this.parentElement.innerHTML=\'\'">';}};
    img.src=localSrc;
  }
  // Show edit description button (always visible — allows adding descriptions to any tag)
  const editDescBtn=document.getElementById('wp-ex-edit');
  if(editDescBtn){
    editDescBtn.onclick=()=>editTagDescription(tag);
    if(!exData){exSec.style.display='block';}
  }
  // Dock to right edge of left panel, aligned with its top/bottom
  popup.classList.add('visible');
  const footer=document.querySelector('.footer');
  if(footer){
    const r=footer.getBoundingClientRect();
    popup.style.left=(r.right+6)+'px';
    popup.style.top=r.top+'px';
    popup.style.bottom=(window.innerHeight-r.bottom)+'px';
  }else{
    popup.style.left='390px';popup.style.top='100px';popup.style.bottom='10px';
  }
  // Escape to close
  popup.onkeydown=ev=>{if(ev.key==='Escape')popup.classList.remove('visible');};
  popup.tabIndex=-1;popup.focus();
}
function editTagDescription(tag){
  const popup=document.getElementById('wpopup');
  popup.classList.remove('visible');
  const current=(appData.tagDescriptions||{})[tag]||(TAG_EXAMPLES[tag]||{}).desc||'';
  const existing=document.getElementById('inline-dialog');
  if(existing)existing.remove();
  const d=document.createElement('div');
  d.id='inline-dialog';d.tabIndex=-1;
  d.style.cssText='position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);outline:none;';
  d.innerHTML=`<div style="background:var(--surface);border:1px solid var(--border3);border-radius:10px;padding:20px;width:380px;box-shadow:0 16px 48px rgba(0,0,0,.6);display:flex;flex-direction:column;gap:12px;">
    <div style="font-size:13px;color:var(--text);font-family:var(--sans);">Description for "${tag}":</div>
    <textarea id="inline-dialog-input" style="background:var(--surface2);border:1px solid var(--border2);border-radius:6px;padding:7px 10px;color:var(--text);font-size:13px;font-family:var(--sans);outline:none;width:100%;box-sizing:border-box;min-height:80px;resize:vertical;line-height:1.5;">${current.replace(/</g,'&lt;')}</textarea>
    <div style="display:flex;gap:8px;justify-content:flex-end;">
      <button onclick="document.getElementById('inline-dialog').remove()" style="padding:6px 14px;background:transparent;border:1px solid var(--border2);border-radius:6px;color:var(--muted);font-size:12px;cursor:pointer;font-family:var(--sans);">Cancel</button>
      <button id="inline-dialog-ok" style="padding:6px 14px;background:var(--text);border:1px solid var(--text);border-radius:6px;color:var(--bg);font-size:12px;font-weight:500;cursor:pointer;font-family:var(--sans);">OK</button>
    </div>
  </div>`;
  document.body.appendChild(d);
  const input=document.getElementById('inline-dialog-input');
  input.focus();
  const confirm=()=>{const v=input.value;d.remove();if(!appData.tagDescriptions)appData.tagDescriptions={};if(v.trim()){appData.tagDescriptions[tag]=v.trim();}else{delete appData.tagDescriptions[tag];}saveAppData();};
  document.getElementById('inline-dialog-ok').onclick=confirm;
  d.onkeydown=e=>{if(e.key==='Escape')d.remove();};
}
function repositionWP(){
  const popup=document.getElementById('wpopup');
  if(!popup||!popup.classList.contains('visible'))return;
  const margin=12;const ph=popup.offsetHeight;
  const maxTop=window.innerHeight-ph-margin;
  popup.style.top=Math.max(margin,Math.min(parseInt(popup.style.top)||0,maxTop))+'px';
}
async function uploadTagImage(input){
  const file=input.files[0];
  if(!file||!currentWPTag)return;
  const fd=new FormData();
  fd.append('file',file,file.name);
  fd.append('key',currentWPTag);
  try{
    const r=await fetch('/tag-images/upload',{method:'POST',body:fd});
    const d=await r.json();
    if(d.ok){
      const imgWrap=document.getElementById('wp-ex-img-wrap');
      imgWrap.innerHTML='<img class="wp-ex-img" src="'+d.url+'?t='+Date.now()+'">';
      showToast('Image saved for "'+currentWPTag+'"');
    }else{showToast(d.error||'Upload failed','err');}
  }catch(e){showToast('Upload failed','err');}
  input.value='';
}
function applyWeight(){
  if(!currentWPTag)return;
  const w=parseFloat(document.getElementById('wpslider').value);
  tagWeights[`${currentWPCat}::${currentWPTag}`]=w;
  delete parenWraps[`${currentWPCat}::${currentWPTag}`];  // explicit weight wins over bare paren
  // Update the textarea text so the weight appears in the prompt immediately
  const fieldId=tagTargetField(currentWPCat);
  const el=document.getElementById(fieldId);
  if(el&&el.value){
    const tag=currentWPTag;
    const esc=tag.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const fmt=w===1.0?tag:`(${tag}:${parseFloat(w).toFixed(2)})`;
    // Try replacing any wrapped form: (tag:X.XX) or bare (tag)
    const rwt=new RegExp('\\('+esc+'(?::\\d+(?:\\.\\d+)?)?\\)','i');
    if(rwt.test(el.value)){
      el.value=el.value.replace(rwt,fmt);
    } else {
      // Replace plain tag in comma-delimited list
      const rpl=new RegExp('(^|,)(\\s*)'+esc+'(\\s*)(?=,|$)','i');
      el.value=el.value.replace(rpl,(m,pre,sp1,sp2)=>pre+sp1+fmt+sp2);
    }
    el.dispatchEvent(new Event('input',{bubbles:true}));
  }
  refreshTag(currentWPCat,currentWPTag);updateOutput();
  document.getElementById('wpopup').classList.remove('visible');
}
function removeTagWP(){
  if(!currentWPTag)return;
  if(activeTags[currentWPCat])activeTags[currentWPCat].delete(currentWPTag);
  delete tagWeights[`${currentWPCat}::${currentWPTag}`];
  removeTagFromField(tagTargetField(currentWPCat),currentWPTag);
  refreshTag(currentWPCat,currentWPTag);updateOutput();updateNav();
  document.getElementById('wpopup').classList.remove('visible');
}

// ===================== LORA PANEL =====================
function toggleLoraPanel(){switchTab('loras');}
function setLoraFilter(f){
  loraFilter=f;
  document.getElementById('lf-all').classList.toggle('active',f==='all');
  document.getElementById('lf-fav').classList.toggle('active',f==='fav');
  renderLoraGrid();
}

async function loadLoras(){
  const st=document.getElementById('lrstatus');
  const gr=document.getElementById('lgrid');
  st.textContent='Loading...';st.className='lrstatus';
  gr.innerHTML='<span style="font-size:11px;color:var(--muted);font-family:var(--mono);">Fetching...</span>';
  try{
    await fetch('/local/refresh').catch(()=>{});
    const r=await fetch('/local/loras/list');
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    const d=await r.json();
    loraList=d.items||[];
    // Restore favorites + display names from unified loraData blob
    loraList.forEach(l=>{
      const d=getLora(l.file_name);
      if(d.favorite!==undefined)l.favorite=d.favorite;
      if(d.name)l.model_name=d.name;
    });
    migrateSingleTriggerLoras();
    st.textContent=`${loraList.length} loaded`;
    document.getElementById('lora-conn').textContent='●';
    document.getElementById('lora-conn').style.color='var(--green)';
    const stt=document.getElementById('lrstatus-tab');
    if(stt)stt.textContent=`${loraList.length} loaded`;
    renderLoraGrid();
    renderLoraTab();
    renderCheckpoints();
    fetchMissingLoraMetadata();
  }catch(err){
    st.textContent='Cannot connect';st.className='lrstatus err';
    document.getElementById('lora-conn').textContent='●';
    document.getElementById('lora-conn').style.color='var(--red)';
    gr.innerHTML=`<span style="font-size:11px;color:var(--red);font-family:var(--mono);">Error: ${err.message}</span>`;
  }
}

async function fetchMissingLoraMetadata(){
  const missing=loraList.filter(l=>!l.civitai&&!l.sha256);
  if(!missing.length)return;
  let fetched=0;
  for(const lora of missing){
    try{
      const r=await fetch('/local/loras/fetch-metadata',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({file_name:lora.file_name}),
      });
      const j=await r.json();
      if(j.ok&&j.found){
        fetched++;
        if(j.model_name)lora.model_name=j.model_name;
        if(j.base_model)lora.base_model=j.base_model;
      }
    }catch{}
  }
  if(fetched>0){
    showToast('Metadata fetched',`Found CivitAI data for ${fetched} LoRA${fetched>1?'s':''}`,'ok');
    await fetch('/local/refresh').catch(()=>{});
    const r=await fetch('/local/loras/list');
    if(r.ok){const d=await r.json();loraList=d.items||[];loraList.forEach(l=>{const d=getLora(l.file_name);if(d.favorite!==undefined)l.favorite=d.favorite;if(d.name)l.model_name=d.name;});}
    renderLoraGrid();
    renderLoraTab();
  }
}

function getLoraModels(lora){
  const key=lora.file_name;
  const override=getLora(key).overrides;
  if(override&&override.length)return override;
  const bm=(lora.base_model||'').toLowerCase();
  if(bm.includes('pony'))return['pony'];
  if(bm.includes('sdxl')||bm.includes('sdxl 1.0'))return['sdxl'];
  if(bm.includes('illustrious'))return['illustrious','pony'];
  return['sdxl','pony','illustrious'];
}

function getLoraStatus(key){
  return getLora(key).status||null;
}
function getStatusClass(key){
  const status=getLoraStatus(key);
  return status?'status-'+status:'';
}
function updateStatusBadge(key){
  const card=document.getElementById('lcard-'+sl(key));
  if(!card)return;
  card.classList.remove('status-verified','status-testing','status-bad');
  const cls=getStatusClass(key);
  if(cls)card.classList.add(cls);
}
function hasPromptData(key){
  const d=getLora(key);
  return !!(d.prefix||d.suffix||d.cfg||d.steps||d.sampler||d.checkpoint);
}
function updatePromptBadge(key){
  const card=document.getElementById('lcard-'+sl(key));
  if(!card)return;
  const existing=card.querySelector('.lora-card-prompt-badge');
  if(hasPromptData(key)){
    if(!existing){
      const nameRow=card.querySelector('.lora-card-name-row');
      if(nameRow)nameRow.insertAdjacentHTML('beforeend','<span class="lora-card-prompt-badge">P</span>');
    }
  }else{
    if(existing)existing.remove();
  }
}
function getLoraType(lora){
  const tags=lora.tags||[];
  const civitaiTags=(lora.civitai&&lora.civitai.tags)||[];
  const allTags=[...tags,...civitaiTags].map(t=>t.toLowerCase());
  if(allTags.includes('character'))return'Character';
  if(allTags.includes('clothing')||allTags.includes('outfit'))return'Clothing';
  if(allTags.includes('style'))return'Style';
  if(allTags.includes('pose'))return'Pose';
  if(allTags.includes('concept'))return'Concept';
  // Check sub_type but ignore generic 'lora' value
  const st=(lora.sub_type||'').toLowerCase();
  if(st&&st!=='lora'&&st!=='locon'&&st!=='lycoris')return st.charAt(0).toUpperCase()+st.slice(1);
  // Check civitai type field
  const ct=(lora.civitai&&lora.civitai.type||'').toLowerCase();
  if(ct==='poses'||ct==='pose')return'Pose';
  if(ct==='character')return'Character';
  if(ct==='clothing')return'Clothing';
  if(ct==='style')return'Style';
  if(ct==='concept')return'Concept';
  return'';
}

function renderLoraGrid(){
  const gr=document.getElementById('lgrid');
  if(!loraList.length){gr.innerHTML='<span style="font-size:11px;color:var(--muted);font-family:var(--mono);">Click Reload to scan LoRAs</span>';return;}
  const search=document.getElementById('lsearch').value.toLowerCase();
  const items=loraList.filter(l=>{
    const models=getLoraModels(l);
    if(!models.includes(model))return false;
    if(loraFilter==='fav'&&!l.favorite)return false;
    if(search&&!l.model_name.toLowerCase().includes(search)&&!(l.folder||'').toLowerCase().includes(search))return false;
    return true;
  });
  if(!items.length){gr.innerHTML='<span style="font-size:11px;color:var(--muted);font-family:var(--mono);">No LoRAs match</span>';return;}
  gr.innerHTML=items.map(l=>{
    const key=l.file_name;
    const isActive=!!activeLoRAs[key];
    const weight=activeLoRAs[key]?.weight||0.8;
    const folder=(l.folder||'').split('/').pop()||'';
    const type=getLoraType(l);
    return `<div class="lchip${isActive?' active':''}" id="lc-${sl(key)}"
      onclick="toggleLora('${key}','${eq(l.model_name)}',event)"
      oncontextmenu="openLpPopup('${key}',event)">
      <span class="lchip-name">${l.model_name}</span>
      ${folder?`<span class="lchip-folder">${folder}</span>`:''}
      ${type?`<span class="lchip-type">${type}</span>`:''}
      <input type="range" class="lchip-wslider" min="0.1" max="1.5" step="0.05" value="${weight}"
        onclick="event.stopPropagation()" oninput="updateLoraW('${key}',this.value,event)">
      <span class="lchip-wval" id="lw-${sl(key)}">${parseFloat(weight).toFixed(2)}</span>
    </div>`;
  }).join('');
}

function toggleLora(key,name,e){
  e&&e.stopPropagation();
  if(activeLoRAs[key])delete activeLoRAs[key];
  else activeLoRAs[key]={name,weight:0.8};
  const chip=document.getElementById('lc-'+sl(key));
  if(chip)chip.classList.toggle('active',!!activeLoRAs[key]);
  refreshEnabledSection();
  updateOutput();updateLoraStats();
}
function updateLoraW(key,val,e){
  e&&e.stopPropagation();
  if(activeLoRAs[key]){
    activeLoRAs[key].weight=parseFloat(val);
    const el=document.getElementById('lw-'+sl(key));
    if(el)el.textContent=parseFloat(val).toFixed(2);
    updateOutput();
  }
}
function updateLoraStats(){
  const n=Object.keys(activeLoRAs).length;
  document.getElementById('lora-ac').textContent=`${n} active`;
  document.getElementById('stat-loras').textContent=n;
  const badge=document.getElementById('loras-tab-ac');
  if(badge){badge.textContent=n>0?n+'':'';badge.style.display=n>0?'':'none';}
}

// ===================== LORA DETAIL PANEL =====================
function openLpPopup(key,e){openLpPanel(key);} // compat shim
function openLpPanel(key){
  currentLPKey=key;
  const lora=loraList.find(l=>l.file_name===key);
  if(!lora)return;
  const data=getLora(key);

  // Name
  document.getElementById('lp-name').textContent=lora.model_name;

  // isAdult flag (buttons set after image innerHTML rebuild below)
  const isAdult=!!data.adult;

  // Type badge
  document.getElementById('lp-type').textContent=getLoraType(lora)||'LoRA';
  const typeColors={style:'#7C3AED',character:'#0891B2',clothing:'#BE185D',pose:'#059669',concept:'#D97706'};
  const tc=typeColors[(getLoraType(lora)||'').toLowerCase()];
  const typeEl=document.getElementById('lp-type');
  if(typeEl&&tc){
    typeEl.style.background=tc+'18';
    typeEl.style.color=tc;
    typeEl.style.borderColor=tc+'30';
  }else if(typeEl){
    typeEl.style.background='';typeEl.style.color='';typeEl.style.borderColor='';
  }

  // Status badge
  const status=getLoraStatus(key);
  const statusBadgeEl=document.getElementById('lp-status-badge');
  const statusLabels={verified:'Verified',testing:'Testing',bad:'Bad'};
  if(status){statusBadgeEl.textContent=statusLabels[status];statusBadgeEl.className='lp-status-badge '+status;}
  else{statusBadgeEl.textContent='';statusBadgeEl.className='lp-status-badge';}

  // (Status/fav/brut buttons set after image innerHTML rebuild below)

  // CivitAI link — use stored custom URL if present, else auto-generate from API data
  const civEl=document.getElementById('lp-civitai');
  const civEdit=document.getElementById('lp-civitai-edit');
  const civId=lora.civitai&&(lora.civitai.modelId||lora.civitai.id);
  const civVId=lora.civitai&&lora.civitai.modelVersionId;
  const customCivUrl=data.civitUrl;
  const autoCivUrl=civId?(civVId?'https://civitai.com/models/'+civId+'?modelVersionId='+civVId:'https://civitai.com/models/'+civId):'';
  const civUrl=customCivUrl||autoCivUrl;
  if(civUrl){civEl.href=civUrl;civEl.style.display='block';}
  else civEl.style.display='none';
  if(civEdit)civEdit.value=civUrl;

  // Filename (element removed, kept for backwards compat)
  const fileEl=document.getElementById('lp-file');
  if(fileEl){fileEl.textContent=lora.file_name+'.safetensors';fileEl.title='Click to copy filename';}

  // Rename row
  document.getElementById('lp-rename-row').style.display='none';

  // Image - smaller size in header row
  const imgWrap=document.getElementById('lpopup-img-wrap');
  const customImg=data.image;
  const rawSrc=lora.preview_url?(lora.preview_url.startsWith('/api/')?'/'+lora.preview_url.replace(/^\//,''):lora.preview_url):null;
  const imgSrc=customImg||rawSrc;
  const resetBtnHtml=customImg?'<button id="lp-img-reset-btn" onclick="resetLoraImg();event.stopPropagation();">Reset</button>':'';
  const overlay='<div class="lp-img-overlay"><button onclick="document.getElementById(\'lp-img-picker\').click();event.stopPropagation();">Change</button>'+resetBtnHtml+'</div>';
  const statusBorderCls=status?'status-'+status:'';
  const picker=document.getElementById('lp-img-picker');
  picker.onchange=handleLoraImgPick;
  if(imgSrc){imgWrap.innerHTML='<div class="lp-img-inner '+statusBorderCls+'"><img src="'+imgSrc+'" onerror="this.parentElement.style.display=\'none\'">'+overlay+'</div>';imgWrap.style.display='';}
  else{imgWrap.innerHTML='<div class="lp-img-inner '+statusBorderCls+'"><div class="lp-img-placeholder">No preview</div>'+overlay+'</div>';imgWrap.style.display='';}
  imgWrap.appendChild(picker);
  imgWrap.dataset.lightboxSrc=imgSrc||'';
  imgWrap.oncontextmenu=function(e){openLpImgCtx(e);};

  // Strength
  const strength=data.strength||0.8;
  const strSlider=document.getElementById('lp-strength');
  strSlider.value=strength;
  document.getElementById('lp-strength-val').textContent=parseFloat(strength).toFixed(2);

  // Settings
  document.getElementById('lp-cfg').value=data.cfg||'';
  document.getElementById('lp-steps').value=data.steps||'';
  document.getElementById('lp-sampler').value=data.sampler||'';
  document.getElementById('lp-checkpoint').value=data.checkpoint||'';

  // Prompt fields
  document.getElementById('lp-prefix').value=data.prefix||'';
  document.getElementById('lp-suffix').value=data.suffix||'';
  // Triggers - prefer stored, fall back to civitai
  const apiTw=lora.civitai&&lora.civitai.trainedWords&&lora.civitai.trainedWords.length?lora.civitai.trainedWords.join(', '):'';
  document.getElementById('lp-triggers').value=data.triggers!==undefined?data.triggers:apiTw;

  // Notes
  document.getElementById('lp-tw').value=data.notes||'';

  // Models
  const currentModels=getLoraModels(lora);
  document.getElementById('lp-models').innerHTML=['sdxl','pony','illustrious'].map(m=>
    '<label class="lmodel-check"><input type="checkbox" value="'+m+'"'+(currentModels.includes(m)?' checked':'')+'>'+m.charAt(0).toUpperCase()+m.slice(1)+'</label>'
  ).join('');

  // Always open in view mode, reset to Overview tab
  lpExitEditMode();
  openLpTab('overview');

  // Open panel - overlays, doesn't shift cards
  document.getElementById('lora-panel').classList.add('open');
  document.getElementById('lora-panel-backdrop').classList.add('open');
  updateFooterH();
}

function openLpTab(tab){
  document.querySelectorAll('.lp-tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===tab));
  document.querySelectorAll('.lp-pane').forEach(p=>p.classList.toggle('active',p.dataset.pane===tab));
}
function closeLpPopup(){closeLpPanel();}
function closeLpPanel(){
  lpExitEditMode();
  document.getElementById('lora-panel').classList.remove('open');
  document.getElementById('lora-panel-backdrop').classList.remove('open');
  currentLPKey=null;
  updateFooterH();
}

function openLightbox(e){
  e.stopPropagation();
  const imgWrap=document.getElementById('lpopup-img-wrap');
  const src=imgWrap.querySelector('img')?.src||imgWrap.dataset.lightboxSrc;
  if(!src)return;
  const lb=document.getElementById('lp-lightbox');
  document.getElementById('lp-lightbox-img').src=src;
  lb.classList.add('open');
}
function closeLightbox(){
  const lb=document.getElementById('lp-lightbox');
  const vid=lb.querySelector('video');
  if(vid)vid.pause();
  lb.classList.remove('open');
  if(!lb.querySelector('#lp-lightbox-img')){
    lb.innerHTML='<img id="lp-lightbox-img" src="" alt="">';
  }
}
// Card image lightbox - click card image for larger view
function openCardLightbox(src,e){
  e.stopPropagation();
  const lb=document.getElementById('lp-lightbox');
  document.getElementById('lp-lightbox-img').src=src;
  lb.classList.add('open');
}
function copyLpFilename(){
  if(!currentLPKey)return;
  navigator.clipboard.writeText(currentLPKey);
  const el=document.getElementById('lp-file');
  const orig=el.textContent;el.textContent='Copied!';el.style.color='var(--green)';
  setTimeout(()=>{el.textContent=orig;el.style.color='';},1200);
}

function copyLpField(id,el){
  // In edit mode, let the field be edited instead of copying
  const panel=document.getElementById('lora-panel');
  if(panel&&panel.classList.contains('editing'))return;
  const val=el.value;
  if(!val)return;
  navigator.clipboard.writeText(val);
  el.classList.add('flash-copied');
  setTimeout(()=>el.classList.remove('flash-copied'),1000);
}

// Bulk-mark triggers in the LoRA detail panel as required (★ all) or optional (all opt).
// Reads current triggers field (or falls back to CivitAI trainedWords if empty),
// rewrites with/without leading * on each token. Save happens via the panel's existing Save flow.
function lpMarkTriggers(mode){
  const ta=document.getElementById('lp-triggers');
  if(!ta)return;
  let raw=(ta.value||'').trim();
  if(!raw){
    // Fall back to CivitAI words if user hasn't customized yet
    const lora=loraList.find(l=>l.file_name===currentLPKey);
    const tw=lora&&lora.civitai&&lora.civitai.trainedWords;
    if(tw&&tw.length)raw=tw.join(', ');
  }
  if(!raw)return;
  const parts=raw.split(',').map(p=>p.trim()).filter(Boolean);
  const rewritten=parts.map(p=>{
    const bare=p.replace(/^\*+/,'').trim();
    return mode==='req'?'*'+bare:bare;
  });
  ta.value=rewritten.join(', ');
}

function toggleLpEdit(){
  const panel=document.getElementById('lora-panel');
  const isEditing=panel.classList.toggle('editing');
  // Toggle readonly on all editable fields
  ['lp-triggers','lp-prefix','lp-suffix','lp-tw','lp-cfg','lp-steps','lp-sampler','lp-checkpoint'].forEach(id=>{
    const el=document.getElementById(id);
    if(el)el.readOnly=!isEditing;
  });
  // Toggle strength slider
  const str=document.getElementById('lp-strength');
  if(str)str.disabled=!isEditing;
  // Show rename row in edit mode
  const renameRow=document.getElementById('lp-rename-row');
  if(renameRow)renameRow.style.display=isEditing?'block':'none';
  if(isEditing){
    const lora=loraList.find(l=>l.file_name===currentLPKey);
    const stored=getLora(currentLPKey).name;
    const nameInput=document.getElementById('lp-display-name');
    if(nameInput)nameInput.value=stored||lora?.model_name||'';
  }
}

function discardLpEdit(){
  // Re-populate fields from saved data and exit edit mode
  if(currentLPKey)openLpPanel(currentLPKey);
}

function lpExitEditMode(){
  const panel=document.getElementById('lora-panel');
  panel.classList.remove('editing');
  ['lp-triggers','lp-prefix','lp-suffix','lp-tw','lp-cfg','lp-steps','lp-sampler','lp-checkpoint'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.readOnly=true;
  });
  const str=document.getElementById('lp-strength');
  if(str)str.disabled=true;
  document.getElementById('lp-rename-row').style.display='none';
}

function lpSetStatus(status){
  if(!currentLPKey)return;
  const cur=getLora(currentLPKey).status===status?null:status;
  setLora(currentLPKey,{status:cur});
  if(!cur)delete appData.loraData[currentLPKey].status;
  // Update panel image border
  const inner=document.querySelector('#lpopup-img-wrap .lp-img-inner');
  if(inner){inner.classList.remove('status-verified','status-testing','status-bad');if(cur)inner.classList.add('status-'+cur);}
  // Update status badge in header
  const statusBadgeEl=document.getElementById('lp-status-badge');
  const statusLabels={verified:'Verified',testing:'Testing',bad:'Bad'};
  if(cur){statusBadgeEl.textContent=statusLabels[cur];statusBadgeEl.className='lp-status-badge '+cur;}
  else{statusBadgeEl.textContent='';statusBadgeEl.className='lp-status-badge';}
  updateStatusBadge(currentLPKey);
  saveAppData();
}

function openLpImgCtx(e){
  e.preventDefault();e.stopPropagation();
  if(!currentLPKey)return;
  const menu=document.getElementById('lp-img-ctx');
  const cur=getLoraStatus(currentLPKey);
  const statusColors={verified:'rgba(52,211,153,.9)',testing:'rgba(96,165,250,.9)',bad:'rgba(248,113,113,.9)'};
  const statusLabels={verified:'Verified',testing:'Testing',bad:'Bad / Remove'};
  ['verified','testing','bad'].forEach(s=>{
    const el=document.getElementById('lpctx-'+s);
    if(!el)return;
    const isActive=cur===s;
    const dot='<span style="width:10px;height:10px;border-radius:50%;background:'+statusColors[s]+';flex-shrink:0;display:inline-block;"></span>';
    el.innerHTML=dot+(isActive?'<strong>'+statusLabels[s]+'</strong>':statusLabels[s]);
    el.style.fontWeight=isActive?'600':'';
  });
  const lora=loraList.find(l=>l.file_name===currentLPKey);
  const isFav=lora&&lora.favorite;
  const favEl=document.getElementById('lpctx-fav');
  if(favEl){favEl.textContent=isFav?'★ Unfavorite':'★ Favorite';favEl.style.color=isFav?'var(--amber)':'var(--text)';}
  const isCleaned=!!getLora(currentLPKey).cleaned;
  const cleanedEl=document.getElementById('lpctx-cleaned');
  if(cleanedEl){
    const dot='<span style="width:10px;height:10px;border-radius:50%;background:rgba(234,179,8,.9);flex-shrink:0;display:inline-block;"></span>';
    cleanedEl.innerHTML=dot+(isCleaned?'<strong>Cleaned</strong>':'Cleaned');
    cleanedEl.style.fontWeight=isCleaned?'600':'';
  }
  const isAdult=!!getLora(currentLPKey).adult;
  const adultEl=document.getElementById('lpctx-adult');
  if(adultEl){adultEl.textContent=isAdult?'Brut ✓':'Brut';adultEl.style.fontWeight=isAdult?'600':'';}
  let left=e.clientX;let top=e.clientY;
  menu.style.display='block';
  const rect=menu.getBoundingClientRect();
  if(left+rect.width>window.innerWidth-8)left=window.innerWidth-rect.width-8;
  if(top+rect.height>window.innerHeight-8)top=window.innerHeight-rect.height-8;
  menu.style.left=left+'px';menu.style.top=top+'px';
  setTimeout(()=>document.addEventListener('click',closeLpImgCtx,{once:true}),0);
}
function closeLpImgCtx(){
  const menu=document.getElementById('lp-img-ctx');
  if(menu)menu.style.display='none';
}

function lpToggleCleaned(){
  if(!currentLPKey)return;
  const cur=!!getLora(currentLPKey).cleaned;
  setLora(currentLPKey,{cleaned:!cur});
  if(cur)delete appData.loraData[currentLPKey].cleaned;
  else resetAutoTagsForLora(currentLPKey);
  document.getElementById('lpst-cleaned')?.classList.toggle('active',!cur);
  updateCleanedBadge(currentLPKey);
  saveAppData();
}

function updateCleanedBadge(key){
  const cleaned=!!getLora(key).cleaned;
  const slk=sl(key);
  document.querySelectorAll('[id="lcard-'+slk+'"] .lora-card-info-btn').forEach(el=>{
    el.classList.toggle('cleaned',cleaned);
  });
}

function saveLpData(){
  if(!currentLPKey)return;
  const checks=[...document.querySelectorAll('#lp-models input:checked')].map(c=>c.value);
  setLora(currentLPKey,{
    overrides:checks,
    notes:document.getElementById('lp-tw').value,
    triggers:document.getElementById('lp-triggers').value,
    strength:parseFloat(document.getElementById('lp-strength').value)||0.8,
    cfg:document.getElementById('lp-cfg').value,
    steps:document.getElementById('lp-steps').value,
    sampler:document.getElementById('lp-sampler').value,
    checkpoint:document.getElementById('lp-checkpoint').value,
    prefix:document.getElementById('lp-prefix').value,
    suffix:document.getElementById('lp-suffix').value,
    civitUrl:document.getElementById('lp-civitai-edit')?.value.trim()||'',
  });
  // Display name rename
  const renameRow=document.getElementById('lp-rename-row');
  if(renameRow.style.display!=='none'){
    const newName=document.getElementById('lp-display-name').value.trim();
    if(newName){
      setLora(currentLPKey,{name:newName});
      const lora=loraList.find(l=>l.file_name===currentLPKey);
      if(lora)lora.model_name=newName;
      const nameEl=document.querySelector('#lcard-'+sl(currentLPKey)+' .lora-card-name');
      if(nameEl)nameEl.textContent=newName;
    }
  }
  // Update P badge on card
  updatePromptBadge(currentLPKey);
  saveAppData();
  renderLoraGrid();
  lpExitEditMode();
  // Re-open to refresh badges
  const key=currentLPKey;
  closeLpPanel();
  setTimeout(()=>openLpPanel(key),50);
}
// ===================== CHECKPOINTS =====================
// Base model for a checkpoint; files without a CivitAI .metadata.json fall back to their folder (SDXL/PONY/Illustrious)
function ckptBaseModel(c){
  return (c.base_model||(c.folder||'').split('/')[0]||'').toLowerCase();
}

function ckptDisplayName(c){
  const key=c.file_name||c.model_name;
  const n=(appData.checkpointNotes&&appData.checkpointNotes[key])||{};
  return n.displayName||c.model_name||c.file_name||key;
}

async function renderCheckpoints(){
  const con=document.getElementById('ckpt-content');
  if(!loraList.length){con.innerHTML='<p class="ckpt-empty">Load LoRAs first to see checkpoints.</p>';return;}
  // Use cached list populated by loadComfyCheckpoints(); fall back to a fresh fetch
  if(!comfyCkpts.length){
    try{
      const r=await fetch('/local/checkpoints/list');
      if(r.ok){const d=await r.json();comfyCkpts=d.items||[];}
    }catch(e){}
  }
  const modelMap={'sdxl':['sdxl','sdxl 1.0'],'pony':['pony'],'illustrious':['illustrious']};
  const modelKeys=modelMap[model]||[];
  const filtered=comfyCkpts.filter(c=>{
    const bm=ckptBaseModel(c);
    if(!modelKeys.some(k=>bm.includes(k)))return false;
    return ckptVisibleInComfy(c.file_name);
  });
  if(!filtered.length){con.innerHTML=`<p class="ckpt-empty">No checkpoints found for ${model.toUpperCase()}. Make sure ComfyUI is running and checkpoints are in the models/checkpoints folder.</p>`;return;}
  con.innerHTML=`<div class="ckpt-grid">${filtered.map(c=>mkCkptCard(c)).join('')}</div>`;
}

function mkCkptCard(c){
  const key=c.file_name||c.model_name;
  const notes=(appData.checkpointNotes&&appData.checkpointNotes[key])||{};
  const displayName=ckptDisplayName(c);
  return `<div class="ckpt-card">
    <div class="ckpt-name"><span>${displayName}</span><button class="ckpt-rename" onclick="renameCheckpoint('${eq(key)}')" title="Rename">✎</button></div>
    <div class="ckpt-file">${c.file_name||''}</div>
    <div class="ckpt-settings">
      <div class="ckpt-field"><label>CFG</label><input class="ckpt-input" id="cn-cfg-${sl(key)}" value="${notes.cfg||''}" placeholder="7"></div>
      <div class="ckpt-field"><label>Steps</label><input class="ckpt-input" id="cn-steps-${sl(key)}" value="${notes.steps||''}" placeholder="20"></div>
      <div class="ckpt-field"><label>Sampler</label><input class="ckpt-input" id="cn-sampler-${sl(key)}" value="${notes.sampler||''}" placeholder="DPM++ 2M"></div>
      <div class="ckpt-field"><label>Clip Skip</label><input class="ckpt-input" id="cn-clip-${sl(key)}" value="${notes.clip||''}" placeholder="1"></div>
    </div>
    <div class="ckpt-notes-label">Prefix Tags</div>
    <input class="ckpt-input ckpt-prefix-input" id="cn-prefix-${sl(key)}" value="${notes.prefix||''}" placeholder="Tags auto-added to prompt when this checkpoint is selected">
    <div class="ckpt-notes-label">Notes</div>
    <textarea class="ckpt-notes" id="cn-notes-${sl(key)}" rows="3" placeholder="What works well, what to avoid...">${notes.notes||''}</textarea>
    <button class="ckpt-save" onclick="saveCkpt('${eq(key)}',this)">Save</button>
  </div>`;
}

function renameCheckpoint(key){
  if(!appData.checkpointNotes)appData.checkpointNotes={};
  const current=(appData.checkpointNotes[key]&&appData.checkpointNotes[key].displayName)||'';
  showInlinePrompt('Checkpoint display name (blank = reset to default)',current,val=>{
    if(!appData.checkpointNotes[key])appData.checkpointNotes[key]={};
    const trimmed=(val||'').trim();
    if(trimmed)appData.checkpointNotes[key].displayName=trimmed;
    else delete appData.checkpointNotes[key].displayName;
    saveAppData();
    renderCheckpoints();
    refreshSendCkpts();
  });
}

function saveCkpt(key,btn){
  const k=sl(key);
  if(!appData.checkpointNotes)appData.checkpointNotes={};
  const existing=appData.checkpointNotes[key]||{};
  appData.checkpointNotes[key]={
    ...existing,
    cfg:document.getElementById(`cn-cfg-${k}`)?.value||'',
    steps:document.getElementById(`cn-steps-${k}`)?.value||'',
    sampler:document.getElementById(`cn-sampler-${k}`)?.value||'',
    clip:document.getElementById(`cn-clip-${k}`)?.value||'',
    prefix:document.getElementById(`cn-prefix-${k}`)?.value||'',
    notes:document.getElementById(`cn-notes-${k}`)?.value||''
  };
  saveAppData();
  btn.textContent='Saved!';btn.classList.add('saved');
  setTimeout(()=>{btn.textContent='Save';btn.classList.remove('saved');},1500);
}

// ===================== OUTPUT =====================
function fmtTag(tag,cid){
  if(parenWraps[`${cid}::${tag}`])return`(${tag})`;
  const w=tagWeights[`${cid}::${tag}`];
  if(w&&w!==1.0)return`(${tag}:${parseFloat(w).toFixed(2)})`;
  return tag;
}
// Parse a raw trigger string like "*cl0n3w4rs-style, *3d, ahsoka tano, togruta"
// into {required: ['cl0n3w4rs-style','3d'], optional: ['ahsoka tano','togruta']}
function parseTriggers(raw){
  const out={required:[],optional:[]};
  if(!raw)return out;
  raw.split(',').forEach(part=>{
    const t=part.trim();
    if(!t)return;
    if(t.startsWith('*'))out.required.push(t.slice(1).trim());
    else out.optional.push(t);
  });
  return out;
}

// Per-LoRA optional-trigger toggle state: { [loraKey]: Set<triggerString> }
let activeTriggers={};

function getCkptPrefix(comfyName){
  if(!comfyName)return'';
  const stem=comfyName.split('/').pop().replace(/\.[^.]+$/,'').toLowerCase();
  const ckptKey=Object.keys(appData.checkpointNotes||{}).find(k=>
    k.split('/').pop().replace(/\.[^.]+$/,'').toLowerCase()===stem
  );
  return(ckptKey&&appData.checkpointNotes[ckptKey].prefix)||'';
}
function buildPos(skipCkptPrefix){
  const parts=[];
  // LoRA calls first
  const loraStr=Object.entries(activeLoRAs).map(([k,v])=>`<lora:${k}:${v.weight.toFixed(2)}>`).join(' ');
  if(loraStr)parts.push(loraStr);
  // LoRA prefix + required triggers + active optional triggers (per LoRA)
  Object.keys(activeLoRAs).forEach(key=>{
    const d=getLora(key);
    if(d.prefix)parts.push(d.prefix);
    const tw=parseTriggers(resolveTriggerSource(key));
    if(tw.required.length)parts.push(tw.required.join(', '));
    const sel=activeTriggers[key];
    if(sel&&sel.size){
      const picked=tw.optional.filter(t=>sel.has(t));
      if(picked.length)parts.push(picked.join(', '));
    }
  });
  // Checkpoint prefix tags
  if(!skipCkptPrefix){
    const selCkpts=getSelectedCkpts();
    if(selCkpts.length){
      const cpPrefix=getCkptPrefix(selCkpts[0]);
      if(cpPrefix)parts.push(cpPrefix);
    }
  }
  // Positive embeddings
  (appData.embeddings||[]).filter(e=>e.target==='pos'&&e.active).forEach(e=>{parts.push('embedding:'+e.name);});
  // Male bias
  if(appData.maleBias)parts.push(getMaleBiasPos());
  // Global quality tokens
  if(model!=='sdxl')parts.push('score_9, score_8_up, score_7_up, masterwork, masterpiece, highres, very aesthetic, absurdres, best quality, amazing quality, intricate details, perfect composition');
  // Subject (clicked positive-category tags get inserted into the subject text directly,
  // so we don't auto-append them here anymore — tag clicks become "type into subject" buttons)
  const subj=document.getElementById('subject-input').value.trim();
  if(subj)parts.push(subj);
  // LoRA suffixes
  Object.keys(activeLoRAs).forEach(key=>{
    const suffix=getLora(key).suffix;
    if(suffix)parts.push(suffix);
  });
  return parts.join(', ');
}
function buildNeg(){
  if(remixNegBase!=null)return remixNegBase;
  const parts=[];
  // Negative embeddings
  (appData.embeddings||[]).filter(e=>e.target==='neg'&&e.active).forEach(e=>{parts.push('embedding:'+e.name);});
  // Male bias negatives
  if(appData.maleBias)parts.push(getMaleBiasNeg());
  if(model!=='sdxl')parts.push('score_4, score_3, score_2, score_1, bad anatomy, bad fingers, worst quality, lowres, text, signature, watermark, artist name, web address, border');
  // Negative-category tag clicks land in the Extra neg textarea, so we don't auto-append them here.
  const xn=(document.getElementById('extra-neg')?.value||'').trim();
  if(xn)parts.push(xn);
  return parts.join(', ');
}
function onExtraNegInput(){
  if(!appData.settings)appData.settings={};
  appData.settings.extraNeg=document.getElementById('extra-neg').value;
  saveAppData();
  updateOutput();
}
function clearRemixNeg(){
  remixNegBase=null;
  updateOutput();
  const ind=document.getElementById('remix-neg-indicator');
  if(ind)ind.remove();
}
// Return the raw trigger string for a LoRA — stored override if present, else CivitAI trainedWords
function resolveTriggerSource(key){
  const stored=getLora(key).triggers;
  if(stored)return stored;
  const lora=loraList.find(l=>l.file_name===key);
  if(lora&&lora.civitai&&lora.civitai.trainedWords&&lora.civitai.trainedWords.length){
    return lora.civitai.trainedWords.join(', ');
  }
  return '';
}

// Legacy string form — used by the "Copy triggers" button. Returns required + active optional joined.
function buildTriggers(){
  const out=[];
  Object.keys(activeLoRAs).forEach(key=>{
    const tw=parseTriggers(resolveTriggerSource(key));
    const sel=activeTriggers[key];
    const picked=tw.optional.filter(t=>sel&&sel.has(t));
    const all=[...tw.required,...picked];
    if(all.length)out.push(all.join(', '));
  });
  return out.join(', ');
}

// Render unified per-LoRA trigger blocks into #tw-req. Each block shows:
//   - LoRA name + strength
//   - Required ★ chips (always visible, non-interactive)
//   - Active optional chips inline (click to remove)
//   - "Options ▾" button (opens popup with all optional chips for that LoRA)
// (#tw-opt is now a hidden legacy element kept just in case other code references it.)
function renderTriggerChips(){
  const box=document.getElementById('tw-req');
  if(!box)return;
  const active=Object.keys(activeLoRAs);
  if(!active.length){
    box.innerHTML='<div class="no-loras-msg">No LoRAs enabled</div>';
    return;
  }
  let html='';
  active.forEach(key=>{
    const tw=parseTriggers(resolveTriggerSource(key));
    const d=getLora(key);
    const name=d.name||(loraList.find(l=>l.file_name===key)?.model_name)||key;
    const w=(activeLoRAs[key]?.weight||0.8).toFixed(2);
    const sel=activeTriggers[key]||new Set();
    const activeOpts=tw.optional.filter(t=>sel.has(t));
    const activeOptCount=activeOpts.length;
    html+='<div class="trigger-lora-block">';
    html+=`<div class="trigger-lora-name"><span class="trigger-lora-name-text">${name}</span><span class="trigger-lora-strength">×${w}</span><button class="trigger-lora-remove" onclick="disableLoraFromPanel('${eq(key)}',event)" title="Remove LoRA">✕</button></div>`;
    html+='<div class="trigger-chips-row">';
    tw.required.forEach(t=>{
      html+=`<span class="trig-chip req" title="Required by this LoRA">${t}</span>`;
    });
    activeOpts.forEach(t=>{
      html+=`<span class="trig-chip opt on" onclick="toggleTriggerChip('${eq(key)}','${eq(t)}')">${t}</span>`;
    });
    if(tw.required.length===0&&activeOptCount===0){
      html+=`<span class="trig-none-inline">—</span>`;
    }
    if(tw.optional.length>0){
      const cls=activeOptCount>0?'opt-trigger-btn has-active':'opt-trigger-btn';
      const cnt=activeOptCount>0?`<span class="opt-trigger-btn-count">${activeOptCount}/${tw.optional.length}</span>`:'';
      html+=`<button class="${cls}" onclick="openOptPopup('${eq(key)}',this)">Options${cnt}<span style="font-size:9px;opacity:.6;">▾</span></button>`;
    }
    html+='</div></div>';
  });
  box.innerHTML=html;
}

function disableLoraFromPanel(key,e){
  e&&e.stopPropagation();
  const d=getLora(key);
  const name=d.name||(loraList.find(l=>l.file_name===key)?.model_name)||key;
  // Strip prefix/suffix tokens from subject-input — they may have landed there via remix
  const si=document.getElementById('subject-input');
  if(si){
    let val=si.value;
    const tokens=[
      ...(d.prefix||'').split(',').map(t=>t.trim()).filter(Boolean),
      ...(d.suffix||'').split(',').map(t=>t.trim()).filter(Boolean),
    ];
    tokens.forEach(t=>{
      const esc=t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      val=val.replace(new RegExp('(^|,)\\s*'+esc+'\\s*(?=,|$)','gi'),'$1');
    });
    si.value=val.replace(/\s*,\s*,+/g,', ').replace(/^\s*,\s*|\s*,\s*$/g,'').trim();
  }
  // toggleLoraTab handles delete + UI sync (card/chip states, enabled section, output)
  toggleLoraTab(key,name,null);
}

// ===================== OPTIONAL TRIGGERS POPUP =====================
let _optPopupKey=null;
function openOptPopup(key,btn){
  if(_optPopupKey===key){closeOptPopup();return;}
  _optPopupKey=key;
  const tw=parseTriggers(resolveTriggerSource(key));
  const d=getLora(key);
  const name=d.name||(loraList.find(l=>l.file_name===key)?.model_name)||key;
  const sel=activeTriggers[key]||new Set();
  document.getElementById('opt-popup-title').textContent=name+' · optional';
  const chips=document.getElementById('opt-popup-chips');
  chips.innerHTML=tw.optional.map(t=>{
    const on=sel.has(t)?' on':'';
    return `<button class="trig-chip opt${on}" onclick="toggleTriggerChip('${eq(key)}','${eq(t)}',true)">${t}</button>`;
  }).join('');
  // Position below the button, clamped to viewport
  const popup=document.getElementById('opt-popup');
  const backdrop=document.getElementById('opt-popup-backdrop');
  popup.classList.add('open');
  backdrop.classList.add('open');
  const r=btn.getBoundingClientRect();
  popup.style.top=(r.bottom+6)+'px';
  // Try right-aligned first; if it would clip left edge, flip to left-aligned
  const rightVal=window.innerWidth-r.right;
  const popupW=popup.offsetWidth||280;
  if(r.right-popupW<8){
    popup.style.left=Math.max(8,r.left)+'px';
    popup.style.right='auto';
  }else{
    popup.style.right=Math.max(rightVal,16)+'px';
    popup.style.left='auto';
  }
}
function closeOptPopup(){
  _optPopupKey=null;
  document.getElementById('opt-popup')?.classList.remove('open');
  document.getElementById('opt-popup-backdrop')?.classList.remove('open');
}
// Re-render the popup chips when triggers toggle from inside it
function refreshOptPopup(){
  if(!_optPopupKey)return;
  const key=_optPopupKey;
  const tw=parseTriggers(resolveTriggerSource(key));
  const sel=activeTriggers[key]||new Set();
  const chips=document.getElementById('opt-popup-chips');
  if(chips){
    chips.innerHTML=tw.optional.map(t=>{
      const on=sel.has(t)?' on':'';
      return `<button class="trig-chip opt${on}" onclick="toggleTriggerChip('${eq(key)}','${eq(t)}',true)">${t}</button>`;
    }).join('');
  }
}

function toggleTriggerChip(key,trigger,fromPopup){
  if(!activeTriggers[key])activeTriggers[key]=new Set();
  const s=activeTriggers[key];
  if(s.has(trigger))s.delete(trigger);
  else s.add(trigger);
  updateOutput();
  if(fromPopup)refreshOptPopup();
}

// ===================== EMBEDDINGS =====================
function initEmbeddings(){
  if(!appData.embeddings){
    appData.embeddings=[
      {name:'lazypos',target:'pos',active:false},
      {name:'lazyneg',target:'neg',active:false}
    ];
    saveAppData();
  }
}
function renderEmbeddingChips(){
  const box=document.getElementById('embed-chips');
  if(!box)return;
  const embs=appData.embeddings||[];
  if(!embs.length){box.innerHTML='<span class="embed-none">No embeddings</span><button class="embed-add-btn" onclick="showEmbedAddForm()" title="Add embedding">+</button>';return;}
  let html=embs.map(e=>{
    const cls=e.active?'embed-chip active':'embed-chip';
    const tl=e.target==='pos'?'+':'−';
    const tc=e.target==='pos'?'embed-target-pos':'embed-target-neg';
    return `<button class="${cls}" onclick="toggleEmbedding('${eq(e.name)}')" oncontextmenu="removeEmbedding('${eq(e.name)}',event)"><span class="embed-target ${tc}">${tl}</span>${e.name}</button>`;
  }).join('');
  html+='<button class="embed-add-btn" onclick="showEmbedAddForm()" title="Add embedding">+</button>';
  box.innerHTML=html;
}
function toggleEmbedding(name){
  const e=(appData.embeddings||[]).find(x=>x.name===name);
  if(!e)return;
  e.active=!e.active;
  saveAppData();
  updateOutput();
}
let _embedPopType='pos';
function showEmbedAddForm(){
  const addBtn=document.querySelector('.embed-add-btn');
  const popup=document.getElementById('embed-popover');
  const backdrop=document.getElementById('embed-popover-backdrop');
  if(!addBtn||!popup||!backdrop)return;
  const r=addBtn.getBoundingClientRect();
  popup.style.bottom=(window.innerHeight-r.top+8)+'px';
  popup.style.left=Math.max(8,r.left-30)+'px';
  popup.classList.add('open');
  backdrop.classList.add('open');
  const inp=document.getElementById('embed-add-name');
  if(inp){inp.value='';setTimeout(()=>inp.focus(),60);}
  document.querySelectorAll('.embed-pop-type').forEach(b=>{
    b.classList.toggle('active',b.dataset.t==='pos');
  });
  _embedPopType='pos';
}
function closeEmbedPopover(){
  document.getElementById('embed-popover')?.classList.remove('open');
  document.getElementById('embed-popover-backdrop')?.classList.remove('open');
}
function setEmbedPopType(t,btn){
  _embedPopType=t;
  document.querySelectorAll('.embed-pop-type').forEach(b=>b.classList.toggle('active',b.dataset.t===t));
}
function submitEmbedding(){
  const name=document.getElementById('embed-add-name').value.trim();
  if(!name)return;
  const target=_embedPopType||'pos';
  if(!appData.embeddings)appData.embeddings=[];
  if(appData.embeddings.find(e=>e.name===name))return;
  appData.embeddings.push({name,target,active:false});
  saveAppData();
  closeEmbedPopover();
  renderEmbeddingChips();
}
function removeEmbedding(name,e){
  e&&e.preventDefault();
  if(!appData.embeddings)return;
  appData.embeddings=appData.embeddings.filter(x=>x.name!==name);
  saveAppData();
  renderEmbeddingChips();
  updateOutput();
}

// ===================== MALE BIAS TOGGLE =====================
const MALE_BIAS_POS_DEFAULT='(male:1.3), (man:1.2), masculine, male focus';
const MALE_BIAS_NEG_DEFAULT='female, woman, girl, breasts';
function getMaleBiasPos(){return appData.maleBiasPos||MALE_BIAS_POS_DEFAULT;}
function getMaleBiasNeg(){return appData.maleBiasNeg||MALE_BIAS_NEG_DEFAULT;}
function parseBiasTags(str){return str.split(',').map(s=>s.trim().replace(/^\(+/,'').replace(/[\):0-9.]+$/,'').trim()).filter(Boolean);}
function initMaleBias(){
  if(appData.maleBias===undefined){appData.maleBias=true;saveAppData();}
  const btn=document.getElementById('male-bias-btn');
  if(btn)btn.classList.toggle('active',!!appData.maleBias);
  syncMaleBiasPills();
}
function toggleMaleBias(){
  const wasOn=!!appData.maleBias;
  appData.maleBias=!wasOn;
  saveAppData();
  const btn=document.getElementById('male-bias-btn');
  if(btn)btn.classList.toggle('active',!wasOn);
  syncMaleBiasPills();
  updateOutput();
}
function syncMaleBiasPills(){
  const on=!!appData.maleBias;
  const posTags=parseBiasTags(getMaleBiasPos());
  const all=posTags;
  categories.forEach(cat=>{
    const src=[...(cat.pony||cat.tags||[]),...(customTags[cat.id]||[])];
    src.forEach(tag=>{
      const lo=tag.toLowerCase();
      const match=all.find(t=>t.toLowerCase()===lo);
      if(!match)return;
      if(!activeTags[cat.id])activeTags[cat.id]=new Set();
      if(on){
        activeTags[cat.id].add(tag);
      }else{
        activeTags[cat.id].delete(tag);
      }
      refreshTag(cat.id,tag);
    });
  });
}
function saveMaleBiasTags(){
  appData.maleBiasPos=document.getElementById('set-male-pos').value;
  appData.maleBiasNeg=document.getElementById('set-male-neg').value;
  saveAppData();
  if(appData.maleBias){syncMaleBiasPills();updateOutput();}
}
function loadMaleBiasSettings(){
  const p=document.getElementById('set-male-pos');
  const n=document.getElementById('set-male-neg');
  if(p)p.value=getMaleBiasPos();
  if(n)n.value=getMaleBiasNeg();
}

// ===================== AUTO-SELECT NEGATIVE TAGS =====================
function getAllNegTags(){
  const negCat=categories.find(c=>c.id==='negative');
  if(!negCat)return[];
  const builtin=negCat.pony||negCat.tags||[];
  const custom=customTags.negative||[];
  return[...builtin,...custom];
}
function initAutoNeg(){
  const allNeg=getAllNegTags();
  if(!allNeg.length)return;
  if(!appData.autoNegTags){
    appData.autoNegTags=allNeg.filter(t=>t!=='text');
    saveAppData();
  }
  if(!activeTags.negative)activeTags.negative=new Set();
  appData.autoNegTags.forEach(tag=>{
    if(allNeg.includes(tag))activeTags.negative.add(tag);
  });
}
function loadAutoNegSettings(){
  const box=document.getElementById('set-auto-neg-list');
  if(!box)return;
  const allNeg=getAllNegTags();
  const auto=new Set(appData.autoNegTags||[]);
  box.innerHTML=allNeg.map(tag=>{
    const checked=auto.has(tag)?'checked':'';
    return `<label style="font-size:11px;display:flex;align-items:center;gap:4px;cursor:pointer;font-family:var(--mono);"><input type="checkbox" ${checked} onchange="toggleAutoNeg('${tag.replace(/'/g,"\\'")}',this.checked)"> ${tag}</label>`;
  }).join('');
}
function toggleAutoNeg(tag,on){
  if(!appData.autoNegTags)appData.autoNegTags=[];
  if(on&&!appData.autoNegTags.includes(tag))appData.autoNegTags.push(tag);
  if(!on)appData.autoNegTags=appData.autoNegTags.filter(t=>t!==tag);
  saveAppData();
}

function updateOutput(){
  const pos=buildPos(),neg=buildNeg();
  const pe=document.getElementById('out-pos'),ne=document.getElementById('out-neg');
  if(pe){pe.value=pos;pe.classList.toggle('empty',!pos);}
  if(ne){ne.value=neg;ne.classList.toggle('empty',!neg);}
  renderTriggerChips();
  renderEmbeddingChips();
  updateSendMeta();
  // If the expand modal is open, keep its "full assembled" view fresh.
  if(_pexpType&&document.getElementById('pexp-modal')?.classList.contains('open'))_refreshPexpAssembled();
}

function updateNav(){
  let total=0;
  categories.forEach(cat=>{
    const n=activeTags[cat.id]?activeTags[cat.id].size:0;
    const el=document.getElementById('nc-'+cat.id);if(el)el.textContent=n;
    total+=n;
  });
  document.getElementById('stat-tags').textContent=total;
}

// ===================== HISTORY =====================
function addToHistory(){
  const pos=buildPos(),neg=buildNeg();
  if(!pos)return;
  if(!appData.history)appData.history=[];
  appData.history.unshift({pos,neg,time:new Date().toLocaleString()});
  if(appData.history.length>20)appData.history=appData.history.slice(0,20);
  saveAppData();renderHistory();
}
function renderHistory(){
  const con=document.getElementById('hist-list');
  if(!appData.history||!appData.history.length){con.innerHTML='<p class="hist-empty">No history yet.</p>';return;}
  con.innerHTML=appData.history.map((h,i)=>`
    <div class="hist-item">
      <div class="hist-time">${h.time}</div>
      <div class="hist-pos">${h.pos}</div>
      ${h.neg?`<div class="hist-neg">NEG: ${h.neg}</div>`:''}
      <div class="hist-actions">
        <button class="hist-btn" onclick="loadHistory(${i})">Load</button>
        <button class="hist-btn" onclick="copyHistItem(${i},event)">Copy</button>
        <button class="hist-btn" style="color:var(--red)" onclick="delHistory(${i})">Delete</button>
      </div>
    </div>`).join('');
}
function loadHistory(i){
  const h=appData.history[i];if(!h)return;
  document.getElementById('subject-input').value=h.pos;
  updateOutput();switchTab('tags');
}
function copyHistItem(i,e){
  const h=appData.history[i];if(!h)return;
  navigator.clipboard.writeText(`POSITIVE:\n${h.pos}\n\nNEGATIVE:\n${h.neg||''}`);
  const btn=e.target;btn.textContent='Copied!';setTimeout(()=>btn.textContent='Copy',1200);
}
function delHistory(i){appData.history.splice(i,1);saveAppData();renderHistory();}
function clearHistory(){appData.history=[];saveAppData();renderHistory();}

// ===================== PRESETS =====================
function savePreset(){
  const name=document.getElementById('preset-name-input').value.trim();
  if(!name)return;
  const preset={
    name,id:Date.now(),model,
    subject:document.getElementById('subject-input').value,
    tags:Object.fromEntries(Object.entries(activeTags).map(([k,v])=>[k,[...v]])),
    weights:{...tagWeights},
    loras:{...activeLoRAs}
  };
  if(!appData.presets)appData.presets=[];
  appData.presets.push(preset);
  document.getElementById('preset-name-input').value='';
  saveAppData();renderPresets();
}
function loadPreset(id){
  const p=appData.presets.find(x=>x.id===id);if(!p)return;
  setModel(p.model||model);
  document.getElementById('subject-input').value=p.subject||'';
  Object.keys(p.tags||{}).forEach(k=>{activeTags[k]=new Set(p.tags[k]);});
  Object.assign(tagWeights,p.weights||{});
  activeLoRAs={...p.loras||{}};
  renderTagSections();renderLoraGrid();updateOutput();updateNav();updateLoraStats();
  switchTab('tags');
}
function delPreset(id,e){
  e.stopPropagation();
  appData.presets=appData.presets.filter(p=>p.id!==id);
  saveAppData();renderPresets();
}
function renderPresets(){
  const con=document.getElementById('preset-grid');
  if(!appData.presets||!appData.presets.length){con.innerHTML='<p style="color:var(--muted);font-size:12px;font-family:var(--mono);grid-column:1/-1">No presets saved yet.</p>';return;}
  con.innerHTML=appData.presets.map(p=>`
    <div class="preset-card" onclick="loadPreset(${p.id})">
      <div class="preset-del" onclick="delPreset(${p.id},event)">✕</div>
      <div class="preset-name">${p.name}</div>
      <div class="preset-meta">${p.model||'sdxl'} · ${Object.values(p.tags||{}).reduce((a,v)=>a+v.length,0)} tags</div>
    </div>`).join('');
}

// ===================== RANDOMIZE =====================
function randomize(){
  // Replace any existing random picks: clear old, then add+insert one fresh per positive cat.
  categories.filter(c=>!c.neg).forEach(cat=>{
    const target=tagTargetField(cat.id);
    if(activeTags[cat.id])activeTags[cat.id].forEach(t=>removeTagFromField(target,t));
    activeTags[cat.id]=new Set();
    const tags=(model!=='sdxl'&&cat.pony)?cat.pony:cat.tags;
    if(tags.length>0){
      const pick=tags[Math.floor(Math.random()*tags.length)];
      activeTags[cat.id].add(pick);
      appendTagToField(target,pick);
    }
  });
  renderTagSections();updateOutput();updateNav();
}
function clearTags(){
  // Deselect every active tag and best-effort wipe its text from subject / extra-neg.
  Object.keys(activeTags).forEach(cid=>{
    const target=tagTargetField(cid);
    activeTags[cid].forEach(t=>{
      removeTagFromField(target,t);
      delete tagWeights[`${cid}::${t}`];
    });
    activeTags[cid]=new Set();
  });
  renderTagSections();updateOutput();updateNav();
}
function sidebarClearAll(){clearAll();}

// ===================== COPY =====================
let _pexpType=null;
// Each entry says: what's the editable input, what's the assembled output (full pos/neg),
// and what to label them. The modal shows BOTH sections — input on top, full assembled below.
const _pexpMeta={
  subj:{title:'Subject + Positive',dot:'#86efac',inputId:'subject-input',inputLabel:'Subject',asmKind:'pos',asmLabel:'Full positive prompt',placeholder:'e.g. solitary figure in a ruined cathedral, wearing a long coat...'},
  xneg:{title:'Extra neg + Negative',dot:'#fca5a5',inputId:'extra-neg',inputLabel:'Extra neg',asmKind:'neg',asmLabel:'Full negative prompt',placeholder:'appended to negative prompt — e.g. blurry, dof, bokeh'},
  // Legacy entries — kept for buttons that may still call openPromptExpand('pos'|'neg')
  pos:{title:'Full positive prompt',dot:'#86efac',inputId:null,asmKind:'pos',asmLabel:'Full positive prompt'},
  neg:{title:'Full negative prompt',dot:'#fca5a5',inputId:null,asmKind:'neg',asmLabel:'Full negative prompt'},
};
function pexpAssembled(kind){
  if(kind==='pos')return buildPos();
  if(kind==='neg')return buildNeg();
  return '';
}
function openPromptExpand(type){
  const m=_pexpMeta[type];if(!m)return;
  _pexpType=type;
  document.getElementById('pexp-title').textContent=m.title;
  document.getElementById('pexp-dot').style.background=m.dot;
  const inputWrap=document.getElementById('pexp-input-wrap');
  const ta=document.getElementById('pexp-text');
  const inputCopyBtn=document.getElementById('pexp-copy-input');
  if(m.inputId){
    inputWrap.style.display='';
    document.getElementById('pexp-input-label').textContent=m.inputLabel||'Input';
    ta.value=document.getElementById(m.inputId).value||'';
    ta.placeholder=m.placeholder||'';
    ta.readOnly=false;
    ta.oninput=()=>{
      const src=document.getElementById(m.inputId);
      src.value=ta.value;
      src.dispatchEvent(new Event('input',{bubbles:true}));
      _refreshPexpAssembled();
    };
    if(inputCopyBtn){inputCopyBtn.style.display='';inputCopyBtn.textContent=`Copy ${(m.inputLabel||'input').toLowerCase()}`;}
  }else{
    inputWrap.style.display='none';
    if(inputCopyBtn)inputCopyBtn.style.display='none';
  }
  // Populate the assembled section
  document.getElementById('pexp-asm-label').textContent=m.asmLabel||'Full prompt';
  _refreshPexpAssembled();
  document.getElementById('pexp-modal').classList.add('open');
  if(m.inputId)setTimeout(()=>ta.focus(),30);
}
function _refreshPexpAssembled(){
  const m=_pexpMeta[_pexpType];if(!m)return;
  const asm=document.getElementById('pexp-asm-text');
  if(asm)asm.value=pexpAssembled(m.asmKind)||'';
}
function closePromptExpand(){
  document.getElementById('pexp-modal').classList.remove('open');
  _pexpType=null;
}
function pexpCopy(target,e){
  if(!_pexpType)return;
  const which=target||'full';
  const text=which==='input'
    ?document.getElementById('pexp-text').value
    :document.getElementById('pexp-asm-text').value;
  if(!text)return;
  navigator.clipboard.writeText(text);
  if(which==='full')addToHistory();
  const btn=(e&&e.target)||document.getElementById(which==='input'?'pexp-copy-input':'pexp-copy');
  if(!btn)return;
  const orig=btn.textContent;
  btn.textContent='Copied!';btn.classList.add('copied');
  setTimeout(()=>{btn.textContent=orig;btn.classList.remove('copied');},1400);
}
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&document.getElementById('pexp-modal').classList.contains('open')){closePromptExpand();}
});

function copyOut(type,e){
  let text='';
  if(type==='pos')text=document.getElementById('out-pos').value;
  else if(type==='neg')text=document.getElementById('out-neg').value;
  else if(type==='tw')text=buildTriggers();
  if(!text)return;
  navigator.clipboard.writeText(text);
  addToHistory();
  const btn=e.target,orig=btn.textContent;
  btn.textContent='Copied!';btn.classList.add('copied');
  setTimeout(()=>{btn.textContent=orig;btn.classList.remove('copied');},1400);
}

// ===================== CLEAR =====================
function clearAll(){
  categories.forEach(c=>{activeTags[c.id]=new Set();});
  Object.keys(tagWeights).forEach(k=>delete tagWeights[k]);
  Object.keys(parenWraps).forEach(k=>delete parenWraps[k]);
  activeLoRAs={};
  activeTriggers={};
  (appData.embeddings||[]).forEach(e=>{e.active=false;});
  document.getElementById('subject-input').value='';
  // Also drop the user-defined "extra negative" tweaks
  const xn=document.getElementById('extra-neg');
  if(xn){
    xn.value='';
    if(appData.settings){appData.settings.extraNeg='';saveAppData();}
  }
  // Drop any remix lock — negative prompt override + the indicator pill
  if(remixNegBase!=null)clearRemixNeg();
  renderTagSections();renderLoraGrid();renderLoraTab();updateOutput();updateNav();updateLoraStats();
}

// ===================== TAG ACCORDION (DEPRECATED) =====================
// The global Tags accordion was replaced by per-category collapse in the v5 redesign.
// These shims stay so any lingering callers don't crash.
function toggleTagAccordion(){}
function restoreTagAccordion(){}

// ===================== SEED LOCK =====================
function isSeedLocked(){
  return document.getElementById('seed-lock-btn')?.classList.contains('locked');
}
function toggleSeedLock(){
  const btn=document.getElementById('seed-lock-btn');
  if(!btn)return;
  const nowLocked=!btn.classList.contains('locked');
  btn.classList.toggle('locked',nowLocked);
  btn.title=nowLocked?'Seed locked — Send will use the value in the box':'Lock seed (don\'t randomize on send)';
  // If locking with an empty seed, roll one so there's something concrete to lock
  if(nowLocked){
    const sf=document.getElementById('cfg-seed');
    if(sf&&!sf.value.trim())randomSeed();
  }
  localStorage.setItem('cpg-seed-locked',nowLocked?'1':'0');
}
function restoreSeedLock(){
  if(localStorage.getItem('cpg-seed-locked')==='1'){
    const btn=document.getElementById('seed-lock-btn');
    if(btn)btn.classList.add('locked');
  }
}
function setSeedLocked(locked){
  const btn=document.getElementById('seed-lock-btn');
  if(!btn)return;
  btn.classList.toggle('locked',locked);
  btn.title=locked?'Seed locked — Send will use the value in the box':'Lock seed (don\'t randomize on send)';
  localStorage.setItem('cpg-seed-locked',locked?'1':'0');
}

// ===================== QUEUE INDICATOR + COMFYUI WEBSOCKET (Phase 3.5) =====================
let _queuePollTimer=null;
let _comfyWS=null;
let _comfyWSReconnectTimer=null;
let _wsGenerating=false; // true between first executing/progress msg and executing{node:null}
let _wsQueueRemaining=0; // items waiting (not including the one currently executing)
let _genStartTime=null;
let _genOutputFiles=[];
let _pendingUpscale=null;

async function pollQueueOnce(){
  const pill=document.getElementById('queue-pill');
  const prog=document.getElementById('queue-progress');
  const inner=document.getElementById('queue-progress-inner');
  if(!pill)return;
  try{
    const r=await fetch('/comfy/queue');
    if(!r.ok)throw new Error('http');
    const q=await r.json();
    const running=q.running||0,pending=q.pending||0;
    // If WS thinks we're generating but ComfyUI says nothing is running, reset
    if(_wsGenerating&&running===0&&pending===0){
      _wsGenerating=false;
      _wsQueueRemaining=0;
      _genStartTime=null;
      _genOutputFiles=[];
      if(prog)prog.classList.remove('active');
      if(inner)inner.style.width='0%';
      pill.textContent='idle · 0 jobs';pill.classList.remove('busy');
      _trayProgress('');
      updateQueueBarState(0,0);
      renderRecentStrip();
    }
    if(!_comfyWS||_comfyWS.readyState!==WebSocket.OPEN){
      pill.classList.remove('disconnected');
      if(running+pending===0){pill.textContent='idle · 0 jobs';pill.classList.remove('busy');}
      else{pill.textContent=running?`generating · ${pending} queued`:`${pending} queued`;pill.classList.add('busy');}
    }
    updateQueueBarState(running,pending);
  }catch(e){
    if(!_comfyWS||_comfyWS.readyState!==WebSocket.OPEN){
      pill.textContent='—';pill.classList.remove('busy');pill.classList.add('disconnected');
    }
  }
}

function connectComfyWS(){
  if(_comfyWS&&(_comfyWS.readyState===WebSocket.OPEN||_comfyWS.readyState===WebSocket.CONNECTING))return;
  try{
    _comfyWS=new WebSocket('ws://127.0.0.1:3000/ws');
    _comfyWS.onopen=()=>{
      clearTimeout(_comfyWSReconnectTimer);
      _comfyWSReconnectTimer=null;
      pollQueueOnce();
      updateSendStatus();
      setTimeout(loadComfyCheckpoints, 2000);
    };
    _comfyWS.onmessage=(e)=>{
      if(typeof e.data==='string'){
        try{handleComfyWSMessage(JSON.parse(e.data));}catch{}
      }
    };
    _comfyWS.onclose=()=>{
      _comfyWS=null;
      const pill=document.getElementById('queue-pill');
      if(pill){pill.textContent='—';pill.classList.remove('busy');pill.classList.add('disconnected');}
      updateSendStatus();
      _comfyWSReconnectTimer=setTimeout(connectComfyWS,5000);
    };
    _comfyWS.onerror=()=>{}; // onclose handles it
  }catch(e){
    _comfyWSReconnectTimer=setTimeout(connectComfyWS,5000);
  }
}

function disconnectComfyWS(){
  clearTimeout(_comfyWSReconnectTimer);
  _comfyWSReconnectTimer=null;
  if(_comfyWS){_comfyWS.onclose=null;_comfyWS.close();_comfyWS=null;}
}

// Debounced label update — fetches authoritative running+pending from the API
// instead of trying to reconstruct the count from async WS messages (which can
// arrive in any order and cause momentary off-by-one errors).
let _queueLabelTimer=null;
function scheduleQueueLabelUpdate(){
  if(_queueLabelTimer)clearTimeout(_queueLabelTimer);
  _queueLabelTimer=setTimeout(async()=>{
    _queueLabelTimer=null;
    try{
      const r=await fetch('/comfy/queue');
      if(r.ok){
        const q=await r.json();
        updateQueueBarState(q.running||0,q.pending||0);
      }
    }catch{}
  },150);
}

function updateQueueBarState(running,pending){
  const generating=_wsGenerating||running>0;
  const total=running+pending;
  // Label stays "Queue" always
  const label=document.getElementById('queue-bar-label');
  if(label)label.textContent='Queue';
  // Show/hide generating vs idle elements
  const stopBtn=document.getElementById('queue-stop-btn');
  const clearBtn=document.getElementById('queue-clear-btn');
  const jobsBtn=document.getElementById('queue-panel-toggle');
  const readyEl=document.getElementById('queue-bar-ready');
  const prog=document.getElementById('queue-progress');
  if(stopBtn)stopBtn.style.display=generating?'':'none';
  if(clearBtn)clearBtn.style.display=generating?'':'none';
  // Jobs button stays visible always so user can toggle the panel
  if(readyEl)readyEl.style.display=generating?'none':'';
  if(prog&&!generating)prog.classList.remove('active');
  // Update jobs button text based on panel state
  if(jobsBtn)jobsBtn.textContent=_queuePanelOpen?'jobs ▴':'jobs ▾';
  // Update top-bar queue indicator
  updateQueueIndicator(total,generating);
}
function updateQueueIndicator(total,generating){
  const el=document.getElementById('queue-indicator');
  if(!el)return;
  if(generating&&total>0){
    el.textContent=total;
    el.style.display='';
  }else if(generating){
    el.textContent='1';
    el.style.display='';
  }else{
    el.style.display='none';
  }
}

function updateQueueStopBtn(){
  updateQueueBarState(_wsGenerating?1:0,0);
}
async function stopComfy(){
  try{await fetch('/comfy/interrupt',{method:'POST'});}catch{}
  scheduleQueueLabelUpdate();
  refreshQueuePanel();
}
async function interruptQueue(){
  try{await fetch('/comfy/interrupt',{method:'POST'});}catch{}
  scheduleQueueLabelUpdate();
  refreshQueuePanel();
}
async function clearQueue(){
  try{await fetch('/comfy/queue/clear',{method:'POST'});}catch{}
  scheduleQueueLabelUpdate();
  refreshQueuePanel();
}

let _queuePanelOpen=false;
function toggleQueuePanel(){
  _queuePanelOpen=!_queuePanelOpen;
  const el=document.getElementById('queue-jobs');
  if(!el)return;
  el.classList.toggle('open',_queuePanelOpen);
  const btn=document.getElementById('queue-panel-toggle');
  if(btn){btn.classList.toggle('active',_queuePanelOpen);btn.textContent=_queuePanelOpen?'jobs ▾':'jobs ▴';}
  if(_queuePanelOpen) refreshQueuePanel();
}
async function refreshQueuePanel(){
  if(!_queuePanelOpen)return;
  const list=document.getElementById('queue-jobs-list');
  if(!list)return;
  try{
    const r=await fetch('/comfy/queue/details');
    if(!r.ok){list.innerHTML='<div class="queue-empty">unable to fetch queue</div>';return;}
    const data=await r.json();
    const running=data.running||[];
    const pending=data.pending||[];
    if(!running.length&&!pending.length){
      list.innerHTML='<div class="queue-empty">queue empty</div>';
      return;
    }
    const notes=appData.checkpointNotes||{};
    function ckptLabel(stem){
      if(!stem)return null;
      return notes[stem]?.displayName||stem;
    }
    let html='';
    running.forEach((job,i)=>{
      const label=ckptLabel(job.checkpoint)||'running';
      html+=`<div class="queue-job running"><span class="queue-job-num">▶</span><span class="queue-job-info" title="${label}">${label}</span><button class="queue-job-cancel" onclick="interruptQueue()" title="Stop this generation">■ stop</button></div>`;
    });
    pending.forEach((job,i)=>{
      const label=ckptLabel(job.checkpoint)||'pending';
      html+=`<div class="queue-job"><span class="queue-job-num">#${i+2}</span><span class="queue-job-info" title="${label}">${label}</span><button class="queue-job-cancel" onclick="cancelQueueJob('${job.promptId}')" title="Remove from queue">✕</button></div>`;
    });
    list.innerHTML=html;
  }catch(e){list.innerHTML='<div class="queue-empty">unable to fetch queue</div>';}
}
async function cancelQueueJob(promptId){
  try{await fetch('/comfy/queue/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({delete:[promptId]})});}catch{}
  scheduleQueueLabelUpdate();
  setTimeout(refreshQueuePanel,200);
}

function _trayProgress(text){window.promptGen?.updateTrayProgress(text);}

function handleComfyWSMessage(msg){
  const pill=document.getElementById('queue-pill');
  const prog=document.getElementById('queue-progress');
  const inner=document.getElementById('queue-progress-inner');
  if(!pill)return;

  if(msg.type==='progress'){
    const {value,max}=msg.data;
    const pct=max>0?Math.round((value/max)*100):0;
    _wsGenerating=true;
    if(prog)prog.classList.add('active');
    if(inner)inner.style.width=pct+'%';
    pill.classList.add('busy');pill.classList.remove('disconnected');
    pill.textContent=`generating · ${pct}%`;
    updateQueueBarState(1,_wsQueueRemaining);
    const qSuf=_wsQueueRemaining>0?` | +${_wsQueueRemaining}`:'';
    _trayProgress(`${pct}%${qSuf}`);

  }else if(msg.type==='executed'){
    const imgs=msg.data?.output?.images;
    if(imgs&&imgs.length){
      imgs.forEach(i=>{if(i.filename)_genOutputFiles.push(i.filename);});
    }

  }else if(msg.type==='executing'){
    if(msg.data.node===null){
      // Entire prompt finished — record timing for output files
      if(_genStartTime&&_genOutputFiles.length){
        const dur=Math.round((Date.now()-_genStartTime)/1000);
        if(!appData.galleryTiming)appData.galleryTiming={};
        _genOutputFiles.forEach(f=>{appData.galleryTiming[f]=dur;});
        saveAppData();
      }
      const completedFiles=[..._genOutputFiles];
      _genStartTime=null;
      _genOutputFiles=[];
      _wsGenerating=false;
      if(completedFiles.length)autoTagCompletedFiles(completedFiles);
      if(_pendingUpscale&&msg.data.prompt_id===_pendingUpscale.promptId){
        const wsFile=completedFiles[completedFiles.length-1];
        if(wsFile){
          const pu={..._pendingUpscale};
          _pendingUpscale=null;
          finalizeUpscale(pu,wsFile);
        }else{
          showToast('Upscale failed','No output file produced','err');
          _pendingUpscale=null;
        }
      }
      _wsQueueRemaining=0;
      if(prog)prog.classList.remove('active');
      if(inner)inner.style.width='0%';
      pill.textContent='idle · 0 jobs';pill.classList.remove('busy');
      _trayProgress('');
      updateQueueBarState(0,0);
      scheduleQueueLabelUpdate();
      renderRecentStrip();
      pollQueueOnce();
      refreshQueuePanel();
    }else{
      // A node started executing — we're definitely generating
      if(!_wsGenerating){_genStartTime=Date.now();_genOutputFiles=[];}
      _wsGenerating=true;
      pill.classList.add('busy');pill.classList.remove('disconnected');
      if(!pill.textContent.includes('%'))pill.textContent='generating…';
      _trayProgress('…');
      updateQueueBarState(1,_wsQueueRemaining);
    }

  }else if(msg.type==='status'){
    const remaining=msg.data?.status?.exec_info?.queue_remaining;
    if(remaining!=null)_wsQueueRemaining=remaining;
    // Only go idle from status if we're not mid-generation — ComfyUI sends
    // queue_remaining=0 when a job moves from queue to execution (still running!)
    if(remaining===0&&!_wsGenerating){
      pill.textContent='idle';pill.classList.remove('busy');
      if(prog)prog.classList.remove('active');
      if(inner)inner.style.width='0%';
      _trayProgress('');
    }else if(remaining>0&&!_wsGenerating){
      pill.classList.add('busy');pill.classList.remove('disconnected');
      pill.textContent=`${remaining} queued`;
      _trayProgress(`+${remaining}`);
    }
    scheduleQueueLabelUpdate();
    refreshQueuePanel();
  }
}

function startQueuePoll(){
  if(_queuePollTimer)return;
  connectComfyWS();
  pollQueueOnce();
  _queuePollTimer=setInterval(pollQueueOnce,5000);
}
function stopQueuePoll(){
  if(_queuePollTimer){clearInterval(_queuePollTimer);_queuePollTimer=null;}
  // Keep WS alive across tab switches so we don't miss executing events
}

// ===================== RECENT OUTPUTS STRIP =====================
async function renderRecentStrip(){
  const wrap=document.getElementById('recent-thumbs');
  if(!wrap)return;
  // Fetch the 3 most recent raw images directly — no dependency on Gallery tab being open
  // Apply session cutoff: clear button stores a timestamp; older images are filtered out.
  const cutoff=parseFloat(localStorage.getItem('cpg-recent-cutoff'))||0;
  let imgs=[];
  try{
    const r=await fetch('/gallery/list?folder=raw');
    if(r.ok){
      const d=await r.json();
      imgs=(Array.isArray(d)?d:[]).filter(it=>(it.mtime||0)>cutoff).sort((a,b)=>(b.mtime||0)-(a.mtime||0)).slice(0,3);
    }
  }catch(e){}
  let html='';
  for(let i=0;i<3;i++){
    const it=imgs[i];
    if(it){
      const imgSrc=`/gallery/image?folder=raw&file=${encodeURIComponent(it.name)}`;
      html+=`<div class="recent-thumb" onmouseenter="showRecentPreview(event,'${eq(imgSrc)}')" onmouseleave="hideRecentPreview()" onclick="openRecentLightbox('${eq(imgSrc)}','${eq(it.name)}')"><img class="recent-thumb-img" src="${imgSrc}"></div>`;
    }else{
      html+=`<div class="recent-thumb empty">·</div>`;
    }
  }
  wrap.innerHTML=html;
}
function clearRecentStrip(){
  // Recent strip pulls newest from disk every render. "Clear" stores a cutoff
  // timestamp so currently-shown images are filtered out; only newer ones appear.
  // Server uses seconds-since-epoch for mtime (Date.now()/1000).
  localStorage.setItem('cpg-recent-cutoff',(Date.now()/1000).toString());
  _recentLastMtime=Date.now()/1000;
  renderRecentStrip();
}
function startRecentPoll(){
  stopRecentPoll();
  _recentPollTimer=setInterval(recentPollTick,4000);
}
function stopRecentPoll(){
  if(_recentPollTimer){clearInterval(_recentPollTimer);_recentPollTimer=null;}
}
async function recentPollTick(){
  try{
    const r=await fetch('/gallery/list?folder=raw');
    if(!r.ok)return;
    const list=await r.json();
    if(!Array.isArray(list)||!list.length)return;
    const cutoff=parseFloat(localStorage.getItem('cpg-recent-cutoff'))||0;
    const newest=list.filter(i=>(i.mtime||0)>cutoff).reduce((m,i)=>Math.max(m,i.mtime||0),0);
    if(newest>_recentLastMtime){
      _recentLastMtime=newest;
      renderRecentStrip();
    }
  }catch(e){}
}
function recentJumpToGallery(name){
  switchTab('gallery');
  // Try to highlight/select that image — best effort
  setTimeout(()=>{
    const card=document.querySelector(`.gallery-card[data-name="${name}"]`);
    if(card)card.scrollIntoView({behavior:'smooth',block:'center'});
  },150);
}
function showRecentPreview(e,url){
  const p=document.getElementById('recent-hover-preview');
  if(!p)return;
  p.querySelector('img').src=url;
  p.style.display='block';
  const rect=e.currentTarget.getBoundingClientRect();
  const pw=160;
  let left=rect.left-pw-10;
  if(left<8)left=rect.right+10;
  let top=rect.top;
  p.style.left=left+'px';
  p.style.top=top+'px';
}
function hideRecentPreview(){
  const p=document.getElementById('recent-hover-preview');
  if(p)p.style.display='none';
}
function openRecentLightbox(url,name){
  const lb=document.getElementById('recent-lightbox');
  const img=document.getElementById('recent-lightbox-img');
  const nm=document.getElementById('recent-lightbox-name');
  if(!lb||!img)return;
  img.src=url;
  if(nm)nm.textContent=name||'';
  lb.classList.add('open');
}
function closeRecentLightbox(){
  const lb=document.getElementById('recent-lightbox');
  if(lb)lb.classList.remove('open');
}
function toggleRecentStrip(){
  const strip=document.getElementById('recent-strip');
  const btn=document.getElementById('queue-recent-toggle');
  if(!strip||!btn)return;
  const hidden=strip.style.display==='none';
  strip.style.display=hidden?'':'none';
  btn.textContent='recent';
  btn.classList.toggle('active',hidden);
  localStorage.setItem('cpg-recent-strip-open',hidden?'1':'0');
}
function restoreRecentStripState(){
  const open=localStorage.getItem('cpg-recent-strip-open');
  // default: show
  if(open==='0'){
    const strip=document.getElementById('recent-strip');
    const btn=document.getElementById('queue-recent-toggle');
    if(strip)strip.style.display='none';
    if(btn)btn.classList.remove('active');
  }else{
    const btn=document.getElementById('queue-recent-toggle');
    if(btn)btn.classList.add('active');
  }
}

// ===================== SEND META ROW =====================
function toggleDimsAccordion(){
  const body=document.getElementById('dims-accordion-body');
  const btn=document.getElementById('dims-accordion-btn');
  if(!body)return;
  const opening=body.style.display==='none';
  body.style.display=opening?'':'none';
  if(btn)btn.classList.toggle('expanded',opening);
}
function updateDimsAccordionSummary(){
  const el=document.getElementById('dims-accordion-summary');
  if(!el)return;
  const v=id=>document.getElementById(id)?.value||'';
  const w=v('cfg-w'),h=v('cfg-h'),steps=v('cfg-steps'),cfg=v('cfg-cfg');
  const samplerEl=document.getElementById('cfg-sampler');
  const sampler=samplerEl?samplerEl.options[samplerEl.selectedIndex]?.text:'';
  const parts=[`${w}×${h}`,`${steps} steps`,`CFG ${cfg}`];
  if(sampler)parts.push(sampler);
  el.textContent=parts.join(' · ');
}
function updateSendMeta(){
  updateSendStatus();
  updateDimsAccordionSummary();
}
function updateSendStatus(){
  const row=document.getElementById('send-status-row');
  const txt=document.getElementById('send-status-text');
  if(!row||!txt)return;
  const connected=_comfyWS&&_comfyWS.readyState===WebSocket.OPEN;
  if(connected){
    row.className='send-status-row';
    txt.textContent='ComfyUI connected · ready';
  }else{
    row.className='send-status-row disconnected';
    txt.textContent='ComfyUI disconnected';
  }
}


// ===================== LORA TAB =====================
function mkLoraSection(id,label,items,hasCol,dotColor){
  const gridClass=loraView==='card'?'lora-card-grid':'lgrid';
  const gridStyle=loraView==='card'?'':'max-height:none;';
  const itemsHtml=loraView==='card'
    ?items.map(l=>mkLoraCard(l)).join('')
    :items.map(l=>{
        const key=l.file_name;const isActive=!!activeLoRAs[key];
        const weight=activeLoRAs[key]?.weight||0.8;
        const folder=(l.folder||'').split('/').pop()||'';
        const type=getLoraType(l);
        const ek=eq(key);const en=eq(l.model_name);
        return '<div class="lchip'+(isActive?' active':'')+'" id="ltc-'+sl(key)+'"'
          +' onclick="toggleLoraTab(\'' +ek+ '\',\'' +en+ '\',event)">'
          +'<span class="lchip-name">'+l.model_name+'</span>'
          +(type?'<span class="lchip-type">'+type+'</span>':'')
          +'<input type="range" class="lchip-wslider" min="0.1" max="1.5" step="0.05" value="'+weight+'"'
          +' onclick="event.stopPropagation()" oninput="updateLoraW(\'' +ek+ '\',this.value,event)">'
          +'<span class="lchip-wval" id="ltw-'+sl(key)+'">'+parseFloat(weight).toFixed(2)+'</span>'
          +'</div>';
      }).join('');
  const dot=dotColor||(hasCol?'var(--orange)':'var(--muted2)');
  return '<div class="tgroup" id="lsec-'+id+'" style="margin-bottom:28px;">'
    +'<div class="lsec-hdr">'
    +'<span class="lsec-dot" style="background:'+dot+'"></span>'
    +'<span class="lsec-label">'+label+'</span>'
    +'<span class="lsec-hr"></span>'
    +'<span class="lsec-count">'+items.length+'</span>'
    +'</div>'
    +'<div class="'+gridClass+'" style="'+gridStyle+'">'+itemsHtml+'</div>'
    +'</div>';
}

function renameLoraCol(id){
  const col=loraCols.find(c=>c.id===id);if(!col)return;
  showInlinePrompt('Rename collection:',col.label,name=>{
    if(!name||!name.trim())return;
    col.label=name.trim();
    appData.loraCols=[...loraCols];
    saveAppData();renderLoraNav();renderLoraTab();
  });
}
function deleteLoraCol(id){
  const col=loraCols.find(c=>c.id===id);if(!col)return;
  showInlineConfirm('Delete "'+col.label+'"? LoRAs move to Uncategorized.',()=>{
    loraCols=loraCols.filter(c=>c.id!==id);
    appData.loraCols=[...loraCols];
    saveAppData();renderLoraNav();renderLoraTab();
  });
}
function promptAddToCol(colId){
  // Open lpopup isn't ideal here - just show a small prompt for now
  // Better UX: drag LoRA chip/card onto collection in sidebar (future)
  const name=prompt('Enter LoRA filename to add (or use drag-to-collect in a future update):');
  if(!name)return;
  const lora=loraList.find(l=>l.file_name.toLowerCase().includes(name.toLowerCase()));
  if(!lora){alert('LoRA not found');return;}
  const col=loraCols.find(c=>c.id===colId);
  if(!col)return;
  if(!col.keys.includes(lora.file_name))col.keys.push(lora.file_name);
  appData.loraCols=[...loraCols];
  saveAppData();renderLoraNav();renderLoraTab();
}

function toggleAdult(){
  showAdult=!showAdult;
  document.querySelectorAll('#ladult-btn').forEach(b=>{
    b.classList.toggle('adult-active',showAdult);
    b.classList.toggle('active',showAdult);
  });
  renderLoraNav();
  renderLoraTab();
  // Re-search browse results with updated nsfw param
  if(_loraMode==='browse')doBrowseSearch();
}

// ===================== LORA CONTEXT MENU =====================
let _ctxKey=null,_ctxName=null;
function openLoraCtx(key,name,e){
  e.preventDefault();e.stopPropagation();
  _ctxKey=key;_ctxName=name;
  const menu=document.getElementById('lora-ctx-menu');
  document.getElementById('ctx-lora-name').textContent=name.length>22?name.slice(0,20)+'...':name;
  // Enable/disable item
  const enableItem=document.getElementById('ctx-enable-item');
  const isEnabled=!!activeLoRAs[key];
  enableItem.textContent=isEnabled?'✓ Enabled — Disable':'▷ Enable';
  enableItem.style.color=isEnabled?'var(--green)':'var(--text)';
  // Fav item
  const lora=loraList.find(l=>l.file_name===key);
  const favItem=document.getElementById('ctx-fav-item');
  const isFav=lora&&lora.favorite;
  favItem.textContent=isFav?'★ Unfavorite':'★ Favorite';
  favItem.style.color=isFav?'var(--amber)':'var(--text)';
  // Status items - always show all 3 dots, bold the active one
  const currentStatus=getLoraStatus(key);
  const statusColors={verified:'var(--green)',testing:'#2563EB',bad:'var(--red)'};
  const statusDotColors={verified:'rgba(52,211,153,.9)',testing:'rgba(96,165,250,.9)',bad:'rgba(248,113,113,.9)'};
  const statusLabels={verified:'Verified',testing:'Testing',bad:'Bad / Remove'};
  ['verified','testing','bad'].forEach(s=>{
    const el=document.getElementById('ctx-status-'+s);
    if(!el)return;
    const isActive=currentStatus===s;
    const dot=`<span style="width:10px;height:10px;border-radius:50%;background:${statusDotColors[s]};flex-shrink:0;display:inline-block;"></span>`;
    el.innerHTML=dot+(isActive?`<strong>${statusLabels[s]}</strong>`:statusLabels[s]);
    el.style.color=isActive?statusColors[s]:'var(--text)';
    el.style.fontWeight=isActive?'600':'';
  });
  // Cleaned item
  const cleanedEl=document.getElementById('ctx-cleaned');
  if(cleanedEl){
    const isCleaned=!!getLora(key).cleaned;
    const dot='<span style="width:10px;height:10px;border-radius:50%;background:rgba(234,179,8,.9);flex-shrink:0;display:inline-block;"></span>';
    cleanedEl.innerHTML=dot+(isCleaned?'<strong>Cleaned</strong>':'Cleaned');
    cleanedEl.style.color=isCleaned?'rgb(234,179,8)':'var(--text)';
    cleanedEl.style.fontWeight=isCleaned?'600':'';
  }
  // Collections submenu
  const cols=document.getElementById('ctx-collections');
  if(loraCols.length){
    cols.innerHTML='<div style="padding:4px 12px 2px;font-family:var(--mono);font-size:9px;color:var(--muted2);letter-spacing:.08em;">ADD TO COLLECTION</div>'
      +loraCols.map(c=>{
        const inCol=c.keys.includes(key);
        return '<div onclick="ctxToggleCol(\'' +c.id+ '\',event)" style="padding:6px 12px 6px 20px;font-size:12px;cursor:pointer;color:'+(inCol?'var(--orange)':'var(--text)')+';" class="ctx-item">'+(inCol?'✓ ':'')+c.label+'</div>';
      }).join('')+'<div style="height:1px;background:var(--border);margin:4px 0;"></div>';
  }else{
    cols.innerHTML='';
  }
  // Position
  const margin=8;
  let left=e.clientX;let top=e.clientY;
  menu.style.display='block';
  const mw=menu.offsetWidth||170;const mh=menu.offsetHeight||120;
  left=Math.max(margin,Math.min(left,window.innerWidth-mw-margin));
  top=Math.max(margin,Math.min(top,window.innerHeight-mh-margin));
  menu.style.left=left+'px';menu.style.top=top+'px';
}
let _ctxJustClosed=false;
function closeLoraCtx(){
  if(document.getElementById('lora-ctx-menu').style.display==='none')return;
  document.getElementById('lora-ctx-menu').style.display='none';
  _ctxKey=null;
  // Flag so the card click that dismissed the menu doesn't also toggle the card
  _ctxJustClosed=true;
  setTimeout(()=>{_ctxJustClosed=false;},50);
}
function ctxToggleFav(){
  if(!_ctxKey)return;
  const lora=loraList.find(l=>l.file_name===_ctxKey);
  if(!lora)return;
  lora.favorite=!lora.favorite;
  setLora(_ctxKey,{favorite:lora.favorite});
  saveAppData();
  // Update card in place
  const card=document.getElementById('lcard-'+sl(_ctxKey));
  if(card){
    let favBtn=card.querySelector('.lora-card-fav');
    if(lora.favorite){
      if(!favBtn){favBtn=document.createElement('button');favBtn.className='lora-card-fav active';favBtn.setAttribute('onclick','toggleCardFav(\''+eq(_ctxKey)+'\',event)');card.appendChild(favBtn);}
      favBtn.style.display='';favBtn.textContent='★';favBtn.classList.add('active');
    }else{if(favBtn)favBtn.style.display='none';}
    const adultBadge=card.querySelector('.lora-card-adult');
    if(adultBadge)adultBadge.classList.toggle('has-fav',lora.favorite);
  }
  closeLoraCtx();
}
function ctxToggleEnable(){
  if(!_ctxKey)return;
  if(activeLoRAs[_ctxKey])delete activeLoRAs[_ctxKey];
  else activeLoRAs[_ctxKey]={name:_ctxName,weight:0.8};
  updateOutput();updateLoraStats();renderLoraTab();closeLoraCtx();
}
function ctxOpenInfo(){
  if(!_ctxKey)return;
  const key=_ctxKey;
  const card=document.getElementById('lcard-'+sl(key));
  const rect=card?card.getBoundingClientRect():null;
  closeLoraCtx();
  // Delay so the document click handler (closePopups) fires first and doesn't immediately close the lpopup
  setTimeout(()=>{
    const fakeE={
      preventDefault:()=>{},
      stopPropagation:()=>{},
      clientX:rect?Math.min(rect.left+rect.width/2,window.innerWidth-280):window.innerWidth/2,
      clientY:rect?Math.min(rect.top+40,window.innerHeight-500):window.innerHeight/2
    };
    openLpPopup(key,fakeE);
  },10);
}
function ctxToggleAdult(){
  if(!_ctxKey)return;
  setLora(_ctxKey,{adult:!getLora(_ctxKey).adult});
  saveAppData();renderLoraTab();closeLoraCtx();
}
function ctxSetStatus(status){
  if(!_ctxKey)return;
  const cur=getLora(_ctxKey).status;
  setLora(_ctxKey,{status:cur===status?null:status});
  if(cur===status)delete appData.loraData[_ctxKey].status;
  saveAppData();
  updateStatusBadge(_ctxKey);
  closeLoraCtx();
}
function ctxToggleCleaned(){
  if(!_ctxKey)return;
  const cur=!!getLora(_ctxKey).cleaned;
  setLora(_ctxKey,{cleaned:!cur});
  if(cur)delete appData.loraData[_ctxKey].cleaned;
  else resetAutoTagsForLora(_ctxKey);
  saveAppData();
  updateCleanedBadge(_ctxKey);
  closeLoraCtx();
}
function ctxToggleCol(colId,e){
  e.stopPropagation();
  const col=loraCols.find(c=>c.id===colId);if(!col||!_ctxKey)return;
  if(col.keys.includes(_ctxKey)){col.keys=col.keys.filter(k=>k!==_ctxKey);}
  else{col.keys.push(_ctxKey);}
  appData.loraCols=[...loraCols];
  saveAppData();renderLoraNav();renderLoraTab();
  closeLoraCtx();
}

function toggleLpVerified(){
  if(!currentLPKey)return;
  const current=getLoraStatus(currentLPKey);
  const next=current==='verified'?null:'verified';
  setLora(currentLPKey,{status:next});
  if(!next)delete appData.loraData[currentLPKey].status;
  const btn=document.getElementById('lp-verified-btn');
  const isV=next==='verified';
  if(btn){btn.style.opacity=isV?'1':'0.5';btn.style.color=isV?'var(--green)':'';}
  saveAppData();
  updateStatusBadge(currentLPKey);
}

function toggleLpAdult(){
  if(!currentLPKey)return;
  const next=!getLora(currentLPKey).adult;
  setLora(currentLPKey,{adult:next});
  saveAppData();
  renderLoraTab();
  // Don't auto-close panel - let user close manually
}

function setLoraView(v){
  loraView=v;
  document.getElementById('lview-chip')?.classList.toggle('active',v==='chip');
  document.getElementById('lview-card')?.classList.toggle('active',v==='card');
  renderLoraTab();
}

function setLoraTabFilter(f){
  loraFilter=f;
  document.getElementById('ltf-all')?.classList.toggle('active',f==='all');
  document.getElementById('ltf-fav')?.classList.toggle('active',f==='fav');
  // Also sync main lgrid filter buttons
  document.getElementById('lf-all')?.classList.toggle('active',f==='all');
  document.getElementById('lf-fav')?.classList.toggle('active',f==='fav');
  renderLoraTab();
}

function clearLoraSearch(){
  const s=document.getElementById('lsearch-tab');
  if(s)s.value='';
  const x=document.getElementById('lsearch-clear');
  if(x)x.style.display='none';
  renderLoraTab();
}

function onLoraSearch(){
  const s=document.getElementById('lsearch-tab');
  const x=document.getElementById('lsearch-clear');
  if(x)x.style.display=s&&s.value?'block':'none';
  renderLoraTab();
}
function cycleVerifiedFilter(){
  const cycle={all:'verified',verified:'unverified',unverified:'all'};
  verifiedFilter=cycle[verifiedFilter];
  const btn=document.getElementById('ltf-verified');
  if(btn){
    const labels={all:'Verified: All',verified:'Verified: ✓',unverified:'Verified: ?'};
    btn.textContent=labels[verifiedFilter];
    btn.classList.toggle('active',verifiedFilter!=='all');
  }
  renderLoraTab();
}

function toggleCleanedFilter(){
  const cycle={all:'uncleaned',uncleaned:'cleaned',cleaned:'all'};
  cleanedFilter=cycle[cleanedFilter];
  const btn=document.getElementById('ltf-cleaned');
  if(btn){
    const labels={all:'Cleaned: All',cleaned:'Cleaned: ✓',uncleaned:'Cleaned: ✗'};
    btn.textContent=labels[cleanedFilter];
    btn.classList.toggle('active',cleanedFilter!=='all');
  }
  renderLoraTab();
}

function refreshEnabledSection(){
  const gr=document.getElementById('lora-tab-grid');
  if(!gr)return;
  const existing=document.getElementById('lsec-__enabled');
  const enabledItems=Object.keys(activeLoRAs)
    .map(k=>loraList.find(l=>l.file_name===k))
    .filter(Boolean);
  if(!enabledItems.length){
    if(existing)existing.remove();
    return;
  }
  const html=mkLoraSection('__enabled','Enabled · '+enabledItems.length,enabledItems,true,'#86efac');
  if(existing){existing.outerHTML=html;}
  else{gr.insertAdjacentHTML('afterbegin',html);}
}

function renderLoraTab(){
  const gr=document.getElementById('lora-tab-grid');
  const st=document.getElementById('lrstatus-tab');
  if(!gr)return;
  if(!loraList.length){
    gr.innerHTML='<p style="color:var(--muted);font-size:12px;font-family:var(--mono);padding:20px 0;">Click ↺ Reload to scan your LoRAs.</p>';
    return;
  }
  const search=(document.getElementById('lsearch-tab')?.value||'').toLowerCase();
  const hideBrutCols=!showAdult||document.body.classList.contains('hide-brut');
  const brutColKeys=hideBrutCols?new Set(loraCols.filter(c=>isColBrut(c.id)).flatMap(c=>c.keys)):null;
  const allItems=loraList.filter(l=>{
    if(!getLoraModels(l).includes(model))return false;
    if(loraFilter==='fav'&&!l.favorite)return false;
    if(!showAdult&&getLora(l.file_name).adult)return false;
    if(brutColKeys&&brutColKeys.has(l.file_name))return false;
    if(verifiedFilter==='verified'&&getLoraStatus(l.file_name)!=='verified')return false;
    if(verifiedFilter==='unverified'&&getLoraStatus(l.file_name)==='verified')return false;
    if(cleanedFilter==='cleaned'&&!getLora(l.file_name).cleaned)return false;
    if(cleanedFilter==='uncleaned'&&getLora(l.file_name).cleaned)return false;
    if(search){
      const nameMatch=l.model_name.toLowerCase().includes(search);
      const folderMatch=(l.folder||'').toLowerCase().includes(search);
      const notesMatch=(getLora(l.file_name).notes||'').toLowerCase().includes(search);
      if(!nameMatch&&!folderMatch&&!notesMatch)return false;
    }
    return true;
  });
  if(st)st.textContent=loraList.length+' loaded';
  if(!allItems.length){gr.innerHTML='<p style="color:var(--muted);font-size:12px;font-family:var(--mono);padding:20px 0;">No LoRAs match.</p>';return;}

  // Active-LoRAs section — pinned at the top, only shown when there are any.
  // Bypasses search/filters so the user can always see what's enabled.
  const enabledItems=Object.keys(activeLoRAs)
    .map(k=>loraList.find(l=>l.file_name===k))
    .filter(Boolean);
  const enabledHtml=enabledItems.length
    ?mkLoraSection('__enabled','Enabled · '+enabledItems.length,enabledItems,true,'#86efac')
    :'';

  // If no collections or searching, render flat
  if(!loraCols.length||search){
    if(loraView==='card'){
      gr.className='';
      gr.innerHTML=enabledHtml+'<div class="lora-card-grid" id="lsec-__all">'+allItems.map(l=>mkLoraCard(l)).join('')+'</div>';
    }else{
      gr.className='';
      gr.style.maxHeight='none';
      gr.innerHTML=enabledHtml+'<div class="lgrid" id="lsec-__all" style="max-height:none;">'+allItems.map(l=>{
        const key=l.file_name;const isActive=!!activeLoRAs[key];
        const weight=activeLoRAs[key]?.weight||0.8;
        const folder=(l.folder||'').split('/').pop()||'';
        const type=getLoraType(l);
        const ek=eq(key);const en=eq(l.model_name);
        return '<div class="lchip'+(isActive?' active':'')+'" id="ltc-'+sl(key)+'"'
          +' onclick="toggleLoraTab(\'' +ek+ '\',\'' +en+ '\',event)">'
          +'<span class="lchip-name">'+l.model_name+'</span>'
          +(type?'<span class="lchip-type">'+type+'</span>':'')
          +'<input type="range" class="lchip-wslider" min="0.1" max="1.5" step="0.05" value="'+weight+'"'
          +' onclick="event.stopPropagation()" oninput="updateLoraW(\'' +ek+ '\',this.value,event)">'
          +'<span class="lchip-wval" id="ltw-'+sl(key)+'">'+parseFloat(weight).toFixed(2)+'</span>'
          +'</div>';
      }).join('')+'</div>';
    }
    renderLoraCollectionTabs();
    return;
  }

  // Render grouped by collection
  gr.className='';
  gr.style.maxHeight='';
  let sectionsHtml=enabledHtml+'<div id="lsec-__all"></div>';
  const loraByKey=new Map(allItems.map(l=>[l.file_name,l]));
  loraCols.forEach(col=>{
    if(hideBrutCols&&isColBrut(col.id))return;
    const colItems=col.keys.map(k=>loraByKey.get(k)).filter(Boolean);
    sectionsHtml+=mkLoraSection(col.id,col.label,colItems,true); // show even if empty
  });
  const uncatItems=allItems.filter(l=>!loraCols.some(c=>c.keys.includes(l.file_name)));
  if(uncatItems.length){
    sectionsHtml+=mkLoraSection('__uncat','Uncategorized',uncatItems,false);
  }
  gr.innerHTML=sectionsHtml;
  renderLoraCollectionTabs();
}

function copyCardTw(key,e){
  e.stopPropagation();
  e.preventDefault();
  const storedTw=getLora(key).triggers;
  const lora=loraList.find(l=>l.file_name===key);
  const apiTw=lora&&lora.civitai&&lora.civitai.trainedWords&&lora.civitai.trainedWords.length?lora.civitai.trainedWords.join(', '):'';
  const tw=storedTw!==undefined?storedTw:apiTw;
  if(!tw)return;
  navigator.clipboard.writeText(tw);
  const btn=e.currentTarget;const orig=btn.textContent;
  btn.textContent='Copied!';btn.classList.add('copied');
  setTimeout(()=>{btn.textContent=orig;btn.classList.remove('copied');},1200);
}

function getLoraTypeColor(type){
  switch((type||'').toLowerCase()){
    case 'character': return '#22d3ee';
    case 'style':     return '#a855f7';
    case 'clothing':  return '#ec4899';
    case 'pose':      return '#4ade80';
    case 'concept':   return '#f97316';
    default:          return 'rgba(255,255,255,0.07)';
  }
}
function getLoraTypeClass(type){
  switch((type||'').toLowerCase()){
    case 'character': return 'type-character';
    case 'style':     return 'type-style';
    case 'clothing':  return 'type-clothing';
    case 'pose':      return 'type-pose';
    case 'concept':   return 'type-concept';
    default:          return '';
  }
}

function mkLoraCard(l){
  const key=l.file_name;
  const d=getLora(key);
  const isActive=!!activeLoRAs[key];
  const type=getLoraType(l);
  const typeClass=getLoraTypeClass(type);
  const isAdult=d.adult;
  const customImg=d.image;
  const rawSrc=l.preview_url?(l.preview_url.startsWith('/api/')?'/'+l.preview_url.replace(/^\//,''):l.preview_url):null;
  const imgSrc=customImg||rawSrc;
  const ek=eq(key);const en=eq(l.model_name);
  const enableLabel=isActive?'✓ Enabled':'Enable';
  const imgHtml=imgSrc
    ?'<img class="lora-card-img" draggable="false" loading="lazy" src="'+imgSrc+'" onerror="this.outerHTML=\'<div class=lora-card-img-placeholder>No preview</div>\'">'
    :'<div class="lora-card-img-placeholder">No preview</div>';
  const statusCls=getStatusClass(key);
  const favBtn='<button class="lora-card-fav'+(l.favorite?' active':'')+'" onclick="toggleCardFav(\''+ek+'\',event)">★</button>';
  const adultBadge=isAdult?'<span class="lora-card-adult" title="Brut"></span>':'';
  const promptBadge=hasPromptData(key)?'<span class="lora-card-prompt-badge">P</span>':'';
  const enableBtn='<button class="lora-card-enable'+(isActive?' active':'')+'" id="lcen-'+sl(key)+'" onclick="toggleLoraTab(\''+ek+'\',\''+en+'\',event)">'+enableLabel+'</button>';
  const cleanedClass=d.cleaned?' cleaned':'';
  const infoBtn='<button class="lora-card-info-btn'+cleanedClass+'" onclick="openLpPopup(\''+ek+'\',event)">i</button>';
  return '<div class="lora-card'+(isActive?' active':'')+(typeClass?' '+typeClass:'')+(isAdult?' brut-card':'')+(statusCls?' '+statusCls:'')+'" id="lcard-'+sl(key)+'"'
    +' data-key="'+ek+'"'
    +' draggable="true"'
    +' onclick="cardClick(\''+ek+'\',event)"'
    +' ondragstart="cardDragStart(event,\''+ek+'\')"'
    +' ondragover="cardDragOver(event,\''+ek+'\')"'
    +' ondragleave="cardDragLeave(event)"'
    +' ondrop="cardDrop(event)"'
    +' ondragend="cardDragEnd(event)"'
    +' oncontextmenu="openLoraCtx(\''+ek+'\',\''+en+'\',event)">'
    +imgHtml
    +favBtn
    +adultBadge
    +'<div class="lora-card-overlay"></div>'
    +'<div class="lora-card-footer">'
    +'<div class="lora-card-name-row"><div class="lora-card-name">'+l.model_name+'</div>'
    +(type?'<div class="lora-card-type">'+type+'</div>':'')
    +promptBadge
    +'</div>'
    +'<div class="lora-card-actions">'+enableBtn+infoBtn+'</div>'
    +'</div>'
    +'</div>';
}

function cardClick(key,e){
  if(e.target.closest('button,input'))return;
  openLpPopup(key,e);
}
function toggleLoraTabGuarded(key,name,e){
  closeLoraCtx();
  if(_ctxJustClosed){e&&e.stopPropagation();return;}
  if(_cardJustDropped){_cardJustDropped=false;e&&e.stopPropagation();return;}
  toggleLoraTab(key,name,e);
}
function toggleLoraTab(key,name,e){
  e&&e.stopPropagation();
  if(activeLoRAs[key])delete activeLoRAs[key];
  else{
    // Use saved default strength if available, otherwise 0.8
    const savedStrength=getLora(key).strength;
    activeLoRAs[key]={name,weight:savedStrength||0.8};
  }
  const isNowActive=!!activeLoRAs[key];
  // Update chip and card in tab — querySelectorAll because the Enabled section
  // and the collection section can both contain the same key, so IDs duplicate.
  // getElementById would only hit the first match and miss the other.
  const slk=sl(key);
  document.querySelectorAll('[id="ltc-'+slk+'"]').forEach(el=>el.classList.toggle('active',isNowActive));
  document.querySelectorAll('[id="lcard-'+slk+'"]').forEach(el=>el.classList.toggle('active',isNowActive));
  document.querySelectorAll('[id="lcen-'+slk+'"]').forEach(el=>{
    el.textContent=isNowActive?'✓ Enabled':'Enable';
    el.classList.toggle('active',isNowActive);
  });
  // Update footer lgrid chip
  document.getElementById('lc-'+slk)?.classList.toggle('active',isNowActive);
  refreshEnabledSection();
  updateOutput();updateLoraStats();
}

function copyCardName(key,name,e){
  e.stopPropagation();
  // Copy the actual filename (key), not the display name
  navigator.clipboard.writeText(key);
  const nameEl=document.querySelector('#lcard-'+sl(key)+' .lora-card-name');
  if(nameEl){const orig=nameEl.textContent;nameEl.textContent='Copied!';setTimeout(()=>nameEl.textContent=orig,1200);}
}

function toggleCardFav(key,e){
  e.stopPropagation();
  const lora=loraList.find(l=>l.file_name===key);
  if(!lora)return;
  lora.favorite=!lora.favorite;
  setLora(key,{favorite:lora.favorite});
  saveAppData();
  const card=document.getElementById('lcard-'+sl(key));
  if(card){
    // Show/hide fav button
    let favBtn=card.querySelector('.lora-card-fav');
    if(lora.favorite){
      if(!favBtn){
        favBtn=document.createElement('button');
        favBtn.className='lora-card-fav active';
        favBtn.setAttribute('onclick','toggleCardFav(\''+eq(key)+'\',event)');
        card.appendChild(favBtn);
      }
      favBtn.style.display='';
      favBtn.textContent='★';
      favBtn.classList.add('active');
    }else{
      if(favBtn)favBtn.style.display='none';
    }
    // Reposition adult badge
    const adultBadge=card.querySelector('.lora-card-adult');
    if(adultBadge)adultBadge.classList.toggle('has-fav',lora.favorite);
  }
}

let _cardDragSrc=null;
let _cardJustDropped=false;

function cardDragStart(e,key){
  _cardDragSrc=key;
  _cardJustDropped=false;
  e.dataTransfer.effectAllowed='move';
  e.dataTransfer.setData('text/plain',key);
  document.querySelector('.lora-card[data-key="'+key+'"]')?.classList.add('dragging');
}

function cardDragOver(e,key){
  e.preventDefault();
  if(key===_cardDragSrc)return;
  document.querySelectorAll('.lora-card.drag-over').forEach(el=>el.classList.remove('drag-over'));
  // Use closest to handle drops on child elements
  const card=e.target.closest('.lora-card');
  if(card)card.classList.add('drag-over');
}

function cardDragLeave(e){
  // Only remove if actually leaving the card, not just moving between children
  if(!e.currentTarget.contains(e.relatedTarget)){
    e.currentTarget.classList.remove('drag-over');
  }
}

function cardDrop(e){
  e.preventDefault();
  e.stopPropagation();
  document.querySelectorAll('.lora-card.drag-over,.lora-card.dragging').forEach(el=>{
    el.classList.remove('drag-over','dragging');
  });
  // Use data-key attribute for reliable key lookup regardless of special chars
  const targetCard=e.target.closest('.lora-card');
  const resolvedTargetKey=targetCard?targetCard.getAttribute('data-key'):null;
  const srcKey=_cardDragSrc||e.dataTransfer.getData('text/plain');
  if(!srcKey||!resolvedTargetKey||srcKey===resolvedTargetKey){_cardDragSrc=null;return;}
  const srcCol=loraCols.find(c=>c.keys.includes(srcKey));
  if(!srcCol){_cardDragSrc=null;return;}
  if(!srcCol.keys.includes(resolvedTargetKey)){_cardDragSrc=null;return;}
  const fi=srcCol.keys.indexOf(srcKey);
  const ti=srcCol.keys.indexOf(resolvedTargetKey);
  if(fi===-1||ti===-1){_cardDragSrc=null;return;}
  srcCol.keys.splice(fi,1);
  srcCol.keys.splice(ti,0,srcKey);
  appData.loraCols=[...loraCols];
  saveAppData();
  _cardJustDropped=true;
  _cardDragSrc=null;
  renderLoraTab();
}

function cardDragEnd(e){
  document.querySelectorAll('.lora-card.drag-over,.lora-card.dragging').forEach(el=>{
    el.classList.remove('drag-over','dragging');
  });
  _cardDragSrc=null;
}

// ===================== SETTINGS =====================
function loadSettings(){
  const s=appData.settings||{};
  document.getElementById('set-raw-folder').value=s.rawFolder||'';
  document.getElementById('set-approved-folder').value=s.approvedFolder||'';
  document.getElementById('set-card-size').value=s.defaultCardSize||'small';
  document.getElementById('set-comfyui-name').value=s.comfyuiAppName||'';
  document.getElementById('set-civitai-key').value=s.civitaiApiKey||'';
  document.getElementById('set-hide-brut').value=s.hideBrut?'hide':'show';
  // Tab visibility checkboxes
  const hidden=s.hiddenTabs||['history','presets'];
  document.getElementById('set-tab-checkpoints').checked=!hidden.includes('checkpoints');
  document.getElementById('set-tab-history').checked=!hidden.includes('history');
  document.getElementById('set-tab-presets').checked=!hidden.includes('presets');
  loadMaleBiasSettings();
  loadAutoNegSettings();
}
function saveSetting(key,value){
  if(!appData.settings)appData.settings={};
  appData.settings[key]=value;
  saveAppData();
}
function toggleTabVisibility(tabName,visible){
  const s=appData.settings||{};
  let hidden=s.hiddenTabs||['history','presets'];
  if(visible)hidden=hidden.filter(t=>t!==tabName);
  else if(!hidden.includes(tabName))hidden.push(tabName);
  saveSetting('hiddenTabs',hidden);
  applyTabVisibility();
}
function applyTabVisibility(){
  const hidden=(appData.settings?.hiddenTabs)||['history','presets'];
  document.querySelectorAll('.tab[data-tab]').forEach(el=>{
    const name=el.dataset.tab;
    if(['tags','loras','gallery'].includes(name))return;
    el.style.display=hidden.includes(name)?'none':'';
  });
}
function applyBrutSetting(hide){
  if(hide===undefined)hide=!!(appData.settings?.hideBrut);
  else saveSetting('hideBrut',hide);
  document.body.classList.toggle('hide-brut',hide);
  if(hide&&showAdult){showAdult=false;}
  if(hide&&showGalleryAdult){showGalleryAdult=false;}
  renderLoraGrid();
  renderLoraNav();
  renderLoraTab();
  renderGallery();
  renderGalleryAlbumTabs();
  // Force brut buttons hidden/shown in titlebar
  const _bb=document.getElementById('tags-brut-btn');
  const _lb=document.getElementById('ladult-btn');
  const _gb=document.getElementById('gsc-brut');
  if(_bb&&_bb.style.display!=='none')_bb.style.display=hide?'none':'';
  if(_lb&&_lb.style.display!=='none')_lb.style.display=hide?'none':'';
  if(_gb&&_gb.style.display!=='none')_gb.style.display=hide?'none':'';
}

// ===================== CHANGELOG =====================
const CHANGELOG=[
  {version:'v3.11',date:'May 15, 2026',entries:[
    {tag:'new',text:'Generation timing — captures how long each generation takes via WebSocket, shows ⏱ in gallery detail and metadata grid'},
    {tag:'new',text:'img2img — use any gallery image as a starting point. Denoise slider controls how much the model deviates from the source'},
  ]},
  {version:'v3.10',date:'April 22, 2026',entries:[
    {tag:'new',text:'Gallery auto-refresh — polls every 3s while the Gallery tab is active, picks up new images automatically'},
    {tag:'new',text:'Gallery design direction notes captured in CONTEXT.md for the upcoming redesign'},
    {tag:'change',text:'Right-side panel widened to 420px with tighter layout so the full prompt + send area fits without scrolling'},
    {tag:'change',text:'Layout toggle moved next to Clear all — right where the prompt area actually lives'},
    {tag:'fix',text:'Right-side panel layout toggle actually works now — CSS was using descendant selectors but the footer is a sibling of .app'},
    {tag:'fix',text:'Right-side panel no longer leaks onto LoRAs/Gallery/Checkpoints tabs'},
    {tag:'fix',text:'Dead 420px gap on non-Tags tabs when layout-right is on — main content reclaims the space'},
  ]},
  {version:'v3.9',date:'April 22, 2026',entries:[
    {tag:'new',text:'LoRA trigger chips — * prefix = required (auto-injects), no prefix = click-to-toggle optional'},
    {tag:'new',text:'Auto-migration: single-trigger LoRAs get their one word marked * automatically on load'},
    {tag:'new',text:'Bulk "★ all" / "all opt" buttons in LoRA panel edit mode for fast multi-trigger marking'},
    {tag:'new',text:'Right-side panel layout — toggle ⬒ in the toolbar flips prompt area to a 360px right column'},
    {tag:'fix',text:'Remix no longer locks the checkpoint dropdown — you can change it freely after remixing'},
    {tag:'fix',text:'Remix model-detection: Illustrious images with score_9 tokens no longer get misflagged as Pony'},
    {tag:'fix',text:'Clear all now drops the "remix negative locked" pill and trigger selections too'},
  ]},
  {version:'v3.8',date:'April 22, 2026',entries:[
    {tag:'new',text:'Send to ComfyUI — generate directly from the prompt builder, no more copy/paste'},
    {tag:'new',text:'Send panel: checkpoint dropdown, W×H, steps, CFG, sampler, scheduler, seed (blank = random)'},
    {tag:'new',text:'Multi-LoRA support — chains as many LoraLoader nodes as you have active LoRAs'},
    {tag:'new',text:'Remix from gallery now also pre-fills checkpoint, dimensions, and all KSampler settings'},
    {tag:'new',text:'Custom checkpoint display names — rename pencil on each Checkpoint card'},
    {tag:'new',text:'Toast notifications (top-right) for Sent / queue depth / errors, with manual dismiss'},
    {tag:'fix',text:'Checkpoint dropdown filtered against ComfyUI authoritative list — no more phantom entries'},
    {tag:'fix',text:'LoRA + checkpoint names resolved to full path+ext that ComfyUI actually expects'},
    {tag:'fix',text:'ComfyUI port corrected to 8000 for Desktop app (LoRA Manager rides inside ComfyUI)'},
  ]},
  {version:'v3.7',date:'April 13, 2026',entries:[
    {tag:'new',text:'Hide/Show from Dock toggle in tray menu'},
    {tag:'new',text:'App stays alive in tray when Cmd+Q — only Quit from tray truly exits'},
    {tag:'removed',text:'Python proxy removed — server is now pure Node.js inside Electron'},
    {tag:'new',text:'Settings tab with folder paths, gallery defaults, ComfyUI config'},
    {tag:'new',text:'Changelog tab'},
  ]},
  {version:'v3.6',date:'April 12, 2026',entries:[
    {tag:'new',text:'Menubar tray app — ComfyUI start/stop/hide, proxy controls, window toggle'},
    {tag:'new',text:'Arrow key navigation in gallery detail panel and lightbox'},
    {tag:'new',text:'PNG metadata extraction — prompts, checkpoint, LoRAs, seed, steps, CFG, sampler'},
    {tag:'new',text:'Metadata accordion panel in gallery detail view'},
    {tag:'change',text:'Large gallery cards reduced from 320px to 270px'},
  ]},
  {version:'v3.5',date:'April 12, 2026',entries:[
    {tag:'new',text:'Gallery bulk select mode — shift+click range select, floating action bar'},
    {tag:'new',text:'Gallery categories — one per image, sidebar nav, sectioned view, drag reorder'},
    {tag:'new',text:'Card size toggle — small/large view'},
    {tag:'new',text:'Brut (adult) filter unified across LoRA + Gallery with sidebar toggle'},
    {tag:'change',text:'Selection color changed from orange to blue'},
    {tag:'fix',text:'Context menu click-through fixed'},
    {tag:'fix',text:'Window bounds persistence fixed'},
    {tag:'fix',text:'Drag-over highlight for sidebar items'},
  ]},
  {version:'v3.4',date:'April 12, 2026',entries:[
    {tag:'new',text:'Gallery Phase 1 — thumbnail grid, 4-state review system, filters, lightbox'},
    {tag:'new',text:'Packaged as macOS .app with electron-builder'},
    {tag:'new',text:'App icon — double chevron in orange on dark background'},
    {tag:'change',text:'Prompt suffix moved to right of prefix below notes'},
  ]},
  {version:'v3.3',date:'April 2026',entries:[
    {tag:'new',text:'Electron app with auto-started proxy, hiddenInset titlebar, traffic lights'},
    {tag:'new',text:'Inline dialog system replacing native prompt/confirm'},
    {tag:'new',text:'Drag handle for window dragging'},
    {tag:'new',text:'Detail panel widened to 780px, 2-column scroll layout'},
    {tag:'change',text:'Status badges changed to colored dots'},
    {tag:'fix',text:'Sidebar close bug on wide monitors'},
    {tag:'fix',text:'LoRA preview images in Electron'},
    {tag:'fix',text:'Scrollbar light mode'},
  ]},
  {version:'v3.2',date:'April 2026',entries:[
    {tag:'fix',text:'Bad badge redesigned — white D on red background'},
    {tag:'fix',text:'Panel footer — view mode shows Close, edit mode shows Discard/Save'},
    {tag:'fix',text:'Drag to reorder within collections — respects saved key order'},
    {tag:'fix',text:'P badge repositioned to bottom-left of card image'},
  ]},
  {version:'v3.1',date:'April 2026',entries:[
    {tag:'new',text:'LoRA browser with card view, collections, drag reorder'},
    {tag:'new',text:'Detail panel with edit/view mode, image badges, lightbox'},
    {tag:'new',text:'Status system — verified, testing, bad'},
    {tag:'new',text:'Prompt assembly with LoRA prefix/suffix support'},
  ]},
];
function renderChangelog(){
  const el=document.getElementById('changelog-content');
  let html='';
  CHANGELOG.forEach(v=>{
    html+=`<div class="cl-entry"><h3>${v.version} — ${v.date}</h3><ul>`;
    v.entries.forEach(e=>{
      html+=`<li><span class="cl-tag ${e.tag}">${e.tag}</span>${e.text}</li>`;
    });
    html+='</ul></div>';
  });
  el.innerHTML=html;
}

// ===================== TABS =====================
function switchTab(tab){
  document.querySelectorAll('.tab[data-tab]').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  const tabEl=document.querySelector(`.tab[data-tab="${tab}"]`);
  if(tabEl)tabEl.classList.add('active');
  document.getElementById('panel-'+tab)?.classList.add('active');
  const app=document.querySelector('.app');
  app.classList.toggle('tags-tab-active', tab==='tags');
  app.classList.toggle('lora-tab-active', tab==='loras');
  app.classList.toggle('gallery-tab-active', tab==='gallery');
  app.classList.toggle('no-sidebar', ['history','checkpoints','train'].includes(tab));
  app.classList.toggle('footer-hidden', tab!=='tags');
  // v5 redesign: hide the entire right-panel grid column on non-Generate tabs
  app.classList.toggle('no-right-panel', tab!=='tags');
  if (tab === 'tags') { if (_genMode === 'video') app.classList.add('video-mode'); }
  else app.classList.remove('video-mode');
  renderNav();
  if(tab==='checkpoints')renderCheckpoints();
  if(tab==='loras'){renderLoraTab();updateFooterH();}
  else if(tab==='gallery'){app.classList.remove('sidebar-collapsed');loadGallery();startGalleryAutoPoll();renderRecentStrip();}
  else if(tab==='settings'){loadSettings();renderChangelog();}
  else if(tab==='train'){renderTrainTab();}
  else updateFooterH();
  if(tab==='tags'){renderRecentStrip();updateSendMeta();}
  // Stop auto-poll when leaving Gallery; hide back-to-top
  if(tab!=='gallery'){stopGalleryAutoPoll();updateBackToTopButton();}

  // Show the right brut button for the active tab (hidden in demo mode)
  const _hb=document.body.classList.contains('hide-brut');
  const _bb=document.getElementById('tags-brut-btn');if(_bb)_bb.style.display=(!_hb&&tab==='tags')?'':'none';
  const _lb=document.getElementById('ladult-btn');if(_lb)_lb.style.display=(!_hb&&tab==='loras')?'':'none';
  const _gb=document.getElementById('gsc-brut');if(_gb)_gb.style.display=(!_hb&&tab==='gallery')?'':'none';
  // Hide IMG/VID subtabs on non-Generate tabs
  const genSubtabs=document.querySelector('.gen-subtabs-titlebar');
  if(genSubtabs)genSubtabs.style.visibility=tab==='tags'?'':'hidden';

  // Recent strip polls for new images while on the Generate tab
  if(tab==='tags')startRecentPoll();
  else stopRecentPoll();
  // Close queue panel when leaving Generate tab
  if(tab!=='tags'&&_queuePanelOpen){_queuePanelOpen=false;const qj=document.getElementById('queue-jobs');if(qj)qj.classList.remove('open');const qb=document.getElementById('queue-panel-toggle');if(qb){qb.classList.remove('active');qb.textContent='jobs ▴';}}
  // Queue indicator only polls while Generate (tags) tab is visible
  if(tab==='tags')startQueuePoll();
  else stopQueuePoll();
}

// ===================== GENERATE MODE (IMAGE / VIDEO) =====================
let _genMode = 'image';

function switchGenMode(mode) {
  _genMode = mode;
  localStorage.setItem('cpg-gen-mode', mode);
  document.querySelectorAll('.gen-subtab').forEach(t => t.classList.toggle('active', (t.dataset.mode || t.textContent.trim().toLowerCase()) === mode));
  document.querySelectorAll('.gen-sub-image').forEach(el => el.classList.toggle('active', mode === 'image'));
  document.querySelectorAll('.gen-sub-video').forEach(el => el.classList.toggle('active', mode === 'video'));
  document.querySelector('.app')?.classList.toggle('video-mode', mode === 'video');
  const sendImg = document.querySelector('.send-config');
  const sendVid = document.getElementById('send-config-video');
  const i2iStrip = document.getElementById('img2img-strip');
  const loraPanel = document.querySelector('.panel-header');
  const panelBody = document.querySelector('.panel-body');
  if (sendImg) sendImg.style.display = mode === 'image' ? '' : 'none';
  if (sendVid) sendVid.style.display = mode === 'video' ? 'flex' : 'none';
  if (i2iStrip) i2iStrip.style.display = mode === 'image' && i2iStrip.classList.contains('active') ? '' : 'none';
  if (loraPanel) loraPanel.style.display = mode === 'image' ? '' : 'none';
  if (panelBody) panelBody.style.display = mode === 'image' ? '' : 'none';
  const sendBtn = document.getElementById('send-btn');
  if (sendBtn) sendBtn.textContent = mode === 'video' ? '→ Generate Video' : (_img2imgSource ? '⟳ Process' : '→ Process');
  if (mode === 'video') updateVideoFramesInfo();
  if (mode === 'video') renderVideoHints();
  updateSendMeta();
}

const VIDEO_MOTION_HINTS = [
  { label: 'slow motion', text: 'slow motion' },
  { label: 'timelapse', text: 'timelapse' },
  { label: 'camera pan left', text: 'camera slowly panning left' },
  { label: 'camera pan right', text: 'camera slowly panning right' },
  { label: 'push forward', text: 'camera pushing forward' },
  { label: 'pull back', text: 'camera pulling back' },
  { label: 'dolly zoom', text: 'dolly zoom effect' },
  { label: 'handheld', text: 'handheld camera movement' },
  { label: 'orbit', text: 'camera orbiting around subject' },
  { label: 'tilt up', text: 'camera tilting upward' },
  { label: 'static', text: 'static camera, locked off' },
  { label: 'aerial', text: 'aerial drone shot' },
  { label: 'close-up', text: 'close-up shot' },
  { label: 'wide shot', text: 'wide establishing shot' },
];

function renderVideoHints() {
  const el = document.getElementById('video-hint-chips');
  if (!el) return;
  el.innerHTML = VIDEO_MOTION_HINTS.map((h, i) =>
    `<button class="video-hint-chip" onclick="insertVideoHint(${i})">${h.label}</button>`
  ).join('');
}

function insertVideoHint(idx) {
  const hint = VIDEO_MOTION_HINTS[idx];
  if (!hint) return;
  const ta = document.getElementById('video-prompt');
  if (!ta) return;
  const v = ta.value.trim();
  ta.value = v ? v + ', ' + hint.text : hint.text;
  ta.focus();
}

function updateVideoFramesInfo() {
  const frames = parseInt(document.getElementById('vcfg-frames')?.value) || 81;
  const fps = parseInt(document.getElementById('vcfg-fps')?.value) || 16;
  const secs = (frames / fps).toFixed(1);
  const valid = (frames - 1) % 4 === 0;
  const el = document.getElementById('vcfg-frames-info');
  if (el) el.textContent = `${frames} frames = ~${secs}s at ${fps}fps` + (valid ? '' : ' ⚠ must be 4n+1');
}

function randomVideoSeed() {
  document.getElementById('vcfg-seed').value = Math.floor(Math.random() * 2147483647);
}

function isVideoSeedLocked() {
  return document.getElementById('vseed-lock-btn')?.classList.contains('locked');
}

function toggleVideoSeedLock() {
  const btn = document.getElementById('vseed-lock-btn');
  if (!btn) return;
  const nowLocked = !btn.classList.contains('locked');
  btn.classList.toggle('locked', nowLocked);
  btn.title = nowLocked ? 'Seed locked — Send will reuse this seed' : 'Lock seed (don\'t randomize on send)';
  if (nowLocked) {
    const sf = document.getElementById('vcfg-seed');
    if (sf && !sf.value.trim()) randomVideoSeed();
  }
  localStorage.setItem('cpg-vseed-locked', nowLocked ? '1' : '0');
}

function restoreVideoSeedLock() {
  if (localStorage.getItem('cpg-vseed-locked') === '1') {
    const btn = document.getElementById('vseed-lock-btn');
    if (btn) btn.classList.add('locked');
  }
}

function pickVideoSource() {
  // placeholder — will wire to gallery picker or file input
}

// ===================== GALLERY AUTO-POLL =====================
// While the Gallery tab is active, poll the raw folder for new images. If a newer
// mtime shows up than we currently know about, re-run loadGallery(). Covers both
// app-sent generations and any ComfyUI runs the user kicks off outside this app.
let _galleryPollTimer=null;
let _galleryLastMtime=0;
let _recentPollTimer=null;
let _recentLastMtime=0;

function startGalleryAutoPoll(){
  stopGalleryAutoPoll();
  // Seed the baseline from whatever is currently loaded
  _galleryLastMtime=galleryImages.reduce((m,i)=>Math.max(m,i.mtime||0),0);
  _galleryPollTimer=setInterval(galleryPollTick,3000);
}

function stopGalleryAutoPoll(){
  if(_galleryPollTimer){clearInterval(_galleryPollTimer);_galleryPollTimer=null;}
}

async function galleryPollTick(){
  try{
    const r=await fetch('/gallery/list?folder=raw');
    if(!r.ok)return;
    const list=await r.json();
    if(!Array.isArray(list)||!list.length)return;
    const newest=list.reduce((m,i)=>Math.max(m,i.mtime||0),0);
    if(newest>_galleryLastMtime){
      _galleryLastMtime=newest;
      loadGallery(); // full reload handles all state/sort/filter correctly
    }
  }catch(e){}
}

// ===================== CLOSE POPUPS =====================
function closePopups(e){
  const wp=document.getElementById('wpopup');
  const tx=document.getElementById('tag-ex-popup');
  const ctx=document.getElementById('lora-ctx-menu');
  const gctx=document.getElementById('gallery-ctx-menu');
  if(!wp.contains(e.target))wp.classList.remove('visible');
  if(tx&&!tx.contains(e.target)&&!e.target.closest('.tag'))tx.classList.remove('visible');
  if(ctx&&!ctx.contains(e.target)){ctx.style.display='none';_ctxKey=null;}
  if(gctx&&!gctx.contains(e.target)){gctx.style.display='none';_galleryCtxFile=null;}
  const lmpop=document.getElementById('lora-meta-popover');
  if(lmpop&&lmpop.classList.contains('open')&&!lmpop.contains(e.target)&&!e.target.closest('.gdp-meta-chip'))closeLoraMetaPopover();
  const qjobs=document.getElementById('queue-jobs');
  if(_queuePanelOpen&&qjobs&&!qjobs.contains(e.target)&&!e.target.closest('#queue-panel-toggle')){_queuePanelOpen=false;qjobs.classList.remove('open');const qb=document.getElementById('queue-panel-toggle');if(qb){qb.classList.remove('active');qb.textContent='jobs ▴';}}
}


// ===================== LORA CUSTOM IMAGE =====================
async function handleLoraImgPick(event){
  const file=event.target.files[0];
  if(!file||!currentLPKey)return;
  const formData=new FormData();
  formData.append('file',file);
  formData.append('key',currentLPKey);
  try{
    const r=await fetch('/lora-image',{method:'POST',body:formData});
    const d=await r.json();
    if(d.url){
      setLora(currentLPKey,{image:d.url});
      await saveAppData();
      // Update popup image immediately
      const imgWrap=document.getElementById('lpopup-img-wrap');
      const img=imgWrap.querySelector('img');
      const newSrc=d.url+'?t='+Date.now();
      if(img){
        img.src=newSrc;
      }else{
        const placeholder=imgWrap.querySelector('.lpopup-img-placeholder');
        const newImg=document.createElement('img');
        newImg.className='lpopup-img';
        newImg.src=newSrc;
        if(placeholder)placeholder.replaceWith(newImg);
        else imgWrap.prepend(newImg);
      }
      imgWrap.dataset.lightboxSrc=newSrc;
      // Update card image in the grid
      const cardImg=document.querySelector('#lcard-'+sl(currentLPKey)+' .lora-card-img');
      if(cardImg)cardImg.src=newSrc;
      else{
        const cardPlaceholder=document.querySelector('#lcard-'+sl(currentLPKey)+' .lora-card-img-placeholder');
        if(cardPlaceholder){
          const newCardImg=document.createElement('img');
          newCardImg.className='lora-card-img';
          newCardImg.src=newSrc;
          cardPlaceholder.replaceWith(newCardImg);
        }
      }
      // Show reset button in overlay if not already there
      const overlay=imgWrap.querySelector('.lpopup-img-overlay');
      if(overlay&&!overlay.querySelector('[onclick*=reset]')){
        const btn=document.createElement('button');
        btn.textContent='Reset';
        btn.setAttribute('onclick','resetLoraImg()');
        overlay.appendChild(btn);
      }
    }
  }catch(err){console.error('Image upload failed',err);}
  event.target.value='';
}

async function resetLoraImg(){
  if(!currentLPKey)return;
  if(appData.loraData&&appData.loraData[currentLPKey])delete appData.loraData[currentLPKey].image;
  await saveAppData();
  const lora=loraList.find(l=>l.file_name===currentLPKey);
  if(lora)openLpPopup(currentLPKey,{preventDefault:()=>{},stopPropagation:()=>{},clientX:parseInt(document.getElementById('lpopup').style.left)+130,clientY:parseInt(document.getElementById('lpopup').style.top)+20});
}

// ===================== THEME =====================
function toggleTheme(){
  const light=document.body.classList.toggle('light');
  const btn=document.getElementById('theme-btn');
  if(btn)btn.classList.toggle('active',light);
  localStorage.setItem('cpg-theme',light?'light':'dark');
}

// ===================== DRAG LOCK =====================
function toggleDragLock(){
  const tabs=document.querySelector('.tabs');
  if(!tabs)return;
  const cur=tabs.style.webkitAppRegion||getComputedStyle(tabs).webkitAppRegion||'no-drag';
  const locked=cur==='no-drag';
  tabs.style.webkitAppRegion=locked?'drag':'no-drag';
  const btn=document.getElementById('drag-lock-btn');
  if(btn){btn.classList.toggle('active',!locked);btn.textContent=locked?'⊟':'⊞';}
}

// ===================== CIVITAI IN-APP BROWSER =====================
function openCivitAI(url){
  const defaultUrl=document.body.classList.contains('hide-brut')?'https://civitai.com':'https://civitai.red';
  if(window.promptGen&&window.promptGen.openCivitAI){
    window.promptGen.openCivitAI(url||defaultUrl);
  }else{
    window.open(url||defaultUrl,'_blank');
  }
}

// ===================== LORA FAVORITE + RENAME =====================
function toggleLpFav(){
  if(!currentLPKey)return;
  const lora=loraList.find(l=>l.file_name===currentLPKey);
  if(!lora)return;
  lora.favorite=!lora.favorite;
  setLora(currentLPKey,{favorite:lora.favorite});
  saveAppData();
  // Update card in place
  const card=document.getElementById('lcard-'+sl(currentLPKey));
  if(card){
    let favBtn=card.querySelector('.lora-card-fav');
    if(lora.favorite){
      if(!favBtn){favBtn=document.createElement('button');favBtn.className='lora-card-fav active';favBtn.setAttribute('onclick','toggleCardFav(\''+eq(currentLPKey)+'\',event)');card.appendChild(favBtn);}
      favBtn.style.display='';favBtn.textContent='★';favBtn.classList.add('active');
    }else{if(favBtn)favBtn.style.display='none';}
    const adultBadge=card.querySelector('.lora-card-adult');
    if(adultBadge)adultBadge.classList.toggle('has-fav',lora.favorite);
  }
  renderLoraGrid();
}

function toggleRenameRow(){
  const row=document.getElementById('lp-rename-row');
  const input=document.getElementById('lp-display-name');
  const visible=row.style.display!=='none';
  row.style.display=visible?'none':'block';
  if(!visible){
    const lora=loraList.find(l=>l.file_name===currentLPKey);
    const stored=getLora(currentLPKey).name;
    input.value=stored||lora?.model_name||'';
    input.focus();
  }
  // Reposition after content change
  const popup=document.getElementById('lpopup');
  requestAnimationFrame(()=>{
    const ph=popup.offsetHeight;
    const margin=12;
    const currentTop=parseInt(popup.style.top)||0;
    const maxTop=window.innerHeight-ph-margin;
    if(currentTop>maxTop) popup.style.top=Math.max(margin,maxTop)+'px';
  });
}


// ===================== DRAG TO REORDER TAGS =====================
let _dragSrcTag=null,_dragSrcCid=null;

// Event delegation for drag - attached to tags containers after render
function initDragOnContainer(cid){
  const con=document.getElementById('tags-'+cid);
  if(!con)return;
  con.addEventListener('dragstart',e=>{
    const el=e.target.closest('[data-tag]');
    if(!el)return;
    _dragSrcTag=el.getAttribute('data-tag');
    _dragSrcCid=el.getAttribute('data-cid');
    e.dataTransfer.effectAllowed='move';
    setTimeout(()=>el.classList.add('drag-over'),0);
  });
  con.addEventListener('dragend',e=>{
    const el=e.target.closest('[data-tag]');
    if(el)el.classList.remove('drag-over');
    document.querySelectorAll('.tag.drag-over').forEach(t=>t.classList.remove('drag-over'));
  });
  con.addEventListener('dragover',e=>{
    e.preventDefault();
    const el=e.target.closest('[data-tag]');
    document.querySelectorAll('.tag.drag-over').forEach(t=>t.classList.remove('drag-over'));
    if(el)el.classList.add('drag-over');
  });
  con.addEventListener('drop',e=>{
    e.preventDefault();e.stopPropagation();
    const el=e.target.closest('[data-tag]');
    document.querySelectorAll('.tag.drag-over').forEach(t=>t.classList.remove('drag-over'));
    if(!el||!_dragSrcTag)return;
    const dropTag=el.getAttribute('data-tag');
    const dropCid=el.getAttribute('data-cid');
    if(!dropTag||dropCid!==_dragSrcCid||dropTag===_dragSrcTag)return;
    const cat=categories.find(c=>c.id===dropCid);
    if(!cat)return;
    const base=(model!=='sdxl'&&cat.pony)?cat.pony:cat.tags;
    const deleted=(appData.deletedBuiltins&&appData.deletedBuiltins[dropCid])||[];
    let all=[...base.filter(t=>!deleted.includes(t)),...(customTags[dropCid]||[])];
    if(appData.tagOrder&&appData.tagOrder[dropCid]){
      const o=appData.tagOrder[dropCid];
      all=o.filter(t=>all.includes(t)).concat(all.filter(t=>!o.includes(t)));
    }
    const fi=all.indexOf(_dragSrcTag),ti=all.indexOf(dropTag);
    if(fi===-1||ti===-1)return;
    all.splice(fi,1);all.splice(ti,0,_dragSrcTag);
    if(!appData.tagOrder)appData.tagOrder={};
    appData.tagOrder[dropCid]=[...all];
    saveAppData();
    renderTagSections();
  });
}


// ===================== TAG EXAMPLE DATA =====================
const TAG_EXAMPLES = {
  // Lighting
  'dramatic studio lighting':{desc:'Hard directional light with controlled shadows, like a photography studio. Sculpts form with intent.'},
  'neon lit street at night':{desc:'Colored neon signs reflecting on wet pavement. Cyberpunk aesthetic, deep shadows with vivid color pops.'},
  'candlelight':{desc:'Warm flickering low light. Orange-yellow, intimate, shadows dance. Usually single small point source.'},
  'golden hour sunlight':{desc:'Warm orange-gold light from just after sunrise or before sunset. Long shadows, soft diffuse warmth.'},
  'bioluminescent light':{desc:'Glowing organic light — like deep sea creatures or glowing fungi. Blue-green otherworldly illumination.'},
  'rim lighting':{desc:'Light comes from behind the subject, creating a glowing outline or halo effect around the edges.'},
  'deep shadows':{desc:'Large areas of pure black. Details hidden, form suggested rather than shown. Moody and ominous.'},
  'harsh overhead light':{desc:'Light directly above — deep eye sockets, strong nose shadow, unflattering but dramatic. Interrogation lamp feel.'},
  'soft diffused light':{desc:'Even, shadowless illumination like an overcast day or through a diffuser. Gentle on skin, no hard edges.'},
  'moonlight':{desc:'Cool blue-silver light, low intensity. Soft shadows with a nighttime color cast. Quiet and ethereal.'},
  'fire light':{desc:'Warm orange-red with dancing shadows. Harsh near the source, falls off rapidly. Primal and unstable.'},
  'light from below':{desc:'Upward-casting light that inverts normal shadows. Unnatural and sinister — classic horror campfire effect.'},
  'colored gel lighting':{desc:'Theatrical colored light — cyan, magenta, amber gels over studio lights. Creates mood through tinted illumination.'},
  'split lighting':{desc:'One side of the face is lit, the other in shadow. Classic portrait technique for moody or dramatic shots.'},
  'chiaroscuro':{desc:'Extreme light/dark contrast. Deep blacks with precise bright highlights creating sculptural form. Caravaggio-style.'},
  'volumetric fog':{desc:'Light rays visible through atmospheric haze or mist. Creates god rays and a sense of depth.'},
  'overcast light':{desc:'Flat even illumination from a cloudy sky. No hard shadows, muted tones. Quietly melancholic.'},
  'dappled sunlight':{desc:'Irregular spots of light filtering through leaves or lattice. Organic pattern of light and shadow on surfaces.'},
  'twilight':{desc:'The blue hour — ambient sky glow after sunset. Cool purples and blues, no direct light source. Liminal.'},
  'window light':{desc:'Soft directional light from a window. Falls off across the room creating a natural gradient. Vermeer-style.'},
  'fluorescent light':{desc:'Flat greenish-white overhead lighting. Institutional, slightly unpleasant color cast. Office/hospital vibe.'},
  'screen glow':{desc:'Cool blue-white light from a monitor illuminating a face in darkness. Modern, isolated, nocturnal.'},
  'underwater caustics':{desc:'Dancing web-like light patterns from sunlight refracting through water surface. Shifts and ripples.'},
  'backlighting':{desc:'Main light source behind the subject. Silhouettes or glowing translucent edges depending on exposure.'},
  'high key lighting':{desc:'Bright, low-contrast, minimal shadows. Clean and airy. Fashion/beauty look with an optimistic feel.'},
  'low key lighting':{desc:'Mostly dark with selective highlights. High contrast, heavy shadows. Film noir, dramatic, tense.'},
  'silhouette lighting':{desc:'Subject is pure black shape against a bright background. All detail lost — only outline remains.'},
  'light painting':{desc:'Long-exposure streaks of light traced through the scene. Neon trails, glowing lines in darkness.'},
  'butterfly lighting':{desc:'Light directly in front and above the subject. Creates a small butterfly-shaped shadow under the nose. Glamour portrait standard.'},
  'Rembrandt lighting':{desc:'Small triangle of light on the shadowed cheek. Named after the painter. Classic portrait technique — dramatic but natural.'},
  // Camera / Focus
  'sharp focus':{desc:'Everything crisp and detailed. No blur anywhere — every edge is defined. Technical precision.'},
  'shallow depth of field':{desc:'Subject is sharp, background blurs into smooth bokeh. Draws focus to a single element.'},
  'motion blur':{desc:'Moving elements streak across the frame. Conveys speed and kinetic energy. Static parts stay sharp.'},
  'wide angle lens':{desc:'More of the scene visible with perspective distortion — edges stretch, space feels larger.'},
  'extreme close up':{desc:'Very tight crop on a small detail — an eye, a texture, fingertips. Context disappears.'},
  'low angle shot':{desc:'Camera placed low looking up. Makes subjects appear powerful or imposing.'},
  'birds eye view':{desc:'Looking straight down from above. Flattens the scene into a map-like composition.'},
  'dutch angle':{desc:'Camera tilted on its axis — horizon is diagonal, creates unease or tension.'},
  'anamorphic lens flare':{desc:'Horizontal blue/teal streaks of light. Cinematic flare created by anamorphic lenses used in film.'},
  'double exposure':{desc:'Two images blended into one — silhouette filled with a landscape, portrait overlaid with texture.'},
  'over-the-shoulder':{desc:'Camera behind one person looking toward another. Creates depth and relationship between subjects.'},
  'worm\'s eye view':{desc:'Extreme low angle looking almost straight up. Buildings tower, figures loom. Maximum dramatic distortion.'},
  'top-down':{desc:'Flat overhead view, like a tabletop layout. No perspective — everything reads as a 2D arrangement.'},
  'eye level':{desc:'Camera at the subject\'s eye height. Neutral, natural perspective. How we actually see people.'},
  'three-quarter view':{desc:'Subject turned about 45° from camera. Shows depth of the face/body. Most common portrait angle.'},
  'bokeh':{desc:'Out-of-focus light sources become soft glowing circles or shapes. Creamy, dreamy background quality.'},
  'macro':{desc:'Extreme magnification of tiny subjects — insects, water drops, textures. Reveals a world invisible at normal scale.'},
  'tilt-shift':{desc:'Selective focus plane that makes real scenes look like miniature models. Sharp center band, blur above and below.'},
  // Quality & Rating
  'masterpiece':{desc:'Highest quality tier tag. Tells the model to aim for its best output.'},
  'best quality':{desc:'Quality booster — pushes toward cleaner lines, better anatomy, more detail.'},
  'newest':{desc:'Biases toward newer training data aesthetics. Generally sharper, more modern look.'},
  'highres':{desc:'High resolution output. Encourages fine detail and crisp rendering.'},
  '4k':{desc:'4K resolution quality. Sharp details, clean edges, minimal artifacts.'},
  '8k':{desc:'Ultra high resolution. Extremely fine detail — can sometimes over-sharpen.'},
  '16k':{desc:'Maximum resolution tag. Use sparingly — can cause over-processing.'},
  'absurdres':{desc:'Absurdly high resolution. Maximum detail push — best paired with highres fix.'},
  'HDR':{desc:'High dynamic range — wider range between darks and lights. Vivid, punchy.'},
  'ultra detailed':{desc:'Pushes for maximum surface detail — every pore, thread, and texture.'},
  'sharp detail':{desc:'Crisp edges and defined textures. Anti-blur, anti-soft.'},
  'rating safe':{desc:'SFW content filter. No nudity, no suggestive content.'},
  'rating sensitive':{desc:'Mild suggestive content allowed. Swimwear, mild exposure.'},
  'rating explicit':{desc:'NSFW content filter. Full nudity and explicit content.'},
  // Physical Descriptors
  '1boy':{desc:'Single male figure. Core tag for male-focused generations.'},
  '2boys':{desc:'Two male figures in the scene. Interaction, contrast, or composition with two subjects.'},
  'lean':{desc:'Slim but toned build. Visible definition without bulk. Runner/swimmer body.'},
  'athletic':{desc:'Fit, active build. Moderate muscle definition, proportional.'},
  'muscular':{desc:'Noticeably built. Clear muscle definition, broad frame.'},
  'buff':{desc:'Very muscular. Large arms, thick chest, visible veins. Gym-built body.'},
  'bodybuilder':{desc:'Extreme muscle mass. Competition-level physique, exaggerated proportions.'},
  'broad shoulders':{desc:'Wide shoulder frame. Creates a V-taper silhouette. Emphasizes upper body.'},
  'defined pecs':{desc:'Visible chest muscle definition. Clear separation and shape.'},
  'thick thighs':{desc:'Heavy, muscular upper legs. Power and mass in the lower body.'},
  'slim waist':{desc:'Narrow midsection. Emphasizes V-taper or hourglass proportions.'},
  'pale skin':{desc:'Very light, cool-toned skin. Almost porcelain. Picks up light dramatically.'},
  'fair skin':{desc:'Light skin with warm undertones. Natural caucasian complexion.'},
  'tan skin':{desc:'Sun-kissed, warm golden-brown skin. Mediterranean or outdoor look.'},
  'olive skin':{desc:'Warm greenish-yellow undertone. Mediterranean, Middle Eastern, or Latin complexion.'},
  'brown skin':{desc:'Medium-dark warm skin. South Asian, Latin, or mixed heritage tones.'},
  'dark skin':{desc:'Rich dark complexion. Deep warm tones, beautiful contrast with light.'},
  'ebony skin':{desc:'Very deep, rich black skin. Stunning with dramatic lighting and contrast.'},
  'young adult':{desc:'Late teens to early twenties appearance. Fresh-faced, youthful energy.'},
  '20s':{desc:'Twenties-age appearance. Peak youth, defined features starting to set.'},
  '30s':{desc:'Thirties-age appearance. Mature features, character lines beginning.'},
  'mature':{desc:'Middle-aged appearance. Defined character, distinguished features.'},
  'older man':{desc:'Visibly aged. Grey hair, wrinkles, weathered features. Gravitas.'},
  'short messy hair':{desc:'Tousled, casual short hair. Bedhead or intentionally disheveled.'},
  'buzzcut':{desc:'Very short, uniformly clipped hair. Military or minimalist. Shows skull shape.'},
  'long hair':{desc:'Hair past the shoulders. Flowing, dramatic, adds movement to compositions.'},
  'stubble':{desc:'Short facial hair, 1-3 days growth. Rugged, casual masculinity.'},
  'beard':{desc:'Full facial hair. Adds weight and maturity to the face.'},
  'sharp jawline':{desc:'Defined, angular jaw. Strong facial structure, chiseled look.'},
  'handsome':{desc:'Conventionally attractive male features. Symmetrical, well-proportioned face.'},
  'nude':{desc:'Fully unclothed. Anatomical, figure study, or explicit context.'},
  'shirtless':{desc:'Bare upper body, clothed below. Emphasizes torso and build.'},
  'clothed':{desc:'Fully dressed. Focus on outfit and fabric rather than body.'},
  'partially undressed':{desc:'Some clothing removed or displaced. Transitional state, suggestive.'},
  'underwear':{desc:'Wearing only undergarments. Intimate but not fully exposed.'},
  // Subject / Action
  'solitary figure':{desc:'One person alone in the frame. Isolation, focus, introspection.'},
  'two figures':{desc:'Two people in the scene. Relationship, tension, or contrast between them.'},
  'close-up face':{desc:'Tight crop on the face. Eyes, expression, and skin detail dominate.'},
  'full body shot':{desc:'Entire figure visible head to toe. Shows pose, outfit, and proportions.'},
  'silhouette':{desc:'Dark figure outline against a lighter background. Shape over detail.'},
  'standing still':{desc:'Static upright pose. Calm, confrontational, or contemplative depending on context.'},
  'in motion':{desc:'Active movement — running, leaping, turning. Dynamic energy and blur potential.'},
  'seated':{desc:'Sitting pose. Grounded, relaxed, or contemplative. Changes body proportions.'},
  'floating':{desc:'Suspended in air with no support. Dreamlike, supernatural, zero-gravity feel.'},
  'crouching':{desc:'Low bent pose. Tension, readiness, or vulnerability depending on context.'},
  'hands extended':{desc:'Arms and hands reaching outward. Offering, commanding, or desperate gesture.'},
  'back to viewer':{desc:'Subject facing away from camera. Mystery, distance, contemplation.'},
  'partially obscured':{desc:'Part of the subject hidden — by shadow, object, or framing. Creates intrigue.'},
  'emerging from shadow':{desc:'Figure stepping out of darkness. Dramatic reveal, birth-from-void.'},
  'dissolving into smoke':{desc:'Figure breaking apart into vapor or particles. Disintegration, transformation.'},
  // Style / Type
  'dark fantasy illustration':{desc:'Fantasy art with horror and gothic elements. Ornate, ominous, richly detailed.'},
  'modern comic book art':{desc:'Contemporary comic style — clean lines, dynamic poses, bold color. Marvel/DC aesthetic.'},
  'graphic novel panel':{desc:'Single panel from a graphic novel. Narrative framing, dramatic composition.'},
  'underground comix':{desc:'Raw hand-drawn style from 60s-70s counterculture. Scratchy lines, grotesque imagery, high contrast.'},
  'body horror aesthetic':{desc:'Disturbing transformation or mutation of the human form. Flesh rendered wrong.'},
  'surrealist painting':{desc:'Dream logic made visual. Impossible objects, melting forms, symbolic imagery. Dalí territory.'},
  'painterly brushwork':{desc:'Visible paint strokes and texture. Loose expressive marks rather than photographic smoothness.'},
  'concept art':{desc:'Professional pre-production art. Clean, atmospheric, designed to communicate an idea for production.'},
  'street photography':{desc:'Candid, urban, documentary style. Real moments, natural light, gritty authenticity.'},
  'hyperrealistic photography':{desc:'Beyond-real photographic detail. Every pore, every fiber, every reflection rendered.'},
  'cinematic still from a film':{desc:'Looks like a frame pulled from a movie. Dramatic lighting, narrative composition, film grain.'},
  'fine art photography':{desc:'Gallery-quality photographic work. Intentional composition, artistic lighting, conceptual depth.'},
  'high fashion editorial photography':{desc:'Fashion magazine aesthetic. Dramatic poses, styled wardrobe, striking lighting.'},
  // Mood / Atmosphere
  'oppressive atmosphere':{desc:'Heavy, suffocating mood. Low ceilings, dark palettes, claustrophobic framing.'},
  'existential dread':{desc:'The void staring back. Cosmic insignificance, quiet horror of being.'},
  'electric tension':{desc:'Energy crackling between elements. Something about to snap or explode.'},
  'sublime terror':{desc:'Overwhelming scale or power that inspires awe and fear simultaneously. Vastness beyond comprehension.'},
  'quiet devastation':{desc:'Aftermath stillness. The damage is done, now silence. Emotional weight without action.'},
  'euphoric chaos':{desc:'Vibrant, overwhelming, uncontrolled energy — beautiful disorder.'},
  'brooding intensity':{desc:'Dark, focused energy. Simmering beneath the surface, about to boil over.'},
  'otherworldly calm':{desc:'Unnatural stillness. Too peaceful, too perfect — serene but unsettling.'},
  'barely contained violence':{desc:'Tension at the breaking point. Clenched fists, coiled muscles, one breath from eruption.'},
  'beautiful wrongness':{desc:'Something visually appealing but deeply uncanny — the aesthetics of the disturbing.'},
  'sensual tension':{desc:'Charged intimacy without explicit action. Heat, proximity, anticipation.'},
  'raw visceral power':{desc:'Primal force made visible. Muscle, blood, sweat, impact. Feels physical.'},
  'transcendent horror':{desc:'Horror that elevates rather than repulses. Sacred and terrible simultaneously.'},
  'melancholic beauty':{desc:'Sadness made gorgeous. Rain on glass, wilting flowers, lonely figures in vast spaces.'},
  'profound loneliness':{desc:'Deep isolation. A single figure dwarfed by emptiness. Ache of disconnection.'},
  // Color Palette
  'deep jewel tones':{desc:'Rich saturated colors — sapphire, emerald, ruby, amethyst. Luxurious and intense.'},
  'desaturated with neon accents':{desc:'Muted grey-toned palette with one or two vivid neon colors punching through.'},
  'monochromatic red':{desc:'All reds — from pale pink to deep crimson. Blood, passion, danger, warmth.'},
  'black and white with single color pop':{desc:'Grayscale image with one element in vivid color. Draws the eye immediately.'},
  'rich crimson and deep violet':{desc:'Royal, dark palette. Blood reds and deep purples. Luxurious and ominous.'},
  'electric teal and black':{desc:'Cyberpunk palette. Glowing teal against deep darkness. High-tech, cold, sharp.'},
  'burnt orange and shadow':{desc:'Warm amber tones sinking into deep blacks. Autumn, fire, fading light.'},
  'ice blue and white':{desc:'Cold, crystalline palette. Frost, snow, arctic light. Clean and unforgiving.'},
  'toxic green and black':{desc:'Radioactive, venomous palette. Acid green glowing in darkness. Unnatural and threatening.'},
  'gold and obsidian':{desc:'Black glass and liquid gold. Sacred, ancient, powerful. Byzantine icon colors.'},
  'acid colors':{desc:'Neon, slightly wrong, oversaturated. Hot pink, toxic green, electric yellow. Psychedelic.'},
  'muted earth tones':{desc:'Brown, olive, ochre, clay. Natural, grounded, warm. Organic and weathered.'},
  'high contrast black and white':{desc:'Pure blacks and whites with minimal grey — graphic, bold, no subtlety.'},
  // Details / Texture
  'intricate tattoos':{desc:'Detailed ink work on skin. Tribal, geometric, traditional, or ornamental patterns.'},
  'flowing fabric':{desc:'Cloth in motion — silk, chiffon, capes. Catches light, creates dynamic curves.'},
  'weathered skin':{desc:'Aged, sun-damaged, lived-in skin. Wrinkles, spots, texture that tells a story.'},
  'cracked surface':{desc:'Fractured material — dried earth, broken plaster, shattered stone. Decay and entropy.'},
  'organic tendrils':{desc:'Living vine-like growths. Roots, tentacles, veins spreading across surfaces.'},
  'geometric patterns':{desc:'Repeating mathematical shapes. Sacred geometry, tessellations, fractals.'},
  'smoke and embers':{desc:'Wisps of smoke with glowing orange particles. Fire aftermath, smoldering atmosphere.'},
  'dripping liquid':{desc:'Viscous fluid running down surfaces. Water, oil, blood, paint — wet and alive.'},
  'shattered glass':{desc:'Broken transparent fragments catching light. Violence frozen in a beautiful moment.'},
  'glowing runes':{desc:'Luminous magical symbols etched into surfaces. Arcane, mystical, supernatural.'},
  'heavy chains':{desc:'Thick metal links. Bondage, imprisonment, industrial weight. Cold and heavy.'},
  'torn clothing':{desc:'Ripped, damaged fabric. Battle-worn, decayed, or violently stripped. Raw edges.'},
  'iridescent scales':{desc:'Rainbow-shifting reptilian or fish scales. Holographic, alien, beautiful surface.'},
  'circuit board veins':{desc:'Electronic circuitry patterns replacing organic blood vessels. Cybernetic fusion.'},
  'bone structure visible':{desc:'Skeletal anatomy showing through skin. X-ray effect, body horror, anatomical.'},
};

let tagExPopupTag=null;

function openTagExPopup(tag,e){
  e.preventDefault();e.stopPropagation();
  const data=TAG_EXAMPLES[tag];
  if(!data&&!tag)return;
  tagExPopupTag=tag;
  const popup=document.getElementById('tag-ex-popup');
  const imgWrap=document.getElementById('tag-ex-img-wrap');
  const name=document.getElementById('tag-ex-name');
  const desc=document.getElementById('tag-ex-desc');
  const more=document.getElementById('tag-ex-more');
  name.textContent=tag;
  desc.textContent=data?data.desc:'';
  const q=encodeURIComponent(tag+' photography lighting example');
  more.href='https://www.pinterest.com/search/pins/?q='+q;
  if(data&&data.img){
    imgWrap.innerHTML=`<img class="tag-ex-img" src="${data.img}" onerror="this.parentElement.innerHTML='<div class=tag-ex-placeholder>No preview</div>'">`;
  }else if(data){
    imgWrap.innerHTML='<div class="tag-ex-placeholder">No static example — see Pinterest</div>';
  }else{
    imgWrap.innerHTML='';
  }
  // Only show if we have data or search makes sense
  if(!data)return;
  // Position
  popup.style.visibility='hidden';
  popup.style.left='-9999px';
  popup.style.top='-9999px';
  popup.classList.add('visible');
  requestAnimationFrame(()=>{
    const pw=popup.offsetWidth||240;
    const ph=popup.offsetHeight||300;
    const margin=12;
    let left=e.clientX+10;
    let top=e.clientY-20;
    left=Math.max(margin,Math.min(left,window.innerWidth-pw-margin));
    top=Math.max(margin,Math.min(top,window.innerHeight-ph-margin));
    popup.style.left=left+'px';
    popup.style.top=top+'px';
    popup.style.visibility='visible';
  });
}
function closeTagExPopup(){document.getElementById('tag-ex-popup').classList.remove('visible');tagExPopupTag=null;}


// ===================== ADAPTIVE LAYOUT =====================
let layoutOverride=null; // null=auto, 'bottom', 'right'

function getAutoLayout(){
  return window.innerWidth<window.innerHeight?'right':'bottom';
}

function applyLayout(mode){
  const app=document.querySelector('.app');
  const btn=document.getElementById('layout-btn');
  if(mode==='right'){
    app.classList.add('layout-right');
    if(btn)btn.textContent='⬒';
    if(btn)btn.title='Switch to bottom bar';
  }else{
    app.classList.remove('layout-right');
    if(btn)btn.textContent='⬒';
    if(btn)btn.title='Switch to side panel';
  }
  setTimeout(updateFooterH,50);
}

function toggleLayout(){
  const current=document.querySelector('.app').classList.contains('layout-right')?'right':'bottom';
  layoutOverride=current==='right'?'bottom':'right';
  localStorage.setItem('cpg-layout',layoutOverride);
  applyLayout(layoutOverride);
}

function checkLayout(){
  const auto=getAutoLayout();
  const mode=layoutOverride||auto;
  applyLayout(mode);
  // Auto-collapse sidebar on portrait, restore on landscape
  const app=document.querySelector('.app');
  if(!layoutOverride){
    const manualCollapse=localStorage.getItem('cpg-sidebar-collapsed');
    if(manualCollapse!==null){
      // Respect the user's manual preference
      app.classList.toggle('sidebar-collapsed',manualCollapse==='1');
    }else{
      // No manual preference — use auto behaviour (portrait=collapsed)
      app.classList.toggle('sidebar-collapsed',mode==='right');
    }
    const isCollapsed=app.classList.contains('sidebar-collapsed');
    const toggleBtn=document.querySelector('.sidebar-toggle');
    if(toggleBtn)toggleBtn.textContent=isCollapsed?'▶':'◀';
    updateFooterH();
  }
}

init();

// ===================== GALLERY =====================
let galleryImages=[];
let galleryFilter='all';
let galleryTimeFilter='all'; // 'all','24h','7d','30d'
let gallerySharedFilter='all'; // 'all','shared','unshared'
let galleryRedditFilter='all'; // 'all','posted','unposted'
let galleryDetailFile=null;
let gallerySelectMode=false;
let gallerySelected=new Set();
let _galleryLastClicked=null; // for shift+click range select
let galleryCats=[];
let galleryCatFilter=null; // null=all, string=cat id, '__uncat'=uncategorized
let showGalleryAdult=false;
let gallerySearchQuery='';
let _gallerySortOrder='newest';

async function loadGallery(){
  const grid=document.getElementById('gallery-grid');
  if(!grid)return;
  grid.innerHTML='<p class="gallery-empty">Loading...</p>';
  try{
    const [rawRes,approvedRes]=await Promise.all([
      fetch('/gallery/list?folder=raw'),
      fetch('/gallery/list?folder=approved')
    ]);
    const rawImages=rawRes.ok?(await rawRes.json()).map(img=>({...img,folder:'raw'})):[];
    const approvedImages=approvedRes.ok?(await approvedRes.json()).map(img=>({...img,folder:'approved'})):[];
    galleryImages=[...rawImages,...approvedImages].sort((a,b)=>_gallerySortOrder==='oldest'?(a.mtime-b.mtime):(b.mtime-a.mtime));
    // Update auto-poll baseline so the tick doesn't re-fire on this fresh data
    _galleryLastMtime=rawImages.reduce((m,i)=>Math.max(m,i.mtime||0),0);
    // Sync approved state from folder contents
    if(!appData.galleryState)appData.galleryState={};
    approvedImages.forEach(img=>{appData.galleryState[img.name]='approved';});
    renderGallery();
  }catch(e){
    grid.innerHTML=`<p class="gallery-empty">Could not load gallery: ${e.message}</p>`;
  }
}

function isVideoFile(name){return /\.(mp4|webm|mov)$/i.test(name);}

function galleryAgeDays(img){return (Date.now()/1000-img.mtime)/86400;}
function galleryAgeLabel(days){
  if(days<14)return Math.floor(days)+'d';
  if(days<30)return Math.floor(days/7)+'w';
  return Math.floor(days/30)+'m';
}

function mkGalleryCard(img,state){
  const s=state[img.name]||'unreviewed';
  const date=new Date(img.mtime*1000).toLocaleDateString();
  const safeFile=img.name.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  const sel=gallerySelected.has(img.name)?' gsel':'';
  const brut=(appData.galleryAdult&&appData.galleryAdult[img.name]);
  const fav=!!(appData.galleryFavorites&&appData.galleryFavorites[img.name]);
  const shared=!!(appData.galleryShared&&appData.galleryShared[img.name]);
  const redditPosted=!!(appData.galleryRedditPosted&&appData.galleryRedditPosted[img.name]);
  const upscaled=!!(appData.galleryUpscaled&&appData.galleryUpscaled[img.name]);
  const src=`/gallery/image?folder=${img.folder}&file=${encodeURIComponent(img.name)}`;
  const isVid=isVideoFile(img.name);
  const media=isVid
    ?`<video src="${src}" muted preload="metadata" class="gthumb-vid"></video><div class="gvid-play">▶</div>`
    :`<img src="${src}" loading="lazy" alt="">`;
  return `<div class="gthumb state-${s}${sel}" data-file="${img.name.replace(/"/g,'&quot;')}" onclick="galleryCardClick('${safeFile}',event)" oncontextmenu="openGalleryCtx('${safeFile}',event)">
    ${media}
    <div class="gthumb-overlay">${date}</div>
    <div class="gsel-check">✓</div>
    <button class="gfav-star${fav?' active':''}" onclick="event.stopPropagation();toggleGalleryFav('${safeFile}')">★</button>${shared?`<div class="gshared-badge${upscaled?' gold':''}" title="Shared to CivitAI">↗</div>`:''}${upscaled&&!shared?'<div class="gupscale-badge" title="Upscaled">HD</div>':''}${redditPosted?'<div class="greddit-badge" title="Posted to Reddit">r</div>':''}${brut?'<div class="gbrut-badge"></div>':''}
  </div>`;
}

function mkGallerySection(id,label,color,images,state){
  if(!images.length)return '';
  const largeClass=galleryLargeCards?' gallery-large':'';
  const selClass=gallerySelectMode?' select-mode':'';
  return `<div class="gallery-section" id="gsec-${id}">
    <div class="gallery-section-header">
      <span class="ttitle-dot" style="background:${color}"></span>
      <span class="gallery-section-label">${label}</span>
      <span class="gallery-section-hr"></span>
      <span class="ncount">${images.length}</span>
    </div>
    <div class="gallery-grid${largeClass}${selClass}">${images.map(img=>mkGalleryCard(img,state)).join('')}</div>
  </div>`;
}

function applyGalleryStateFilter(images,state){
  if(galleryFilter==='fav')return images.filter(img=>appData.galleryFavorites&&appData.galleryFavorites[img.name]);
  if(galleryFilter==='unreviewed')return images.filter(img=>!state[img.name]);
  if(galleryFilter==='review')return images.filter(img=>state[img.name]==='review');
  if(galleryFilter==='approved')return images.filter(img=>state[img.name]==='approved');
  if(galleryFilter==='declined')return images.filter(img=>state[img.name]==='declined');
  if(galleryFilter==='old'){const t=Date.now()/1000-14*86400;return images.filter(img=>!state[img.name]&&img.mtime<t);}
  return images;
}

function applyGalleryAdultFilter(images){
  if(showGalleryAdult)return images;
  const adult=appData.galleryAdult||{};
  const brutKeys=getBrutCatKeys();
  return images.filter(img=>!adult[img.name]&&!brutKeys.has(img.name));
}

function applyGalleryTimeFilter(images){
  if(galleryTimeFilter==='all')return images;
  const now=Date.now()/1000;
  const cutoffs={'24h':86400,'7d':604800,'30d':2592000};
  const cutoff=now-(cutoffs[galleryTimeFilter]||0);
  return images.filter(img=>(img.mtime||0)>=cutoff);
}

function applyGallerySearchFilter(images){
  if(!gallerySearchQuery)return images;
  const q=gallerySearchQuery.toLowerCase();
  const tags=appData.galleryTags||{};
  return images.filter(img=>{
    // Match filename
    if(img.name.toLowerCase().includes(q))return true;
    // Match tags
    const imgTags=tags[img.name];
    if(imgTags&&imgTags.some(t=>t.includes(q)))return true;
    return false;
  });
}

function applyGallerySharedFilter(images){
  if(gallerySharedFilter==='all')return images;
  const shared=appData.galleryShared||{};
  if(gallerySharedFilter==='shared')return images.filter(img=>!!shared[img.name]);
  return images.filter(img=>!shared[img.name]);
}

function applyGalleryRedditFilter(images){
  if(galleryRedditFilter==='all')return images;
  const posted=appData.galleryRedditPosted||{};
  if(galleryRedditFilter==='posted')return images.filter(img=>!!posted[img.name]);
  return images.filter(img=>!posted[img.name]);
}

function onGallerySearch(){
  const input=document.getElementById('gsearch');
  const clear=document.getElementById('gsearch-clear');
  gallerySearchQuery=(input&&input.value)||'';
  if(clear)clear.style.display=gallerySearchQuery?'block':'none';
  renderGallery();
}

function clearGallerySearch(){
  const input=document.getElementById('gsearch');
  if(input)input.value='';
  gallerySearchQuery='';
  const clear=document.getElementById('gsearch-clear');
  if(clear)clear.style.display='none';
  renderGallery();
}

function scrollGalleryToTop(){
  const gp=document.getElementById('panel-gallery');
  if(gp)gp.scrollTo({top:0,behavior:'smooth'});
}

function updateBackToTopButton(){
  const galleryBtn=document.getElementById('gallery-back-top');
  const topBtn=document.getElementById('scroll-top-btn');
  const main=document.querySelector('.main');
  const appEl=document.querySelector('.app');
  const isGallery=appEl?.classList.contains('gallery-tab-active');
  const isLora=appEl?.classList.contains('lora-tab-active');
  // Gallery back-to-top
  if(galleryBtn){
    const gp=document.getElementById('panel-gallery');
    if(!isGallery||!gp||gp.scrollTop<200)galleryBtn.classList.remove('visible');
    else galleryBtn.classList.add('visible');
  }
  // LoRA tab back-to-top
  if(topBtn){
    const loraPanel=document.getElementById('panel-loras');
    if(isLora&&loraPanel&&loraPanel.scrollTop>300)topBtn.classList.add('visible');
    else if(!isGallery&&main&&main.scrollTop>300)topBtn.classList.add('visible');
    else topBtn.classList.remove('visible');
  }
}
function scrollBackToTop(){
  const appEl=document.querySelector('.app');
  if(appEl?.classList.contains('lora-tab-active')){
    const lp=document.getElementById('panel-loras');
    if(lp)lp.scrollTo({top:0,behavior:'smooth'});
  }
  const main=document.querySelector('.main');
  if(main)main.scrollTo({top:0,behavior:'smooth'});
}

// Attach scroll listeners once DOM is ready
document.addEventListener('DOMContentLoaded',()=>{
  const main=document.querySelector('.main');
  if(main)main.addEventListener('scroll',updateBackToTopButton,{passive:true});
  const loraPanel=document.getElementById('panel-loras');
  if(loraPanel)loraPanel.addEventListener('scroll',updateBackToTopButton,{passive:true});
  const galleryPanel=document.getElementById('panel-gallery');
  if(galleryPanel)galleryPanel.addEventListener('scroll',updateBackToTopButton,{passive:true});
});

const GALLERY_TIME_CYCLE=['all','24h','7d','30d'];
const GALLERY_TIME_LABELS={'all':'All time','24h':'Today','7d':'7 days','30d':'30 days'};
function cycleGalleryTimeFilter(){
  const idx=GALLERY_TIME_CYCLE.indexOf(galleryTimeFilter);
  galleryTimeFilter=GALLERY_TIME_CYCLE[(idx+1)%GALLERY_TIME_CYCLE.length];
  const btn=document.getElementById('gtf-time');
  if(btn){
    btn.textContent=GALLERY_TIME_LABELS[galleryTimeFilter];
    btn.classList.toggle('active',galleryTimeFilter!=='all');
  }
  renderGallery();
}

const GALLERY_SHARED_CYCLE=['all','shared','unshared'];
const GALLERY_SHARED_LABELS={'all':'↗ All','shared':'↗ Shared','unshared':'↗ Unshared'};
function cycleGallerySharedFilter(){
  const idx=GALLERY_SHARED_CYCLE.indexOf(gallerySharedFilter);
  gallerySharedFilter=GALLERY_SHARED_CYCLE[(idx+1)%GALLERY_SHARED_CYCLE.length];
  const btn=document.getElementById('gtf-shared');
  if(btn){
    btn.textContent=GALLERY_SHARED_LABELS[gallerySharedFilter];
    btn.classList.toggle('active',gallerySharedFilter!=='all');
  }
  renderGallery();
}

const GALLERY_REDDIT_CYCLE=['all','posted','unposted'];
const GALLERY_REDDIT_LABELS={'all':'r/ All','posted':'r/ Posted','unposted':'r/ Unposted'};
function cycleGalleryRedditFilter(){
  const idx=GALLERY_REDDIT_CYCLE.indexOf(galleryRedditFilter);
  galleryRedditFilter=GALLERY_REDDIT_CYCLE[(idx+1)%GALLERY_REDDIT_CYCLE.length];
  const btn=document.getElementById('gtf-reddit');
  if(btn){
    btn.textContent=GALLERY_REDDIT_LABELS[galleryRedditFilter];
    btn.classList.toggle('active',galleryRedditFilter!=='all');
  }
  renderGallery();
}

function renderGallery(){
  const grid=document.getElementById('gallery-grid');
  if(!grid)return;
  const state=appData.galleryState||{};
  updateGalleryFilterCounts();

  // Sectioned view: show all categories as sections (like LoRA collections)
  if(galleryCatFilter===null&&galleryCats.length>0){
    grid.className='';
    const catted=new Set();
    galleryCats.forEach(c=>c.keys.forEach(k=>catted.add(k)));
    let html='';
    galleryCats.forEach(cat=>{
      if(!showGalleryAdult&&isCatBrut(cat.id))return;
      const catImages=galleryImages.filter(img=>cat.keys.includes(img.name));
      const filtered=applyGalleryRedditFilter(applyGallerySharedFilter(applyGallerySearchFilter(applyGalleryTimeFilter(applyGalleryAdultFilter(applyGalleryStateFilter(catImages,state))))));
      html+=mkGallerySection(cat.id,cat.label,cat.color||'var(--orange)',filtered,state);
    });
    const uncatImages=galleryImages.filter(img=>!catted.has(img.name));
    const uncatFiltered=applyGalleryRedditFilter(applyGallerySharedFilter(applyGallerySearchFilter(applyGalleryTimeFilter(applyGalleryAdultFilter(applyGalleryStateFilter(uncatImages,state))))));
    html+=mkGallerySection('__uncat','Uncategorized','var(--muted2)',uncatFiltered,state);
    if(!html){html='<p class="gallery-empty">No images here.</p>';}
    grid.innerHTML=html;
    return;
  }

  // Flat view: single category or no categories exist
  const largeClass=galleryLargeCards?' gallery-large':'';
  const selClass=gallerySelectMode?' select-mode':'';
  grid.className='gallery-grid'+largeClass+selClass;
  let images=galleryImages;
  if(galleryCatFilter==='__uncat'){
    const catted=new Set();
    galleryCats.forEach(c=>c.keys.forEach(k=>catted.add(k)));
    images=images.filter(img=>!catted.has(img.name));
  }else if(galleryCatFilter){
    const cat=galleryCats.find(c=>c.id===galleryCatFilter);
    const keys=new Set(cat?cat.keys:[]);
    images=images.filter(img=>keys.has(img.name));
  }
  images=applyGalleryRedditFilter(applyGallerySharedFilter(applyGallerySearchFilter(applyGalleryTimeFilter(applyGalleryAdultFilter(applyGalleryStateFilter(images,state))))));
  if(!images.length){
    grid.innerHTML='<p class="gallery-empty">No images here.</p>';
    return;
  }
  const recentImgs=[];const oldImgs=[];
  images.forEach(img=>{
    const ageDays=galleryAgeDays(img);
    const s=state[img.name]||'unreviewed';
    if(s==='unreviewed'&&ageDays>=14)oldImgs.push(img);
    else recentImgs.push(img);
  });
  let html=recentImgs.map(img=>mkGalleryCard(img,state)).join('');
  if(oldImgs.length>0){
    html+=`<div class="gallery-age-divider"><div class="age-divider-line"></div><div class="age-divider-pill"><span class="age-divider-dot"></span>14+ days · unreviewed · ${oldImgs.length} images</div><div class="age-divider-line"></div></div>`;
    html+=oldImgs.map(img=>mkGalleryCard(img,state)).join('');
  }
  grid.innerHTML=html;
}

function updateGalleryFilterCounts(){
  const state=appData.galleryState||{};
  const all=galleryImages.length;
  const unreviewed=galleryImages.filter(img=>!state[img.name]).length;
  const review=galleryImages.filter(img=>state[img.name]==='review').length;
  const approved=galleryImages.filter(img=>state[img.name]==='approved').length;
  const declined=galleryImages.filter(img=>state[img.name]==='declined').length;
  const oldThreshold=Date.now()/1000-14*86400;
  const oldCount=galleryImages.filter(img=>!state[img.name]&&img.mtime<oldThreshold).length;
  const counts={all,unreviewed,review,approved,declined,old:oldCount};
  Object.keys(counts).forEach(k=>{
    const el=document.getElementById('gtfc-'+k);
    if(el)el.textContent=counts[k];
  });
  const processBtn=document.getElementById('gallery-process-btn');
  if(processBtn){processBtn.style.display=declined>0?'':'none';processBtn.textContent=`🗑 Process ${declined}`;}
  const nagThreshold=Date.now()/1000-7*86400;
  const nagCount=galleryImages.filter(img=>!state[img.name]&&img.mtime<nagThreshold).length;
  const nagBadge=document.getElementById('gallery-tab-nag');
  if(nagBadge)nagBadge.textContent=nagCount>0?'⏱'+nagCount:'';
}

let _backlogToastShown=false;
async function checkGalleryBacklog(){
  try{
    const [rawRes,approvedRes]=await Promise.all([fetch('/gallery/list?folder=raw'),fetch('/gallery/list?folder=approved')]);
    const raw=rawRes.ok?await rawRes.json():[];
    const approved=approvedRes.ok?await approvedRes.json():[];
    const all=[...raw,...approved];
    const state=appData.galleryState||{};
    const oldThreshold=Date.now()/1000-7*86400;
    const oldCount=all.filter(img=>!state[img.name]&&img.mtime<oldThreshold).length;
    const nagBadge=document.getElementById('gallery-tab-nag');
    if(nagBadge)nagBadge.textContent=oldCount>0?'⏱'+oldCount:'';
    if(oldCount>0&&!_backlogToastShown){
      _backlogToastShown=true;
      setTimeout(()=>showToast('Gallery backlog',`${oldCount} image${oldCount>1?'s':''} unreviewed for 7+ days`,'warn'),5000);
    }
  }catch(e){}
}

function setGalleryFilter(f){
  galleryFilter=f;
  ['all','fav','unreviewed','review','approved','declined','old'].forEach(id=>{
    document.getElementById('gtf-'+id)?.classList.toggle('active',f===id);
  });
  renderGallery();
}

function openGalleryDetail(file){
  galleryDetailFile=file;
  const img=galleryImages.find(i=>i.name===file);
  const folder=img?.folder||'raw';
  const src=`/gallery/image?folder=${folder}&file=${encodeURIComponent(file)}`;
  const wrap=document.querySelector('.gallery-detail-img-wrap');
  const isVid=isVideoFile(file);
  const isFav=(appData.galleryFavorites||{})[file];
  const isBrut=(appData.galleryAdult||{})[file];
  const favBtn=`<button class="gdp-detail-fav${isFav?' active':''}" id="gdp-detail-fav" onclick="event.stopPropagation();toggleGalleryDetailFav()" title="Favorite">★</button>`;
  const brutEl=isBrut?'<div class="gdp-detail-brut"></div>':'';
  if(isVid){
    wrap.innerHTML=`<video class="gallery-detail-img" id="gdp-img" src="${src}" controls muted preload="metadata" oncontextmenu="openGalleryDetailCtx(event)"></video>`+favBtn+brutEl;
  }else{
    wrap.innerHTML=`<img class="gallery-detail-img" id="gdp-img" src="${src}" alt="" onclick="openGalleryLightbox()" oncontextmenu="openGalleryDetailCtx(event)">`+favBtn+brutEl;
  }
  document.getElementById('gdp-name').textContent=file;
  if(img){
    document.getElementById('gdp-date').textContent=new Date(img.mtime*1000).toLocaleString();
    const kb=img.size/1024;
    document.getElementById('gdp-size').textContent=kb<1024?Math.round(kb)+'KB':(kb/1024).toFixed(1)+'MB';
  }
  const timingEl=document.getElementById('gdp-timing');
  const dur=appData.galleryTiming?.[file];
  timingEl.textContent=dur!=null?'⏱ '+formatDuration(dur):'';
  updateGalleryDetailState();
  updateGalleryDetailCat();
  renderGalleryTags();
  cancelAddGalleryTag();
  const upBtn=document.querySelector('.gdp-upscale');
  if(upBtn)upBtn.style.display=(appData.galleryUpscaled&&appData.galleryUpscaled[file])?'none':'';
  const shareBtn=document.querySelector('.gdp-share');
  if(shareBtn){
    const isShared=!!(appData.galleryShared&&appData.galleryShared[file]);
    shareBtn.classList.toggle('shared',isShared);
    shareBtn.textContent=isShared?'↗ Shared':'↗ Share';
  }
  document.getElementById('gallery-detail').classList.add('open');
  document.getElementById('gallery-detail-backdrop').classList.add('visible');
  loadGalleryMetadata(file,folder);
}

async function loadGalleryMetadata(file,folder){
  const el=document.getElementById('gdp-metadata');
  if(!el)return;
  const inner=document.getElementById('gdp-metadata-inner');
  if(!inner)return;
  inner.innerHTML='<div class="gdp-meta-none">Loading metadata…</div>';
  const toggle=document.getElementById('gdp-accordion-toggle');
  if(toggle)toggle.style.display='';
  try{
    const res=await fetch(`/gallery/metadata?folder=${folder}&file=${encodeURIComponent(file)}`);
    if(!res.ok){inner.innerHTML='';if(toggle)toggle.style.display='none';return;}
    const m=await res.json();
    const hasUsefulMeta=m.has_metadata&&(m.positive||m.checkpoint);
    if(!hasUsefulMeta){
      const upRec=appData.galleryUpscaled&&appData.galleryUpscaled[file];
      if(upRec&&upRec.meta){
        if(galleryDetailFile!==file)return;
        inner.innerHTML=renderGalleryMetadata(upRec.meta,file);
        return;
      }
      if(!m.has_metadata){inner.innerHTML='<div class="gdp-meta-none">No generation data found</div>';return;}
    }
    if(galleryDetailFile!==file){return;}
    autoTagFile(file,m);
    renderGalleryTags();
    inner.innerHTML=renderGalleryMetadata(m,file);
  }catch(e){
    inner.innerHTML='';
    if(toggle)toggle.style.display='none';
  }
}

// ===================== GALLERY RENAME =====================
function startGalleryRename(){
  if(!galleryDetailFile)return;
  const wrap=document.getElementById('gdp-rename-wrap');
  const input=document.getElementById('gdp-rename-input');
  // Strip extension for editing — we'll preserve it on save
  const ext=galleryDetailFile.lastIndexOf('.');
  input.value=ext>0?galleryDetailFile.substring(0,ext):galleryDetailFile;
  wrap.classList.add('active');
  input.focus();
  input.select();
  input.onkeydown=e=>{
    if(e.key==='Enter'){e.preventDefault();confirmGalleryRename();}
    if(e.key==='Escape'){e.preventDefault();cancelGalleryRename();}
  };
}

function cancelGalleryRename(){
  document.getElementById('gdp-rename-wrap').classList.remove('active');
}

async function confirmGalleryRename(){
  if(!galleryDetailFile)return;
  const input=document.getElementById('gdp-rename-input');
  const raw=input.value.trim();
  if(!raw){cancelGalleryRename();return;}
  // Build the full new filename with preserved extension
  const dotIdx=galleryDetailFile.lastIndexOf('.');
  const origExt=dotIdx>0?galleryDetailFile.substring(dotIdx):'.png';
  // Only allow letters, numbers, dashes, underscores, spaces
  if(!/^[a-zA-Z0-9_\- ]+$/.test(raw)){
    showToast('Invalid name','Only letters, numbers, dashes, underscores, and spaces allowed','err');
    return;
  }
  const newName=raw+origExt;
  if(newName===galleryDetailFile){cancelGalleryRename();return;}
  const img=galleryImages.find(i=>i.name===galleryDetailFile);
  const folder=img?.folder||'raw';
  try{
    const res=await fetch('/gallery/rename',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({file:galleryDetailFile,newName,folder})
    });
    const data=await res.json();
    if(!res.ok){
      showToast('Rename failed',data.error||'Unknown error','err');
      return;
    }
    const finalName=data.newName;
    const oldName=galleryDetailFile;
    // Update galleryImages array
    if(img)img.name=finalName;
    // Update galleryState
    if(appData.galleryState&&appData.galleryState[oldName]!==undefined){
      appData.galleryState[finalName]=appData.galleryState[oldName];
      delete appData.galleryState[oldName];
    }
    // Update galleryAdult
    if(appData.galleryAdult&&appData.galleryAdult[oldName]){
      appData.galleryAdult[finalName]=true;
      delete appData.galleryAdult[oldName];
    }
    // Update galleryTags
    if(appData.galleryTags&&appData.galleryTags[oldName]){
      appData.galleryTags[finalName]=appData.galleryTags[oldName];
      delete appData.galleryTags[oldName];
    }
    // Update galleryAutoTagged
    if(appData.galleryAutoTagged&&appData.galleryAutoTagged[oldName]){
      appData.galleryAutoTagged[finalName]=true;
      delete appData.galleryAutoTagged[oldName];
    }
    // Update galleryTiming
    if(appData.galleryTiming&&appData.galleryTiming[oldName]!=null){
      appData.galleryTiming[finalName]=appData.galleryTiming[oldName];
      delete appData.galleryTiming[oldName];
    }
    // Update galleryShared
    if(appData.galleryShared&&appData.galleryShared[oldName]){
      appData.galleryShared[finalName]=appData.galleryShared[oldName];
      delete appData.galleryShared[oldName];
    }
    // Update galleryRedditPosted
    if(appData.galleryRedditPosted&&appData.galleryRedditPosted[oldName]){
      appData.galleryRedditPosted[finalName]=appData.galleryRedditPosted[oldName];
      delete appData.galleryRedditPosted[oldName];
    }
    // Update galleryUpscaled
    if(appData.galleryUpscaled&&appData.galleryUpscaled[oldName]){
      appData.galleryUpscaled[finalName]=appData.galleryUpscaled[oldName];
      delete appData.galleryUpscaled[oldName];
    }
    // Update galleryCats keys
    galleryCats.forEach(cat=>{
      const idx=cat.keys.indexOf(oldName);
      if(idx!==-1)cat.keys[idx]=finalName;
    });
    appData.galleryCats=[...galleryCats];
    // Update current detail
    galleryDetailFile=finalName;
    document.getElementById('gdp-name').textContent=finalName;
    // Update the card in the grid
    const card=document.querySelector(`.gthumb[data-file="${CSS.escape(oldName)}"]`);
    if(card){
      card.dataset.file=finalName;
      const safeFile=finalName.replace(/'/g,"\\'");
      card.setAttribute('onclick',`galleryCardClick('${safeFile}',event)`);
      card.setAttribute('oncontextmenu',`openGalleryCtx('${safeFile}',event)`);
      // Update image/video src
      const mediaEl=card.querySelector('img,video');
      if(mediaEl)mediaEl.src=`/gallery/image?folder=${folder}&file=${encodeURIComponent(finalName)}`;
    }
    cancelGalleryRename();
    saveAppData();
    showToast('Renamed',`${oldName} → ${finalName}`);
  }catch(e){
    showToast('Rename failed',e.message,'err');
  }
}

// ===================== GALLERY TAGS =====================
function migrateAutoTags(){
  if(!appData.galleryAutoTagged||appData._autoTagV2)return;
  appData.galleryAutoTagged={};
  appData._autoTagV2=true;
  saveAppData();
}

// When a LoRA is cleaned, clear autoTagged flags for images that used it
// so they get re-processed with the LoRA's tag next time their detail is viewed
async function resetAutoTagsForLora(loraKey){
  if(!appData.galleryAutoTagged)return;
  let changed=false;
  for(const file of Object.keys(appData.galleryAutoTagged)){
    try{
      const folder=(appData.galleryState||{})[file]==='approved'?'approved':'raw';
      const res=await fetch(`/gallery/metadata?folder=${folder}&file=${encodeURIComponent(file)}`);
      if(!res.ok)continue;
      const m=await res.json();
      if(!m.has_metadata||!m.loras)continue;
      if(m.loras.some(l=>l.name===loraKey)){
        delete appData.galleryAutoTagged[file];
        changed=true;
      }
    }catch(e){}
  }
  if(changed)saveAppData();
}

function autoTagFile(file,metadata){
  if(!file||!metadata||!metadata.has_metadata)return;
  if(!appData.galleryAutoTagged)appData.galleryAutoTagged={};
  if(appData.galleryAutoTagged[file])return;
  if(!appData.galleryTags)appData.galleryTags={};
  if(!appData.galleryTags[file])appData.galleryTags[file]=[];
  const tags=appData.galleryTags[file];
  const toAdd=[];
  if(metadata.checkpoint){
    const ckStem=metadata.checkpoint.split('/').pop().replace(/\.[^.]+$/,'');
    const ckNotes=(appData.checkpointNotes||{})[ckStem];
    if(ckNotes?.displayName){
      const t=ckNotes.displayName.toLowerCase();
      if(!tags.includes(t))toAdd.push(t);
    }
  }
  if(metadata.loras&&metadata.loras.length){
    metadata.loras.forEach(l=>{
      if(!l.name)return;
      const ld=getLora(l.name);
      if(!ld.cleaned)return;
      const lr=loraList.find(x=>x.file_name===l.name);
      const display=ld.name||(lr&&lr.model_name)||l.name;
      const t=display.toLowerCase();
      if(!tags.includes(t))toAdd.push(t);
    });
  }
  if(toAdd.length)appData.galleryTags[file]=tags.concat(toAdd);
  appData.galleryAutoTagged[file]=true;
  saveAppData();
}

function autoTagCompletedFiles(files){
  files.forEach(async f=>{
    try{
      const res=await fetch(`/gallery/metadata?folder=raw&file=${encodeURIComponent(f)}`);
      if(res.ok){const m=await res.json();autoTagFile(f,m);}
    }catch(e){}
  });
}

function getGalleryTags(file){
  return (appData.galleryTags&&appData.galleryTags[file])||[];
}

function renderGalleryTags(){
  const container=document.getElementById('gdp-tags-chips');
  if(!container||!galleryDetailFile)return;
  const tags=getGalleryTags(galleryDetailFile);
  let html=tags.map(t=>{
    const safe=t.replace(/'/g,"\\'").replace(/"/g,'&quot;');
    return `<span class="gdp-tag-chip">${t.replace(/</g,'&lt;')} <button class="gdp-tag-rm" onclick="event.stopPropagation();removeGalleryTag('${safe}')" title="Remove">×</button></span>`;
  }).join('');
  html+=`<button class="gdp-tags-add-btn" onclick="startAddGalleryTag()">+ tag</button>`;
  container.innerHTML=html;
}

function addGalleryTag(tag){
  if(!galleryDetailFile||!tag)return;
  if(!appData.galleryTags)appData.galleryTags={};
  if(!appData.galleryTags[galleryDetailFile])appData.galleryTags[galleryDetailFile]=[];
  const normalized=tag.trim().toLowerCase();
  if(!normalized)return;
  if(appData.galleryTags[galleryDetailFile].includes(normalized))return;
  appData.galleryTags[galleryDetailFile].push(normalized);
  saveAppData();
  renderGalleryTags();
}

function removeGalleryTag(tag){
  if(!galleryDetailFile||!appData.galleryTags)return;
  const tags=appData.galleryTags[galleryDetailFile];
  if(!tags)return;
  appData.galleryTags[galleryDetailFile]=tags.filter(t=>t!==tag);
  if(!appData.galleryTags[galleryDetailFile].length)delete appData.galleryTags[galleryDetailFile];
  saveAppData();
  renderGalleryTags();
}

function getAllGalleryTagCounts(){
  const counts={};
  if(!appData.galleryTags)return counts;
  Object.values(appData.galleryTags).forEach(tags=>{
    tags.forEach(t=>{counts[t]=(counts[t]||0)+1;});
  });
  return counts;
}

let tagSuggestIdx=-1;

function updateTagSuggest(){
  const input=document.getElementById('gdp-tags-input');
  const box=document.getElementById('gdp-tags-suggest');
  if(!input||!box)return;
  // get the last segment after the last comma (for batch entry)
  const full=input.value;
  const parts=full.split(',');
  const query=parts[parts.length-1].trim().toLowerCase();
  if(!query){box.classList.remove('open');box.innerHTML='';tagSuggestIdx=-1;return;}
  const counts=getAllGalleryTagCounts();
  const current=getGalleryTags(galleryDetailFile);
  // already-typed tags in this batch
  const batchSoFar=parts.slice(0,-1).map(s=>s.trim().toLowerCase()).filter(Boolean);
  const matches=Object.entries(counts)
    .filter(([tag])=>tag.includes(query)&&!current.includes(tag)&&!batchSoFar.includes(tag))
    .sort((a,b)=>b[1]-a[1])
    .slice(0,8);
  if(!matches.length){
    if(query&&!counts[query]){
      box.innerHTML='<div class="gdp-tags-suggest-item new-tag" data-tag="'+query.replace(/"/g,'&quot;')+'"><span style="color:var(--orange)">+</span> Create "<b>'+query.replace(/</g,'&lt;')+'</b>"</div>';
      box.classList.add('open');
    }else{box.classList.remove('open');box.innerHTML='';}
    tagSuggestIdx=-1;
    return;
  }
  const exactMatch=matches.some(([tag])=>tag===query);
  let html=matches.map(([tag,count],i)=>{
    const hl=tag.replace(new RegExp('('+query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi'),'<mark>$1</mark>');
    return '<div class="gdp-tags-suggest-item'+(i===tagSuggestIdx?' active':'')+'" data-tag="'+tag.replace(/"/g,'&quot;')+'">'+hl+'<span class="tag-count">×'+count+'</span></div>';
  }).join('');
  if(!exactMatch){
    html+='<div class="gdp-tags-suggest-item new-tag'+(tagSuggestIdx===matches.length?' active':'')+'" data-tag="'+query.replace(/"/g,'&quot;')+'"><span style="color:var(--orange)">+</span> Create "<b>'+query.replace(/</g,'&lt;')+'</b>"</div>';
  }
  box.innerHTML=html;
  box.classList.add('open');
  // click handler
  box.querySelectorAll('.gdp-tags-suggest-item').forEach(el=>{
    el.onmousedown=e=>{
      e.preventDefault();
      selectTagSuggestion(el.dataset.tag);
    };
  });
}

function selectTagSuggestion(tag){
  const input=document.getElementById('gdp-tags-input');
  const box=document.getElementById('gdp-tags-suggest');
  if(!input)return;
  const parts=input.value.split(',');
  parts[parts.length-1]=tag;
  input.value=parts.join(', ')+', ';
  tagSuggestIdx=-1;
  if(box){box.classList.remove('open');box.innerHTML='';}
  input.focus();
}

function startAddGalleryTag(){
  const row=document.getElementById('gdp-tags-input-row');
  const input=document.getElementById('gdp-tags-input');
  row.style.display='flex';
  input.value='';
  tagSuggestIdx=-1;
  input.focus();
  input.oninput=()=>{tagSuggestIdx=-1;updateTagSuggest();};
  input.onkeydown=e=>{
    const box=document.getElementById('gdp-tags-suggest');
    const items=box?box.querySelectorAll('.gdp-tags-suggest-item'):[];
    const isOpen=box&&box.classList.contains('open')&&items.length;
    if(e.key==='ArrowDown'&&isOpen){
      e.preventDefault();
      tagSuggestIdx=Math.min(tagSuggestIdx+1,items.length-1);
      items.forEach((el,i)=>el.classList.toggle('active',i===tagSuggestIdx));
      return;
    }
    if(e.key==='ArrowUp'&&isOpen){
      e.preventDefault();
      tagSuggestIdx=Math.max(tagSuggestIdx-1,0);
      items.forEach((el,i)=>el.classList.toggle('active',i===tagSuggestIdx));
      return;
    }
    if(e.key==='Enter'){
      e.preventDefault();
      if(isOpen&&tagSuggestIdx>=0&&tagSuggestIdx<items.length){
        selectTagSuggestion(items[tagSuggestIdx].dataset.tag);
      }else{
        confirmAddGalleryTag();
      }
      return;
    }
    if(e.key==='Escape'){
      e.preventDefault();
      if(isOpen){box.classList.remove('open');box.innerHTML='';tagSuggestIdx=-1;}
      else cancelAddGalleryTag();
    }
    if(e.key==='Tab'&&isOpen&&items.length){
      e.preventDefault();
      const idx=tagSuggestIdx>=0?tagSuggestIdx:0;
      if(idx<items.length)selectTagSuggestion(items[idx].dataset.tag);
    }
  };
}

function confirmAddGalleryTag(){
  const input=document.getElementById('gdp-tags-input');
  const val=input.value.trim();
  if(val){
    // Support comma-separated batch add
    val.split(',').forEach(t=>{
      const tag=t.trim();
      if(tag)addGalleryTag(tag);
    });
  }
  cancelAddGalleryTag();
}

function cancelAddGalleryTag(){
  document.getElementById('gdp-tags-input-row').style.display='none';
  document.getElementById('gdp-tags-input').value='';
  const box=document.getElementById('gdp-tags-suggest');
  if(box){box.classList.remove('open');box.innerHTML='';}
  tagSuggestIdx=-1;
}

// ===================== REMIX FROM GALLERY =====================
function remixFromGallery(){
  if(!galleryDetailFile)return;
  showInlineConfirm(
    'Overwrite the current prompt with this image\u2019s settings?',
    ()=>doRemixFromGallery(galleryDetailFile),
    {okLabel:'Remix',okColor:'var(--blue)'}
  );
}
async function doRemixFromGallery(file){
  const img=galleryImages.find(i=>i.name===file);
  const folder=img?.folder||'raw';
  let m;
  try{
    const res=await fetch(`/gallery/metadata?folder=${folder}&file=${encodeURIComponent(file)}`);
    if(!res.ok)throw new Error('no metadata');
    m=await res.json();
    if(!m.has_metadata||(!m.positive&&!m.checkpoint))throw new Error('no metadata');
  }catch(e){
    const upRec=appData.galleryUpscaled&&appData.galleryUpscaled[file];
    if(upRec&&upRec.meta){m=upRec.meta;}
    else{showInlineConfirm('No generation metadata found on this image.',()=>{},{okLabel:'OK',okColor:'var(--surface3)'});return;}
  }

  // Derive model. Priority:
  //   1. Look up the actual checkpoint in our list — its base_model is authoritative
  //   2. LoRA intersection (pick the only base-model all referenced LoRAs agree on)
  //   3. Checkpoint name string heuristic
  //   4. Fallback to SDXL
  // NOTE: score_9/score_8_up tokens are NOT used — Illustrious uses those same tokens, so they're ambiguous.
  const ck=(m.checkpoint||'').toLowerCase();
  let newModel=null;
  if(m.checkpoint){
    const stem=ck.split('/').pop().replace(/\.[^.]+$/,'');
    const ckMatch=comfyCkpts.find(c=>{
      const fn=(c.file_name||'').toLowerCase();
      return fn.split('/').pop().replace(/\.[^.]+$/,'')===stem;
    });
    if(ckMatch){
      const bm=ckptBaseModel(ckMatch);
      if(bm.includes('illustrious'))newModel='illustrious';
      else if(bm.includes('pony'))newModel='pony';
      else if(bm.includes('sdxl'))newModel='sdxl';
    }
  }
  if(!newModel){
    const sets=(m.loras||[]).map(l=>{
      const lr=loraList.find(x=>x.file_name===l.name);
      return lr?getLoraModels(lr):null;
    }).filter(Boolean);
    if(sets.length){
      const inter=sets.reduce((a,b)=>a.filter(x=>b.includes(x)));
      if(inter.length===1)newModel=inter[0];
      else if(inter.includes('illustrious'))newModel='illustrious';
      else if(inter.includes('pony'))newModel='pony';
      else if(inter.length)newModel=inter[0];
    }
  }
  if(!newModel){
    if(/pony/.test(ck))newModel='pony';
    else if(/illustrious|noob|wai|hassaku|plantmilk|novacomic|homosimile/.test(ck))newModel='illustrious';
    else newModel='sdxl';
  }
  if(newModel!==model)setModel(newModel);

  // Clear current state
  activeTags={};
  activeLoRAs={};

  // Populate LoRAs from metadata (strength as-is from image)
  if(m.loras&&m.loras.length){
    m.loras.forEach(l=>{
      const key=l.name;
      const lr=loraList.find(x=>x.file_name===key);
      const name=lr?(lr.display_name||lr.file_name):key;
      const w=(l.strength!=null&&!isNaN(l.strength))?parseFloat(l.strength):0.8;
      activeLoRAs[key]={name,weight:w};
    });
  }

  // Strip <lora:...> calls and quality tokens from positive prompt
  let pos=m.positive||'';
  pos=pos.replace(/<lora:[^>]*>/gi,'');
  const qualityTokens=[
    'score_9','score_8_up','score_7_up','score_6_up','score_5_up','score_4_up',
    'masterwork','masterpiece','highres','very aesthetic','absurdres',
    'best quality','amazing quality','intricate details','perfect composition'
  ];
  qualityTokens.forEach(t=>{
    const re=new RegExp('(^|,)\\s*'+t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*(?=,|$)','gi');
    pos=pos.replace(re,'$1');
  });
  // Strip each active LoRA's required triggers, prefix, and suffix — buildPos re-injects
  // them on send, so leaving them in subject would double-print them.
  Object.keys(activeLoRAs).forEach(key=>{
    const tw=parseTriggers(resolveTriggerSource(key));
    const d=getLora(key);
    const tokens=[
      ...tw.required,
      ...(d.prefix||'').split(',').map(t=>t.trim()).filter(Boolean),
      ...(d.suffix||'').split(',').map(t=>t.trim()).filter(Boolean),
    ];
    tokens.forEach(t=>{
      const re=new RegExp('(^|,)\\s*'+t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*(?=,|$)','gi');
      pos=pos.replace(re,'$1');
    });
  });
  pos=pos.replace(/\s*,\s*,+/g,', ').replace(/^\s*,\s*|\s*,\s*$/g,'').trim();
  document.getElementById('subject-input').value=pos;

  // Lock in the metadata negative verbatim
  remixNegBase=m.negative||'';

  // Re-render UI that depends on active state
  renderLoraGrid();
  renderLoraTab();
  renderTagSections();
  updateNav();
  updateOutput();
  updateLoraStats();

  // Show a small indicator that neg is locked to remix
  showRemixNegIndicator();

  // Pre-fill the Send-to-ComfyUI panel with this image's settings
  _comfyRemixCkpt=null; // reset before applying
  applyRemixToSendPanel(m);

  // Take the user to the Generate tab so they can see and act on the remixed state
  closeGalleryDetail();
  switchTab('tags');
}

function img2imgFromGallery(){
  if(!galleryDetailFile)return;
  showInlineConfirm(
    'Use this image as img2img source? (loads settings + sets source image)',
    ()=>doImg2imgFromGallery(galleryDetailFile),
    {okLabel:'img2img',okColor:'#0e7490'}
  );
}
async function doImg2imgFromGallery(file){
  const img=galleryImages.find(i=>i.name===file);
  const folder=img?.folder||'raw';
  // Check metadata first — img2img still works without it, just skip remix
  let hasMeta=false;
  try{
    const res=await fetch(`/gallery/metadata?folder=${folder}&file=${encodeURIComponent(file)}`);
    if(res.ok){const m=await res.json();hasMeta=!!m.has_metadata;}
  }catch{}
  _img2imgSource={file,folder};
  if(hasMeta){
    await doRemixFromGallery(file);
  }else{
    closeGalleryDetail();
    switchTab('tags');
  }
  showImg2imgStrip();
}

// ===================== SHARE TO CIVITAI =====================
function shareToCI(){
  if(!galleryDetailFile)return;
  const file=galleryDetailFile;
  const img=galleryImages.find(i=>i.name===file);
  const ext=(file.split('.').pop()||'').toLowerCase();
  if(!['png','jpg','jpeg','webp'].includes(ext)){
    showToast('Share','Only PNG, JPG, and WebP images can be shared','err');
    return;
  }
  const isUpscaled=!!(appData.galleryUpscaled&&appData.galleryUpscaled[file]);
  if(!isUpscaled&&!isVideoFile(file)){
    showInlineConfirm('This image hasn\'t been upscaled. Upscale to 2× first?',
      ()=>{doUpscaleFromGallery(file);},
      {okLabel:'Upscale first',okColor:'#a78bfa',cancelLabel:'Share as-is',
       onCancel:()=>shareToCI_confirm(file,img)});
    return;
  }
  shareToCI_confirm(file,img);
}
function shareToCI_confirm(file,img){
  const isBrut=appData.galleryAdult&&appData.galleryAdult[file];
  const msg=isBrut
    ?'Upload this image to CivitAI? Your prompt and settings will be pre-filled.<br><br><span style="color:var(--amber);font-size:11px;">⚠ This image is marked Brut — remember to set the Mature flag on CivitAI before publishing.</span>'
    :'Upload this image to CivitAI? Your prompt and settings will be pre-filled.';
  showInlineConfirm(msg,()=>doShareToCI(file,img),{okLabel:'Share',okColor:'var(--orange)'});
}
async function doShareToCI(file,img){
  const folder=img?.folder||'raw';
  const apiKey=appData.settings&&appData.settings.civitaiApiKey;
  if(!apiKey){
    showToast('No API key','Set your CivitAI API key in Settings','err');
    return;
  }
  showToast('Uploading to CivitAI…','This may take a moment');

  let meta=null;
  try{
    const mres=await fetch(`/gallery/metadata?folder=${folder}&file=${encodeURIComponent(file)}`);
    if(mres.ok){const m=await mres.json();if(m.has_metadata&&(m.positive||m.checkpoint))meta=m;}
  }catch{}
  if(!meta){
    const upRec=appData.galleryUpscaled&&appData.galleryUpscaled[file];
    if(upRec&&upRec.meta)meta=upRec.meta;
  }

  const descParts=[];
  const tags=[];
  if(meta){
    if(meta.positive)descParts.push('**Prompt:** '+meta.positive);
    if(meta.negative)descParts.push('**Negative:** '+meta.negative);
    const settings=[];
    if(meta.checkpoint)settings.push('Checkpoint: '+meta.checkpoint);
    if(meta.steps)settings.push('Steps: '+meta.steps);
    if(meta.cfg)settings.push('CFG: '+meta.cfg);
    if(meta.sampler)settings.push('Sampler: '+meta.sampler);
    if(meta.scheduler)settings.push('Scheduler: '+meta.scheduler);
    if(meta.seed)settings.push('Seed: '+meta.seed);
    if(meta.width&&meta.height)settings.push('Size: '+meta.width+'×'+meta.height);
    if(meta.denoise!=null&&meta.denoise<1)settings.push('Denoise: '+meta.denoise);
    if(settings.length)descParts.push('**Settings:** '+settings.join(' · '));
    if(meta.loras&&meta.loras.length){
      const loraNames=meta.loras.map(l=>{
        const ld=appData.loraData&&appData.loraData[l.name+'.safetensors'];
        const displayName=ld?.name||l.name;
        return displayName+(l.strength!=null&&l.strength!==1?' ('+l.strength+')':'');
      });
      descParts.push('**LoRAs:** '+loraNames.join(', '));
    }
    if(meta.checkpoint){
      const stem=meta.checkpoint.split('/').pop().replace(/\.[^.]+$/,'');
      const ckData=appData.checkpointNotes&&appData.checkpointNotes[stem+'.safetensors'];
      tags.push(ckData?.displayName||stem);
    }
    if(meta.loras){
      for(const l of meta.loras){
        if(tags.length>=5)break;
        const ld=appData.loraData&&appData.loraData[l.name+'.safetensors'];
        tags.push(ld?.name||l.name);
      }
    }
  }

  const isBrut=!!(appData.galleryAdult&&appData.galleryAdult[file]);

  try{
    const ures=await fetch('/gallery/share-upload',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        file,folder,apiKey,
        meta:meta||null,
        description:descParts.length?descParts.join('\n\n'):'',
        tags:tags.slice(0,5),
        isBrut
      })
    });
    const uj=await ures.json();
    if(!uj.ok||!uj.postUrl)throw new Error(uj.error||'Upload failed');
    if(!appData.galleryShared)appData.galleryShared={};
    appData.galleryShared[file]={postUrl:uj.postUrl,ts:Date.now()};
    saveAppData();
    const card=document.querySelector(`.gthumb[data-file="${file.replace(/"/g,'&quot;')}"]`);
    if(card){
      const isUp=!!(appData.galleryUpscaled&&appData.galleryUpscaled[file]);
      const existing=card.querySelector('.gshared-badge');
      if(existing)existing.remove();
      card.insertAdjacentHTML('beforeend',`<div class="gshared-badge${isUp?' gold':''}" title="Shared to CivitAI">↗</div>`);
      const hdBadge=card.querySelector('.gupscale-badge');
      if(hdBadge)hdBadge.remove();
    }
    showToast('Posted to CivitAI','Click to view','ok');
    openCivitAI(uj.postUrl);
  }catch(e){
    showToast('Upload failed',e.message,'err');
  }
}

// ---- Upscale ----

function upscaleFromGallery(){
  const file=galleryDetailFile;
  if(!file)return;
  if(isVideoFile(file)){showToast('Cannot upscale','Video files are not supported','err');return;}
  showInlineConfirm('Upscale this image to 2× resolution?',()=>doUpscaleFromGallery(file),{okLabel:'Upscale',okColor:'#a78bfa'});
}

async function doUpscaleFromGallery(file){
  const img=galleryImages.find(i=>i.name===file);
  const folder=img?img.folder:'raw';

  let meta=null;
  try{
    const mr=await fetch(`/gallery/metadata?folder=${folder}&file=${encodeURIComponent(file)}`);
    if(mr.ok){const mj=await mr.json();if(mj.has_metadata)meta=mj;}
  }catch{}

  showToast('Uploading for upscale…','','info');
  let uploadedName;
  try{
    const ur=await fetch('/comfy/upload-gallery',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({file,folder}),
    });
    const ud=await ur.json();
    if(!ur.ok||!ud.name)throw new Error(ud.error||'Upload failed');
    uploadedName=ud.name;
  }catch(e){
    showToast('Upload failed',e.message,'err');
    return;
  }

  let targetW=0,targetH=0;
  if(meta&&meta.width&&meta.height){
    targetW=Math.round(parseInt(meta.width)*2/8)*8;
    targetH=Math.round(parseInt(meta.height)*2/8)*8;
  }

  const origStem=file.replace(/\.[^.]+$/,'');
  const wf=buildUpscaleWorkflow({
    sourceImage:uploadedName,
    targetW,targetH,
    filenamePrefix:'Up_'+origStem,
  });

  try{
    const r=await fetch('/comfy/prompt',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({prompt:wf,client_id:'prompt-gen'}),
    });
    const j=await r.json();
    if(!r.ok||j.error){
      let detail='';
      if(j.node_errors&&typeof j.node_errors==='object'){
        const ids=Object.keys(j.node_errors);
        if(ids.length){
          const ne=j.node_errors[ids[0]];
          const firstErr=ne.errors&&ne.errors[0];
          if(firstErr)detail=(ne.class_type?ne.class_type+': ':'')+(firstErr.details||firstErr.message);
        }
      }
      showToast('Upscale error',detail||(typeof j.error==='string'?j.error:JSON.stringify(j.error)),'err');
      _pendingUpscale=null;
      return;
    }
    _pendingUpscale={promptId:j.prompt_id,originalFile:file,originalFolder:folder,meta};
    let sub=targetW?`${targetW}×${targetH}`:'2× upscale';
    try{
      const qr=await fetch('/comfy/queue');
      if(qr.ok){const q=await qr.json();const ahead=(q.running||0)+(q.pending||0)-1;if(ahead>0)sub+=` · ${ahead} ahead`;}
    }catch{}
    showToast('Upscale queued',sub,'ok');
  }catch(e){
    showToast('Upscale failed',e.message||'ComfyUI not reachable','err');
    return;
  }

  closeGalleryDetail();
}

async function finalizeUpscale(pu,wsFile){
  // loadGallery may rename the file (dedup with approved/ folder), so we need
  // the real on-disk name before we can assign properties. The new file always
  // starts in raw/ — match there to avoid hitting an old approved file with
  // the same stem.
  await loadGallery();
  const stem=wsFile.replace(/\.[^.]+$/,'');
  const realFile=galleryImages.find(i=>i.folder==='raw'&&i.name===wsFile)
    ||galleryImages.find(i=>i.folder==='raw'&&i.name.startsWith(stem));
  const upscaledFile=realFile?realFile.name:wsFile;
  inheritUpscaleProperties(pu.originalFile,upscaledFile,pu.meta);
  setTimeout(()=>archiveUpscaleOriginal(pu.originalFile,pu.originalFolder,upscaledFile),4000);
}

function inheritUpscaleProperties(originalFile,upscaledFile,originalMeta){
  // Copy all properties from original → upscaled (runs immediately on WS completion)
  if(appData.galleryState&&appData.galleryState[originalFile]){
    appData.galleryState[upscaledFile]=appData.galleryState[originalFile];
  }
  if(appData.galleryAdult&&appData.galleryAdult[originalFile]){
    if(!appData.galleryAdult)appData.galleryAdult={};
    appData.galleryAdult[upscaledFile]=true;
  }
  if(appData.galleryTags&&appData.galleryTags[originalFile]){
    if(!appData.galleryTags)appData.galleryTags={};
    appData.galleryTags[upscaledFile]=[...appData.galleryTags[originalFile]];
  }
  if(appData.galleryFavorites&&appData.galleryFavorites[originalFile]){
    if(!appData.galleryFavorites)appData.galleryFavorites={};
    appData.galleryFavorites[upscaledFile]=true;
  }
  if(appData.galleryTiming&&appData.galleryTiming[originalFile]!=null){
    if(!appData.galleryTiming)appData.galleryTiming={};
    appData.galleryTiming[upscaledFile]=appData.galleryTiming[originalFile];
  }
  if(appData.galleryCats){
    appData.galleryCats.forEach(cat=>{
      if(cat.keys.includes(originalFile)&&!cat.keys.includes(upscaledFile)){
        cat.keys.push(upscaledFile);
      }
    });
  }
  // Clear stale shared status — the new file hasn't been shared even if an
  // old file with the same name was (filename reuse from ComfyUI counter reset)
  if(appData.galleryShared)delete appData.galleryShared[upscaledFile];
  if(appData.galleryRedditPosted)delete appData.galleryRedditPosted[upscaledFile];
  // Track upscale relationship + stash metadata
  if(!appData.galleryUpscaled)appData.galleryUpscaled={};
  const upRec={original:originalFile,ts:Date.now()};
  if(originalMeta)upRec.meta=originalMeta;
  appData.galleryUpscaled[upscaledFile]=upRec;
  saveAppData();
}

async function archiveUpscaleOriginal(originalFile,originalFolder,upscaledFile){
  // If original was approved, approve the upscaled file too
  if(appData.galleryState&&appData.galleryState[originalFile]==='approved'){
    try{
      await fetch('/gallery/approve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({file:upscaledFile})});
      const entry=galleryImages.find(i=>i.name===upscaledFile);
      if(entry)entry.folder='approved';
    }catch{}
  }

  // Archive original
  let archived=false;
  try{
    const ar=await fetch('/gallery/archive-original',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({file:originalFile,folder:originalFolder}),
    });
    if(ar.ok)archived=true;
    else{const ae=await ar.json().catch(()=>({}));showToast('Archive failed',ae.error||`HTTP ${ar.status}`,'err');}
  }catch(e){
    showToast('Archive failed',e.message,'err');
  }

  if(archived){
    // Remove original from gallery only if archive succeeded
    const idx=galleryImages.findIndex(i=>i.name===originalFile);
    if(idx!==-1)galleryImages.splice(idx,1);
    if(appData.galleryState)delete appData.galleryState[originalFile];
    if(appData.galleryAdult)delete appData.galleryAdult[originalFile];
    if(appData.galleryTags)delete appData.galleryTags[originalFile];
    if(appData.galleryAutoTagged)delete appData.galleryAutoTagged[originalFile];
    if(appData.galleryTiming)delete appData.galleryTiming[originalFile];
    if(appData.galleryShared)delete appData.galleryShared[originalFile];
    if(appData.galleryRedditPosted)delete appData.galleryRedditPosted[originalFile];
    if(appData.galleryFavorites)delete appData.galleryFavorites[originalFile];
    if(appData.galleryCats){
      appData.galleryCats.forEach(cat=>{
        const ki=cat.keys.indexOf(originalFile);
        if(ki!==-1)cat.keys.splice(ki,1);
      });
    }
  }

  saveAppData();
  await loadGallery();
  showToast('Upscale complete',`${upscaledFile}${archived?' · original archived':''}`,'ok');
}

function showImg2imgStrip(){
  const strip=document.getElementById('img2img-strip');
  if(!strip||!_img2imgSource)return;
  const {file,folder}=_img2imgSource;
  const src=`/gallery/image?folder=${folder}&file=${encodeURIComponent(file)}`;
  strip.querySelector('.i2i-thumb').src=src;
  strip.querySelector('.i2i-name').textContent=file;
  const slider=document.getElementById('i2i-denoise');
  const val=document.getElementById('i2i-denoise-val');
  if(slider&&val){slider.value='0.75';val.textContent='0.75';}
  strip.classList.add('active');
  updateSendBtnLabel();
}

function clearImg2img(){
  _img2imgSource=null;
  const strip=document.getElementById('img2img-strip');
  if(strip)strip.classList.remove('active');
  updateSendBtnLabel();
}

function updateDenoiseLabel(){
  const slider=document.getElementById('i2i-denoise');
  const val=document.getElementById('i2i-denoise-val');
  if(slider&&val)val.textContent=parseFloat(slider.value).toFixed(2);
}

function showDenoiseTooltip(icon){
  const tip=document.getElementById('i2i-tooltip');
  if(!tip)return;
  const r=icon.getBoundingClientRect();
  tip.style.display='block';
  tip.style.left='';tip.style.top='';tip.style.right='';tip.style.bottom='';
  tip.style.bottom=(window.innerHeight-r.top+8)+'px';
  tip.style.right=(window.innerWidth-r.right)+'px';
}
function hideDenoiseTooltip(){
  const tip=document.getElementById('i2i-tooltip');
  if(tip)tip.style.display='none';
}

function showRemixNegIndicator(){
  let ind=document.getElementById('remix-neg-indicator');
  if(ind)return;
  const negBox=document.getElementById('out-neg');
  if(!negBox||!negBox.parentElement)return;
  ind=document.createElement('div');
  ind.id='remix-neg-indicator';
  ind.style.cssText='font-family:var(--mono);font-size:9px;color:var(--blue);margin-top:4px;display:flex;align-items:center;gap:8px;';
  ind.innerHTML='<span>\u25CF remix negative locked</span><button onclick="clearRemixNeg()" style="background:transparent;border:1px solid var(--border2);color:var(--muted);font-family:var(--mono);font-size:9px;padding:2px 7px;border-radius:4px;cursor:pointer;">clear</button>';
  negBox.parentElement.appendChild(ind);
}

function renderGalleryMetadata(m,file){
  let html='';

  // Positive prompt
  if(m.positive){
    html+=`<div class="gdp-meta-section">
      <div class="gdp-meta-label">Positive Prompt</div>
      <div class="gdp-meta-prompt">${esc(m.positive)}</div>
    </div>`;
  }

  // Negative prompt
  if(m.negative){
    html+=`<div class="gdp-meta-section">
      <div class="gdp-meta-label">Negative Prompt</div>
      <div class="gdp-meta-prompt neg">${esc(m.negative)}</div>
    </div>`;
  }

  // LoRAs
  if(m.loras&&m.loras.length){
    html+=`<div class="gdp-meta-section">
      <div class="gdp-meta-label">LoRAs</div>
      <div>${m.loras.map(l=>{
        const str=l.strength!=null?`<span class="lora-str">${l.strength}</span>`:'';
        const en=eq(l.name);
        const sv=l.strength!=null?l.strength:'';
        return `<span class="gdp-meta-chip clickable" onclick="openLoraMetaPopover('${en}','${sv}',event)">${esc(l.name)}${str}</span>`;
      }).join('')}</div>
    </div>`;
  }

  // Generation params grid
  const params=[];
  if(m.checkpoint){const ckStem=m.checkpoint.split('/').pop().replace(/\.[^.]+$/,'');const ckDisplay=(appData.checkpointNotes||{})[ckStem]?.displayName||m.checkpoint;params.push(['Checkpoint',ckDisplay]);}
  if(m.seed!=null)params.push(['Seed',m.seed]);
  if(m.steps!=null)params.push(['Steps',m.steps]);
  if(m.cfg!=null)params.push(['CFG',m.cfg]);
  if(m.sampler)params.push(['Sampler',m.sampler]);
  if(m.scheduler)params.push(['Scheduler',m.scheduler]);
  if(m.width&&m.height)params.push(['Size',`${m.width}×${m.height}`]);
  if(m.denoise!=null&&m.denoise!==1)params.push(['Denoise',m.denoise]);
  const genDur=file&&appData.galleryTiming?.[file];
  if(genDur!=null)params.push(['Time',formatDuration(genDur)]);

  if(params.length){
    html+=`<div class="gdp-meta-section">
      <div class="gdp-meta-label">Parameters</div>
      <div class="gdp-meta-grid">${params.map(([k,v])=>
        `<div><span style="color:var(--muted);font-family:var(--mono);font-size:9px;">${k}</span><br><span style="font-family:var(--mono);font-size:11px;color:var(--text);">${esc(String(v))}</span></div>`
      ).join('')}</div>
    </div>`;
  }

  return html;
}

// ===================== LORA METADATA POPOVER =====================
function openLoraMetaPopover(name,genStrength,e){
  e.stopPropagation();
  const pop=document.getElementById('lora-meta-popover');
  if(!pop)return;
  // If clicking the same chip that already has the popover open, close it
  if(pop.classList.contains('open')&&pop.dataset.key===name){
    closeLoraMetaPopover();
    return;
  }
  const lora=loraList.find(l=>l.file_name===name);
  pop.dataset.key=name;
  if(!lora){
    pop.innerHTML=`<div class="lmpop-missing"><div style="font-size:12px;color:var(--text);margin-bottom:4px;">${esc(name)}</div>Not in your library</div>`;
  }else{
    const d=getLora(name);
    const customImg=d.image;
    const rawSrc=lora.preview_url?(lora.preview_url.startsWith('/api/')?'/'+lora.preview_url.replace(/^\//,''):lora.preview_url):null;
    const imgSrc=customImg||rawSrc;
    const imgHtml=imgSrc
      ?`<img class="lmpop-img" src="${imgSrc}" onerror="this.outerHTML='<div class=\\'lmpop-img-placeholder\\'>No preview</div>'">`
      :'<div class="lmpop-img-placeholder">No preview</div>';
    const displayName=d.name||lora.model_name;
    const type=getLoraType(lora);
    const status=getLoraStatus(name);
    const statusDot=status?`<span class="lmpop-status-dot ${status}" title="${status}"></span>`:'';
    const typeHtml=type?`<span class="lmpop-type">${esc(type)}</span>`:'';
    // Strength comparison
    const saved=d.strength;
    const gen=genStrength!==''&&genStrength!=null?parseFloat(genStrength):null;
    let strHtml='';
    if(gen!=null){
      const genStr=gen.toFixed(2);
      if(saved!=null&&Math.abs(saved-gen)>0.001){
        strHtml=`<div class="lmpop-strengths">This image: <b>${genStr}</b> &nbsp;·&nbsp; your default: <span class="diff">${parseFloat(saved).toFixed(2)}</span></div>`;
      }else{
        strHtml=`<div class="lmpop-strengths">Strength: <b>${genStr}</b></div>`;
      }
    }else if(saved!=null){
      strHtml=`<div class="lmpop-strengths">Your default: <b>${parseFloat(saved).toFixed(2)}</b></div>`;
    }
    const notesHtml=d.notes?`<div class="lmpop-notes">${esc(d.notes)}</div>`:'';
    const ek=eq(name);
    pop.innerHTML=imgHtml+
      `<div class="lmpop-body">`+
      `<div class="lmpop-name">${esc(displayName)}</div>`+
      (type||status?`<div class="lmpop-meta-row">${statusDot}${typeHtml}</div>`:'')+
      strHtml+
      notesHtml+
      `<button class="lmpop-btn" onclick="lmpopOpenInfo('${ek}',event)">Open Info</button>`+
      `</div>`;
  }
  // Position near the chip, flip if near viewport edges
  pop.style.display='block';
  pop.classList.add('open');
  const rect=e.currentTarget.getBoundingClientRect();
  requestAnimationFrame(()=>{
    const pw=pop.offsetWidth||260;
    const ph=pop.offsetHeight||300;
    let left=rect.left;
    let top=rect.bottom+6;
    if(left+pw>window.innerWidth-8)left=window.innerWidth-pw-8;
    if(left<8)left=8;
    if(top+ph>window.innerHeight-8)top=rect.top-ph-6;
    if(top<8)top=8;
    pop.style.left=left+'px';
    pop.style.top=top+'px';
  });
}
function closeLoraMetaPopover(){
  const pop=document.getElementById('lora-meta-popover');
  if(!pop)return;
  pop.classList.remove('open');
  pop.style.display='none';
  delete pop.dataset.key;
}
function lmpopOpenInfo(key,e){
  e.stopPropagation();
  closeLoraMetaPopover();
  setTimeout(()=>openLpPanel(key),10);
}

function toggleMetadataAccordion(){
  const toggle=document.getElementById('gdp-accordion-toggle');
  const meta=document.getElementById('gdp-metadata');
  if(!toggle||!meta)return;
  const isOpen=meta.classList.toggle('open');
  toggle.classList.toggle('open',isOpen);
}

function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

function updateGalleryDetailCat(){
  const sel=document.getElementById('gdp-cat');
  if(!sel||!galleryDetailFile)return;
  const current=getImageCategory(galleryDetailFile);
  sel.innerHTML='<option value="">Uncategorized</option>'+galleryCats.map(c=>
    `<option value="${c.id}"${current===c.id?' selected':''}>${c.label}</option>`
  ).join('');
}

function gallerySetCategory(catId){
  if(!galleryDetailFile)return;
  setImageCategory(galleryDetailFile,catId||null);
  updateGalleryDetailCat();
}

function updateGalleryDetailState(){
  if(!galleryDetailFile)return;
  const state=(appData.galleryState||{})[galleryDetailFile]||'unreviewed';
  const badge=document.getElementById('gdp-state');
  if(badge){badge.className='gdp-state-badge '+state;badge.textContent=state;}
  const imgWrap=document.querySelector('.gallery-detail-img-wrap');
  if(imgWrap){
    imgWrap.classList.remove('state-review','state-approved','state-declined');
    if(state!=='unreviewed')imgWrap.classList.add('state-'+state);
  }
}

function galleryNavigate(e){
  const detailOpen=document.getElementById('gallery-detail')?.classList.contains('open');
  const lightboxOpen=document.getElementById('lp-lightbox')?.classList.contains('open');
  if(!detailOpen&&!lightboxOpen)return;
  if(!galleryDetailFile)return;
  e.preventDefault();
  const cards=[...document.querySelectorAll('#gallery-grid .gthumb')];
  const files=cards.map(c=>c.dataset.file);
  const idx=files.indexOf(galleryDetailFile);
  if(idx===-1)return;
  const next=e.key==='ArrowRight'?idx+1:idx-1;
  if(next<0||next>=files.length)return;
  openGalleryDetail(files[next]);
  if(lightboxOpen) openGalleryLightbox();
}

function closeGalleryDetail(){
  cancelGalleryRename();
  galleryDetailFile=null;
  document.getElementById('gallery-detail').classList.remove('open');
  document.getElementById('gallery-detail-backdrop').classList.remove('visible');
  document.getElementById('gdp-img').src='';
  const meta=document.getElementById('gdp-metadata');
  if(meta)meta.classList.remove('open');
  const inner=document.getElementById('gdp-metadata-inner');
  if(inner)inner.innerHTML='';
  const toggle=document.getElementById('gdp-accordion-toggle');
  if(toggle)toggle.classList.remove('open');
}

async function galleryApprove(){
  if(!galleryDetailFile)return;
  const file=galleryDetailFile;
  const current=(appData.galleryState||{})[file];
  if(!appData.galleryState)appData.galleryState={};
  if(current==='approved'){
    try{
      const res=await fetch('/gallery/unapprove',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({file})});
      if(!res.ok)throw new Error(await res.text());
      delete appData.galleryState[file];
      const entry=galleryImages.find(i=>i.name===file);
      if(entry)entry.folder='raw';
    }catch(e){console.error('Gallery unapprove failed:',e);return;}
  }else{
    try{
      const res=await fetch('/gallery/approve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({file})});
      if(!res.ok)throw new Error(await res.text());
      appData.galleryState[file]='approved';
      const entry=galleryImages.find(i=>i.name===file);
      if(entry)entry.folder='approved';
    }catch(e){console.error('Gallery approve failed:',e);return;}
  }
  saveAppData();
  updateGalleryDetailState();
  patchGalleryCard(file);
}

function galleryDecline(){
  if(!galleryDetailFile)return;
  if(!appData.galleryState)appData.galleryState={};
  const current=appData.galleryState[galleryDetailFile];
  if(current==='declined')delete appData.galleryState[galleryDetailFile];
  else appData.galleryState[galleryDetailFile]='declined';
  saveAppData();
  updateGalleryDetailState();
  patchGalleryCard(galleryDetailFile);
}

async function galleryProcessDeclined(){
  const state=appData.galleryState||{};
  const declined=galleryImages.filter(img=>state[img.name]==='declined');
  if(!declined.length)return;
  showInlineConfirm(`Permanently trash ${declined.length} declined image${declined.length===1?'':'s'}?`,async()=>{
  for(const img of declined){
    try{
      const res=await fetch('/gallery/decline',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({file:img.name,folder:img.folder})});
      if(!res.ok)throw new Error(await res.text());
      delete appData.galleryState[img.name];
      galleryImages=galleryImages.filter(i=>i.name!==img.name);
    }catch(e){console.error('Failed to trash:',img.name,e);}
  }
  saveAppData();
  closeGalleryDetail();
  renderGallery();
  }); // end showInlineConfirm
}

function gallerySetReview(){
  if(!galleryDetailFile)return;
  if(!appData.galleryState)appData.galleryState={};
  const current=appData.galleryState[galleryDetailFile];
  if(current==='review')delete appData.galleryState[galleryDetailFile];
  else appData.galleryState[galleryDetailFile]='review';
  saveAppData();
  updateGalleryDetailState();
  patchGalleryCard(galleryDetailFile);
}

// Patch a single card's border state without rebuilding the grid
function patchGalleryCard(filename){
  const s=(appData.galleryState||{})[filename]||'unreviewed';
  const card=document.querySelector(`.gthumb[data-file="${filename.replace(/"/g,'&quot;')}"]`);
  if(card){
    const sel=card.classList.contains('gsel')?' gsel':'';
    card.className=`gthumb state-${s}${sel}`;
  }
  updateGalleryFilterCounts();
}

function openGalleryLightbox(){
  const el=document.getElementById('gdp-img');
  if(!el||!el.src)return;
  const lb=document.getElementById('lp-lightbox');
  const isVid=isVideoFile(galleryDetailFile||'');
  if(isVid){
    lb.innerHTML=`<video src="${el.src}" controls autoplay muted style="max-width:90vw;max-height:90vh;border-radius:6px;" onclick="event.stopPropagation()"></video>`;
  }else{
    lb.innerHTML=`<img id="lp-lightbox-img" src="${el.src}" alt="">`;
  }
  lb.classList.add('open');
}

// ---- Gallery select mode + bulk actions ----
function exitGallerySelectMode(){
  gallerySelectMode=false;
  gallerySelected.clear();
  _galleryLastClicked=null;
  const selBtn=document.getElementById('gtf-select');
  if(selBtn)selBtn.classList.remove('active');
  document.querySelectorAll('.gthumb.gsel').forEach(c=>c.classList.remove('gsel'));
  document.querySelectorAll('.gallery-grid').forEach(g=>g.classList.remove('select-mode'));
  updateBulkBar();
}

function galleryCardClick(file,e){
  // If context menu is open, just close it
  const gctx=document.getElementById('gallery-ctx-menu');
  if(gctx&&gctx.style.display==='block'){gctx.style.display='none';_galleryCtxFile=null;return;}

  // Cmd+click (metaKey on Mac) or Ctrl+click or Shift+click enters/extends select mode
  const isModified=e.metaKey||e.ctrlKey||e.shiftKey;
  if(gallerySelectMode||isModified){
    e.stopPropagation();
    if(!gallerySelectMode){
      gallerySelectMode=true;
      const _selBtn=document.getElementById('gtf-select');if(_selBtn)_selBtn.classList.add('active');
      document.querySelectorAll('.gallery-grid').forEach(g=>g.classList.add('select-mode'));
    }
    if(e.shiftKey&&_galleryLastClicked){
      // Range select: select everything between last clicked and this one
      const cards=[...document.querySelectorAll('#gallery-grid .gthumb')];
      const files=cards.map(c=>c.dataset.file);
      const a=files.indexOf(_galleryLastClicked);
      const b=files.indexOf(file);
      if(a!==-1&&b!==-1){
        const start=Math.min(a,b),end=Math.max(a,b);
        for(let i=start;i<=end;i++){
          gallerySelected.add(files[i]);
          cards[i].classList.add('gsel');
        }
      }
    }else{
      // Toggle single
      const card=document.querySelector(`.gthumb[data-file="${file.replace(/"/g,'&quot;')}"]`);
      if(gallerySelected.has(file)){gallerySelected.delete(file);card?.classList.remove('gsel');}
      else{gallerySelected.add(file);card?.classList.add('gsel');}
    }
    _galleryLastClicked=file;
    updateBulkBar();
    return;
  }
  openGalleryDetail(file);
}

function toggleGallerySelect(){
  gallerySelectMode=!gallerySelectMode;
  const gtfSel=document.getElementById('gtf-select');
  if(gtfSel)gtfSel.classList.toggle('active',gallerySelectMode);
  if(!gallerySelectMode){
    gallerySelected.clear();
    _galleryLastClicked=null;
    document.querySelectorAll('.gthumb.gsel').forEach(c=>c.classList.remove('gsel'));
  }
  document.querySelectorAll('.gallery-grid').forEach(g=>g.classList.toggle('select-mode',gallerySelectMode));
  updateBulkBar();
}

function setGallerySort(val){
  _gallerySortOrder=val;
  galleryImages.sort((a,b)=>val==='oldest'?(a.mtime-b.mtime):(b.mtime-a.mtime));
  renderGallery();
}

function gallerySelectAll(){
  const cards=[...document.querySelectorAll('#gallery-grid .gthumb')];
  cards.forEach(c=>{gallerySelected.add(c.dataset.file);c.classList.add('gsel');});
  updateBulkBar();
}

function galleryDeselectAll(){
  gallerySelected.clear();
  _galleryLastClicked=null;
  document.querySelectorAll('.gthumb.gsel').forEach(c=>c.classList.remove('gsel'));
  updateBulkBar();
}

function updateBulkBar(){
  const bar=document.getElementById('gallery-bulk-bar');
  if(!bar)return;
  const n=gallerySelected.size;
  bar.style.display=(gallerySelectMode&&n>0)?'flex':'none';
  const count=document.getElementById('gbulk-count');
  if(count)count.textContent=`${n} selected`;
  const compareBtn=document.getElementById('gtf-compare');
  if(compareBtn)compareBtn.style.display=(gallerySelectMode&&n===2)?'':'none';
}

async function galleryBulkApprove(){
  const files=[...gallerySelected];
  if(!files.length)return;
  if(!appData.galleryState)appData.galleryState={};
  for(const file of files){
    if(appData.galleryState[file]==='approved')continue;
    try{
      const res=await fetch('/gallery/approve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({file})});
      if(!res.ok)continue;
      appData.galleryState[file]='approved';
      const entry=galleryImages.find(i=>i.name===file);
      if(entry)entry.folder='approved';
    }catch(e){console.error('Bulk approve failed:',file,e);}
  }
  saveAppData();
  exitGallerySelectMode();
  renderGallery();
}

function galleryBulkDecline(){
  const files=[...gallerySelected];
  if(!files.length)return;
  if(!appData.galleryState)appData.galleryState={};
  for(const file of files){appData.galleryState[file]='declined';}
  saveAppData();
  exitGallerySelectMode();
  renderGallery();
}

function galleryBulkReview(){
  const files=[...gallerySelected];
  if(!files.length)return;
  if(!appData.galleryState)appData.galleryState={};
  for(const file of files){appData.galleryState[file]='review';}
  saveAppData();
  exitGallerySelectMode();
  renderGallery();
}

// ---- Compare mode ----
let compareFiles={left:null,right:null};

function openCompareMode(){
  const selected=[...gallerySelected];
  if(selected.length!==2)return;
  compareFiles.left=selected[0];
  compareFiles.right=selected[1];
  // Populate both sides
  ['left','right'].forEach(side=>{
    const file=compareFiles[side];
    const img=galleryImages.find(i=>i.name===file);
    const folder=img?img.folder:'raw';
    const src=`/gallery/image?folder=${folder}&file=${encodeURIComponent(file)}`;
    const wrap=document.getElementById(`compare-${side}`).querySelector('.compare-img-wrap');
    if(wrap){
      if(isVideoFile(file)){
        wrap.innerHTML=`<video id="compare-img-${side}" src="${src}" controls muted preload="metadata" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:6px;"></video>`;
      }else{
        wrap.innerHTML=`<img id="compare-img-${side}" src="${src}" alt="" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:6px;">`;
      }
    }
    const nameEl=document.getElementById(`compare-name-${side}`);
    if(nameEl)nameEl.textContent=file;
    updateCompareStateBadge(side);
  });
  document.getElementById('compare-overlay').classList.add('open');
}

function closeCompareMode(){
  document.getElementById('compare-overlay').classList.remove('open');
  compareFiles={left:null,right:null};
  // Clear images
  const imgL=document.getElementById('compare-img-left');
  const imgR=document.getElementById('compare-img-right');
  if(imgL)imgL.src='';
  if(imgR)imgR.src='';
  exitGallerySelectMode();
}

function updateCompareStateBadge(side){
  const file=compareFiles[side];
  if(!file)return;
  const state=(appData.galleryState||{})[file]||'unreviewed';
  const badge=document.getElementById(`compare-state-${side}`);
  if(badge){badge.className='compare-state-badge '+state;badge.textContent=state;}
  // Highlight active button
  const sideEl=document.getElementById(`compare-${side}`);
  if(!sideEl)return;
  sideEl.querySelectorAll('.compare-actions .gdp-btn').forEach(btn=>{
    btn.classList.remove('cmp-active');
  });
  const map={approved:'.gdp-approve',declined:'.gdp-decline',review:'.gdp-review'};
  if(map[state]){
    const active=sideEl.querySelector(`.compare-actions ${map[state]}`);
    if(active)active.classList.add('cmp-active');
  }
}

async function compareSetState(side,state){
  const file=compareFiles[side];
  if(!file)return;
  if(!appData.galleryState)appData.galleryState={};
  const current=appData.galleryState[file]||'unreviewed';

  if(state==='approved'){
    // Toggle: if already approved, go back to unreviewed
    if(current==='approved'){delete appData.galleryState[file];}
    else{
      const entry=galleryImages.find(i=>i.name===file);
      if(entry&&entry.folder==='raw'){
        try{
          const res=await fetch('/gallery/approve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({file})});
          if(!res.ok)throw new Error(await res.text());
          entry.folder='approved';
        }catch(e){console.error('Compare approve failed:',e);return;}
      }
      appData.galleryState[file]='approved';
    }
  }else if(state==='declined'){
    // Toggle: if already declined, go back to unreviewed
    if(current==='declined'){delete appData.galleryState[file];}
    else{appData.galleryState[file]='declined';}
  }else if(state==='review'){
    // Toggle: if already review, go back to unreviewed
    if(current==='review'){delete appData.galleryState[file];}
    else{appData.galleryState[file]='review';}
  }
  saveAppData();
  updateCompareStateBadge(side);
  patchGalleryCard(file);
}

function galleryBulkBrut(){
  const files=[...gallerySelected];
  if(!files.length)return;
  if(!appData.galleryAdult)appData.galleryAdult={};
  const allBrut=files.every(f=>appData.galleryAdult[f]);
  for(const file of files){
    if(allBrut)delete appData.galleryAdult[file];
    else appData.galleryAdult[file]=true;
  }
  saveAppData();
  exitGallerySelectMode();
  renderGallery();
}

let galleryLargeCards=false;
function toggleGallerySize(){
  galleryLargeCards=!galleryLargeCards;
  const label=galleryLargeCards?'Large':'Small';
  document.querySelectorAll('#gsc-size').forEach(b=>b.classList.toggle('active',galleryLargeCards));
  document.querySelectorAll('.gallery-grid').forEach(g=>g.classList.toggle('gallery-large',galleryLargeCards));
}

// ---- Gallery categories ----
function getImageCategory(filename){
  for(const cat of galleryCats){
    if(cat.keys.includes(filename))return cat.id;
  }
  return null;
}

function renderGalleryNav(){renderGalleryAlbumTabs();}

function renderGalleryAlbumTabs(){
  const el=document.getElementById('gallery-album-tabs');
  if(!el)return;
  const hideBrut=!showGalleryAdult||document.body.classList.contains('hide-brut');
  const brutKeys=hideBrut?getBrutCatKeys():new Set();
  const visibleImages=galleryImages.filter(img=>!brutKeys.has(img.name));
  const allCount=visibleImages.length;
  const catted=new Set();
  galleryCats.forEach(c=>c.keys.forEach(k=>catted.add(k)));
  const uncatCount=visibleImages.filter(img=>!catted.has(img.name)).length;
  const a=galleryCatFilter;
  let html=`<button class="gallery-album-tab${a===null?' active':''}" onclick="setGalleryCatFilter(null)"><span class="ndot" style="background:var(--muted2)"></span>All Images <span class="ncount">${allCount}</span></button>`;
  galleryCats.forEach(cat=>{
    if(hideBrut&&isCatBrut(cat.id))return;
    const count=cat.keys.filter(k=>galleryImages.some(img=>img.name===k)).length;
    const dot=isCatBrut(cat.id)?'#EF4444':(cat.color||'var(--orange)');
    html+=`<button class="gallery-album-tab${a===cat.id?' active':''}" draggable="true" data-catid="${cat.id}" onclick="setGalleryCatFilter('${cat.id}')" oncontextmenu="galleryAlbumTabCtx('${cat.id}',event)" ondragstart="gAlbumTabDragStart(event,'${cat.id}')" ondragover="gAlbumTabDragOver(event)" ondrop="gAlbumTabDrop(event,'${cat.id}')" ondragend="gAlbumTabDragEnd(event)"><span class="ndot" style="background:${dot}"></span>${cat.label} <span class="ncount">${count}</span></button>`;
  });
  if(uncatCount>0){
    html+=`<button class="gallery-album-tab${a==='__uncat'?' active':''}" onclick="setGalleryCatFilter('__uncat')"><span class="ndot" style="background:var(--muted2)"></span>Uncategorized <span class="ncount">${uncatCount}</span></button>`;
  }
  html+=`<button class="gallery-album-add" onclick="showAddGalleryCat()">+ album</button>`;
  el.innerHTML=html;
}

function galleryAlbumTabCtx(catId,e){
  e.preventDefault();e.stopPropagation();
  closeGalleryAlbumCtx();
  const brutActive=isCatBrut(catId);
  const menu=document.createElement('div');
  menu.id='gallery-album-ctx';
  menu.className='gallery-album-ctx';
  const dm=document.body.classList.contains('hide-brut');
  menu.innerHTML=`<button onclick="closeGalleryAlbumCtx();renameGalleryCat('${catId}')">✎ Rename</button>${dm?'':`<button onclick="closeGalleryAlbumCtx();toggleGalleryCatBrut('${catId}')">${brutActive?'Unmark':'Mark'} Brut</button>`}<button onclick="closeGalleryAlbumCtx();deleteGalleryCat('${catId}')">✕ Delete</button>`;
  menu.style.left=e.clientX+'px';
  menu.style.top=e.clientY+'px';
  document.body.appendChild(menu);
  setTimeout(()=>document.addEventListener('click',closeGalleryAlbumCtx,{once:true}),0);
}
function closeGalleryAlbumCtx(){
  const m=document.getElementById('gallery-album-ctx');
  if(m)m.remove();
}

let _gAlbumTabDragId=null;
function gAlbumTabDragStart(e,id){_gAlbumTabDragId=id;e.dataTransfer.effectAllowed='move';e.currentTarget.classList.add('dragging');}
function gAlbumTabDragOver(e){e.preventDefault();e.dataTransfer.dropEffect='move';const tgt=e.currentTarget;if(!tgt||tgt.dataset.catid===_gAlbumTabDragId)return;document.querySelectorAll('.gallery-album-tab.drag-over').forEach(el=>el.classList.remove('drag-over'));tgt.classList.add('drag-over');}
function gAlbumTabDrop(e,targetId){
  e.preventDefault();
  document.querySelectorAll('.gallery-album-tab.drag-over,.gallery-album-tab.dragging').forEach(el=>{el.classList.remove('drag-over');el.classList.remove('dragging');});
  if(!_gAlbumTabDragId||_gAlbumTabDragId===targetId)return;
  const fi=galleryCats.findIndex(c=>c.id===_gAlbumTabDragId);
  const ti=galleryCats.findIndex(c=>c.id===targetId);
  if(fi===-1||ti===-1)return;
  const [moved]=galleryCats.splice(fi,1);
  galleryCats.splice(ti,0,moved);
  appData.galleryCats=[...galleryCats];
  saveAppData();
  renderGalleryAlbumTabs();
  renderGallery();
  _gAlbumTabDragId=null;
}
function gAlbumTabDragEnd(e){_gAlbumTabDragId=null;document.querySelectorAll('.gallery-album-tab.drag-over,.gallery-album-tab.dragging').forEach(el=>{el.classList.remove('drag-over');el.classList.remove('dragging');});}

function setGalleryCatFilter(id){
  galleryCatFilter=id;
  renderGalleryAlbumTabs();
  renderGallery();
}

// Gallery favorite toggle
function toggleGalleryDetailFav(){
  if(!galleryDetailFile)return;
  toggleGalleryFav(galleryDetailFile);
  const btn=document.getElementById('gdp-detail-fav');
  if(btn)btn.classList.toggle('active',!!(appData.galleryFavorites||{})[galleryDetailFile]);
}

function toggleGalleryFav(filename){
  if(!appData.galleryFavorites)appData.galleryFavorites={};
  appData.galleryFavorites[filename]=!appData.galleryFavorites[filename];
  if(!appData.galleryFavorites[filename])delete appData.galleryFavorites[filename];
  saveAppData();
  const card=document.querySelector(`.gthumb[data-file="${filename.replace(/"/g,'&quot;')}"]`);
  if(card){
    const star=card.querySelector('.gfav-star');
    if(star)star.classList.toggle('active',!!appData.galleryFavorites[filename]);
  }
}

// Gallery adult (Brut) toggle
function toggleGalleryAdult(){
  showGalleryAdult=!showGalleryAdult;
  document.querySelectorAll('#gsc-brut').forEach(b=>b.classList.toggle('active',showGalleryAdult));
  renderGalleryAlbumTabs();
  renderGallery();
}

function setGalleryImageAdult(filename){
  if(!appData.galleryAdult)appData.galleryAdult={};
  appData.galleryAdult[filename]=!appData.galleryAdult[filename];
  if(!appData.galleryAdult[filename])delete appData.galleryAdult[filename];
  saveAppData();
  renderGallery();
  renderGalleryNav();
}

function toggleGalleryCatBrut(catId){
  if(!appData.galleryCatBrut)appData.galleryCatBrut={};
  appData.galleryCatBrut[catId]=!appData.galleryCatBrut[catId];
  if(!appData.galleryCatBrut[catId])delete appData.galleryCatBrut[catId];
  saveAppData();
  renderGalleryNav();
  renderGallery();
}

function isCatBrut(catId){
  return !!(appData.galleryCatBrut&&appData.galleryCatBrut[catId]);
}

function getBrutCatKeys(){
  if(!appData.galleryCatBrut)return new Set();
  const keys=new Set();
  galleryCats.forEach(c=>{
    if(appData.galleryCatBrut[c.id])c.keys.forEach(k=>keys.add(k));
  });
  return keys;
}

// Gallery category nav drag reorder
let _gcatNavDragSrc=null;
function gcatNavDragStart(e,id){_gcatNavDragSrc=id;e.dataTransfer.effectAllowed='move';}
function gcatNavDragOver(e,id){e.preventDefault();if(id===_gcatNavDragSrc)return;document.querySelectorAll('.nitem.drag-over').forEach(el=>el.classList.remove('drag-over'));document.getElementById('gcnav-'+id)?.classList.add('drag-over');}
function gcatNavDrop(e,id){
  e.preventDefault();
  document.querySelectorAll('.nitem.drag-over').forEach(el=>el.classList.remove('drag-over'));
  if(!_gcatNavDragSrc||_gcatNavDragSrc===id)return;
  const fi=galleryCats.findIndex(c=>c.id===_gcatNavDragSrc);
  const ti=galleryCats.findIndex(c=>c.id===id);
  if(fi===-1||ti===-1)return;
  const [moved]=galleryCats.splice(fi,1);
  galleryCats.splice(ti,0,moved);
  appData.galleryCats=[...galleryCats];
  saveAppData();
  renderGalleryNav();
  renderGallery();
  _gcatNavDragSrc=null;
}

function showAddGalleryCat(){
  showInlinePrompt('New category name:','',name=>{
    if(!name||!name.trim())return;
    const id='gcat_'+Date.now();
    const colors=['var(--orange)','var(--purple)','var(--blue)','var(--pink)','var(--green)','var(--amber)','var(--slate)'];
    const color=colors[galleryCats.length%colors.length];
    galleryCats.push({id,label:name.trim(),color,keys:[]});
    appData.galleryCats=[...galleryCats];
    saveAppData();
    renderGalleryNav();
  });
}

function renameGalleryCat(id){
  const cat=galleryCats.find(c=>c.id===id);
  if(!cat)return;
  showInlinePrompt('Rename category:',cat.label,name=>{
    if(!name||!name.trim())return;
    cat.label=name.trim();
    appData.galleryCats=[...galleryCats];
    saveAppData();
    renderGalleryNav();
  });
}

function deleteGalleryCat(id){
  showInlineConfirm('Delete this category? Images won\'t be removed.',()=>{
    galleryCats=galleryCats.filter(c=>c.id!==id);
    appData.galleryCats=[...galleryCats];
    saveAppData();
    if(galleryCatFilter===id)galleryCatFilter=null;
    renderGalleryNav();
    renderGallery();
  });
}

function setImageCategory(filename,catId){
  // Remove from any existing category
  galleryCats.forEach(c=>{c.keys=c.keys.filter(k=>k!==filename);});
  // Add to new category (null = uncategorize)
  if(catId){
    const cat=galleryCats.find(c=>c.id===catId);
    if(cat)cat.keys.push(filename);
  }
  appData.galleryCats=[...galleryCats];
  saveAppData();
  renderGalleryNav();
}

// ---- Gallery context menu ----
let _galleryCtxFile=null;
function openGalleryCtx(file,e){
  e.preventDefault();e.stopPropagation();
  _galleryCtxFile=file;
  const menu=document.getElementById('gallery-ctx-menu');
  const state=(appData.galleryState||{})[file]||'unreviewed';
  const approveItem=document.getElementById('gallery-ctx-approve-item');
  if(approveItem){
    approveItem.childNodes[approveItem.childNodes.length-1].textContent=state==='approved'?'Approve ✓':'Approve';
    approveItem.style.fontWeight=state==='approved'?'600':'normal';
  }
  const reviewItem=document.getElementById('gallery-ctx-review-item');
  if(reviewItem){
    reviewItem.childNodes[reviewItem.childNodes.length-1].textContent=state==='review'?'Review ✓':'Mark Review';
    reviewItem.style.fontWeight=state==='review'?'600':'normal';
  }
  const declineItem=document.getElementById('gallery-ctx-decline-item');
  if(declineItem){
    declineItem.childNodes[declineItem.childNodes.length-1].textContent=state==='declined'?'Decline ✓':'Decline';
    declineItem.style.fontWeight=state==='declined'?'600':'normal';
  }
  // Update shared label
  const sharedItem=document.getElementById('gallery-ctx-shared-item');
  if(sharedItem){
    const isShared=!!(appData.galleryShared&&appData.galleryShared[file]);
    sharedItem.childNodes[sharedItem.childNodes.length-1].textContent=isShared?'Shared ✓':'Mark Shared';
    sharedItem.style.fontWeight=isShared?'600':'normal';
  }
  // Update reddit label
  const redditItem=document.getElementById('gallery-ctx-reddit-item');
  if(redditItem){
    const isPosted=!!(appData.galleryRedditPosted&&appData.galleryRedditPosted[file]);
    redditItem.childNodes[redditItem.childNodes.length-1].textContent=isPosted?'Posted to Reddit ✓':'Mark Posted to Reddit';
    redditItem.style.fontWeight=isPosted?'600':'normal';
  }
  // Update brut label
  const brutItem=document.getElementById('gallery-ctx-brut-item');
  if(brutItem){
    const isBrut=!!(appData.galleryAdult&&appData.galleryAdult[file]);
    brutItem.style.fontWeight=isBrut?'bold':'normal';
  }
  // Populate category list in context menu
  const catsEl=document.getElementById('gallery-ctx-cats');
  if(catsEl){
    const currentCat=getImageCategory(file);
    let catHtml=`<div onclick="ctxGallerySetCat('')" style="padding:6px 12px;font-size:11px;cursor:pointer;color:var(--muted);display:flex;align-items:center;gap:8px;" class="ctx-item">${!currentCat?'<b>':''}Uncategorized${!currentCat?'</b>':''}</div>`;
    galleryCats.forEach(c=>{
      const active=currentCat===c.id;
      catHtml+=`<div onclick="ctxGallerySetCat('${c.id}')" style="padding:6px 12px;font-size:11px;cursor:pointer;color:var(--text);display:flex;align-items:center;gap:8px;" class="ctx-item"><span style="width:8px;height:8px;border-radius:50%;background:${c.color};flex-shrink:0;"></span>${active?'<b>'+c.label+'</b>':c.label}</div>`;
    });
    catsEl.innerHTML=catHtml;
  }
  menu.style.left='-9999px';
  menu.style.top='-9999px';
  menu.style.display='block';
  // Measure actual height then position so it doesn't clip
  requestAnimationFrame(()=>{
    const mw=menu.offsetWidth||160;
    const mh=menu.offsetHeight||120;
    menu.style.left=Math.min(e.clientX,window.innerWidth-mw-8)+'px';
    menu.style.top=Math.min(e.clientY,window.innerHeight-mh-8)+'px';
  });
}
function closeGalleryCtx(){
  document.getElementById('gallery-ctx-menu').style.display='none';
  _galleryCtxFile=null;
}
async function ctxGalleryApprove(){
  if(!_galleryCtxFile)return;
  const file=_galleryCtxFile;
  closeGalleryCtx();
  const bulk=gallerySelectMode&&gallerySelected.has(file);
  const targets=bulk?[...gallerySelected]:[file];
  if(!appData.galleryState)appData.galleryState={};
  for(const f of targets){
    const current=appData.galleryState[f];
    const entry=galleryImages.find(i=>i.name===f);
    if(current==='approved'){
      try{
        const res=await fetch('/gallery/unapprove',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({file:f})});
        if(!res.ok)continue;
        delete appData.galleryState[f];
        if(entry)entry.folder='raw';
      }catch(e){console.error('ctx unapprove failed:',f,e);}
    }else{
      try{
        const res=await fetch('/gallery/approve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({file:f})});
        if(!res.ok)continue;
        appData.galleryState[f]='approved';
        if(entry)entry.folder='approved';
      }catch(e){console.error('ctx approve failed:',f,e);}
    }
  }
  saveAppData();
  if(bulk){exitGallerySelectMode();renderGallery();}
  else{patchGalleryCard(file);updateGalleryDetailState();}
}
function ctxGalleryReview(){
  if(!_galleryCtxFile)return;
  const file=_galleryCtxFile;
  closeGalleryCtx();
  const bulk=gallerySelectMode&&gallerySelected.has(file);
  const targets=bulk?[...gallerySelected]:[file];
  if(!appData.galleryState)appData.galleryState={};
  for(const f of targets){
    if(appData.galleryState[f]==='review')delete appData.galleryState[f];
    else appData.galleryState[f]='review';
  }
  saveAppData();
  if(bulk){exitGallerySelectMode();renderGallery();}
  else{patchGalleryCard(file);updateGalleryDetailState();}
}
function ctxGalleryDecline(){
  if(!_galleryCtxFile)return;
  const file=_galleryCtxFile;
  closeGalleryCtx();
  const bulk=gallerySelectMode&&gallerySelected.has(file);
  const targets=bulk?[...gallerySelected]:[file];
  if(!appData.galleryState)appData.galleryState={};
  for(const f of targets){
    if(appData.galleryState[f]==='declined')delete appData.galleryState[f];
    else appData.galleryState[f]='declined';
  }
  saveAppData();
  if(bulk){exitGallerySelectMode();renderGallery();}
  else{patchGalleryCard(file);updateGalleryDetailState();}
}
function ctxGalleryToggleShared(){
  if(!_galleryCtxFile)return;
  const file=_galleryCtxFile;
  closeGalleryCtx();
  if(!appData.galleryShared)appData.galleryShared={};
  if(appData.galleryShared[file]){
    delete appData.galleryShared[file];
  }else{
    appData.galleryShared[file]={postUrl:'',ts:Date.now()};
  }
  saveAppData();
  renderGallery();
  const shareBtn=document.querySelector('.gdp-share');
  if(shareBtn&&galleryDetailFile===file){
    const isShared=!!appData.galleryShared[file];
    shareBtn.classList.toggle('shared',isShared);
    shareBtn.textContent=isShared?'↗ Shared':'↗ Share';
  }
}
function ctxGalleryToggleReddit(){
  if(!_galleryCtxFile)return;
  const file=_galleryCtxFile;
  closeGalleryCtx();
  const bulk=gallerySelectMode&&gallerySelected.has(file);
  const targets=bulk?[...gallerySelected]:[file];
  if(!appData.galleryRedditPosted)appData.galleryRedditPosted={};
  // If any target is unposted, mark all posted; else clear all
  const anyUnposted=targets.some(f=>!appData.galleryRedditPosted[f]);
  for(const f of targets){
    if(anyUnposted)appData.galleryRedditPosted[f]={ts:Date.now()};
    else delete appData.galleryRedditPosted[f];
  }
  saveAppData();
  if(bulk)exitGallerySelectMode();
  renderGallery();
}
async function copyGalleryImage(file){
  const img=galleryImages.find(i=>i.name===file);
  const folder=img?.folder||'raw';
  const url=`/gallery/image?folder=${folder}&file=${encodeURIComponent(file)}`;
  try{
    const res=await fetch(url);
    const blob=await res.blob();
    await navigator.clipboard.write([new ClipboardItem({[blob.type]:blob})]);
    showToast('Copied','Image copied to clipboard','ok');
  }catch(e){
    showToast('Copy failed',e.message,'err');
  }
}
function ctxGalleryCopyImage(){
  if(!_galleryCtxFile)return;
  const file=_galleryCtxFile;
  closeGalleryCtx();
  copyGalleryImage(file);
}
function ctxGalleryReveal(){
  if(!_galleryCtxFile)return;
  const file=_galleryCtxFile;
  closeGalleryCtx();
  fetch('/gallery/reveal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({file})})
    .then(r=>r.json()).then(d=>{if(d&&d.error)console.error('reveal failed:',d.error);})
    .catch(e=>console.error('reveal failed:',e));
}
function openGalleryDetailCtx(e){
  e.stopPropagation();
  if(galleryDetailFile)openGalleryCtx(galleryDetailFile,e);
}
function ctxGallerySetCat(catId){
  if(!_galleryCtxFile)return;
  const file=_galleryCtxFile;
  closeGalleryCtx();
  const bulk=gallerySelectMode&&gallerySelected.has(file);
  if(bulk){
    for(const f of gallerySelected){setImageCategory(f,catId||null);}
    exitGallerySelectMode();
  }else{
    setImageCategory(file,catId||null);
  }
  renderGallery();
}
function ctxGalleryToggleBrut(){
  if(!_galleryCtxFile)return;
  const file=_galleryCtxFile;
  closeGalleryCtx();
  const bulk=gallerySelectMode&&gallerySelected.has(file);
  if(bulk){
    if(!appData.galleryAdult)appData.galleryAdult={};
    const allBrut=[...gallerySelected].every(f=>appData.galleryAdult[f]);
    for(const f of gallerySelected){
      if(allBrut)delete appData.galleryAdult[f];
      else appData.galleryAdult[f]=true;
    }
    saveAppData();
    exitGallerySelectMode();
    renderGallery();
  }else{
    setGalleryImageAdult(file);
  }
}

// ===================== COMFY SEND =====================
const COMFY_SAMPLERS=['euler','euler_ancestral','heun','heunpp2','dpm_2','dpm_2_ancestral','lms','dpm_fast','dpm_adaptive','dpmpp_2s_ancestral','dpmpp_sde','dpmpp_sde_gpu','dpmpp_2m','dpmpp_2m_sde','dpmpp_2m_sde_gpu','dpmpp_3m_sde','dpmpp_3m_sde_gpu','ddpm','lcm','ipndm','deis','ddim','uni_pc','uni_pc_bh2'];
const COMFY_SCHEDULERS=['normal','karras','exponential','sgm_uniform','simple','ddim_uniform','beta'];
const COMFY_DEFAULTS={steps:30,cfg:5,sampler:'euler_ancestral',scheduler:'karras',w:896,h:1152};
let comfyCkpts=[];           // raw checkpoint list from local scan
let comfyCkptsAuth=null;     // authoritative list from ComfyUI /object_info (Set of names); null = unknown/unreachable
let comfyLorasAuth=null;     // authoritative list of LoRA names ComfyUI can load
let _comfyPanelInit=false;

async function loadComfyCheckpoints(){
  const [lm,auth,lorasAuth]=await Promise.all([
    fetch('/local/checkpoints/list').then(r=>r.ok?r.json():null).catch(()=>null),
    fetch('/comfy/checkpoints').then(r=>r.ok?r.json():null).catch(()=>null),
    fetch('/comfy/loras').then(r=>r.ok?r.json():null).catch(()=>null),
  ]);
  comfyCkpts=(lm&&lm.items)||[];
  comfyCkptsAuth=(auth&&Array.isArray(auth.checkpoints))?new Set(auth.checkpoints):null;
  comfyLorasAuth=(lorasAuth&&Array.isArray(lorasAuth.loras))?new Set(lorasAuth.loras):null;
  refreshSendCkpts();
  // Re-render Checkpoints tab if currently visible
  if(document.getElementById('panel-ckpt')?.classList.contains('active'))renderCheckpoints();
}

// Resolve a bare LoRA name (e.g. "Kuroimori-ArtStyle") to the full path+ext ComfyUI expects
// (e.g. "Kuroimori-ArtStyle.safetensors" or "subfolder/Foo.safetensors"). Falls back to
// appending .safetensors when the auth list is unreachable.
function matchLoraInComfyAuth(bareName){
  if(!bareName)return null;
  if(!comfyLorasAuth)return bareName+'.safetensors';
  const target=bareName.split('/').pop().replace(/\.[^.]+$/,'').toLowerCase();
  for(const auth of comfyLorasAuth){
    const stem=auth.split('/').pop().replace(/\.[^.]+$/,'').toLowerCase();
    if(stem===target)return auth;
  }
  return null;
}

// Returns the full ComfyUI path-prefixed ckpt_name (e.g. "Illustrious/PlantMilk_walnut.safetensors")
// for a LoRA Manager file_name (bare stem, e.g. "PlantMilk_walnut"), or null if ComfyUI can't load it.
// When the authoritative list is unavailable (ComfyUI unreachable), returns a best-guess fallback.
function matchInComfyAuth(lmFileName){
  if(!lmFileName)return null;
  if(!comfyCkptsAuth)return lmFileName+'.safetensors'; // best guess when ComfyUI offline
  const target=lmFileName.split('/').pop().replace(/\.[^.]+$/,'').toLowerCase();
  for(const auth of comfyCkptsAuth){
    const stem=auth.split('/').pop().replace(/\.[^.]+$/,'').toLowerCase();
    if(stem===target)return auth;
  }
  return null;
}

function ckptVisibleInComfy(fileName){
  return matchInComfyAuth(fileName)!==null;
}

function filteredCkptsForModel(){
  const map={'sdxl':['sdxl','sdxl 1.0'],'pony':['pony'],'illustrious':['illustrious']};
  const keys=map[model]||[];
  return comfyCkpts.filter(c=>{
    const bm=ckptBaseModel(c);
    if(!keys.some(k=>bm.includes(k)))return false;
    return ckptVisibleInComfy(c.file_name);
  });
}

let _ckptItems=[];
let _selectedCkpts=new Set();

function refreshSendCkpts(){
  const list=filteredCkptsForModel();
  _ckptItems=list.map(c=>({
    value:matchInComfyAuth(c.file_name)||(c.file_name+'.safetensors'),
    label:ckptDisplayName(c),
  }));

  if(!_ckptItems.length){
    _selectedCkpts.clear();
    renderCkptMultiList();
    updateCkptMultiLabel();
    updateSendBtnLabel();
    return;
  }

  const validValues=new Set(_ckptItems.map(it=>it.value));
  for(const v of _selectedCkpts){if(!validValues.has(v))_selectedCkpts.delete(v);}

  if(!_selectedCkpts.size){
    const candidates=[];
    const saved=(appData.settings&&appData.settings.lastSend&&appData.settings.lastSend.checkpoint);
    if(saved)candidates.push(saved);
    const firstLora=Object.keys(activeLoRAs)[0];
    if(firstLora){const cp=getLora(firstLora).checkpoint;if(cp)candidates.push(cp);}
    const stemToValue=new Map(_ckptItems.map(it=>[it.value.split('/').pop().replace(/\.[^.]+$/,'').toLowerCase(),it.value]));
    const normalize=c=>{
      if(!c)return null;
      if(validValues.has(c))return c;
      const stem=c.split('/').pop().replace(/\.[^.]+$/,'').toLowerCase();
      return stemToValue.get(stem)||null;
    };
    const pick=candidates.map(normalize).find(Boolean)||_ckptItems[0].value;
    _selectedCkpts.add(pick);
  }

  renderCkptMultiList();
  updateCkptMultiLabel();
  updateSendBtnLabel();

  const sel=document.getElementById('cfg-ckpt');
  if(sel){
    sel.innerHTML=_ckptItems.map(it=>`<option value="${it.value.replace(/"/g,'&quot;')}">${it.label}</option>`).join('');
    const first=[..._selectedCkpts][0];
    if(first)sel.value=first;
  }
}

function renderCkptMultiList(){
  const listEl=document.getElementById('ckpt-multi-list');
  if(!listEl)return;
  if(!_ckptItems.length){
    listEl.innerHTML='<div style="padding:10px;color:var(--muted);font-size:12px;font-family:var(--mono);">(no checkpoints)</div>';
    return;
  }
  const allSelected=_selectedCkpts.size===_ckptItems.length;
  let html='<div class="ckpt-list-header">';
  html+=`<span>${_selectedCkpts.size} of ${_ckptItems.length} selected</span>`;
  html+=`<button onclick="event.stopPropagation();toggleAllCkpts()">${allSelected?'clear all':'select all'}</button>`;
  html+='</div><div class="ckpt-list-scroll">';
  html+=_ckptItems.map(it=>{
    const on=_selectedCkpts.has(it.value);
    const ev=it.value.replace(/'/g,"\\'");
    return `<label class="ckpt-opt" onclick="event.stopPropagation()"><div class="ckpt-checkbox${on?' checked':''}">${on?'✓':''}</div><input type="checkbox" ${on?'checked':''} onchange="toggleCkptOption('${ev}',this.checked)" style="display:none">${it.label}</label>`;
  }).join('');
  html+='</div>';
  listEl.innerHTML=html;
}

function toggleCkptOption(value,checked){
  if(checked){
    _selectedCkpts.add(value);
  }else{
    _selectedCkpts.delete(value);
    if(!_selectedCkpts.size&&_ckptItems.length)_selectedCkpts.add(_ckptItems[0].value);
  }
  renderCkptMultiList();
  updateCkptMultiLabel();
  updateSendBtnLabel();
  updateOutput();
  const sel=document.getElementById('cfg-ckpt');
  if(sel){const first=[..._selectedCkpts][0];if(first)sel.value=first;}
}
function toggleAllCkpts(){
  if(_selectedCkpts.size===_ckptItems.length){
    _selectedCkpts.clear();
    if(_ckptItems.length)_selectedCkpts.add(_ckptItems[0].value);
  }else{
    _ckptItems.forEach(it=>_selectedCkpts.add(it.value));
  }
  renderCkptMultiList();
  updateCkptMultiLabel();
  updateSendBtnLabel();
  updateOutput();
}

function updateCkptMultiLabel(){
  const lbl=document.getElementById('ckpt-multi-label');
  if(!lbl)return;
  const n=_selectedCkpts.size;
  if(!n){lbl.textContent='(none)';return;}
  if(n===1){
    const v=[..._selectedCkpts][0];
    const item=_ckptItems.find(it=>it.value===v);
    lbl.textContent=item?item.label:v;
  }else{
    const first=_ckptItems.find(it=>_selectedCkpts.has(it.value));
    lbl.textContent=(first?first.label:'')+ ` +${n-1} more`;
  }
}

function toggleCkptDropdown(e){
  if(e)e.stopPropagation();
  const wrap=document.getElementById('ckpt-multi');
  if(!wrap)return;
  const opening=!wrap.classList.contains('open');
  if(opening){
    wrap.classList.add('open');
    const btn=document.getElementById('ckpt-multi-btn');
    const list=document.getElementById('ckpt-multi-list');
    if(btn&&list){
      const r=btn.getBoundingClientRect();
      list.style.bottom=(window.innerHeight-r.top+6)+'px';
      list.style.left=r.left+'px';
      list.style.width=r.width+'px';
    }
  }else{
    wrap.classList.remove('open');
  }
}
function closeCkptDropdown(){
  const wrap=document.getElementById('ckpt-multi');
  if(wrap)wrap.classList.remove('open');
}

function getSelectedCkpts(){return[..._selectedCkpts];}

function updateSendBtnLabel(){
  const btn=document.getElementById('send-btn');
  if(!btn||btn.disabled)return;
  const n=_selectedCkpts.size||1;
  const batch=Math.max(1,parseInt(document.getElementById('cfg-batch')?.value)||1);
  const total=n*batch;
  const prefix=_img2imgSource?'⟳ ':'→ ';
  btn.textContent=total>1?`${prefix}Process ${total} jobs`:`${prefix}Process`;
}

function initSendPanel(){
  if(_comfyPanelInit)return;
  _comfyPanelInit=true;
  const sa=document.getElementById('cfg-sampler');
  const sc=document.getElementById('cfg-scheduler');
  if(sa)sa.innerHTML=COMFY_SAMPLERS.map(s=>`<option value="${s}">${s}</option>`).join('');
  if(sc)sc.innerHTML=COMFY_SCHEDULERS.map(s=>`<option value="${s}">${s}</option>`).join('');
  // Restore last-used or defaults
  const last=(appData.settings&&appData.settings.lastSend)||{};
  setSendField('cfg-w',last.w||COMFY_DEFAULTS.w);
  setSendField('cfg-h',last.h||COMFY_DEFAULTS.h);
  setSendField('cfg-steps',last.steps||COMFY_DEFAULTS.steps);
  setSendField('cfg-cfg',last.cfg!=null?last.cfg:COMFY_DEFAULTS.cfg);
  setSendField('cfg-sampler',last.sampler||COMFY_DEFAULTS.sampler);
  setSendField('cfg-scheduler',last.scheduler||COMFY_DEFAULTS.scheduler);
  setSendField('cfg-batch',last.batch||1);
  // Persist on change + refresh the send-meta row in the panel footer
  ['cfg-w','cfg-h','cfg-steps','cfg-cfg','cfg-sampler','cfg-scheduler','cfg-ckpt','cfg-seed','cfg-batch'].forEach(id=>{
    const el=document.getElementById(id);
    if(!el)return;
    el.addEventListener('change',()=>{saveSendDefaults();updateSendMeta();});
    el.addEventListener('input',updateSendMeta);
  });
  updateSendMeta();
}

function setSendField(id,val){
  const el=document.getElementById(id);
  if(el)el.value=val;
}

function saveSendDefaults(){
  if(!appData.settings)appData.settings={};
  const firstCkpt=[..._selectedCkpts][0]||'';
  appData.settings.lastSend={
    checkpoint:firstCkpt,
    w:parseInt(document.getElementById('cfg-w')?.value)||COMFY_DEFAULTS.w,
    h:parseInt(document.getElementById('cfg-h')?.value)||COMFY_DEFAULTS.h,
    steps:parseInt(document.getElementById('cfg-steps')?.value)||COMFY_DEFAULTS.steps,
    cfg:parseFloat(document.getElementById('cfg-cfg')?.value)||COMFY_DEFAULTS.cfg,
    sampler:document.getElementById('cfg-sampler')?.value||COMFY_DEFAULTS.sampler,
    scheduler:document.getElementById('cfg-scheduler')?.value||COMFY_DEFAULTS.scheduler,
    batch:parseInt(document.getElementById('cfg-batch')?.value)||1,
  };
  saveAppData();
}

function randomSeed(){
  // 15-digit random uint (well within JS safe-int range, matches ComfyUI seed scale)
  const seed=Math.floor(Math.random()*900000000000000)+100000000000000;
  setSendField('cfg-seed',seed);
}

function buildComfyWorkflow(opts){
  const pos=opts.positive||'';
  const neg=opts.negative||'';
  const ckpt=opts.checkpoint;
  const w=parseInt(opts.w)||COMFY_DEFAULTS.w;
  const h=parseInt(opts.h)||COMFY_DEFAULTS.h;
  const steps=parseInt(opts.steps)||COMFY_DEFAULTS.steps;
  const cfg=parseFloat(opts.cfg)||COMFY_DEFAULTS.cfg;
  const sampler=opts.sampler||COMFY_DEFAULTS.sampler;
  const scheduler=opts.scheduler||COMFY_DEFAULTS.scheduler;
  const seed=opts.seed;
  const loras=opts.loras||[]; // [{name, strength}]

  const i2i=opts.img2img; // { sourceImage, denoise }

  const wf={};
  wf['1']={inputs:{ckpt_name:ckpt},class_type:'CheckpointLoaderSimple',_meta:{title:'Load Checkpoint'}};
  if(i2i){
    wf['15']={inputs:{image:i2i.sourceImage,upload:'image'},class_type:'LoadImage',_meta:{title:'Load Image'}};
    wf['16']={inputs:{pixels:['15',0],vae:['1',2]},class_type:'VAEEncode',_meta:{title:'VAE Encode'}};
  }else{
    wf['16']={inputs:{width:w,height:h,batch_size:1},class_type:'EmptyLatentImage',_meta:{title:'Empty Latent Image'}};
  }

  // LoRA chain — start from checkpoint, each LoraLoader feeds the next.
  // Resolve each bare LoRA name to the path+ext form ComfyUI actually expects.
  let modelSrc=['1',0], clipSrc=['1',1];
  let nextId=100;
  loras.forEach((l,idx)=>{
    const id=String(nextId++);
    const resolvedName=matchLoraInComfyAuth(l.name)||(l.name+'.safetensors');
    wf[id]={
      inputs:{
        lora_name:resolvedName,
        strength_model:l.strength,
        strength_clip:l.strength,
        model:modelSrc,
        clip:clipSrc,
      },
      class_type:'LoraLoader',
      _meta:{title:`LoRA ${idx+1}: ${resolvedName}`},
    };
    modelSrc=[id,0];
    clipSrc=[id,1];
  });

  // CLIPTextEncode — feed clip directly (no clip skip; Illustrious/Pony SDXL don't need it)
  wf['8']={inputs:{text:pos,clip:clipSrc},class_type:'CLIPTextEncode',_meta:{title:'POS Prompt'}};
  wf['9']={inputs:{text:neg,clip:clipSrc},class_type:'CLIPTextEncode',_meta:{title:'NEG Prompt'}};

  wf['17']={
    inputs:{
      seed,steps,cfg,sampler_name:sampler,scheduler,denoise:i2i?i2i.denoise:1.0,
      model:modelSrc,
      positive:['8',0],
      negative:['9',0],
      latent_image:['16',0],
    },
    class_type:'KSampler',
    _meta:{title:'KSampler'},
  };

  wf['32']={inputs:{samples:['17',0],vae:['1',2]},class_type:'VAEDecode',_meta:{title:'VAE Decode'}};
  wf['41']={inputs:{filename_prefix:'ComfyUI',images:['32',0]},class_type:'SaveImage',_meta:{title:'Save Image'}};
  return wf;
}

function buildUpscaleWorkflow(opts){
  const wf={};
  const tw=opts.targetW||0;
  const th=opts.targetH||0;

  wf['50']={inputs:{image:opts.sourceImage,upload:'image'},class_type:'LoadImage',_meta:{title:'Load Source'}};
  // Force contiguous tensor — ImageUpscaleWithModel crashes on non-contiguous input from LoadImage
  if(tw&&th){
    wf['49']={inputs:{image:['50',0],upscale_method:'lanczos',width:tw/2,height:th/2,crop:'disabled'},class_type:'ImageScale',_meta:{title:'Prep'}};
  }else{
    wf['49']={inputs:{image:['50',0],upscale_method:'lanczos',scale_by:1.0},class_type:'ImageScaleBy',_meta:{title:'Prep'}};
  }
  wf['51']={inputs:{model_name:'4xUltrasharp_4xUltrasharpV10.pt'},class_type:'UpscaleModelLoader',_meta:{title:'Load Upscaler'}};
  wf['52']={inputs:{upscale_model:['51',0],image:['49',0]},class_type:'ImageUpscaleWithModel',_meta:{title:'Upscale 4×'}};

  if(tw&&th){
    wf['53']={inputs:{image:['52',0],upscale_method:'lanczos',width:tw,height:th,crop:'disabled'},class_type:'ImageScale',_meta:{title:'Scale to 2×'}};
  }else{
    wf['53']={inputs:{image:['52',0],upscale_method:'lanczos',scale_by:0.5},class_type:'ImageScaleBy',_meta:{title:'Scale to 2×'}};
  }

  const prefix=opts.filenamePrefix||'Upscale';
  wf['41']={inputs:{filename_prefix:prefix,images:['53',0]},class_type:'SaveImage',_meta:{title:'Save Image'}};
  return wf;
}

// ===================== TRAINING (Phase 1: dataset + caption builder) =====================
let _activeTrainSet = null; // set id
let _trainCkptsLoaded = false;

function ensureTrainingData(){ if(!Array.isArray(appData.trainingSets)) appData.trainingSets = []; }

function getActiveTrainSet(){
  ensureTrainingData();
  if(!appData.trainingSets.length) return null;
  let s = appData.trainingSets.find(x=>x.id===_activeTrainSet);
  if(!s){ s = appData.trainingSets[0]; _activeTrainSet = s.id; }
  return s;
}

function newTrainingSet(name){
  ensureTrainingData();
  const id = 'ts' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
  const set = { id, name: name || ('style-' + (appData.trainingSets.length+1)), trigger:'', baseCheckpoint:'', rank:16, steps:2000, learningRate:'1e-4', resolution:1024, items:[], created:Date.now() };
  appData.trainingSets.push(set);
  _activeTrainSet = id;
  saveAppData();
  renderTrainTab();
  return set;
}

function switchTrainSet(id){ _activeTrainSet = id; renderTrainTab(); }

function deleteTrainingSet(){
  const s = getActiveTrainSet();
  if(!s) return;
  showInlineConfirm(`Delete training set "${s.name}"? This only removes it from the app — any exported folder on disk stays.`, ()=>{
    ensureTrainingData();
    appData.trainingSets = appData.trainingSets.filter(x=>x.id!==s.id);
    _activeTrainSet = appData.trainingSets.length ? appData.trainingSets[0].id : null;
    saveAppData();
    renderTrainTab();
  });
}

function updateTrainField(field, val){
  const s = getActiveTrainSet();
  if(!s) return;
  s[field] = val;
  saveAppData();
  if(field==='name') renderTrainSetSelect();
  if(field==='trigger') renderTrainImages();
}

function addSelectedToTraining(){
  const files = [...gallerySelected];
  if(!files.length) return;
  ensureTrainingData();
  let s = getActiveTrainSet();
  if(!s) s = newTrainingSet();
  let added = 0;
  for(const file of files){
    if(s.items.some(it=>it.file===file)) continue;
    const entry = galleryImages.find(i=>i.name===file);
    const folder = entry ? entry.folder : 'raw';
    s.items.push({ file, folder, caption:'' });
    added++;
  }
  saveAppData();
  exitGallerySelectMode();
  showToast('Added to training', `${added} image${added===1?'':'s'} → "${s.name}"`, 'ok');
  switchTab('train');
}

function renderTrainSetSelect(){
  const sel = document.getElementById('train-set-select');
  if(!sel) return;
  ensureTrainingData();
  const active = getActiveTrainSet();
  if(!appData.trainingSets.length){ sel.innerHTML = '<option>(no sets yet)</option>'; return; }
  sel.innerHTML = appData.trainingSets.map(s=>`<option value="${esc(s.id)}"${active&&s.id===active.id?' selected':''}>${esc(s.name)}</option>`).join('');
}

async function loadTrainCheckpoints(){
  const sel = document.getElementById('train-ckpt');
  if(!sel) return;
  const s = getActiveTrainSet();
  const cur = s && s.baseCheckpoint;
  if(_trainCkptsLoaded && sel.options.length>1){ if(cur) sel.value = cur; return; }
  try{
    const r = await fetch('/comfy/checkpoints');
    if(r.ok){
      const j = await r.json();
      const names = j.checkpoints || [];
      sel.innerHTML = '<option value="">— pick base model —</option>' + names.map(n=>`<option value="${esc(n)}"${cur===n?' selected':''}>${esc(n)}</option>`).join('');
      _trainCkptsLoaded = true;
    }
  }catch(e){}
}

async function renderTrainTab(){
  ensureTrainingData();
  renderTrainSetSelect();
  await loadTrainCheckpoints();
  const s = getActiveTrainSet();
  const cnt = document.getElementById('train-count');
  const nameEl = document.getElementById('train-name');
  const trigEl = document.getElementById('train-trigger');
  const rankEl = document.getElementById('train-rank');
  const stepsEl = document.getElementById('train-steps');
  const ckptEl = document.getElementById('train-ckpt');
  const resEl = document.getElementById('train-res');
  const grid = document.getElementById('train-grid');
  if(!s){
    if(cnt) cnt.textContent = '';
    if(grid) grid.innerHTML = '<div class="train-empty">No training set yet.<br>Go to the <strong>Gallery</strong>, select images, and click <strong>◆ Add to Training</strong> — or start an empty set with <strong>＋ New set</strong>.</div>';
    return;
  }
  if(nameEl) nameEl.value = s.name || '';
  if(trigEl) trigEl.value = s.trigger || '';
  if(rankEl) rankEl.value = s.rank || 16;
  if(stepsEl) stepsEl.value = s.steps || 2000;
  if(resEl) resEl.value = String(s.resolution || 1024);
  if(ckptEl && s.baseCheckpoint) ckptEl.value = s.baseCheckpoint;
  if(cnt) cnt.textContent = `${s.items.length} image${s.items.length===1?'':'s'}`;
  renderTrainImages();
}

function renderTrainImages(){
  const grid = document.getElementById('train-grid');
  if(!grid) return;
  const s = getActiveTrainSet();
  if(!s || !s.items.length){ grid.innerHTML = '<div class="train-empty">This set has no images yet.<br>Add some from the <strong>Gallery</strong>.</div>'; return; }
  const trig = (s.trigger || '').trim();
  grid.innerHTML = s.items.map((it,idx)=>{
    const src = `/gallery/image?folder=${it.folder||'raw'}&file=${encodeURIComponent(it.file)}`;
    const trigChip = trig ? `<div class="train-card-trig">${esc(trig)}, …</div>` : '';
    return `<div class="train-card"><img src="${src}" loading="lazy" alt="">
      <div class="train-card-body">${trigChip}
      <textarea placeholder="Describe the content only — subjects, pose, lighting, composition. Not the style." oninput="updateTrainCaption(${idx},this.value)">${esc(it.caption||'')}</textarea>
      <button class="train-card-rm" onclick="removeTrainImage(${idx})">✕ remove</button></div></div>`;
  }).join('');
}

function updateTrainCaption(idx, val){
  const s = getActiveTrainSet();
  if(!s || !s.items[idx]) return;
  s.items[idx].caption = val;
  saveAppData();
}

function removeTrainImage(idx){
  const s = getActiveTrainSet();
  if(!s) return;
  s.items.splice(idx,1);
  saveAppData();
  renderTrainImages();
  const cnt = document.getElementById('train-count');
  if(cnt) cnt.textContent = `${s.items.length} image${s.items.length===1?'':'s'}`;
}

function autoCaptionTrain(){ showToast('Not yet', "Auto-captioning needs the WD14 tagger node — that's the next phase", 'warn'); }

async function exportTrainingSet(){
  const s = getActiveTrainSet();
  if(!s){ showToast('No training set', 'Create one first', 'err'); return; }
  if(!s.items.length){ showToast('Empty set', 'Add images before exporting', 'err'); return; }
  if(!s.trigger || !s.trigger.trim()){ showToast('No trigger word', 'Set a trigger word — it carries your style', 'err'); return; }
  const missing = s.items.filter(it=>!(it.caption||'').trim()).length;
  const doExport = async ()=>{
    try{
      const r = await fetch('/training/export', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          name:s.name, trigger:s.trigger, baseCheckpoint:s.baseCheckpoint, rank:s.rank, steps:s.steps, learningRate:s.learningRate, resolution:s.resolution,
          items: s.items.map(it=>({ file:it.file, folder:it.folder, caption:it.caption||'' })),
        }),
      });
      const j = await r.json();
      if(!r.ok || j.error){ showToast('Export failed', j.error || ('HTTP '+r.status), 'err'); return; }
      s.exportPath = j.path;
      saveAppData();
      showToast('Training folder ready', `${j.count} images + captions saved`, 'ok');
    }catch(e){ showToast('Export failed', e.message || 'Server error', 'err'); }
  };
  if(missing){
    showInlineConfirm(`${missing} image${missing===1?'':'s'} still uncaptioned — they'll only get the trigger word. Export anyway?`, doExport);
  } else {
    doExport();
  }
}

function buildVideoWorkflow(opts) {
  const pos = opts.positive || '';
  const neg = opts.negative || '';
  const w = parseInt(opts.w) || 832;
  const h = parseInt(opts.h) || 480;
  const frames = parseInt(opts.frames) || 81;
  const steps = parseInt(opts.steps) || 30;
  const cfg = parseFloat(opts.cfg) || 6;
  const seed = opts.seed;
  const fps = parseInt(opts.fps) || 16;

  const wf = {};
  wf['1'] = { inputs: { unet_name: 'wan2.2_ti2v_5B_fp16.safetensors', weight_dtype: 'default' }, class_type: 'UNETLoader', _meta: { title: 'Load Diffusion Model' } };
  wf['2'] = { inputs: { clip_name: 'umt5_xxl_fp16.safetensors', type: 'wan', device: 'default' }, class_type: 'CLIPLoader', _meta: { title: 'Load CLIP' } };
  wf['3'] = { inputs: { vae_name: 'wan2.2_vae.safetensors' }, class_type: 'VAELoader', _meta: { title: 'Load VAE' } };
  wf['4'] = { inputs: { text: pos, clip: ['2', 0] }, class_type: 'CLIPTextEncode', _meta: { title: 'POS Prompt' } };
  wf['5'] = { inputs: { text: neg, clip: ['2', 0] }, class_type: 'CLIPTextEncode', _meta: { title: 'NEG Prompt' } };
  wf['6'] = { inputs: { shift: 8.0, model: ['1', 0] }, class_type: 'ModelSamplingSD3', _meta: { title: 'ModelSamplingSD3' } };
  wf['7'] = { inputs: { width: w, height: h, length: frames, batch_size: 1, vae: ['3', 0] }, class_type: 'Wan22ImageToVideoLatent', _meta: { title: 'Video Size & Length' } };
  wf['8'] = {
    inputs: {
      seed, steps, cfg, sampler_name: 'euler', scheduler: 'simple', denoise: 1.0,
      model: ['6', 0],
      positive: ['4', 0],
      negative: ['5', 0],
      latent_image: ['7', 0],
    },
    class_type: 'KSampler',
    _meta: { title: 'KSampler' },
  };
  wf['9'] = { inputs: { samples: ['8', 0], vae: ['3', 0] }, class_type: 'VAEDecode', _meta: { title: 'VAE Decode' } };
  wf['10'] = { inputs: { images: ['9', 0], fps: fps }, class_type: 'CreateVideo', _meta: { title: 'Create Video' } };
  wf['11'] = { inputs: { video: ['10', 0], filename_prefix: 'ComfyUI', format: 'auto', codec: 'auto' }, class_type: 'SaveVideo', _meta: { title: 'Save Video' } };
  return wf;
}

async function sendVideoToComfy() {
  const btn = document.getElementById('send-btn');
  const prompt = document.getElementById('video-prompt')?.value?.trim();
  if (!prompt) { showToast('Empty prompt', 'Describe the scene and motion first', 'err'); return; }

  const neg = document.getElementById('video-neg')?.value?.trim() || '';
  const seedField = document.getElementById('vcfg-seed');
  if (!isVideoSeedLocked()) randomVideoSeed();
  const seed = parseInt(seedField?.value?.trim()) || Math.floor(Math.random() * 2147483647);
  seedField.value = String(seed);

  const wf = buildVideoWorkflow({
    positive: prompt,
    negative: neg,
    w: document.getElementById('vcfg-w')?.value,
    h: document.getElementById('vcfg-h')?.value,
    frames: document.getElementById('vcfg-frames')?.value,
    steps: document.getElementById('vcfg-steps')?.value,
    cfg: document.getElementById('vcfg-cfg')?.value,
    fps: document.getElementById('vcfg-fps')?.value,
    seed,
  });

  if (btn) { btn.classList.add('sending'); btn.disabled = true; btn.textContent = 'Sending…'; }

  try {
    const r = await fetch('/comfy/prompt', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: wf, client_id: 'prompt-gen' }),
    });
    const j = await r.json();
    if (!r.ok || j.error) {
      let detail = '';
      if (j.node_errors && typeof j.node_errors === 'object') {
        const ids = Object.keys(j.node_errors);
        if (ids.length) {
          const ne = j.node_errors[ids[0]];
          const firstErr = ne.errors && ne.errors[0];
          if (firstErr) { detail = (ne.class_type ? ne.class_type + ': ' : '') + (firstErr.details || firstErr.message); }
        }
      }
      const msg = j.error ? (j.error.message || j.error) : `HTTP ${r.status}`;
      showToast('Video error', detail || (typeof msg === 'string' ? msg : JSON.stringify(msg)), 'err');
    } else {
      let sub = '';
      try {
        const qr = await fetch('/comfy/queue');
        if (qr.ok) { const q = await qr.json(); const ahead = (q.running || 0) + (q.pending || 0) - 1; sub = ahead > 0 ? `${ahead} ahead in queue` : 'generating now'; }
      } catch (e) {}
      sub = (sub ? sub + ' · ' : '') + 'seed ' + seed;
      showToast('Video sent to ComfyUI', sub, 'ok');
    }
  } catch (e) { showToast('Send failed', e.message || 'ComfyUI not reachable', 'err'); }

  if (btn) { btn.classList.remove('sending'); btn.disabled = false; btn.textContent = '→ Generate Video'; }
}

async function sendToComfy(){
  if (_genMode === 'video') return sendVideoToComfy();
  const btn=document.getElementById('send-btn');
  const checkpoints=getSelectedCkpts();
  if(!checkpoints.length){showToast('No checkpoint selected','Pick one from the dropdown','err');return;}
  const batchCount=Math.max(1,parseInt(document.getElementById('cfg-batch')?.value)||1);
  const totalJobs=checkpoints.length*batchCount;
  const pos=buildPos();
  const neg=buildNeg();
  if(!pos.trim()){showToast('Empty prompt','Add tags or a subject first','err');return;}
  const posBase=buildPos(true);

  const seedField=document.getElementById('cfg-seed');
  const locked=isSeedLocked();
  let baseSeed=null;
  if(locked){
    const seedRaw=seedField.value.trim();
    if(seedRaw===''){
      baseSeed=Math.floor(Math.random()*900000000000000)+100000000000000;
      seedField.value=String(baseSeed);
    }else{
      baseSeed=parseInt(seedRaw);
      if(isNaN(baseSeed)){showToast('Bad seed','Must be a number','err');return;}
    }
  }

  const loras=Object.entries(activeLoRAs).map(([k,v])=>({name:k,strength:v.weight}));
  const baseOpts={
    positive:posBase,negative:neg,
    w:document.getElementById('cfg-w').value,
    h:document.getElementById('cfg-h').value,
    steps:document.getElementById('cfg-steps').value,
    cfg:document.getElementById('cfg-cfg').value,
    sampler:document.getElementById('cfg-sampler').value,
    scheduler:document.getElementById('cfg-scheduler').value,
    loras,
  };

  // img2img: upload source image to ComfyUI's input folder
  let img2imgOpts=null;
  if(_img2imgSource){
    const denoise=parseFloat(document.getElementById('i2i-denoise')?.value)||0.75;
    if(btn){btn.classList.add('sending');btn.disabled=true;btn.textContent='Uploading…';}
    try{
      const ur=await fetch('/comfy/upload-gallery',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({file:_img2imgSource.file,folder:_img2imgSource.folder}),
      });
      const ud=await ur.json();
      if(!ur.ok||!ud.name){throw new Error(ud.error||'Upload failed');}
      img2imgOpts={sourceImage:ud.name,denoise};
    }catch(e){
      showToast('img2img upload failed',e.message||'Could not upload source image','err');
      if(btn){btn.classList.remove('sending');btn.disabled=false;btn.textContent='→ Process';}
      return;
    }
  }

  const label=totalJobs>1?`Sending ${totalJobs} jobs…`:'Sending…';
  if(btn){btn.classList.add('sending');btn.disabled=true;btn.textContent=label;}

  let sent=0,errors=0,lastSeed=baseSeed;
  for(const ckpt of checkpoints){
    for(let i=0;i<batchCount;i++){
      const seed=locked?baseSeed:Math.floor(Math.random()*900000000000000)+100000000000000;
      lastSeed=seed;
      const cpPre=getCkptPrefix(ckpt);
      const jobPos=cpPre?cpPre+', '+posBase:posBase;
      const wf=buildComfyWorkflow({...baseOpts,positive:jobPos,checkpoint:ckpt,seed,img2img:img2imgOpts});
      try{
        const r=await fetch('/comfy/prompt',{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({prompt:wf,client_id:'prompt-gen'}),
        });
        const j=await r.json();
        if(!r.ok||j.error){
          errors++;
          let detail='';
          if(j.node_errors&&typeof j.node_errors==='object'){
            const ids=Object.keys(j.node_errors);
            if(ids.length){
              const ne=j.node_errors[ids[0]];
              const firstErr=ne.errors&&ne.errors[0];
              if(firstErr){const ct=ne.class_type?`${ne.class_type}: `:'';detail=ct+(firstErr.details||firstErr.message);}
            }
          }
          const baseMsg=(j.error&&(j.error.message||j.error))||`HTTP ${r.status}`;
          const msg=typeof baseMsg==='string'?baseMsg:JSON.stringify(baseMsg);
          const ckptShort=ckpt.split('/').pop().replace(/\.[^.]+$/,'');
          showToast(`Error · ${ckptShort}`,detail||msg,'err');
        }else{sent++;}
      }catch(e){errors++;showToast('Send failed',e.message||'ComfyUI not reachable','err');}
    }
  }

  seedField.value=String(lastSeed);

  if(sent>0){
    let sub='';
    try{
      const qr=await fetch('/comfy/queue');
      if(qr.ok){const q=await qr.json();const ahead=(q.running||0)+(q.pending||0)-sent;
        sub=ahead>0?`${ahead} ahead in queue`:'generating now';}
    }catch(e){}
    if(totalJobs===1)sub=(sub?sub+' · ':'')+'seed '+lastSeed;
    else sub=(sub?sub+' · ':'')+sent+' queued'+(locked?' · same seed':'');
    showToast('Sent to ComfyUI',sub,'ok');
    saveSendDefaults();
  }

  if(btn){btn.classList.remove('sending');btn.disabled=false;updateSendBtnLabel();}
}

function showToast(title,sub,type){
  const stack=document.getElementById('toast-stack');
  if(!stack)return;
  const t=document.createElement('div');
  t.className='toast '+(type||'info');
  t.innerHTML=`<button class="t-close" title="Dismiss">×</button><div class="t-title">${title}</div>${sub?`<div class="t-sub">${sub}</div>`:''}`;
  stack.appendChild(t);
  const dismiss=()=>{if(t._gone)return;t._gone=true;t.style.transition='opacity .25s';t.style.opacity='0';setTimeout(()=>t.remove(),260);};
  t.querySelector('.t-close').onclick=dismiss;
  const lifeMs=type==='err'?8000:3500;
  setTimeout(dismiss,lifeMs);
}

// Hook into doRemixFromGallery — pre-fill Send panel from PNG metadata.
// Called by an extended remix (see remix patch below).
function applyRemixToSendPanel(m){
  if(!m)return;
  // Resolve checkpoint to ComfyUI-native name
  let resolved=null;
  if(m.checkpoint){
    const stem=m.checkpoint.split('/').pop().replace(/\.[^.]+$/,'').toLowerCase();
    const lmMatch=comfyCkpts.find(c=>{
      const fn=(c.file_name||'').toLowerCase();
      return fn.split('/').pop().replace(/\.[^.]+$/,'')===stem;
    });
    if(lmMatch)resolved=matchInComfyAuth(lmMatch.file_name)||(lmMatch.file_name+'.safetensors');
  }
  if(resolved&&_ckptItems.some(it=>it.value===resolved)){
    _selectedCkpts.clear();
    _selectedCkpts.add(resolved);
  }
  refreshSendCkpts();
  setSendField('cfg-batch',1);
  updateSendBtnLabel();
  if(m.width)setSendField('cfg-w',m.width);
  if(m.height)setSendField('cfg-h',m.height);
  if(m.steps)setSendField('cfg-steps',m.steps);
  if(m.cfg!=null)setSendField('cfg-cfg',m.cfg);
  if(m.sampler&&COMFY_SAMPLERS.includes(m.sampler))setSendField('cfg-sampler',m.sampler);
  if(m.scheduler&&COMFY_SCHEDULERS.includes(m.scheduler))setSendField('cfg-scheduler',m.scheduler);
  if(m.seed!=null){
    setSendField('cfg-seed',m.seed);
    setSeedLocked(true);
  }
  saveSendDefaults();
}

// ===================== LORA INSTALL / UNINSTALL =====================

let _installPollTimer=null;

function openLoraInstallDialog(){
  const ov=document.getElementById('lora-install-overlay');
  ov.style.display='flex';
  document.getElementById('lora-install-url').value='';
  document.getElementById('lora-install-preview').style.display='none';
  document.getElementById('lora-install-preview').innerHTML='';
  document.getElementById('lora-install-progress').style.display='none';
  document.getElementById('lora-install-url').focus();
}

function closeLoraInstallDialog(){
  document.getElementById('lora-install-overlay').style.display='none';
  if(_installPollTimer){clearInterval(_installPollTimer);_installPollTimer=null;}
}

async function previewLoraInstall(){
  const url=document.getElementById('lora-install-url').value.trim();
  if(!url){showToast('Paste a CivitAI URL','','err');return;}
  const preview=document.getElementById('lora-install-preview');
  preview.style.display='block';
  preview.innerHTML='<div style="color:var(--muted);font-size:11px;font-family:var(--mono);">Looking up…</div>';
  try{
    const r=await fetch('/local/loras/preview-info?url='+encodeURIComponent(url));
    if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.error||'HTTP '+r.status);}
    const d=await r.json();
    const imgHtml=d.previewUrl?`<img src="${d.previewUrl}" style="width:80px;height:107px;object-fit:cover;border-radius:6px;flex-shrink:0;">`:'';
    const wordsHtml=d.trainedWords&&d.trainedWords.length?`<div style="font-size:9px;color:var(--muted2);margin-top:4px;">Triggers: ${d.trainedWords.slice(0,5).join(', ')}</div>`:'';
    const alreadyHtml=d.alreadyInstalled?'<div style="font-size:10px;color:var(--orange);margin-top:4px;font-weight:600;">Already installed</div>':'';
    preview.innerHTML=`
      <div style="display:flex;gap:12px;align-items:flex-start;">
        ${imgHtml}
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${d.name||'Unknown'}</div>
          <div style="font-size:10px;color:var(--muted);margin-top:2px;">${d.versionName||''} · ${d.baseModel||''} · ${d.sizeMB||'?'} MB</div>
          <div style="font-size:9px;color:var(--muted2);margin-top:2px;">${d.fileName||''}</div>
          ${wordsHtml}
          ${alreadyHtml}
          ${d.alreadyInstalled?'':`<button onclick="startLoraInstall()" style="margin-top:10px;background:var(--orange);color:#000;border:none;border-radius:6px;padding:6px 16px;cursor:pointer;font-size:12px;font-weight:600;font-family:var(--sans);">Install</button>`}
        </div>
      </div>`;
  }catch(e){
    preview.innerHTML=`<div style="color:#f87171;font-size:11px;">${e.message}</div>`;
  }
}

async function startLoraInstall(){
  const url=document.getElementById('lora-install-url').value.trim();
  if(!url)return;
  const prog=document.getElementById('lora-install-progress');
  const bar=document.getElementById('lora-install-progress-bar');
  const label=document.getElementById('lora-install-progress-label');
  prog.style.display='block';
  bar.style.width='0%';
  label.textContent='Starting…';

  // Start the install (async on server)
  fetch('/local/loras/install',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url})}).then(async r=>{
    const d=await r.json().catch(()=>({}));
    if(_installPollTimer){clearInterval(_installPollTimer);_installPollTimer=null;}
    if(r.ok){
      bar.style.width='100%';
      label.textContent='Installed!';
      showToast('LoRA installed',d.model_name||d.file_name||'','ok');
      // Save the original CivitAI URL so the link points to the right domain
      if(d.file_name&&d.source_url){
        setLora(d.file_name,{civitUrl:d.source_url});
        saveAppData();
      }
      await loadLoras();
      renderLoraTab();
      closeLoraInstallDialog();
      // Scroll to the new LoRA card and open its detail panel
      if(d.file_name){
        setTimeout(()=>{
          const card=document.querySelector('.lora-card[data-key="'+d.file_name+'"]');
          if(card){card.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>openLpPanel(d.file_name),400);}
        },200);
      }
    }else{
      label.textContent='Error: '+(d.error||'Unknown');
      bar.style.width='0%';
      bar.style.background='#f87171';
    }
  }).catch(e=>{
    if(_installPollTimer){clearInterval(_installPollTimer);_installPollTimer=null;}
    label.textContent='Error: '+e.message;
  });

  // Poll progress while downloading
  _installPollTimer=setInterval(async()=>{
    try{
      const r=await fetch('/local/loras/install-progress');
      const d=await r.json();
      if(d.status==='downloading'){
        bar.style.width=d.pct+'%';
        bar.style.background='var(--orange)';
        label.textContent=d.message||('Downloading… '+d.pct+'%');
      }else if(d.status==='saving'){
        bar.style.width='95%';
        label.textContent='Saving metadata…';
      }else if(d.status==='fetching'){
        label.textContent='Fetching model info…';
      }else if(d.status==='done'||d.status==='error'||d.status==='idle'){
        clearInterval(_installPollTimer);_installPollTimer=null;
      }
    }catch{}
  },500);
}

async function uninstallLora(fileName){
  if(!fileName)return;
  const loraName=(appData.loraData&&appData.loraData[fileName]&&appData.loraData[fileName].name)||fileName;
  showInlineConfirm('Uninstall "'+loraName+'"? This deletes the .safetensors, metadata, and preview from disk. Your custom data (notes, triggers, collections) stays in app data.',async()=>{
    try{
      const r=await fetch('/local/loras/uninstall',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({file_name:fileName})});
      const d=await r.json();
      if(r.ok){
        showToast('Uninstalled',loraName,'ok');
        closeLpPanel();
        await loadLoras();
        renderLoraTab();
      }else{
        showToast('Error',d.error||'Unknown','err');
      }
    }catch(e){
      showToast('Error',e.message,'err');
    }
  },{okLabel:'Uninstall',okColor:'var(--red)'});
}

// ===================== BROWSE CIVITAI =====================
let _loraMode='library';
let _browseResults=[];
let _browseMetadata={};
let _browseQuery='';
let _browseSearchTimer=null;
let _browseSearchGen=0;
let _browseScrollPos=0;
let _libraryScrollPos=0;
let _currentBrowseModel=null;
let _currentBrowseVersion=null;
let _bdInstallPoll=null;

function switchLoraMode(mode){
  const panel=document.getElementById('panel-loras');
  const toolbar=document.getElementById('lora-toolbar');
  if(!panel||!toolbar)return;
  // Save scroll position
  if(_loraMode==='library')_libraryScrollPos=panel.scrollTop;
  else _browseScrollPos=panel.scrollTop;
  _loraMode=mode;
  const isBrowse=mode==='browse';
  panel.classList.toggle('browse-mode',isBrowse);
  toolbar.classList.toggle('browse-active',isBrowse);
  document.getElementById('lora-mode-library').classList.toggle('active',!isBrowse);
  document.getElementById('lora-mode-browse').classList.toggle('active',isBrowse);
  // Toggle collection tabs — element is a sibling of #panel-loras, not a child,
  // so CSS #panel-loras.browse-mode can't target it. Use JS with !important.
  const colTabs=document.getElementById('lora-collection-tabs');
  if(colTabs){
    if(isBrowse)colTabs.style.setProperty('display','none','important');
    else colTabs.style.removeProperty('display');
  }
  // Toggle grids
  const libGrid=document.getElementById('lora-tab-grid');
  const browseGrid=document.getElementById('browse-tab-grid');
  if(libGrid)libGrid.style.setProperty('display',isBrowse?'none':'block','important');
  if(browseGrid)browseGrid.style.setProperty('display',isBrowse?'block':'none','important');
  // Toggle toolbar controls
  toolbar.querySelectorAll('.library-only').forEach(el=>el.style.setProperty('display',isBrowse?'none':'contents','important'));
  toolbar.querySelectorAll('.browse-only').forEach(el=>el.style.setProperty('display',isBrowse?'contents':'none','important'));
  if(isBrowse){
    if(_browseResults.length)panel.scrollTop=_browseScrollPos;
  }else{
    panel.scrollTop=_libraryScrollPos;
  }
}

function onBrowseSearch(){
  const input=document.getElementById('browse-search');
  const clear=document.getElementById('browse-search-clear');
  if(!input)return;
  _browseQuery=input.value.trim();
  if(clear)clear.style.display=_browseQuery?'block':'none';
  clearTimeout(_browseSearchTimer);
  _browseSearchTimer=setTimeout(()=>doBrowseSearch(),350);
}

function clearBrowseSearch(){
  const input=document.getElementById('browse-search');
  if(input)input.value='';
  _browseQuery='';
  const clear=document.getElementById('browse-search-clear');
  if(clear)clear.style.display='none';
  doBrowseSearch();
}

async function doBrowseSearch(cursor){
  const isFirstPage=!cursor;
  const gen=isFirstPage?++_browseSearchGen:_browseSearchGen;
  const sort=document.getElementById('browse-sort')?.value||'Most Downloaded';
  const period=document.getElementById('browse-period')?.value||'AllTime';
  const baseModel=document.getElementById('browse-basemodel')?.value||'';
  const nsfw=showAdult?'true':'false';
  const statusEl=document.getElementById('browse-status');
  const resultsEl=document.getElementById('browse-results');
  const loadMoreEl=document.getElementById('browse-load-more');
  const emptyEl=document.getElementById('browse-empty');
  const loadingEl=document.getElementById('browse-loading');
  if(isFirstPage){
    if(resultsEl)resultsEl.innerHTML='';
    _browseResults=[];
    if(emptyEl)emptyEl.style.display='none';
    if(loadingEl)loadingEl.style.display='block';
    if(loadMoreEl)loadMoreEl.style.display='none';
  }
  try{
    let url='/local/civitai/search?sort='+encodeURIComponent(sort)
      +'&period='+encodeURIComponent(period)
      +'&nsfw='+encodeURIComponent(nsfw)
      +'&limit=20';
    if(cursor)url+='&cursor='+encodeURIComponent(cursor);
    if(_browseQuery)url+='&query='+encodeURIComponent(_browseQuery);
    if(baseModel)url+='&baseModel='+encodeURIComponent(baseModel);
    const res=await fetch(url);
    if(!res.ok){
      const errBody=await res.text().catch(()=>'');
      throw new Error('Search failed ('+res.status+'): '+errBody);
    }
    const data=await res.json();
    if(gen!==_browseSearchGen)return; // stale request, discard
    if(data.error)throw new Error(data.error);
    if(loadingEl)loadingEl.style.display='none';
    const items=data.items||[];
    _browseMetadata=data.metadata||{};
    _browseResults=isFirstPage?items:_browseResults.concat(items);
    if(isFirstPage&&!items.length){
      if(emptyEl){emptyEl.style.display='block';emptyEl.querySelector('div:nth-child(2)').textContent=_browseQuery?'No results for "'+_browseQuery+'"':'No results';}
      if(statusEl)statusEl.textContent='';
      return;
    }
    items.forEach(m=>{
      // Skip models with no still images (only videos or no images at all)
      const ver0=m.modelVersions&&m.modelVersions[0];
      const stillImgs=(ver0&&ver0.images||[]).filter(i=>i.type!=='video');
      if(!stillImgs.length)return;
      if(resultsEl)resultsEl.insertAdjacentHTML('beforeend',mkBrowseCard(m));
    });
    if(statusEl){
      const total=_browseMetadata.totalItems||_browseResults.length;
      statusEl.textContent=_browseResults.length+(total>_browseResults.length?' of '+total:'')+' results';
    }
    const hasMore=!!_browseMetadata.nextCursor;
    if(loadMoreEl)loadMoreEl.style.display=hasMore?'block':'none';
  }catch(e){
    if(loadingEl)loadingEl.style.display='none';
    showToast('Search error',e.message,'err');
  }
}

function loadMoreBrowseResults(){
  if(_browseMetadata.nextCursor)doBrowseSearch(_browseMetadata.nextCursor);
}

function mkBrowseCard(model){
  const ver=model.modelVersions&&model.modelVersions[0];
  const imgs=ver&&ver.images||[];
  // Find first SFW still image (skip videos), or first image if adult mode
  let img=null;
  for(const i of imgs){
    if(i.type==='video')continue;
    if(showAdult||!i.nsfw||(i.nsfwLevel||0)<=2){img=i;break;}
  }
  const imgUrl=img?img.url:null;
  const name=model.name||'Unknown';
  const baseModel=ver?ver.baseModel:'';
  const downloads=model.stats?model.stats.downloadCount||0:0;
  const thumbsUp=model.stats?model.stats.thumbsUpCount||0:0;
  const isNsfw=model.nsfw;
  const isInstalled=isModelInstalled(model.id);
  const imgHtml=imgUrl
    ?'<img class="lora-card-img" draggable="false" loading="lazy" referrerpolicy="no-referrer" src="'+imgUrl+'" onerror="this.outerHTML=\'<div class=browse-card-img-retry onclick=retryBrowseImg(this,\\\''+(imgUrl.replace(/'/g,''))+'\\\') title=Click to retry>⟳</div>\'">'
    :'<div class="lora-card-img-placeholder">No preview</div>';
  const installedBadge=isInstalled?'<span class="browse-card-installed" title="Already installed">✓</span>':'';
  const nsfwBadge=isNsfw&&showAdult?'<span class="browse-card-nsfw">NSFW</span>':'';
  const dlStr=downloads>=1000?(downloads/1000).toFixed(1)+'k':downloads.toString();
  const thumbsStr=thumbsUp?'👍 '+( thumbsUp>=1000?(thumbsUp/1000).toFixed(1)+'k':thumbsUp):'';
  return '<div class="lora-card browse-card'+(isNsfw?' brut-card':'')+'" data-civitai-model-id="'+model.id+'" onclick="openBrowseDetail('+model.id+')">'
    +imgHtml
    +installedBadge
    +nsfwBadge
    +'<div class="lora-card-overlay"></div>'
    +'<div class="lora-card-footer">'
    +'<div class="lora-card-name-row"><div class="lora-card-name">'+esc(name)+'</div>'
    +(baseModel?'<div class="lora-card-type">'+esc(baseModel)+'</div>':'')
    +'</div>'
    +'<div class="browse-card-stats">'
    +'<span>↓ '+dlStr+'</span>'
    +(thumbsStr?'<span>'+thumbsStr+'</span>':'')
    +'</div>'
    +'</div>'
    +'</div>';
}

function retryBrowseImg(el,url){
  event.stopPropagation();
  const img=document.createElement('img');
  img.className='lora-card-img';
  img.draggable=false;
  img.loading='lazy';
  img.referrerPolicy='no-referrer';
  img.src=url+'?t='+Date.now();
  img.onerror=()=>{el.textContent='✕';el.title='Failed to load';};
  el.replaceWith(img);
}

function isModelInstalled(civitaiModelId){
  return loraList.some(l=>{
    const civ=l.civitai;
    if(!civ)return false;
    return (civ.modelId||civ.id)==civitaiModelId;
  });
}

function openBrowseDetail(modelId){
  const model=_browseResults.find(m=>m.id===modelId);
  if(!model)return;
  _currentBrowseModel=model;
  // Close library panel if open
  closeLpPanel();
  const panel=document.getElementById('browse-detail');
  const backdrop=document.getElementById('browse-detail-backdrop');
  // Name
  document.getElementById('bd-name').textContent=model.name||'Unknown';
  // Type + base model badges
  const typeEl=document.getElementById('bd-type');
  typeEl.textContent=model.type||'LORA';
  const bmEl=document.getElementById('bd-basemodel');
  const ver=model.modelVersions&&model.modelVersions[0];
  bmEl.textContent=ver?ver.baseModel:'';
  // CivitAI link
  const linkEl=document.getElementById('bd-civitai-link');
  linkEl.href='https://civitai.com/models/'+model.id;
  // Version picker — default to version matching base model filter if set
  const verSelect=document.getElementById('bd-version');
  verSelect.innerHTML='';
  const versions=model.modelVersions||[];
  versions.forEach((v,i)=>{
    const opt=document.createElement('option');
    opt.value=i;
    opt.textContent=v.name+(v.baseModel?' ('+v.baseModel+')':'');
    verSelect.appendChild(opt);
  });
  const bmFilter=document.getElementById('browse-basemodel')?.value||'';
  let defaultIdx=0;
  if(bmFilter){
    const matchIdx=versions.findIndex(v=>v.baseModel===bmFilter);
    if(matchIdx>=0)defaultIdx=matchIdx;
  }
  verSelect.value=String(defaultIdx);
  renderBrowseVersion(defaultIdx);
  panel.classList.add('open');
  if(backdrop)backdrop.classList.add('open');
}

function closeBrowseDetail(){
  _currentBrowseModel=null;
  _currentBrowseVersion=null;
  if(_bdInstallPoll){clearInterval(_bdInstallPoll);_bdInstallPoll=null;}
  document.getElementById('browse-detail')?.classList.remove('open');
  document.getElementById('browse-detail-backdrop')?.classList.remove('open');
}

function onBrowseVersionChange(){
  const idx=parseInt(document.getElementById('bd-version')?.value||'0');
  renderBrowseVersion(idx);
}

function renderBrowseVersion(idx){
  if(!_currentBrowseModel)return;
  const versions=_currentBrowseModel.modelVersions||[];
  const ver=versions[idx];
  if(!ver)return;
  _currentBrowseVersion=ver;
  // Images
  const imgsEl=document.getElementById('bd-images');
  const imgs=ver.images||[];
  const visibleImgs=(showAdult?imgs:imgs.filter(i=>!i.nsfw&&(i.nsfwLevel||0)<=2)).filter(i=>i.type!=='video');
  imgsEl.innerHTML=visibleImgs.length
    ?visibleImgs.map(i=>'<img src="'+i.url+'" onclick="openLightboxUrl(\''+i.url+'\')" loading="lazy" referrerpolicy="no-referrer">').join('')
    :'<div style="padding:20px;color:var(--muted);font-size:11px;">No preview images</div>';
  // Base model badge
  document.getElementById('bd-basemodel').textContent=ver.baseModel||'';
  // Stats
  const statsEl=document.getElementById('bd-stats');
  const primaryFile=(ver.files||[]).find(f=>f.primary&&f.name.endsWith('.safetensors'))
    ||(ver.files||[]).find(f=>f.name.endsWith('.safetensors'));
  const sizeMB=primaryFile?Math.round((primaryFile.sizeKB||0)/1024):0;
  const model=_currentBrowseModel;
  const downloads=model.stats?model.stats.downloadCount||0:0;
  const thumbsUp=model.stats?model.stats.thumbsUpCount||0:0;
  const thumbsDown=model.stats?model.stats.thumbsDownCount||0:0;
  const published=ver.publishedAt?new Date(ver.publishedAt).toLocaleDateString():'';
  statsEl.innerHTML=''
    +'<div class="bd-stat"><div class="bd-stat-label">File Size</div><div class="bd-stat-value">'+(sizeMB?sizeMB+' MB':'Unknown')+'</div></div>'
    +'<div class="bd-stat"><div class="bd-stat-label">Downloads</div><div class="bd-stat-value">'+downloads.toLocaleString()+'</div></div>'
    +'<div class="bd-stat"><div class="bd-stat-label">Rating</div><div class="bd-stat-value">'+(thumbsUp?'👍 '+thumbsUp.toLocaleString()+(thumbsDown?' · 👎 '+thumbsDown.toLocaleString():''):'N/A')+'</div></div>'
    +'<div class="bd-stat"><div class="bd-stat-label">Published</div><div class="bd-stat-value">'+(published||'Unknown')+'</div></div>';
  // Trained words
  const twWrap=document.getElementById('bd-triggers-wrap');
  const twEl=document.getElementById('bd-triggers');
  const words=ver.trainedWords||[];
  if(words.length){
    twWrap.style.display='block';
    twEl.innerHTML=words.map(w=>'<span class="bd-trigger-chip">'+esc(w)+'</span>').join('');
  }else{
    twWrap.style.display='none';
  }
  // Description
  const descWrap=document.getElementById('bd-desc-wrap');
  const descEl=document.getElementById('bd-desc');
  const desc=model.description||'';
  if(desc){
    descWrap.style.display='block';
    // CivitAI returns HTML in descriptions — render as text for safety
    const tmp=document.createElement('div');
    tmp.innerHTML=desc;
    descEl.textContent=tmp.textContent.slice(0,1000);
  }else{
    descWrap.style.display='none';
  }
  // Install button state
  updateBrowseInstallBtn();
}

function updateBrowseInstallBtn(){
  const btn=document.getElementById('bd-install-btn');
  if(!btn||!_currentBrowseModel)return;
  const installed=isModelInstalled(_currentBrowseModel.id);
  btn.textContent=installed?'✓ Already Installed':'Install';
  btn.disabled=installed;
  btn.style.opacity=installed?'.5':'1';
  btn.style.cursor=installed?'default':'pointer';
  // Reset progress bar
  document.getElementById('bd-install-progress').style.display='none';
  document.getElementById('bd-progress-bar').style.width='0%';
  document.getElementById('bd-progress-text').textContent='';
}

async function installFromBrowse(){
  if(!_currentBrowseModel||!_currentBrowseVersion)return;
  const model=_currentBrowseModel;
  const ver=_currentBrowseVersion;
  const civitUrl='https://civitai.com/models/'+model.id+'?modelVersionId='+ver.id;
  const btn=document.getElementById('bd-install-btn');
  const progressWrap=document.getElementById('bd-install-progress');
  const progressBar=document.getElementById('bd-progress-bar');
  const progressText=document.getElementById('bd-progress-text');
  btn.textContent='Installing…';
  btn.disabled=true;
  btn.style.opacity='.5';
  progressWrap.style.display='block';
  try{
    const res=await fetch('/local/loras/install',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({url:civitUrl,civitaiApiKey:appData.settings?.civitaiApiKey||''})
    });
    const resData=await res.json().catch(()=>({}));
    if(!res.ok){
      throw new Error(resData.error||'Install failed');
    }
    // Poll progress (server returns immediately, download runs in background)
    _bdInstallPoll=setInterval(async()=>{
      try{
        const pr=await fetch('/local/loras/install-progress');
        const prog=await pr.json();
        const pct=prog.pct||0;
        progressBar.style.width=pct+'%';
        progressText.textContent=prog.message||(pct+'%');
        if(prog.status==='done'||prog.status==='error'){
          clearInterval(_bdInstallPoll);
          _bdInstallPoll=null;
          if(prog.status==='done'){
            progressBar.style.width='100%';
            progressText.textContent='Installed!';
            showToast('Installed',model.name,'ok');
            // Refresh library
            await loadLoras();
            renderLoraTab();
            updateBrowseInstallBtn();
            // Update installed badge on browse card
            const card=document.querySelector('[data-civitai-model-id="'+model.id+'"]');
            if(card&&!card.querySelector('.browse-card-installed')){
              card.insertAdjacentHTML('afterbegin','<span class="browse-card-installed" title="Already installed">✓</span>');
            }
          }else{
            btn.textContent='Install';
            btn.disabled=false;
            btn.style.opacity='1';
            showToast('Install failed',prog.message||'Unknown error','err');
          }
        }
      }catch(e){}
    },500);
  }catch(e){
    btn.textContent='Install';
    btn.disabled=false;
    btn.style.opacity='1';
    progressWrap.style.display='none';
    showToast('Install error',e.message,'err');
  }
}

// Lightbox for browse detail images
function openLightboxUrl(url){
  const lb=document.getElementById('lp-lightbox');
  if(!lb)return;
  document.getElementById('lp-lightbox-img').src=url;
  lb.classList.add('open');
}

