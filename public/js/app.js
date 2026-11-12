import {defaults,sanitizeSettings,normalizeCatalog,filterPlaces,pickPlaces,loadLocal,saveLocal,readHistory,rouletteProfile,landingDelays,nextHop} from './core.js';
import {checkAdvisory} from './advisory.js';
import {createMap} from './map.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let storage;try{storage=localStorage;}catch{}
const KEY='randomplace:v1:';
let settings=sanitizeSettings(loadLocal(storage,KEY+'settings',{})),catalog=[],history=[],saved=[],results=[],pool=[],map,sequence=0,busy=false,epoch=0,controller,toastTimer,libraryView='saved';
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
function toast(text){$('#toast').textContent=text;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,3200);}
function openDialog(id){$(id).showModal();}
$$('dialog').forEach(d=>{let backdrop=false;d.addEventListener('pointerdown',e=>backdrop=e.target===d);d.addEventListener('click',e=>{if(e.target.closest('[data-close]')||(e.target===d&&backdrop))d.close();});});
function persist(type,value,explicit=false){const okay=saveLocal(storage,KEY+type,value);if(!okay&&explicit)toast('이 브라우저에서는 저장할 수 없어요. 이번 방문 동안만 유지됩니다.');return okay;}
function scopeName(mode=settings.mode){return {overseas:'해외',domestic:'국내',gyeonggi:'경기도',seoul:'서울'}[mode];}
function syncControls(){
  $$('.mode').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===settings.mode)));
  $$('[data-fields]').forEach(e=>e.hidden=e.dataset.fields==='korea'?!['domestic','gyeonggi'].includes(settings.mode):e.dataset.fields!==settings.mode);
  for(const key of ['continent','risk','province','kind','animation','ggCity','seoulGu','seoulCategory','spotType'])$('#'+key).value=String(settings[key]);
  for(const key of ['avoidRecent','includeIslands'])$('#'+key).checked=settings[key];
  $$('input[name=quantity]').forEach(r=>r.checked=+r.value===settings.quantity);
  const countries=catalog.filter(p=>p.scope==='overseas'&&(settings.continent==='all'||p.continent===settings.continent));
  options($('#country'),new Map(countries.map(p=>[p.countryCode,p.country])),'모든 국가');
  if(settings.country!=='all'&&!countries.some(p=>p.countryCode===settings.country))settings.country='all';
  $('#country').value=settings.country;
}
function options(select,values,first){select.replaceChildren();const start=document.createElement('option');start.value='all';start.textContent=first;select.append(start);for(const [value,label] of [...values].sort((a,b)=>a[1].localeCompare(b[1],'ko'))){const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option);}}
function refresh({clear=false}={}){
  if(!map)return;syncControls();pool=filterPlaces(catalog,settings,history);
  $('#candidateCount').textContent=pool.length.toLocaleString('ko-KR');$('#summaryCount').textContent=`${pool.length}곳 · 조건 설정`;
  const short=pool.length<settings.quantity;
  $('#drawBtn').disabled=busy||short;
  $('#filterHint').textContent=short?'후보가 부족해요. 조건을 넓히거나 최근 결과 제외를 꺼 주세요.':settings.mode==='overseas'?'지금은 목록 기준 후보 수예요. 추첨 중 경보 확인 후 달라질 수 있어요.':settings.mode==='gyeonggi'?'경기도의 여행 명소와 31개 시·군 대표점에서 골라요.':settings.mode==='seoul'?'편집 선정한 서울의 궁궐·공원·동네·시장 등에서 골라요.':'선택한 시도의 여행 명소와 시·군·구 대표점에서 골라요.';
  $('#filterHint').classList.toggle('settings-error',short);$('#clearRecent').hidden=!short||!history.length||!settings.avoidRecent;
  $('#mapEyebrow').textContent={overseas:'THE WORLD IS OPEN',domestic:'A LITTLE CLOSER',gyeonggi:'A DAY AROUND GYEONGGI',seoul:'SEOUL, ONE MORE TIME'}[settings.mode];
  $('#mapTitle').textContent={overseas:'다음 목적지의 가능성',domestic:'우리나라, 새롭게 만나기',gyeonggi:'멀리 가지 않아도 좋은 날',seoul:'늘 지나치던 서울의 낯선 하루'}[settings.mode];
  map.set(settings.mode,pool);
  if(clear){results=[];renderResults();}else if(results.length)map.show(results,false);
  persist('settings',settings);if($('#candidateDialog').open)renderCandidates();
}
function cancel(announce=true){epoch++;controller?.abort();controller=null;busy=false;$('#drawOverlay').hidden=true;$('#resultGrid').setAttribute('aria-busy','false');$('#drawBtn span').textContent='어디든, 뽑아보기';if(map)refresh();if(announce)toast('추첨을 취소했어요.');}
function change(key,value){if(busy)cancel(false);settings[key]=value;settings=sanitizeSettings(settings);refresh({clear:true});}
$$('.mode').forEach(b=>b.addEventListener('click',()=>change('mode',b.dataset.mode)));
for(const key of ['continent','country','province','ggCity','seoulGu','seoulCategory','spotType','kind','animation','risk'])$('#'+key).addEventListener('change',e=>{if(key==='continent')settings.country='all';change(key,key==='risk'?+e.target.value:e.target.value);});
for(const key of ['avoidRecent','includeIslands'])$('#'+key).addEventListener('change',e=>change(key,e.target.checked));
$$('input[name=quantity]').forEach(r=>r.addEventListener('change',()=>change('quantity',+r.value)));
$('#resetSettings').addEventListener('click',()=>{if(busy)cancel(false);const mode=settings.mode;settings={...defaults(),mode};refresh({clear:true});toast('이 범위의 조건을 초기화했어요. 저장과 기록은 유지됩니다.');});
$('#cancelBtn').addEventListener('click',()=>cancel());
$('#clearRecent').addEventListener('click',()=>{history=[];persist('history',history);refresh();toast('추첨 기록을 비웠어요.');});
function emptyResult(){const box=document.createElement('div');box.className='empty-result';const arrow=document.createElement('span');arrow.textContent='↗';const p=document.createElement('p');p.textContent='아직은, 어디든 갈 수 있어요.';const small=document.createElement('small');small.textContent='마음에 드는 조건을 고르고 첫 여행지를 뽑아 보세요.';p.append(small);box.append(arrow,p);return box;}
function toggleSave(id){const existed=saved.includes(id);saved=existed?saved.filter(x=>x!==id):[id,...saved].slice(0,100);const okay=persist('saved',saved,true);updateSaved();if(okay)toast(existed?'저장한 장소에서 뺐어요.':'다음 여행으로 저장했어요.');}
function updateSaved(){$('#savedBadge').textContent=saved.length;$$('[data-save-id]').forEach(b=>{const active=saved.includes(b.dataset.saveId);b.setAttribute('aria-pressed',String(active));b.firstChild.textContent=active?'★':'☆';});if($('#libraryDialog').open)renderLibrary();}
function makeCard(p,index=0,{historical=false}={}){
  const node=$('#placeTemplate').content.firstElementChild.cloneNode(true);
  node.querySelector('.place-tag').textContent=(historical?'SAVED STOP':String(index+1).padStart(2,'0')+' / '+scopeName());
  node.querySelector('.place-region').textContent=p.region;node.querySelector('.place-name').textContent=p.name;
  node.querySelector('.place-area').textContent=p.scope==='overseas'?[p.cityEn,p.area].filter((v,i,a)=>v&&a.indexOf(v)===i).join(' · '):p.type==='spot'?p.area+' · '+p.categoryLabel:p.area===p.name?'지역 대표점':p.area+' · 지역 대표점';
  node.querySelector('.place-check').textContent=p.advisory?`${p.advisory.label} · ${new Date(p.advisory.checkedAt).toLocaleString('ko-KR')} 확인`:p.scope==='overseas'?'저장한 후보 · 현재 경보는 출발 전 다시 확인':p.type==='spot'?p.note:'통계청 2018년 행정경계 기준';
  const save=node.querySelector('.save-btn');save.dataset.saveId=p.id;save.setAttribute('aria-label',p.name+' 저장');save.setAttribute('aria-pressed',String(saved.includes(p.id)));save.firstChild.textContent=saved.includes(p.id)?'★':'☆';save.addEventListener('click',()=>toggleSave(p.id));
  node.querySelector('.place-map').href=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.lat+','+p.lon)}`;
  node.querySelector('.place-copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(`${p.region} ${p.name}\n${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}`);toast('장소와 좌표를 복사했어요.');}catch{toast('클립보드를 사용할 수 없어요. 지도에서 좌표를 확인해 주세요.');}});
  return node;
}
function renderResults(){const grid=$('#resultGrid');grid.replaceChildren();if(!results.length){grid.append(emptyResult());$('#resultsTitle').textContent='우연을 기다리는 중';$('#resultSequence').textContent='01 — ?';$('#resultNote').textContent='';return;}
  results.forEach((p,i)=>grid.append(makeCard(p,i)));$('#resultsTitle').textContent=results.length===1?'이번 여행은, 이곳으로.':'세 곳의 가능성, 선택은 당신에게.';$('#resultSequence').textContent=String(sequence).padStart(2,'0')+' — '+scopeName();
  $('#resultNote').textContent=settings.mode==='seoul'?'편집 선정한 장소의 대표 좌표예요. 운영 시간·휴무·입장 조건은 방문 전에 확인해 주세요.':settings.mode==='overseas'?'확인 시점의 외교부 경보 기준입니다. 비자·입국 조건과 현지 접근성은 출발 전에 따로 확인해 주세요.':results.some(p=>p.type==='district')?'시·군·구 결과는 관광시설이나 주소가 아닌 행정구역 대표점이에요. 명소는 대표 좌표이니 운영 시간과 접근성을 방문 전에 확인해 주세요.':'편집 선정한 명소의 대표 좌표예요. 운영 시간·휴무·입장 조건은 방문 전에 확인해 주세요.';
}
const sleep=(ms,signal)=>new Promise((resolve,reject)=>{
  const abort=()=>{clearTimeout(timer);reject(new DOMException('추첨을 취소했어요.','AbortError'));};
  const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);
  if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});
});
function tick(p,{landed=false,index=0,total=1}={}){
  $('#tickerName').textContent=p.name;
  $('#tickerRegion').textContent=[p.region,p.area].filter((v,i,a)=>v&&v!==p.name&&a.indexOf(v)===i).join(' · ');
  $('.ticker-label').textContent=landed?(total>1?`${String(index+1).padStart(2,'0')} / ${String(total).padStart(2,'0')} 여기로!`:'여기로 결정!'):'지나가는 중';
  $('#drawOverlay').classList.toggle('landed',landed);
}
// 후보 사이를 빠르게 옮겨 다니다가, 결과가 정해지면 점점 느려지며 결과마다 멈춰요.
async function roulette(candidates,chosen,profile,signal){
  for(const [i,p] of chosen.entries()){
    const delays=landingDelays(profile.landing[i===0?0:1],profile);let last=p;
    for(const [k,delay] of delays.entries()){
      const target=k===delays.length-1?p:nextHop(candidates,last);last=target;
      map.scan(target,delay);tick(target);await sleep(delay,signal);
    }
    // 표시가 결과에 도착한 뒤에 확정 표시와 번호 핀을 보여 줘요.
    tick(p,{landed:true,index:i,total:chosen.length});map.lock(p,i);await sleep(profile.hold,signal);
  }
}
$('#drawBtn').addEventListener('click',async()=>{
  if(busy||pool.length<settings.quantity)return;
  const snapshot={...settings},candidates=[...pool],mine=++epoch;controller=new AbortController();const signal=controller.signal;
  const profile=rouletteProfile(snapshot.animation,reduced.matches);
  busy=true;results=[];renderResults();map.reset();map.clearPins();$('#drawBtn').disabled=true;$('#drawBtn span').textContent='다음 목적지를 찾는 중';
  $('.ticker').hidden=!profile;$('#drawOverlay').classList.remove('landed');$('#drawOverlay').hidden=false;$('#resultGrid').setAttribute('aria-busy','true');
  const drawController=controller;const timeout=setTimeout(()=>drawController.abort(),45000);
  let spinning=Boolean(profile),last;
  const spinner=(async()=>{while(spinning&&!signal.aborted){last=nextHop(candidates,last);map.scan(last,profile.interval);tick(last);await sleep(profile.interval,signal).catch(()=>{});}})();
  try{
    const minimum=profile?sleep(profile.spin,signal):Promise.resolve();
    const chosen=await pickPlaces(candidates,snapshot,{verify:checkAdvisory,signal,onProgress:(n,total,tries)=>{$('#progressText').textContent=snapshot.mode==='overseas'?`지역별 여행경보 확인 중 · ${n}/${total}곳 (${tries}번째 후보)`:`${scopeName(snapshot.mode)}의 다음 목적지를 고르는 중…`;}});
    await minimum;spinning=false;await spinner;if(mine!==epoch||signal.aborted)return;
    if(profile){$('#progressText').textContent='여기로 멈추는 중…';await roulette(candidates,chosen,profile,signal);}
    if(mine!==epoch||signal.aborted)return;
    results=chosen;sequence++;history=[{ids:chosen.map(p=>p.id),at:new Date().toISOString(),mode:snapshot.mode},...history].slice(0,100);persist('history',history);
    busy=false;$('#drawOverlay').hidden=true;$('#resultGrid').setAttribute('aria-busy','false');$('#drawBtn span').textContent='한 번 더, 뽑아보기';refresh();renderResults();map.show(results,Boolean(profile));
    if(matchMedia('(max-width:800px)').matches)$('#resultsTitle').scrollIntoView({behavior:reduced.matches?'instant':'smooth',block:'center'});
  }catch(err){spinning=false;if(mine!==epoch)return;busy=false;$('#drawOverlay').hidden=true;$('#resultGrid').setAttribute('aria-busy','false');$('#drawBtn span').textContent='다시 뽑아보기';refresh();const error=document.createElement('div');error.className='error-result';error.textContent=err.name==='AbortError'?'조회 시간이 길어져 멈췄어요. 다시 시도해 주세요.':err.message;$('#resultGrid').replaceChildren(error);$('#resultsTitle').textContent='다시 한번 골라볼까요?';}
  finally{spinning=false;clearTimeout(timeout);}
});
function renderCandidates(){const query=$('#candidateSearch').value.trim().toLocaleLowerCase();const matches=pool.filter(p=>[p.name,p.region,p.area,p.cityEn,p.categoryLabel,p.note].join(' ').toLocaleLowerCase().includes(query));$('#searchCount').textContent=`${pool.length}곳 중 ${matches.length}곳`;
  const box=$('#candidateList');box.replaceChildren();for(const p of matches){const item=document.createElement('div');item.className='candidate-item';const title=document.createElement('strong'),sub=document.createElement('small');title.textContent=p.name;sub.textContent=(p.type==='spot'?[settings.mode==='seoul'?'':p.region,p.area,p.categoryLabel]:[p.region,p.area]).filter((v,i,a)=>v&&a.indexOf(v)===i).join(' · ');item.append(title,sub);box.append(item);}}
$('#candidateBtn').addEventListener('click',()=>{$('#candidateSearch').value='';renderCandidates();openDialog('#candidateDialog');});$('#candidateSearch').addEventListener('input',renderCandidates);
function renderLibrary(){const box=$('#libraryList');box.replaceChildren();$$('[data-library]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.library===libraryView)));$('#clearHistory').hidden=libraryView!=='history'||!history.length;
  if(libraryView==='saved'){for(const id of saved){const p=catalog.find(p=>p.id===id);if(p)box.append(makeCard(p,0,{historical:true}));}}else for(const h of history){const entry=document.createElement('section');entry.className='history-entry';const date=document.createElement('p');date.className='history-date';date.textContent=new Date(h.at).toLocaleString('ko-KR')+' · 당시 추첨 기록';entry.append(date);for(const id of h.ids){const p=catalog.find(p=>p.id===id);if(p)entry.append(makeCard(p,0,{historical:true}));}box.append(entry);}
  if(!box.children.length){const p=document.createElement('p');p.className='muted';p.textContent=libraryView==='saved'?'아직 저장한 장소가 없어요. 결과 카드의 별을 눌러 보세요.':'아직 추첨 기록이 없어요. 첫 여행지를 뽑아 보세요.';box.append(p);}}
$('#libraryBtn').addEventListener('click',()=>{renderLibrary();openDialog('#libraryDialog');});$$('[data-library]').forEach(b=>b.addEventListener('click',()=>{libraryView=b.dataset.library;renderLibrary();}));
$('#clearHistory').addEventListener('click',()=>{if(busy)cancel(false);history=[];persist('history',history);renderLibrary();refresh();toast('추첨 기록을 비웠어요. 저장한 장소는 유지됩니다.');});
for(const id of ['aboutBtn','sourceBtn'])$('#'+id).addEventListener('click',()=>openDialog('#aboutDialog'));
try{
  const [overseas,domestic,world,korea,seoul,seoulMap,spots]=await Promise.all(['overseas.json','domestic.json','world-map.json','korea-map.json','seoul.json','seoul-map.json','korea-spots.json'].map(async path=>{const r=await fetch(new URL('../data/'+path,import.meta.url));if(!r.ok)throw new Error('장소 목록을 불러오지 못했어요. 새로고침해 주세요.');return r.json();}));
  catalog=normalizeCatalog(overseas,domestic,seoul,spots);history=readHistory(loadLocal(storage,KEY+'history',[]),catalog);
  const raw=loadLocal(storage,KEY+'saved',[]);saved=Array.isArray(raw)?[...new Set(raw)].filter(id=>catalog.some(p=>p.id===id)).slice(0,100):[];
  options($('#province'),new Map(catalog.filter(p=>p.scope==='domestic').map(p=>[p.regionCode,p.region])),'전국 모든 시도');
  options($('#ggCity'),new Map(catalog.filter(p=>p.type==='district'&&p.province==='31').map(p=>[p.id,p.name])),'경기도 전체 31개 시·군');
  options($('#seoulGu'),new Map(catalog.filter(p=>p.scope==='seoul').map(p=>[p.regionCode,p.area])),'서울 25개 구 전체');
  $('#worldCount').textContent=catalog.filter(p=>p.scope==='overseas').length;$('#domesticCount').textContent=catalog.filter(p=>p.province).length;$('#ggCount').textContent=catalog.filter(p=>p.scope==='domestic'&&p.province==='31').length;$('#seoulCount').textContent=seoul.destinations.length;
  map=createMap(world,korea,seoulMap);if(matchMedia('(max-width:800px)').matches)$('#settings').open=false;updateSaved();refresh();document.body.dataset.ready='true';
}catch(err){$('#filterHint').textContent=err.message;$('#filterHint').classList.add('settings-error');$('#mapTitle').textContent='목록을 다시 불러와 주세요';}
