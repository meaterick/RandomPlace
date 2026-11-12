export const SPOT_CATEGORIES=['history','park','mountain','sea','river','street','market','culture','landmark'];
export const defaults=()=>({mode:'overseas',continent:'all',country:'all',province:'all',ggCity:'all',seoulGu:'all',seoulCategory:'all',spotType:'all',kind:'all',quantity:1,avoidRecent:true,includeIslands:false,animation:'auto',risk:1});
export function sanitizeSettings(value){
  const s=defaults();if(!value||typeof value!=='object')return s;
  for(const key of ['continent','country','province','ggCity','seoulGu','seoulCategory'])if(typeof value[key]==='string'&&value[key].length<80)s[key]=value[key];
  if(['overseas','domestic','gyeonggi','seoul'].includes(value.mode))s.mode=value.mode;
  if(['all','city','county'].includes(value.kind))s.kind=value.kind;
  if(['all','spot','district',...SPOT_CATEGORIES].includes(value.spotType))s.spotType=value.spotType;
  if(['auto','short','none'].includes(value.animation))s.animation=value.animation;
  for(const key of ['avoidRecent','includeIslands'])if(typeof value[key]==='boolean')s[key]=value[key];
  if([1,3].includes(value.quantity))s.quantity=value.quantity;
  if([0,1].includes(value.risk))s.risk=value.risk;
  return s;
}
// 국내 후보는 시·군·구 대표점(district)과 여행 명소(spot)로 나뉘고, 모두 시도(province)와 상위 시·군·구(parent)를 가져요.
// 서울 범위의 장소도 국내 범위에서는 서울특별시의 명소로 함께 뽑혀요.
const empty={destinations:[]};
export function normalizeCatalog(overseas,domestic,seoul=empty,spots=empty){
  return [
    ...overseas.destinations.filter(p=>p.countryCode!=='KOR'&&p.curation==='korean-traveler-famous-city'&&p.landmass==='continental-mainland'&&p.continent!=='Africa').map(p=>({...p,id:'world-'+p.id,name:p.city,region:p.country,regionCode:p.countryCode,scope:'overseas'})),
    ...domestic.destinations.map(p=>({...p,scope:'domestic',type:'district',province:p.regionCode,parent:p.id})),
    ...spots.destinations.map(p=>({...p,scope:'domestic',type:'spot',province:p.regionCode,parent:p.parentId})),
    ...seoul.destinations.map(p=>({...p,scope:'seoul',type:'spot',province:'11',parent:'kr-'+p.regionCode,kind:'city',island:false})),
  ];
}
export function filterPlaces(catalog,settings,history=[]){
  const s=sanitizeSettings(settings),recent=new Set(history.slice(0,20).flatMap(h=>h.ids||[]));
  return catalog.filter(p=>{
    if(s.mode==='overseas'){
      if(p.scope!=='overseas'||p.continent==='Africa'||p.landmass!=='continental-mainland')return false;
      if(s.continent!=='all'&&p.continent!==s.continent)return false;
      if(s.country!=='all'&&p.countryCode!==s.country)return false;
    }else if(s.mode==='seoul'){
      if(p.scope!=='seoul')return false;
      if(s.seoulGu!=='all'&&p.regionCode!==s.seoulGu)return false;
      if(s.seoulCategory!=='all'&&p.category!==s.seoulCategory)return false;
    }else{
      if(p.scope!=='domestic'&&!(p.scope==='seoul'&&s.mode==='domestic'))return false;
      if(s.mode==='gyeonggi'&&(p.province!=='31'||(s.ggCity!=='all'&&p.parent!==s.ggCity)))return false;
      if(s.mode==='domestic'&&s.province!=='all'&&p.province!==s.province)return false;
      if(s.spotType==='spot'&&p.type!=='spot')return false;
      if(s.spotType==='district'&&p.type!=='district')return false;
      if(SPOT_CATEGORIES.includes(s.spotType)&&(p.type!=='spot'||p.category!==s.spotType))return false;
      if(s.kind!=='all'&&p.kind!==s.kind)return false;
      if(!s.includeIslands&&p.island)return false;
    }
    return !s.avoidRecent||!recent.has(p.id);
  });
}
// 추첨 연출: 후보 사이를 빠르게 옮겨 다니다가(간격 고정) 결과 앞에서 점점 느려지며 멈춰요.
export const rouletteProfile=(animation,reduced)=>animation==='none'||(animation==='auto'&&reduced)?null
  :animation==='short'?{spin:300,interval:55,landing:[4,3],slowest:230,hold:160}
  :{spin:1000,interval:65,landing:[9,6],slowest:430,hold:320};
export function landingDelays(steps,profile){
  return Array.from({length:steps},(_,i)=>{const t=steps<2?1:i/(steps-1);return Math.round(profile.interval+(profile.slowest-profile.interval)*t*t);});
}
export function nextHop(pool,previous,rng=random){
  if(pool.length<2)return pool[0];
  let index=Math.min(pool.length-1,Math.floor(rng()*(pool.length-1)));
  if(pool[index]===previous)index=pool.length-1;
  return pool[index];
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
