import { test,before,after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium,devices } from 'playwright';
import { serve } from '../scripts/serve.mjs';

const overseas=JSON.parse(fs.readFileSync(new URL('../public/data/overseas.json',import.meta.url),'utf8')).destinations;
const domestic=JSON.parse(fs.readFileSync(new URL('../public/data/domestic.json',import.meta.url),'utf8')).destinations;
const seoul=JSON.parse(fs.readFileSync(new URL('../public/data/seoul.json',import.meta.url),'utf8')).destinations;
const spots=JSON.parse(fs.readFileSync(new URL('../public/data/korea-spots.json',import.meta.url),'utf8')).destinations;
const gyeonggiAll=31+spots.filter(p=>p.regionCode==='31'&&!p.island).length;
let server,browser,base;
before(async()=>{
  server=await serve(0);base=`http://127.0.0.1:${server.address().port}/`;
  browser=await chromium.launch();
});
after(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));});

async function visit({mobile=false,delay=false,motion=false}={}){
  const context=await browser.newContext({...mobile?devices['iPhone 13']:{viewport:{width:1440,height:1100}},locale:'ko-KR',timezoneId:'Asia/Seoul',reducedMotion:motion?'no-preference':'reduce'});
  const page=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',err=>errors.push(err.message));
  let release;
  const gate=new Promise(resolve=>{release=resolve;});
  await page.route('https://gis.0404.go.kr/**',async route=>{
    const url=new URL(route.request().url());requests.push(url);
    if(delay)await gate;
    const [lon,lat]=url.searchParams.get('geometry').split(',').map(Number);
    const p=overseas.find(p=>p.lon===lon&&p.lat===lat);
    assert.ok(p,'조회 좌표는 실제 해외 후보에서 골라야 해요');
    const features=url.pathname.includes('/4/')?[{attributes:{alert_cd:'NM',ntn_alpha_3_cd:p.countryCode,ntn_nm:p.country,adm_nm:p.area}}]:[];
    await route.fulfill({json:{features}}).catch(()=>{});
  });
  await page.goto(base);await page.waitForSelector('body[data-ready=true]');
  return {page,context,errors,requests,release};
}
const count=page=>page.locator('#candidateCount').innerText().then(s=>Number(s.replace(/,/g,'')));
const resultIds=page=>page.locator('#resultGrid .save-btn').evaluateAll(els=>els.map(el=>el.dataset.saveId));
async function mode(page,value){await page.click(`[data-mode="${value}"]`);await page.waitForFunction(v=>document.querySelector(`[data-mode="${v}"]`).getAttribute('aria-pressed')==='true',value);}
async function draw(page,quantity=1){
  await page.click('#drawBtn');await page.waitForFunction(n=>document.querySelectorAll('#resultGrid .place-card').length===n,quantity,{timeout:15000});
  await page.waitForSelector('#drawOverlay[hidden]',{state:'attached'});
}

test('국내 시도 필터와 경기도 31개 시군이 독립적으로 동작해요',async()=>{
  const {page,context,errors,requests}=await visit();
  try{
    await mode(page,'domestic');assert.ok(await count(page)>200);
    await page.selectOption('#province','11');
    assert.equal(await count(page),domestic.filter(p=>p.regionCode==='11'&&!p.island).length+seoul.length);
    await page.selectOption('#spotType','district');assert.equal(await count(page),25);await page.selectOption('#spotType','all');
    await page.click('#candidateBtn');
    assert.ok((await page.locator('#candidateList').innerText()).includes('서울특별시'));
    await page.keyboard.press('Escape');
    await mode(page,'gyeonggi');assert.equal(await count(page),gyeonggiAll);assert.equal(await page.locator('#ggCount').innerText(),String(31+spots.filter(p=>p.regionCode==='31').length));
    await page.selectOption('#spotType','district');assert.equal(await count(page),31);
    await page.selectOption('#kind','county');assert.equal(await count(page),3);
    await page.click('#candidateBtn');const names=await page.locator('#candidateList strong').allTextContents();
    assert.deepEqual([...names].sort(),['가평군','양평군','연천군']);
    await page.keyboard.press('Escape');
    assert.equal(requests.length,0);assert.deepEqual(errors,[]);
  }finally{await context.close();}
});

test('서울 범위는 자치구·종류로 좁히고 경보 조회 없이 결과를 보여 줘요',async()=>{
  const {page,context,errors,requests}=await visit();
  try{
    await mode(page,'seoul');assert.equal(await count(page),seoul.length);
    assert.equal(await page.locator('#seoulCount').innerText(),String(seoul.length));
    assert.equal(await page.locator('#kind').isVisible(),false);
    await page.selectOption('#seoulGu','11010');assert.equal(await count(page),seoul.filter(p=>p.regionCode==='11010').length);
    await page.selectOption('#seoulCategory','history');const expected=seoul.filter(p=>p.regionCode==='11010'&&p.category==='history');
    assert.equal(await count(page),expected.length);
    await page.click('#candidateBtn');assert.ok((await page.locator('#candidateList').innerText()).includes('경복궁'));await page.keyboard.press('Escape');
    await page.check('input[name=quantity][value="3"]');await draw(page,3);
    const ids=await resultIds(page);assert.equal(new Set(ids).size,3);assert.ok(ids.every(id=>expected.some(p=>p.id===id)));
    assert.match(await page.locator('#resultGrid .place-area').first().innerText(),/종로구 · 궁궐·역사/);
    assert.equal(await page.locator('#mapSvg path.land').count(),25);
    await page.screenshot({path:fileURLToPath(new URL('../../randomplace-seoul.png',import.meta.url)),fullPage:true});
    assert.equal(requests.length,0);assert.deepEqual(errors,[]);
  }finally{await context.close();}
});

