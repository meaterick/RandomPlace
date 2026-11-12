import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=name=>JSON.parse(fs.readFileSync(new URL(`../public/data/${name}.json`,import.meta.url),'utf8'));
const spots=read('korea-spots'),domestic=read('domestic').destinations,koreaMap=read('korea-map'),overseas=read('overseas'),world=read('world-map');
const polys=f=>f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
const inRing=([x,y],r)=>{let inside=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const [a,b]=r[i],[c,d]=r[j];if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)inside=!inside;}return inside;};
const km=([x,y],[a,b],[c,d])=>{const k=Math.cos(y*Math.PI/180),dx=(c-a)*k,dy=d-b,px=(x-a)*k,py=y-b,t=dx*dx+dy*dy?Math.max(0,Math.min(1,(px*dx+py*dy)/(dx*dx+dy*dy))):0;return Math.hypot(px-t*dx,py-t*dy)*111;};
function near(pt,feature,limit){
  for(const p of polys(feature)){if(inRing(pt,p[0])&&!p.slice(1).some(r=>inRing(pt,r)))return true;}
  for(const p of polys(feature))for(const r of p)for(let i=0,j=r.length-1;i<r.length;j=i++)if(km(pt,r[j],r[i])<=limit)return true;
  return false;
}

test('국내 여행 명소는 서울을 뺀 16개 시도에 고르게 있고 경기도에 80곳 이상이에요',()=>{
  const list=spots.destinations;assert.ok(list.length>=350);
  assert.equal(new Set(list.map(p=>p.id)).size,list.length);assert.equal(new Set(list.map(p=>p.name)).size,list.length);
  const provinces=new Set(list.map(p=>p.regionCode));assert.equal(provinces.size,16);assert.equal(provinces.has('11'),false,'서울은 서울 범위 목록을 함께 써요');
  assert.ok(list.filter(p=>p.regionCode==='31').length>=80);
  for(const p of list){
    const parent=domestic.find(d=>d.id===p.parentId);assert.ok(parent,p.name);
    assert.equal(parent.regionCode,p.regionCode);assert.equal(parent.name,p.area);assert.equal(p.kind,parent.kind);
    assert.ok(spots.categories[p.category]);assert.equal(p.categoryLabel,spots.categories[p.category]);assert.ok(p.note);assert.equal(typeof p.island,'boolean');
  }
  for(const key of Object.keys(spots.categories))assert.ok(list.some(p=>p.category===key),key);
  assert.ok(list.filter(p=>p.regionCode==='39').every(p=>p.island),'제주 명소는 모두 섬이에요');
  assert.equal(list.find(p=>p.name==='인천 차이나타운').island,false);assert.equal(list.find(p=>p.name==='제부도').island,true);
});

// 시·군·구 판정은 빌드 스크립트가 하고, 여기서는 시도 지도와 크게 어긋난 좌표만 잡아요. 작은 섬은 시도 지도에 없을 수 있어요.
test('국내 명소 좌표는 해당 시도 경계 근처(해안 5km, 섬 10km 이내)에 있어요',()=>{
  const byCode=new Map(koreaMap.features.map(f=>[f.properties.code,f]));
  for(const p of spots.destinations)assert.ok(near([p.lon,p.lat],byCode.get(p.regionCode),p.island?10:5),`${p.name} 좌표가 ${p.region} 안에 있어요`);
});

test('해외에 더한 도시는 아프리카·섬이 아니고 적어 둔 국가 경계 근처에 있어요',()=>{
  const added=overseas.destinations.filter(p=>p.addedBy==='randomplace');
  assert.ok(added.length>=250);assert.ok(overseas.destinations.length>=480);
  assert.equal(new Set(overseas.destinations.map(p=>p.id)).size,overseas.destinations.length);
  const byCode=new Map(world.features.map(f=>[f.properties.code,f]));
  for(const p of added){
    assert.notEqual(p.continent,'Africa');assert.equal(p.landmass,'continental-mainland');assert.equal(p.curation,'korean-traveler-famous-city');
    assert.ok(p.city&&p.cityEn&&p.area&&p.country);
    assert.ok(near([p.lon,p.lat],byCode.get(p.countryCode),25),`${p.city} 좌표가 ${p.country} 경계 근처에 있어요`);
  }
  for(const name of ['팔레르모','코펜하겐','호바트','베네치아'])assert.equal(overseas.destinations.some(p=>p.city===name),false,name+'은 섬이라 넣지 않아요');
});
