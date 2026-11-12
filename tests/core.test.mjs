import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  defaults,sanitizeSettings,normalizeCatalog,filterPlaces,pickPlaces,
  loadLocal,saveLocal,readHistory,rouletteProfile,landingDelays,nextHop,
} from '../public/js/core.js';

const read=name=>JSON.parse(fs.readFileSync(new URL(`../public/data/${name}.json`,import.meta.url),'utf8'));
const overseas=read('overseas'),domestic=read('domestic'),seoulData=read('seoul'),spotData=read('korea-spots');
const catalog=normalizeCatalog(overseas,domestic,seoulData,spotData);
const setting=patch=>({...defaults(),...patch});
const world=catalog.filter(p=>p.scope==='overseas');
const korea=catalog.filter(p=>p.scope==='domestic');
const districts=korea.filter(p=>p.type==='district'),spots=korea.filter(p=>p.type==='spot');
const seoul=catalog.filter(p=>p.scope==='seoul');

test('잘못되거나 오래된 설정을 허용된 기본값으로 복구해요',()=>{
  for(const value of [undefined,null,'bad',42])assert.deepEqual(sanitizeSettings(value),defaults());
  const s=sanitizeSettings({mode:'unknown',quantity:99,risk:4,kind:'resort',animation:'endless',includeIslands:'yes',avoidRecent:0,country:'x'.repeat(80),extra:'ignored'});
  assert.deepEqual(s,defaults());
  assert.deepEqual(sanitizeSettings({mode:'gyeonggi',quantity:3,risk:0,kind:'county',animation:'none',includeIslands:true,avoidRecent:false,province:'31'}),setting({mode:'gyeonggi',quantity:3,risk:0,kind:'county',animation:'none',includeIslands:true,avoidRecent:false,province:'31'}));
});

test('설정 정규화는 원본을 바꾸지 않고 매번 독립된 값을 반환해요',()=>{
  const original={mode:'domestic',quantity:3};const snapshot=JSON.stringify(original);
  const normalized=sanitizeSettings(original);normalized.mode='gyeonggi';
  assert.equal(JSON.stringify(original),snapshot);assert.equal(sanitizeSettings(original).mode,'domestic');
});

test('실제 해외·국내 자료를 이름·지역·좌표가 있는 공통 스키마로 구분해요',()=>{
  assert.equal(world.length,overseas.destinations.filter(p=>p.countryCode!=='KOR').length);
  assert.ok(overseas.destinations.some(p=>p.countryCode==='KOR'),'이전 해외 목록에 있던 한국 도시를 검증해요');
  assert.equal(world.some(p=>p.countryCode==='KOR'),false,'한국 도시는 해외 범위에서 제외돼요');
  assert.equal(districts.length,domestic.destinations.length);assert.equal(spots.length,spotData.destinations.length);
  assert.equal(new Set(catalog.map(p=>p.id)).size,catalog.length);
  for(const p of catalog){assert.ok(p.name&&p.region&&p.regionCode);assert.ok(Number.isFinite(p.lat)&&Number.isFinite(p.lon));}
  for(const p of world){assert.ok(p.id.startsWith('world-'));assert.equal(p.name,p.city);assert.equal(p.region,p.country);}
  for(const p of districts)assert.ok(p.id.startsWith('kr-')&&p.parent===p.id);
  const ids=new Set(districts.map(p=>p.id));
  for(const p of spots){assert.ok(p.id.startsWith('spot-'));assert.ok(ids.has(p.parent),'명소는 실제 시·군·구에 속해요');assert.equal(p.province,p.parent.slice(3,5));}
});

test('선정되지 않은 도시·섬·아프리카를 해외 자료에 섞어도 정규화에서 제외해요',()=>{
  const p=overseas.destinations[0];
  const invalid=[{...p,id:'raw',curation:undefined},{...p,id:'island',landmass:'island'},{...p,id:'africa',continent:'Africa'}];
  assert.deepEqual(normalizeCatalog({destinations:invalid},{destinations:[]}),[]);
});

test('해외 모드의 대륙과 국가 설정은 국내 자료와 다른 나라를 섞지 않아요',()=>{
  const europe=filterPlaces(catalog,setting({continent:'Europe'}));assert.ok(europe.length>0);
  assert.ok(europe.every(p=>p.scope==='overseas'&&p.continent==='Europe'));
  const france=filterPlaces(catalog,setting({continent:'Europe',country:'FRA'}));assert.ok(france.length>0);
  assert.ok(france.every(p=>p.countryCode==='FRA'));
  assert.equal(filterPlaces(catalog,setting({continent:'Asia',country:'FRA'})).length,0);
});