test('추첨 연출은 여러 후보를 빠르게 지나간 뒤 결과에 멈추고 취소할 수 있어요',async()=>{
  const {page,context,errors}=await visit({motion:true});
  try{
    await mode(page,'gyeonggi');await page.selectOption('#animation','short');
    await page.evaluate(()=>{window.__hops=[];new MutationObserver(()=>window.__hops.push(document.querySelector('#tickerName').textContent)).observe(document.querySelector('#tickerName'),{childList:true,characterData:true,subtree:true});});
    await page.click('#drawBtn');await page.waitForSelector('#scanner.active',{state:'attached'});
    assert.equal(await page.locator('.ticker').isVisible(),true);
    await page.waitForFunction(()=>document.querySelectorAll('#resultGrid .place-card').length===1,null,{timeout:15000});
    const hops=await page.evaluate(()=>window.__hops),name=await page.locator('#resultGrid .place-name').innerText();
    assert.ok(new Set(hops).size>=4,`여러 후보를 지나가요 (${new Set(hops).size}곳)`);assert.equal(hops.at(-1),name,'마지막으로 멈춘 곳이 결과예요');
    assert.equal(await page.locator('#pins > g').count(),1);assert.equal(await page.locator('#drawOverlay').isHidden(),true);
    await page.check('input[name=quantity][value="3"]');await page.click('#drawBtn');await page.waitForSelector('#scanner.active',{state:'attached'});
    await page.waitForFunction(()=>document.querySelectorAll('#pins .pin-drop').length>=1,null,{timeout:10000});
    await page.click('#cancelBtn');await page.waitForTimeout(500);
    assert.equal(await page.locator('#resultGrid .place-card').count(),0);assert.equal(await page.locator('#pins > g').count(),0);
    assert.equal(await page.locator('#scanner').getAttribute('class'),'scanner');
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('randomplace:v1:history')).length),1,'취소한 추첨은 기록되지 않아요');
    await draw(page,3);const ids=await resultIds(page);assert.equal(new Set(ids).size,3);assert.equal(await page.locator('#pins > g').count(),3);
    await page.screenshot({path:fileURLToPath(new URL('../../randomplace-roulette.png',import.meta.url))});
    assert.deepEqual(errors,[]);
  }finally{await context.close();}
});

test('3곳 추첨은 중복이 없고 최근 제외·저장·기록 초기화가 이어져요',async()=>{
  const {page,context,errors,requests}=await visit();
  try{
    await mode(page,'gyeonggi');await page.selectOption('#spotType','district');await page.check('input[name=quantity][value="3"]');
    await draw(page,3);const firstIds=await resultIds(page);
    assert.equal(new Set(firstIds).size,3);assert.equal(await count(page),28);
    await page.screenshot({path:fileURLToPath(new URL('../../randomplace-desktop.png',import.meta.url)),fullPage:true});
    await page.locator('#resultGrid .save-btn').first().click();
    assert.equal(await page.locator('#savedBadge').innerText(),'1');
    await page.reload();await page.waitForSelector('body[data-ready=true]');
    assert.equal(await count(page),28);assert.equal(await page.locator('#savedBadge').innerText(),'1');
    await draw(page,3);const nextIds=await resultIds(page);
    assert.ok(nextIds.every(id=>!firstIds.includes(id)));assert.equal(await count(page),25);
    await page.click('#libraryBtn');
    assert.equal(await page.locator('#libraryList .place-card').count(),1);
    assert.equal(await page.locator('#libraryList .save-btn').first().getAttribute('aria-pressed'),'true');
    await page.click('[data-library="history"]');assert.equal(await page.locator('#libraryList .history-entry').count(),2);
    await page.click('#clearHistory');assert.equal(await page.locator('#libraryList .history-entry').count(),0);
    await page.click('[data-library="saved"]');assert.equal(await page.locator('#libraryList .place-card').count(),1);
    await page.keyboard.press('Escape');assert.equal(await count(page),31);
    await page.click('#resetSettings');assert.equal(await count(page),gyeonggiAll);assert.equal(await page.locator('#savedBadge').innerText(),'1');
    assert.equal(await page.locator('input[name=quantity][value="1"]').isChecked(),true);
    assert.equal(requests.length,0);assert.deepEqual(errors,[]);
  }finally{await context.close();}
});

