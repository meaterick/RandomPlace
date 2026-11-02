import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const data=JSON.parse(fs.readFileSync(new URL('../public/data/domestic.json',import.meta.url),'utf8'));
const places=data.destinations;
test('국내 후보는 17개 시도와 중복 없는 지역 대표점을 포함해요',()=>{
  assert.equal(new Set(places.map(p=>p.regionCode)).size,17);
  assert.equal(new Set(places.map(p=>p.id)).size,places.length);
  assert.ok(places.length>=220);
  for(const p of places){assert.ok(p.name&&p.region&&p.area);assert.ok(Number.isFinite(p.lat)&&Number.isFinite(p.lon));assert.ok(p.lat>33&&p.lat<39);assert.ok(p.lon>124&&p.lon<132);assert.ok(['city','county'].includes(p.kind));assert.equal(typeof p.island,'boolean');}
});
test('경기도31개 시군은 일반구로 중복되지 않아요',()=>{
  const expected=['가평군','고양시','과천시','광명시','광주시','구리시','군포시','김포시','남양주시','동두천시','부천시','성남시','수원시','시흥시','안산시','안성시','안양시','양주시','양평군','여주시','연천군','오산시','용인시','의왕시','의정부시','이천시','파주시','평택시','포천시','하남시','화성시'].sort();
  const actual=places.filter(p=>p.regionCode==='31');
  assert.equal(actual.length,31);assert.deepEqual(actual.map(p=>p.name).sort(),expected);
});
test('같은 이름의 군과 구도 시도·ID로 구분돼요',()=>{
  const goseong=places.filter(p=>p.name==='고성군');assert.equal(goseong.length,2);assert.equal(new Set(goseong.map(p=>p.regionCode)).size,2);
  const jung=places.filter(p=>p.name==='중구');assert.ok(jung.length>=5);assert.equal(new Set(jung.map(p=>p.id)).size,jung.length);
});
test('도서 행정구역 표시와 데이터 기준을 명시해요',()=>{
  assert.equal(data.year,2018);assert.match(data.source,/통계청/);assert.match(data.notes,/대표점/);assert.match(data.islandClassification,/근사/);
  for(const p of places.filter(p=>p.regionCode==='39'||['강화군','옹진군','울릉군','거제시'].includes(p.name)))assert.equal(p.island,true);
  assert.equal(places.find(p=>p.regionCode==='31'&&p.name==='수원시').island,false);
});