test('국내 모드는 선택한 시도만 남기고 해외 국가 설정을 적용하지 않아요',()=>{
  const seoul=filterPlaces(catalog,setting({mode:'domestic',province:'11',country:'FRA',continent:'Europe'}));
  assert.ok(seoul.length>0);assert.ok(seoul.every(p=>p.province==='11'));
  assert.ok(seoul.some(p=>p.type==='district')&&seoul.some(p=>p.scope==='seoul'),'서울 자치구 대표점과 서울 명소를 함께 뽑아요');
  const all=filterPlaces(catalog,setting({mode:'domestic',includeIslands:true}));assert.equal(all.length,korea.length+seoulData.destinations.length);
});

test('경기도 모드는 31개 시군으로 한정하고 다른 국내 시도 설정과 분리돼요',()=>{
  const rows=filterPlaces(catalog,setting({mode:'gyeonggi',province:'11',spotType:'district'}));
  assert.equal(rows.length,31);assert.ok(rows.every(p=>p.regionCode==='31'));
  assert.equal(new Set(rows.map(p=>p.name)).size,31);
  const suwon=rows.find(p=>p.name==='수원시');assert.ok(suwon);
  assert.deepEqual(filterPlaces(catalog,setting({mode:'gyeonggi',ggCity:suwon.id,spotType:'district'})).map(p=>p.name),['수원시']);
  const suwonAll=filterPlaces(catalog,setting({mode:'gyeonggi',ggCity:suwon.id}));
  assert.ok(suwonAll.some(p=>p.name==='수원화성'));assert.ok(suwonAll.every(p=>p.parent===suwon.id));
});

test('도시·군 설정은 결과 유형을 정확히 제한해요',()=>{
  const counties=filterPlaces(catalog,setting({mode:'gyeonggi',kind:'county',spotType:'district'}));
  assert.deepEqual(counties.map(p=>p.name).sort(),['가평군','양평군','연천군']);
  assert.ok(filterPlaces(catalog,setting({mode:'gyeonggi',kind:'county',spotType:'spot'})).every(p=>['가평군','양평군','연천군'].includes(p.area)));
  const cities=filterPlaces(catalog,setting({mode:'gyeonggi',kind:'city',spotType:'district'}));
  assert.equal(cities.length,28);assert.ok(cities.every(p=>p.kind==='city'));
});

test('국내 섬 포함 설정은 표시된 섬 후보에만 적용돼요',()=>{
  const without=filterPlaces(catalog,setting({mode:'domestic',includeIslands:false}));
  const withIslands=filterPlaces(catalog,setting({mode:'domestic',includeIslands:true}));
  assert.ok(withIslands.some(p=>p.island));assert.ok(without.every(p=>!p.island));
  assert.ok(withIslands.length>without.length);
  assert.ok(!without.some(p=>p.regionCode==='39'));
});

test('최근 20회에 포함된 결과만 제외하고 설정을 끄면 다시 고를 수 있어요',()=>{
  const rows=korea.slice(0,22);
  const history=rows.map((p,i)=>({ids:[p.id],at:String(i)}));
  const options=setting({mode:'domestic',includeIslands:true});
  const filtered=filterPlaces(rows,options,history);
  assert.deepEqual(filtered.map(p=>p.id),rows.slice(20).map(p=>p.id));
  assert.equal(filterPlaces(rows,{...options,avoidRecent:false},history).length,rows.length);
});

test('국내 1곳 또는 3곳 뽑기는 외교부를 조회하지 않고 서로 다른 곳을 반환해요',async()=>{
  let calls=0;const verify=()=>{calls++;throw new Error('국내에서는 호출되면 안 돼요');};
  for(const quantity of [1,3]){
    const selected=await pickPlaces(korea.slice(0,5),setting({mode:'domestic',quantity}),{verify,rng:()=>0});
    assert.equal(selected.length,quantity);assert.equal(new Set(selected.map(p=>p.id)).size,quantity);
  }
  assert.equal(calls,0);
});

