// node scripts/build-domestic.mjs <시군구 TopoJSON> <시도 GeoJSON>
// source: 통계청 SGIS 2018 / southkorea-maps, 공공누리 제1유형.
import fs from 'node:fs';
const [districtFile,provinceFile]=process.argv.slice(2);
if(!districtFile||!provinceFile)throw new Error('시군구 TopoJSON과 시도 GeoJSON을 지정해 주세요.');
const topology=JSON.parse(fs.readFileSync(districtFile,'utf8'));
const provinces=JSON.parse(fs.readFileSync(provinceFile,'utf8'));
const provinceNames=new Map(provinces.features.map(f=>[f.properties.code,f.properties.name]));
const displayAliases={'32':'강원특별자치도','35':'전북특별자치도'};
const decoded=new Map();
function arc(ref){
  const index=ref<0?~ref:ref;
  if(!decoded.has(index)){
    let x=0,y=0;decoded.set(index,topology.arcs[index].map(([dx,dy])=>{x+=dx;y+=dy;return [x*topology.transform.scale[0]+topology.transform.translate[0],y*topology.transform.scale[1]+topology.transform.translate[1]];}));
  }
  return ref<0?[...decoded.get(index)].reverse():decoded.get(index);
}
function ring(refs){const points=[];for(const ref of refs){if(points.length)points.pop();for(const p of arc(ref))points.push(p);}return points;}
function polygons(g){return (g.type==='Polygon'?[g.arcs]:g.arcs).map(p=>p.map(ring));}
function area(ring){let sum=0;for(let i=0,j=ring.length-1;i<ring.length;j=i++)sum+=ring[j][0]*ring[i][1]-ring[i][0]*ring[j][1];return Math.abs(sum/2);}
function inRing([x,y],ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [a,b]=ring[i],[c,d]=ring[j];if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)inside=!inside;}return inside;}
function segmentDistance([x,y],[a,b],[c,d]){const dx=c-a,dy=d-b;const t=dx*dx+dy*dy?Math.max(0,Math.min(1,((x-a)*dx+(y-b)*dy)/(dx*dx+dy*dy))):0;return Math.hypot(x-a-t*dx,y-b-t*dy);}
function strictlyInside(point,rings){
  if(!inRing(point,rings[0])||rings.slice(1).some(r=>inRing(point,r)))return false;
  for(const r of rings)for(let i=0,j=r.length-1;i<r.length;j=i++)if(segmentDistance(point,r[i],r[j])<1e-7)return false;
  return true;
}
function rounded(p){return p.map(n=>+n.toFixed(6));}
function innerPoint(rings){
  const outer=rings[0];let a=0,cx=0,cy=0;
  for(let i=0,j=outer.length-1;i<outer.length;j=i++){const cross=outer[j][0]*outer[i][1]-outer[i][0]*outer[j][1];a+=cross;cx+=(outer[j][0]+outer[i][0])*cross;cy+=(outer[j][1]+outer[i][1])*cross;}
  if(a){const centroid=rounded([cx/(3*a),cy/(3*a)]);if(strictlyInside(centroid,rings))return centroid;}
  const minY=Math.min(...outer.map(p=>p[1])),maxY=Math.max(...outer.map(p=>p[1]));
  let best=null,bestWidth=-1;
  // 오목한 경계나 호수 때문에 무게중심이 밖에 있으면 넓은 내부 구간을 골라요.
  for(let step=0;step<128;step++){
    const y=minY+(maxY-minY)*(step+.5)/128,xs=[];
    for(const r of rings)for(let i=0,j=r.length-1;i<r.length;j=i++){const [x1,y1]=r[j],[x2,y2]=r[i];if((y1>y)!==(y2>y))xs.push(x1+(x2-x1)*(y-y1)/(y2-y1));}
    xs.sort((x,y)=>x-y);
    for(let i=0;i+1<xs.length;i+=2){const width=xs[i+1]-xs[i],candidate=rounded([(xs[i+1]+xs[i])/2,y]);if(width>bestWidth&&strictlyInside(candidate,rings)){bestWidth=width;best=candidate;}}
  }
  if(!best)throw new Error('경계 안의 대표점을 찾지 못했어요.');return best;
}
function municipalityName(name){return name.match(/^(.+?시).+구$/)?.[1]||name;}
const groups=new Map();
for(const g of Object.values(topology.objects)[0].geometries){
  const regionCode=g.properties.code.slice(0,2),name=municipalityName(g.properties.name),key=regionCode+':'+name;
  if(!groups.has(key))groups.set(key,{regionCode,name,members:[]});groups.get(key).members.push(g);
}
const islandNames=new Set(['강화군','옹진군','울릉군','진도군','완도군','신안군','남해군','거제시']);
const destinations=[];
for(const group of groups.values()){
  const components=group.members.flatMap(member=>polygons(member).map(rings=>({rings,member,area:area(rings[0])})));
  const largest=components.reduce((best,p)=>p.area>best.area?p:best);
  const [lon,lat]=innerPoint(largest.rings);
  if(!strictlyInside([lon,lat],largest.rings))throw new Error('대표점 검증 실패: '+group.name);
  const code=group.members.map(g=>g.properties.code).sort()[0];
  const areaName=largest.member.properties.name.replace(/시(?=.+구$)/,'시 ');
  destinations.push({id:'kr-'+code,name:group.name,region:displayAliases[group.regionCode]||provinceNames.get(group.regionCode),regionCode:group.regionCode,area:areaName,lat,lon,
    island:group.regionCode==='39'||islandNames.has(group.name)||(group.regionCode==='23'&&group.name==='중구'),kind:group.name.endsWith('군')?'county':'city'});
}
destinations.sort((a,b)=>a.id.localeCompare(b.id));
const result={source:'통계청 SGIS 2018 / southkorea-maps (공공누리 제1유형, 출처표시)',sourceUrl:'https://github.com/southkorea/southkorea-maps/tree/60c8c0cf0016381d80004d6b125760d6c5cb0605/kostat/2018/json',year:2018,
  notes:'2018년 시군구 경계. 일반구는 시 단위로 묶고, 특별·광역시 자치구/군은 유지. 강원·전북은 표시 명칭만 현행화. 좌표는 가장 큰 경계 폴리곤 내부의 지역 대표점이며 관광지·주소·도로 접근성을 뜻하지 않습니다.',
  islandClassification:'제주 전체, 강화·옹진·울릉·진도·완도·신안·남해·거제 및 인천 중구를 도서 행정구역으로 표시한 근사 기준입니다. 해안 시군의 모든 섬을 판정한 결과는 아닙니다.',destinations};
const out=new URL('../public/data/domestic.json',import.meta.url);fs.mkdirSync(new URL('../public/data/',import.meta.url),{recursive:true});fs.writeFileSync(out,JSON.stringify(result));
console.log({destinations:destinations.length,provinces:new Set(destinations.map(d=>d.regionCode)).size,gyeonggi:destinations.filter(d=>d.regionCode==='31').length});
