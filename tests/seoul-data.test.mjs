import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=name=>JSON.parse(fs.readFileSync(new URL(`../public/data/${name}.json`,import.meta.url),'utf8'));
const data=read('seoul'),map=read('seoul-map'),places=data.destinations;
const inRing=([x,y],r)=>{let inside=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const [a,b]=r[i],[c,d]=r[j];if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)inside=!inside;}return inside;};
const inFeature=(pt,f)=>f.geometry.coordinates.some(p=>inRing(pt,p[0])&&!p.slice(1).some(r=>inRing(pt,r)));

test('서울 후보는 200곳 이상이고 25개 자치구를 모두 포함해요',()=>{
  assert.ok(places.length>=200);
  assert.equal(new Set(places.map(p=>p.id)).size,places.length);
  assert.equal(new Set(places.map(p=>p.name)).size,places.length);
  assert.equal(map.features.length,25);
  assert.equal(new Set(places.map(p=>p.regionCode)).size,25);
});

test('서울 장소는 이름·분류·소개와 서울 안의 좌표를 가져요',()=>{
  for(const p of places){
    assert.ok(p.name&&p.note&&p.area);assert.equal(p.region,'서울특별시');
    assert.ok(data.categories[p.category]);assert.equal(p.categoryLabel,data.categories[p.category]);
    assert.ok(p.lat>37.4&&p.lat<37.72&&p.lon>126.76&&p.lon<127.19);
  }
  for(const key of Object.keys(data.categories))assert.ok(places.some(p=>p.category===key),key+' 분류에 장소가 있어요');
});

test('각 장소의 좌표는 표시한 자치구 경계 안에 있어요',()=>{
  const byCode=new Map(map.features.map(f=>[f.properties.code,f]));
  for(const p of places){const f=byCode.get(p.regionCode);assert.ok(f,p.name);assert.equal(f.properties.name,p.area);assert.ok(inFeature([p.lon,p.lat],f),`${p.name} 좌표가 ${p.area} 안에 있어요`);}
});