test('후보가 부족하면 설정을 완화하거나 중복을 채우지 않고 거부해요',async()=>{
  let calls=0;
  await assert.rejects(pickPlaces(korea.slice(0,2),setting({mode:'domestic',quantity:3}),{verify:()=>{calls++;}}),/2곳/);
  assert.equal(calls,0);
});

test('미발령만 설정은 1단계를 건너뛰고, 1단계까지 설정은 둘 다 허용해요',async()=>{
  const pool=world.slice(0,3);let calls=0;
  const verify=async()=>({allowed:true,level:calls++===0?1:0});
  const strict=await pickPlaces(pool,setting({risk:0}),{verify,rng:()=>0});
  assert.equal(strict[0].id,pool[1].id);assert.equal(strict[0].advisory.level,0);
  const normal=await pickPlaces(pool,setting({risk:1}),{verify:async()=>({allowed:true,level:1}),rng:()=>0});
  assert.equal(normal[0].id,pool[0].id);assert.equal(normal[0].advisory.level,1);
});

test('해외 3곳은 각각 검증하고 고위험·불완전 응답을 건너뛰어요',async()=>{
  const pool=world.slice(0,6);const levels=[4,undefined,1,0,1];let calls=0;
  const selected=await pickPlaces(pool,setting({quantity:3}),{rng:()=>0,verify:async()=>({allowed:true,level:levels[calls++]})});
  assert.deepEqual(selected.map(p=>p.id),pool.slice(2,5).map(p=>p.id));
  assert.ok(selected.every(p=>[0,1].includes(p.advisory.level)));
});

test('세 곳 중 일부만 확인됐더라도 나머지가 실패하면 부분 결과를 반환하지 않아요',async()=>{
  let calls=0;let returned=false;
  await assert.rejects(pickPlaces(world.slice(0,4),setting({quantity:3}),{rng:()=>0,verify:async()=>{if(++calls===2)throw new Error('연결 실패');return {allowed:true,level:0};}}).then(()=>{returned=true;}),/연결 실패/);
  assert.equal(returned,false);
  await assert.rejects(pickPlaces(world.slice(0,4),setting({quantity:3}),{rng:()=>0,verify:async()=>({allowed:false,level:4})}));
});

test('시작 전 취소와 해외 검증 중 취소는 늦은 성공 결과도 반환하지 않아요',async()=>{
  const before=new AbortController();before.abort();
  await assert.rejects(pickPlaces(korea.slice(0,3),setting({mode:'domestic'}),{signal:before.signal}),{name:'AbortError'});
  const during=new AbortController();let returned=false;
  await assert.rejects(pickPlaces(world.slice(0,3),setting({quantity:3}),{signal:during.signal,verify:async()=>{during.abort();return {allowed:true,level:0};}}).then(()=>{returned=true;}),{name:'AbortError'});
  assert.equal(returned,false);
});

test('손상되거나 사용할 수 없는 저장소에서도 기본값을 읽고 저장 실패를 알 수 있어요',()=>{
  const fallback={mode:'domestic'};
  assert.deepEqual(loadLocal({getItem:()=>'{broken'},'settings',fallback),fallback);
  assert.deepEqual(loadLocal({getItem:()=>null},'settings',fallback),fallback);
  assert.deepEqual(loadLocal({getItem:()=>{throw new Error('blocked');}},'settings',fallback),fallback);
  assert.equal(saveLocal({setItem:()=>{throw new Error('quota');}},'settings',fallback),false);
  let saved;assert.equal(saveLocal({setItem:(key,value)=>{saved=[key,value];}},'settings',fallback),true);
  assert.deepEqual(saved,['settings',JSON.stringify(fallback)]);
});

test('기록 복원은 현재 목록에 없는 ID와 잘못된 행을 제거해요',()=>{
  const valid={ids:[catalog[0].id],at:'2026-11-02T12:00:00Z'};
  const rows=[null,{ids:['removed-place'],at:valid.at},{ids:'bad',at:valid.at},{ids:[catalog[0].id]},{ids:[],at:valid.at},{ids:[catalog[0].id],at:'not-a-date'},valid];
  assert.deepEqual(readHistory(rows,catalog),[valid]);assert.deepEqual(readHistory('{broken',catalog),[]);
});

