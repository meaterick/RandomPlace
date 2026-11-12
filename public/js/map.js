const NS='http://www.w3.org/2000/svg';
function el(tag,attrs={}){const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);return n;}
const polygons=f=>f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
export function createMap(world,korea,seoul){
  const camera=document.querySelector('#camera'),land=document.querySelector('#land'),dots=document.querySelector('#dots'),pins=document.querySelector('#pins'),overview=document.querySelector('#overviewBtn');let project,features;
  const reset=()=>{camera.style.transform='';overview.hidden=true;};overview.addEventListener('click',reset);
  function set(mode,pool){
    reset();pins.replaceChildren();land.replaceChildren();dots.replaceChildren();
    features=mode==='overseas'?world.features:mode==='seoul'?seoul.features:mode==='gyeonggi'?korea.features.filter(f=>f.properties.code==='31'):korea.features;
    if(mode==='overseas')project=([lon,lat])=>[30+(lon+180)*940/360,65+(85-lat)*470/145];
    else{const all=features.flatMap(f=>polygons(f).flat(2)),cos=Math.cos(36*Math.PI/180),xs=all.map(p=>p[0]*cos),ys=all.map(p=>-p[1]),a=Math.min(...xs),b=Math.max(...xs),c=Math.min(...ys),d=Math.max(...ys),scale=Math.min(800/(b-a),460/(d-c));project=([lon,lat])=>[500+(lon*cos-(a+b)/2)*scale,300+(-lat-(c+d)/2)*scale];}
    for(const f of features){const path=el('path',{class:'land','fill-rule':'evenodd','data-code':mode==='overseas'?f.properties.code:f.properties.code,d:polygons(f).map(p=>p.map(r=>r.map((v,i)=>(i?'L':'M')+project(v).map(n=>n.toFixed(2)).join(',')).join('')+'Z').join('')).join('')});land.append(path);}
    for(const p of pool){const [x,y]=project([p.lon,p.lat]),dot=el('circle',{cx:x,cy:y,r:mode==='overseas'?2.3:3,class:'candidate-dot'}),title=el('title');title.textContent=p.region+' '+p.name;dot.append(title);dots.append(dot);}
    document.querySelector('#mapSvg').setAttribute('aria-label',`${mode==='overseas'?'세계':mode==='gyeonggi'?'경기도':mode==='seoul'?'서울':'대한민국'} 지도, 후보 ${pool.length}곳`);
  }
  function show(results,animate=true){pins.replaceChildren();land.querySelectorAll('path').forEach(p=>p.classList.remove('selected'));
    for(const [i,p] of results.entries()){const [x,y]=project([p.lon,p.lat]),group=el('g',{transform:`translate(${x} ${y})`}),ring=el('circle',{r:19,class:'pin-ring'}),core=el('circle',{r:10,class:'pin-core'}),text=el('text',{y:4,'text-anchor':'middle',fill:'#15201b','font-size':11,'font-weight':700});text.textContent=String(i+1);group.append(ring,core,text);pins.append(group);const code=p.scope==='overseas'?p.countryCode:p.regionCode;land.querySelector(`[data-code="${code}"]`)?.classList.add('selected');}
    if(results.length===1&&animate){const [x,y]=project([results[0].lon,results[0].lat]),scale=results[0].scope==='overseas'?1.45:1.16;camera.style.transform=`translate(${500-x*scale}px,${300-y*scale}px) scale(${scale})`;overview.hidden=false;}
  }
  return {set,show,reset};
}