test('단일 시군에서 3곳을 요청하면 추첨을 막고 조건 초기화로 복구돼요',async()=>{
  const {page,context,errors}=await visit();
  try{
    await mode(page,'gyeonggi');
    const suwon=domestic.find(p=>p.regionCode==='31'&&p.name==='수원시');
    await page.selectOption('#ggCity',suwon.id);assert.equal(await count(page),1+spots.filter(p=>p.parentId===suwon.id&&!p.island).length);
    await page.selectOption('#spotType','district');assert.equal(await count(page),1);
    await page.check('input[name=quantity][value="3"]');assert.equal(await page.locator('#drawBtn').isDisabled(),true);
    assert.match(await page.locator('#filterHint').innerText(),/후보가 부족/);
    await page.click('#resetSettings');assert.equal(await count(page),gyeonggiAll);assert.equal(await page.locator('#drawBtn').isDisabled(),false);
    assert.deepEqual(errors,[]);
  }finally{await context.close();}
});

test('국내 섬 포함과 최근 결과 제외 토글이 후보 수를 바꿔요',async()=>{
  const {page,context,errors}=await visit();
  try{
    await mode(page,'domestic');const initial=await count(page);
    await page.check('#includeIslands');assert.equal(await count(page),domestic.length+spots.length+seoul.length);assert.ok(await count(page)>initial);
    await page.selectOption('#province','39');const jeju=await count(page);assert.ok(jeju>0);
    await page.uncheck('#includeIslands');assert.equal(await count(page),0);assert.equal(await page.locator('#drawBtn').isDisabled(),true);
    await page.check('#includeIslands');await draw(page);assert.equal(await count(page),jeju-1);
    await page.uncheck('#avoidRecent');assert.equal(await count(page),jeju);
    assert.deepEqual(errors,[]);
  }finally{await context.close();}
});

test('해외 기본 기준은 1단계를 허용하고 미발령만 기준은 같은 응답을 제외해요',async()=>{
  const {page,context,errors,requests}=await visit();
  try{
    await page.selectOption('#country','FRA');await draw(page);
    assert.match(await page.locator('#resultGrid .place-check').innerText(),/1단계/);
    assert.ok((await resultIds(page))[0].startsWith('world-'));
    assert.ok(requests.some(url=>url.pathname.includes('/4/'))&&requests.some(url=>url.pathname.includes('/5/'))&&requests.some(url=>url.pathname.includes('/17/')));
    await page.selectOption('#risk','0');await page.click('#drawBtn');
    await page.waitForSelector('#resultGrid .error-result',{timeout:15000});
    assert.equal(await page.locator('#resultGrid .place-card').count(),0);
    assert.match(await page.locator('#resultGrid').innerText(),/필요한 수|조건/);
    assert.equal(await page.locator('#drawBtn').isDisabled(),false);assert.deepEqual(errors,[]);
  }finally{await context.close();}
});

test('해외 확인 중 취소한 뒤 늦은 응답이 와도 결과와 기록이 생기지 않아요',async()=>{
  const {page,context,errors,requests,release}=await visit({delay:true});
  try{
    await page.click('#drawBtn');await page.waitForSelector('#drawOverlay:not([hidden])');
    await page.waitForFunction(()=>document.querySelector('#progressText').textContent.includes('여행경보'));
    await page.waitForTimeout(100);assert.ok(requests.length>0);
    await page.click('#cancelBtn');release();await page.waitForTimeout(300);
    assert.equal(await page.locator('#resultGrid .place-card').count(),0);
    assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('randomplace:v1:history')||'[]')),[]);
    await mode(page,'domestic');await draw(page);assert.equal(await page.locator('#resultGrid .place-card').count(),1);
    assert.deepEqual(errors,[]);
  }finally{release();await context.close();}
});

test('모바일에서 조건·후보 검색·안내 창과 결과를 사용할 수 있고 가로로 넘치지 않아요',async()=>{
  const {page,context,errors}=await visit({mobile:true});
  try{
    assert.equal(await page.locator('#settings').getAttribute('open'),null);
    await mode(page,'gyeonggi');await page.locator('#settings summary').click();
    assert.equal(await page.locator('#settings').evaluate(el=>el.open),true);
    await page.click('#candidateBtn');await page.fill('#candidateSearch','가평');
    const gapyeong=1+spots.filter(p=>p.regionCode==='31'&&!p.island&&[p.name,p.region,p.area,p.categoryLabel,p.note].join(' ').includes('가평')).length;
    assert.equal(await page.locator('#candidateList .candidate-item').count(),gapyeong);
    await page.click('#candidateDialog [data-close]');await page.click('#aboutBtn');await page.waitForSelector('#aboutDialog[open]');
    await page.click('#aboutDialog [data-close]');await page.selectOption('#animation','none');await page.locator('#settings summary').click();await draw(page);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:fileURLToPath(new URL('../../randomplace-mobile.png',import.meta.url)),fullPage:true});
    assert.deepEqual(errors,[]);
  }finally{await context.close();}
});
