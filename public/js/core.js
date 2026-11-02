export const defaults=()=>({mode:'overseas',continent:'all',country:'all',province:'all',ggCity:'all',kind:'all',quantity:1,avoidRecent:true,includeIslands:false,animation:'auto',risk:1});
export function sanitizeSettings(value){
  const s=defaults();if(!value||typeof value!=='object')return s;
  for(const key of ['continent','country','province','ggCity'])if(typeof value[key]==='string'&&value[key].length<80)s[key]=value[key];
  if(['overseas','domestic','gyeonggi'].includes(value.mode))s.mode=value.mode;
  if(['all','city','county'].includes(value.kind))s.kind=value.kind;
  if(['auto','short','none'].includes(value.animation))s.animation=value.animation;
  for(const key of ['avoidRecent','includeIslands'])if(typeof value[key]==='boolean')s[key]=value[key];
  if([1,3].includes(value.quantity))s.quantity=value.quantity;
  if([0,1].includes(value.risk))s.risk=value.risk;
  return s;
}
export function normalizeCatalog(overseas,domestic){
  return [...overseas.destinations.filter(p=>p.countryCode!=='KOR'&&p.curation==='korean-traveler-famous-city'&&p.landmass==='continental-mainland'&&p.continent!=='Africa').map(p=>({...p,id:'world-'+p.id,name:p.city,region:p.country,regionCode:p.countryCode,scope:'overseas'})),...domestic.destinations.map(p=>({...p,scope:'domestic'}))];
}
export function filterPlaces(catalog,settings,history=[]){
  const s=sanitizeSettings(settings),recent=new Set(history.slice(0,20).flatMap(h=>h.ids||[]));
  return catalog.filter(p=>{
    if(s.mode==='overseas'){
      if(p.scope!=='overseas'||p.continent==='Africa'||p.landmass!=='continental-mainland')return false;
      if(s.continent!=='all'&&p.continent!==s.continent)return false;
      if(s.country!=='all'&&p.countryCode!==s.country)return false;
    }else{
      if(p.scope!=='domestic')return false;
      if(s.mode==='gyeonggi'&&(p.regionCode!=='31'||(s.ggCity!=='all'&&p.id!==s.ggCity)))return false;
      if(s.mode==='domestic'&&s.province!=='all'&&p.regionCode!==s.province)return false;
      if(s.kind!=='all'&&p.kind!==s.kind)return false;
      if(!s.includeIslands&&p.island)return false;
    }
    return !s.avoidRecent||!recent.has(p.id);
  });
}
export const random=()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296;
export async function pickPlaces(pool,settings,{verify,signal,rng=random,onProgress=()=>{}}={}){
  const s=sanitizeSettings(settings);
  if(pool.length<s.quantity)throw new Error(`조건에 맞는 후보가 ${pool.length}곳이에요. 조건을 넓히거나 최근 결과 제외를 꺼 주세요.`);
  const remaining=[...pool],result=[];let tries=0;
  while(remaining.length&&tries<Math.max(24,s.quantity*12)){
    if(signal?.aborted)throw new DOMException('추첨을 취소했어요.','AbortError');
    const index=Math.min(remaining.length-1,Math.floor(rng()*remaining.length)),point=remaining.splice(index,1)[0];tries++;onProgress(result.length,s.quantity,tries);
    if(s.mode==='overseas'){
      const advisory=await verify(point,{signal});
      if(signal?.aborted)throw new DOMException('추첨을 취소했어요.','AbortError');
      if(!advisory.allowed||![0,1].includes(advisory.level)||advisory.level>s.risk)continue;
      result.push({...point,advisory});
    }else result.push(point);
    if(result.length===s.quantity)return result;
  }
  throw new Error('선택한 조건으로 필요한 수의 여행지를 확인하지 못했어요. 조건을 바꾸거나 다시 시도해 주세요.');
}
export function loadLocal(storage,key,fallback){try{const value=JSON.parse(storage.getItem(key));return value??fallback;}catch{return fallback;}}
export function saveLocal(storage,key,value){try{storage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
export function readHistory(value,catalog){const ids=new Set(catalog.map(p=>p.id));return Array.isArray(value)?value.filter(h=>h&&Array.isArray(h.ids)&&h.ids.length>0&&h.ids.every(id=>ids.has(id))&&typeof h.at==='string'&&Number.isFinite(Date.parse(h.at))).slice(0,100):[];}