test('서울 범위는 서울 장소만 고르고 자치구·종류 조건을 함께 적용해요',()=>{
  assert.equal(seoul.length,seoulData.destinations.length);
  const all=filterPlaces(catalog,setting({mode:'seoul'}));
  assert.equal(all.length,seoul.length);assert.ok(all.every(p=>p.scope==='seoul'&&p.id.startsWith('seoul-')));
  const jongno=filterPlaces(catalog,setting({mode:'seoul',seoulGu:'11010'}));
  assert.ok(jongno.length>0&&jongno.every(p=>p.area==='종로구'));
  const palaces=filterPlaces(catalog,setting({mode:'seoul',seoulGu:'11010',seoulCategory:'history'}));
  assert.ok(palaces.some(p=>p.name==='경복궁'));assert.ok(palaces.every(p=>p.category==='history'&&p.area==='종로구'));
  assert.equal(filterPlaces(catalog,setting({mode:'seoul',kind:'county',includeIslands:false})).length,seoul.length,'국내 전용 조건은 서울 범위에 영향을 주지 않아요');
  const recent=[{ids:[all[0].id],at:new Date().toISOString()}];
  assert.equal(filterPlaces(catalog,setting({mode:'seoul'}),recent).length,seoul.length-1);
  assert.deepEqual(sanitizeSettings({mode:'seoul',seoulGu:'11230',seoulCategory:'park'}),setting({mode:'seoul',seoulGu:'11230',seoulCategory:'park'}));
});

test('서울 3곳 추첨은 경보 조회 없이 중복 없이 골라요',async()=>{
  const pool=filterPlaces(catalog,setting({mode:'seoul',quantity:3}));
  const chosen=await pickPlaces(pool,setting({mode:'seoul',quantity:3}),{verify:()=>{throw new Error('서울은 경보를 조회하지 않아요');}});
  assert.equal(chosen.length,3);assert.equal(new Set(chosen.map(p=>p.id)).size,3);assert.ok(chosen.every(p=>p.scope==='seoul'));
});

test('장소 종류는 명소·대표점·명소 분류로 국내와 경기도 후보를 나눠요',()=>{
  const all=filterPlaces(catalog,setting({mode:'gyeonggi'})),spot=filterPlaces(catalog,setting({mode:'gyeonggi',spotType:'spot'})),district=filterPlaces(catalog,setting({mode:'gyeonggi',spotType:'district'}));
  assert.equal(all.length,spot.length+district.length);assert.ok(spot.length>=80);assert.ok(spot.every(p=>p.type==='spot'&&p.province==='31'));
  const sea=filterPlaces(catalog,setting({mode:'domestic',spotType:'sea',includeIslands:true}));
  assert.ok(sea.length>0&&sea.every(p=>p.type==='spot'&&p.category==='sea'));
  const history=filterPlaces(catalog,setting({mode:'domestic',province:'11',spotType:'history'}));
  assert.ok(history.some(p=>p.name==='경복궁'),'국내 범위의 서울 역사 명소에 서울 장소가 포함돼요');
  assert.equal(sanitizeSettings({spotType:'beach'}).spotType,'all');assert.equal(sanitizeSettings({spotType:'sea'}).spotType,'sea');
  assert.equal(filterPlaces(catalog,setting({mode:'gyeonggi',spotType:'sea'})).some(p=>p.name==='제부도'),false,'섬 명소는 섬 포함을 켜야 나와요');
  assert.ok(filterPlaces(catalog,setting({mode:'gyeonggi',spotType:'sea',includeIslands:true})).some(p=>p.name==='제부도'));
});

test('추첨 연출은 설정과 기기 설정에 맞춰 점점 느려지는 간격을 만들어요',()=>{
  assert.equal(rouletteProfile('none',false),null);assert.equal(rouletteProfile('auto',true),null);
  const full=rouletteProfile('auto',false),short=rouletteProfile('short',true);
  assert.ok(full&&short);assert.ok(short.spin<full.spin);
  const delays=landingDelays(full.landing[0],full);
  assert.equal(delays.length,full.landing[0]);assert.equal(delays[0],full.interval);assert.equal(delays.at(-1),full.slowest);
  for(let i=1;i<delays.length;i++)assert.ok(delays[i]>=delays[i-1]);
  const pool=[{id:'a'},{id:'b'},{id:'c'}];let last;
  for(let i=0;i<50;i++){const next=nextHop(pool,last);assert.notEqual(next,last);assert.ok(pool.includes(next));last=next;}
  assert.equal(nextHop([pool[0]],pool[0]),pool[0]);
});
