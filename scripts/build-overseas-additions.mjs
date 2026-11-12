// node scripts/build-overseas-additions.mjs
// 해외 범위에 더하는 편집 선정 도시를 overseas.json에 합쳐요. 다시 실행하면 이전에 더한 도시를 교체해요.
// 각 도시는 world-map.json(Natural Earth)에서 적어 둔 국가 경계 안(해안 도시는 25km 이내)에 있어야 하고,
// 그 경계 조각이 다른 나라와 맞닿은 대륙 본토이거나 대륙 규모여야 해요. 섬·아프리카는 넣지 않아요.
import fs from 'node:fs';
const dataDir=new URL('../public/data/',import.meta.url);
const overseas=JSON.parse(fs.readFileSync(new URL('overseas.json',dataDir),'utf8'));
const world=JSON.parse(fs.readFileSync(new URL('world-map.json',dataDir),'utf8'));

// [국가 코드, 도시, 영문, 지역, 위도, 경도]
const cities=[
  // 아시아
  ['THA','파타야','Pattaya','Chon Buri',12.9276,100.8771],['THA','아유타야','Ayutthaya','Phra Nakhon Si Ayutthaya',14.3532,100.5689],
  ['THA','수코타이','Sukhothai','Sukhothai',17.0078,99.8230],['THA','칸차나부리','Kanchanaburi','Kanchanaburi',14.0228,99.5328],
  ['VNM','호이안','Hoi An','Quang Nam',15.8801,108.3380],['VNM','사파','Sa Pa','Lao Cai',22.3364,103.8438],['VNM','닌빈','Ninh Binh','Ninh Binh',20.2506,105.9745],
  ['VNM','무이네','Mui Ne','Binh Thuan',10.9333,108.2833],['VNM','붕따우','Vung Tau','Ba Ria-Vung Tau',10.3460,107.0843],
  ['KHM','바탐방','Battambang','Battambang',13.0957,103.2022],['KHM','캄폿','Kampot','Kampot',10.6104,104.1815],
  ['LAO','방비엥','Vang Vieng','Vientiane Province',18.9235,102.4478],['LAO','팍세','Pakse','Champasak',15.1202,105.7990],
  ['MYS','말라카','Melaka','Melaka',2.1896,102.2501],['MYS','카메론하이랜드','Cameron Highlands','Pahang',4.4720,101.3801],
  ['CHN','장자제','Zhangjiajie','Hunan',29.1171,110.4792],['CHN','리장','Lijiang','Yunnan',26.8721,100.2299],['CHN','다리','Dali','Yunnan',25.6065,100.2676],
  ['CHN','황산','Huangshan','Anhui',29.7147,118.3375],['CHN','우한','Wuhan','Hubei',30.5928,114.3055],['CHN','창사','Changsha','Hunan',28.2282,112.9388],
  ['CHN','옌지','Yanji','Jilin',42.9048,129.5136],['CHN','얼다오바이허(백두산)','Erdaobaihe','Jilin',42.4130,128.1070],['CHN','선양','Shenyang','Liaoning',41.8057,123.4315],
  ['CHN','둔황','Dunhuang','Gansu',40.1421,94.6619],['CHN','주자이거우','Jiuzhaigou','Sichuan',33.2600,103.9180],['CHN','우전','Wuzhen','Zhejiang',30.7450,120.4870],
  ['CHN','핑야오','Pingyao','Shanxi',37.2020,112.1780],['CHN','양숴','Yangshuo','Guangxi',24.7780,110.4960],
  ['IND','리시케시','Rishikesh','Uttarakhand',30.0869,78.2676],['IND','암리차르','Amritsar','Punjab',31.6340,74.8723],['IND','다르질링','Darjeeling','West Bengal',27.0410,88.2663],
  ['IND','콜카타','Kolkata','West Bengal',22.5726,88.3639],['IND','벵갈루루','Bengaluru','Karnataka',12.9716,77.5946],['IND','첸나이','Chennai','Tamil Nadu',13.0827,80.2707],
  ['IND','마이소르','Mysuru','Karnataka',12.2958,76.6394],['IND','함피','Hampi','Karnataka',15.3350,76.4600],['IND','카주라호','Khajuraho','Madhya Pradesh',24.8318,79.9199],
  ['IND','하이데라바드','Hyderabad','Telangana',17.3850,78.4867],
  ['NPL','룸비니','Lumbini','Lumbini',27.4840,83.2760],['NPL','소우라하(치트완)','Sauraha','Bagmati',27.5830,84.4960],
  ['UZB','히바','Khiva','Xorazm',41.3783,60.3639],['KAZ','아스타나','Astana','Astana',51.1694,71.4491],
  ['KGZ','카라콜','Karakol','Issyk-Kul',42.4907,78.3936],['KGZ','촐폰아타','Cholpon-Ata','Issyk-Kul',42.6490,77.0850],
  ['ARE','두바이','Dubai','Dubai',25.2048,55.2708],['OMN','무스카트','Muscat','Muscat',23.5880,58.3829],['QAT','도하','Doha','Doha',25.2854,51.5310],
  ['JOR','암만','Amman','Amman',31.9454,35.9284],['JOR','와디무사(페트라)','Wadi Musa',"Ma'an",30.3220,35.4790],
  ['TUR','괴레메(카파도키아)','Göreme','Nevşehir',38.6431,34.8289],['TUR','페티예','Fethiye','Muğla',36.6213,29.1164],['TUR','보드룸','Bodrum','Muğla',37.0344,27.4305],
  ['TUR','셀축(에페소스)','Selçuk','İzmir',37.9510,27.3680],['TUR','파묵칼레','Pamukkale','Denizli',37.9137,29.1187],['TUR','부르사','Bursa','Bursa',40.1885,29.0610],
  ['TUR','트라브존','Trabzon','Trabzon',41.0027,39.7168],
  ['GEO','쿠타이시','Kutaisi','Imereti',42.2679,42.6946],['GEO','스테판츠민다','Stepantsminda','Mtskheta-Mtianeti',42.6573,44.6431],['GEO','시그나기','Sighnaghi','Kakheti',41.6199,45.9217],
  ['ARM','딜리잔','Dilijan','Tavush',40.7410,44.8630],['AZE','셰키','Sheki','Sheki',41.1919,47.1706],
  ['BTN','파로','Paro','Paro',27.4287,89.4164],['BTN','푸나카','Punakha','Punakha',27.5916,89.8770],
  // 유럽
  ['FRA','아비뇽','Avignon',"Provence-Alpes-Côte d'Azur",43.9493,4.8055],['FRA','엑상프로방스','Aix-en-Provence',"Provence-Alpes-Côte d'Azur",43.5297,5.4474],
  ['FRA','콜마르','Colmar','Grand Est',48.0794,7.3585],['FRA','낭트','Nantes','Pays de la Loire',47.2184,-1.5536],['FRA','릴','Lille','Hauts-de-France',50.6292,3.0573],
  ['FRA','몽펠리에','Montpellier','Occitanie',43.6108,3.8767],['FRA','칸','Cannes',"Provence-Alpes-Côte d'Azur",43.5528,7.0174],['FRA','샤모니','Chamonix','Auvergne-Rhône-Alpes',45.9237,6.8694],
  ['FRA','루앙','Rouen','Normandy',49.4432,1.0999],['FRA','디종','Dijon','Bourgogne-Franche-Comté',47.3220,5.0415],['FRA','투르','Tours','Centre-Val de Loire',47.3941,0.6848],
  ['FRA','카르카손','Carcassonne','Occitanie',43.2130,2.3491],['FRA','에트르타','Étretat','Normandy',49.7070,0.2050],['FRA','생말로','Saint-Malo','Brittany',48.6493,-2.0257],
  ['DEU','로텐부르크','Rothenburg ob der Tauber','Bavaria',49.3779,10.1866],['DEU','퓌센','Füssen','Bavaria',47.5699,10.7004],['DEU','라이프치히','Leipzig','Saxony',51.3397,12.3731],
  ['DEU','브레멘','Bremen','Bremen',53.0793,8.8017],['DEU','포츠담','Potsdam','Brandenburg',52.3906,13.0645],['DEU','뷔르츠부르크','Würzburg','Bavaria',49.7913,9.9534],
  ['DEU','레겐스부르크','Regensburg','Bavaria',49.0134,12.1016],['DEU','바이마르','Weimar','Thuringia',50.9795,11.3235],['DEU','프라이부르크','Freiburg','Baden-Württemberg',47.9990,7.8421],
  ['DEU','하노버','Hannover','Lower Saxony',52.3759,9.7320],['DEU','밤베르크','Bamberg','Bavaria',49.8988,10.9028],
  ['ITA','몬테로소알마레(친퀘테레)','Monterosso al Mare','Liguria',44.1460,9.6540],['ITA','아시시','Assisi','Umbria',43.0707,12.6196],['ITA','제노바','Genoa','Liguria',44.4056,8.9463],
  ['ITA','코모','Como','Lombardy',45.8081,9.0852],['ITA','볼차노','Bolzano','Trentino-Alto Adige',46.4983,11.3548],['ITA','소렌토','Sorrento','Campania',40.6263,14.3758],
  ['ITA','아말피','Amalfi','Campania',40.6340,14.6027],['ITA','바리','Bari','Apulia',41.1171,16.8719],['ITA','마테라','Matera','Basilicata',40.6663,16.6043],
  ['ITA','레체','Lecce','Apulia',40.3515,18.1750],['ITA','파르마','Parma','Emilia-Romagna',44.8015,10.3279],['ITA','루카','Lucca','Tuscany',43.8429,10.5027],
  ['ITA','페루자','Perugia','Umbria',43.1107,12.3908],['ITA','알베로벨로','Alberobello','Apulia',40.7845,17.2399],['ITA','산지미냐노','San Gimignano','Tuscany',43.4677,11.0432],
  ['ESP','산세바스티안','San Sebastián','Basque Country',43.3183,-1.9812],['ESP','세고비아','Segovia','Castile and León',40.9429,-4.1088],['ESP','살라망카','Salamanca','Castile and León',40.9701,-5.6635],
  ['ESP','론다','Ronda','Andalusia',36.7423,-5.1671],['ESP','산티아고데콤포스텔라','Santiago de Compostela','Galicia',42.8782,-8.5448],['ESP','히로나','Girona','Catalonia',41.9794,2.8214],
  ['ESP','네르하','Nerja','Andalusia',36.7580,-3.8740],['ESP','시체스','Sitges','Catalonia',41.2370,1.8110],
  ['PRT','신트라','Sintra','Lisbon',38.8029,-9.3817],['PRT','라구스','Lagos','Faro',37.1028,-8.6730],['PRT','브라가','Braga','Braga',41.5454,-8.4265],
  ['PRT','에보라','Évora','Évora',38.5714,-7.9135],['PRT','오비두스','Óbidos','Leiria',39.3606,-9.1571],['PRT','나자레','Nazaré','Leiria',39.6012,-9.0700],
  ['CHE','인터라켄','Interlaken','Bern',46.6863,7.8632],['CHE','체르마트','Zermatt','Valais',46.0207,7.7491],['CHE','그린델발트','Grindelwald','Bern',46.6242,8.0414],
  ['CHE','루가노','Lugano','Ticino',46.0037,8.9511],['CHE','몽트뢰','Montreux','Vaud',46.4312,6.9107],['CHE','생모리츠','St. Moritz','Graubünden',46.4908,9.8355],
  ['AUT','할슈타트','Hallstatt','Upper Austria',47.5622,13.6493],['AUT','린츠','Linz','Upper Austria',48.3069,14.2858],
  ['CZE','체스키크룸로프','Český Krumlov','South Bohemian',48.8127,14.3175],['CZE','카를로비바리','Karlovy Vary','Karlovy Vary',50.2310,12.8710],
  ['CZE','쿠트나호라','Kutná Hora','Central Bohemian',49.9484,15.2682],['CZE','올로모우츠','Olomouc','Olomouc',49.5938,17.2509],
  ['HUN','에게르','Eger','Heves',47.9025,20.3772],['HUN','페치','Pécs','Baranya',46.0727,18.2323],['HUN','센텐드레','Szentendre','Pest',47.6694,19.0756],
  ['POL','브로츠와프','Wrocław','Lower Silesian',51.1079,17.0385],['POL','자코파네','Zakopane','Lesser Poland',49.2992,19.9496],['POL','토룬','Toruń','Kuyavian-Pomeranian',53.0138,18.5984],
  ['NLD','델프트','Delft','South Holland',52.0116,4.3571],['NLD','마스트리흐트','Maastricht','Limburg',50.8514,5.6910],['NLD','잔담(잔세스칸스)','Zaandam','North Holland',52.4740,4.8170],
  ['NLD','흐로닝언','Groningen','Groningen',53.2194,6.5665],
  ['BEL','디낭','Dinant','Namur',50.2606,4.9122],['BEL','뢰번','Leuven','Flemish Brabant',50.8798,4.7005],['LUX','룩셈부르크','Luxembourg','Luxembourg',49.6116,6.1319],
  ['DNK','빌룬','Billund','Southern Denmark',55.7308,9.1153],['DNK','스카겐','Skagen','North Jutland',57.7209,10.5839],['DNK','리베','Ribe','Southern Denmark',55.3280,8.7620],
  ['NOR','트론헤임','Trondheim','Trøndelag',63.4305,10.3951],['NOR','플롬','Flåm','Vestland',60.8630,7.1140],['NOR','게이랑에르','Geiranger','Møre og Romsdal',62.1008,7.2059],
  ['NOR','릴레함메르','Lillehammer','Innlandet',61.1153,10.4662],
  ['SWE','웁살라','Uppsala','Uppsala',59.8586,17.6389],['SWE','키루나','Kiruna','Norrbotten',67.8558,20.2253],
  ['FIN','탐페레','Tampere','Pirkanmaa',61.4978,23.7610],['FIN','포르보','Porvoo','Uusimaa',60.3932,25.6650],['FIN','사리셀카','Saariselkä','Lapland',68.4210,27.4170],
  ['EST','탈린','Tallinn','Harju',59.4370,24.7536],['EST','타르투','Tartu','Tartu',58.3780,26.7290],['LVA','리가','Riga','Riga',56.9496,24.1052],
  ['LTU','빌뉴스','Vilnius','Vilnius',54.6872,25.2797],['LTU','트라카이','Trakai','Vilnius',54.6379,24.9347],['LTU','카우나스','Kaunas','Kaunas',54.8985,23.9036],
  ['GRC','칼람바카(메테오라)','Kalambaka','Thessaly',39.7060,21.6280],['GRC','델피','Delphi','Central Greece',38.4824,22.5010],['GRC','나플리오','Nafplio','Peloponnese',37.5673,22.8015],
  ['HRV','풀라','Pula','Istria',44.8666,13.8496],['HRV','로비니','Rovinj','Istria',45.0812,13.6387],['HRV','시베니크','Šibenik','Šibenik-Knin',43.7350,15.8952],
  ['SVN','블레드','Bled','Upper Carniola',46.3683,14.1146],['SVN','피란','Piran','Coastal–Karst',45.5285,13.5683],
  ['MNE','코토르','Kotor','Kotor',42.4247,18.7712],['MNE','부드바','Budva','Budva',42.2911,18.8403],
  ['ALB','티라나','Tirana','Tirana',41.3275,19.8187],['ALB','베라트','Berat','Berat',40.7058,19.9522],['ALB','사란더','Sarandë','Vlorë',39.8661,20.0050],
  ['MKD','오흐리드','Ohrid','Southwestern',41.1172,20.8016],['MKD','스코페','Skopje','Skopje',41.9981,21.4254],['SRB','노비사드','Novi Sad','Vojvodina',45.2671,19.8335],
  ['BGR','플로브디프','Plovdiv','Plovdiv',42.1354,24.7453],['BGR','벨리코투르노보','Veliko Tarnovo','Veliko Tarnovo',43.0757,25.6172],['BGR','바르나','Varna','Varna',43.2141,27.9147],
  ['ROU','시비우','Sibiu','Sibiu',45.7983,24.1256],['ROU','클루지나포카','Cluj-Napoca','Cluj',46.7712,23.6236],['ROU','시기쇼아라','Sighișoara','Mureș',46.2197,24.7964],
  ['SVK','포프라트(타트라)','Poprad','Prešov',49.0590,20.2970],
  // 북아메리카
  ['USA','내슈빌','Nashville','Tennessee',36.1627,-86.7816],['USA','멤피스','Memphis','Tennessee',35.1495,-90.0490],['USA','산타페','Santa Fe','New Mexico',35.6870,-105.9378],
  ['USA','세도나','Sedona','Arizona',34.8697,-111.7610],['USA','투사얀(그랜드캐니언)','Tusayan','Arizona',35.9733,-112.1263],['USA','몬터레이','Monterey','California',36.6002,-121.8947],
  ['USA','샌타바버라','Santa Barbara','California',34.4208,-119.6982],['USA','팜스프링스','Palm Springs','California',33.8303,-116.5453],['USA','찰스턴','Charleston','South Carolina',32.7765,-79.9311],
  ['USA','서배너','Savannah','Georgia',32.0809,-81.0912],['USA','피츠버그','Pittsburgh','Pennsylvania',40.4406,-79.9959],['USA','미니애폴리스','Minneapolis','Minnesota',44.9778,-93.2650],
  ['USA','세인트루이스','St. Louis','Missouri',38.6270,-90.1994],['USA','앵커리지','Anchorage','Alaska',61.2181,-149.9003],['USA','페어뱅크스','Fairbanks','Alaska',64.8378,-147.7164],
  ['USA','잭슨','Jackson','Wyoming',43.4799,-110.7624],['USA','모압','Moab','Utah',38.5733,-109.5498],['USA','나파','Napa','California',38.2975,-122.2869],
  ['USA','샌안토니오','San Antonio','Texas',29.4241,-98.4936],['USA','볼티모어','Baltimore','Maryland',39.2904,-76.6122],['USA','애스펀','Aspen','Colorado',39.1911,-106.8175],
  ['CAN','휘슬러','Whistler','British Columbia',50.1163,-122.9574],['CAN','에드먼턴','Edmonton','Alberta',53.5461,-113.4938],['CAN','핼리팩스','Halifax','Nova Scotia',44.6488,-63.5752],
  ['CAN','나이아가라폴스','Niagara Falls','Ontario',43.0896,-79.0849],['CAN','옐로나이프','Yellowknife','Northwest Territories',62.4540,-114.3718],['CAN','킹스턴','Kingston','Ontario',44.2312,-76.4860],
  ['CAN','화이트호스','Whitehorse','Yukon',60.7212,-135.0568],['CAN','캔모어','Canmore','Alberta',51.0884,-115.3479],['CAN','레이크루이스','Lake Louise','Alberta',51.4254,-116.1773],
  ['MEX','오악사카','Oaxaca','Oaxaca',17.0732,-96.7266],['MEX','산크리스토발데라스카사스','San Cristóbal de las Casas','Chiapas',16.7370,-92.6376],['MEX','과나후아토','Guanajuato','Guanajuato',21.0190,-101.2574],
  ['MEX','산미겔데아옌데','San Miguel de Allende','Guanajuato',20.9144,-100.7452],['MEX','툴룸','Tulum','Quintana Roo',20.2114,-87.4654],['MEX','플라야델카르멘','Playa del Carmen','Quintana Roo',20.6296,-87.0739],
  ['MEX','푸에블라','Puebla','Puebla',19.0414,-98.2063],['MEX','카보산루카스','Cabo San Lucas','Baja California Sur',22.8905,-109.9167],['MEX','바야돌리드','Valladolid','Yucatán',20.6896,-88.2022],
  ['GTM','안티과과테말라','Antigua Guatemala','Sacatepéquez',14.5586,-90.7295],['CRI','라포르투나','La Fortuna','Alajuela',10.4710,-84.6450],
  // 남아메리카
  ['PER','쿠스코','Cusco','Cusco',-13.5320,-71.9675],['PER','아과스칼리엔테스(마추픽추)','Aguas Calientes','Cusco',-13.1547,-72.5254],['PER','푸노','Puno','Puno',-15.8402,-70.0219],
  ['PER','이카(와카치나)','Ica','Ica',-14.0875,-75.7626],
  ['BOL','우유니','Uyuni','Potosí',-20.4630,-66.8250],['BOL','코파카바나','Copacabana','La Paz',-16.1660,-69.0860],
  ['ARG','푸에르토이과수','Puerto Iguazú','Misiones',-25.5991,-54.5736],['ARG','엘칼라파테','El Calafate','Santa Cruz',-50.3379,-72.2648],['ARG','살타','Salta','Salta',-24.7821,-65.4232],
  ['ARG','엘찰텐','El Chaltén','Santa Cruz',-49.3315,-72.8863],['ARG','푸에르토마드린','Puerto Madryn','Chubut',-42.7692,-65.0385],
  ['CHL','발파라이소','Valparaíso','Valparaíso',-33.0472,-71.6127],['CHL','산페드로데아타카마','San Pedro de Atacama','Antofagasta',-22.9087,-68.1997],['CHL','푸콘','Pucón','Araucanía',-39.2820,-71.9540],
  ['CHL','푸에르토나탈레스','Puerto Natales','Magallanes',-51.7236,-72.4875],['CHL','비냐델마르','Viña del Mar','Valparaíso',-33.0245,-71.5518],
  ['BRA','살바도르','Salvador','Bahia',-12.9777,-38.5016],['BRA','브라질리아','Brasília','Federal District',-15.7939,-47.8828],['BRA','쿠리치바','Curitiba','Paraná',-25.4284,-49.2733],
  ['BRA','마나우스','Manaus','Amazonas',-3.1190,-60.0217],['BRA','파라치','Paraty','Rio de Janeiro',-23.2178,-44.7131],['BRA','오루프레투','Ouro Preto','Minas Gerais',-20.3856,-43.5035],
  ['BRA','보니토','Bonito','Mato Grosso do Sul',-21.1261,-56.4836],
  ['COL','칼리','Cali','Valle del Cauca',3.4516,-76.5320],['COL','산타마르타','Santa Marta','Magdalena',11.2408,-74.1990],['COL','살렌토','Salento','Quindío',4.6370,-75.5700],
  ['ECU','바뇨스','Baños','Tungurahua',-1.3964,-78.4247],
  ['URY','콜로니아델사크라멘토','Colonia del Sacramento','Colonia',-34.4626,-57.8400],['URY','푼타델에스테','Punta del Este','Maldonado',-34.9600,-54.9500],
  ['PRY','아순시온','Asunción','Asunción',-25.2637,-57.5759],
  // 오세아니아(호주 본토)
  ['AUS','바이런베이','Byron Bay','New South Wales',-28.6474,153.6020],['AUS','누사','Noosa Heads','Queensland',-26.3943,153.0910],['AUS','포트더글러스','Port Douglas','Queensland',-16.4836,145.4653],
  ['AUS','율라라(울루루)','Yulara','Northern Territory',-25.2406,130.9889],['AUS','마거릿리버','Margaret River','Western Australia',-33.9550,115.0750],['AUS','카툼바(블루마운틴)','Katoomba','New South Wales',-33.7120,150.3110],
  ['AUS','론(그레이트오션로드)','Lorne','Victoria',-38.5410,143.9760],['AUS','브룸','Broome','Western Australia',-17.9614,122.2359],['AUS','타운즈빌','Townsville','Queensland',-19.2590,146.8169],
  ['AUS','넬슨베이(포트스티븐스)','Nelson Bay','New South Wales',-32.7180,152.1440],['AUS','뉴캐슬','Newcastle','New South Wales',-32.9283,151.7817],['AUS','에어리비치','Airlie Beach','Queensland',-20.2680,148.7180],
  ['AUS','타눈다(바로사밸리)','Tanunda','South Australia',-34.5230,138.9590],['AUS','프리맨틀','Fremantle','Western Australia',-32.0569,115.7439],
];

const base=overseas.destinations.filter(p=>p.addedBy!=='randomplace');
const countryInfo=new Map();
for(const p of base)if(!countryInfo.has(p.countryCode))countryInfo.set(p.countryCode,{country:p.country,continent:p.continent});
for(const f of world.features)if(!countryInfo.has(f.properties.code))countryInfo.set(f.properties.code,{country:f.properties.name,continent:f.properties.continent});

const polys=f=>f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
const parts=world.features.flatMap(f=>polys(f).map(rings=>({code:f.properties.code,rings})));
function inRing([x,y],r){let inside=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const [a,b]=r[i],[c,d]=r[j];if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)inside=!inside;}return inside;}
function km([x,y],[a,b],[c,d]){const k=Math.cos(y*Math.PI/180),dx=(c-a)*k,dy=d-b,px=(x-a)*k,py=y-b,t=dx*dx+dy*dy?Math.max(0,Math.min(1,(px*dx+py*dy)/(dx*dx+dy*dy))):0;return Math.hypot(px-t*dx,py-t*dy)*111;}
const edgeDistance=(pt,rings)=>Math.min(...rings.map(r=>{let m=Infinity;for(let i=0,j=r.length-1;i<r.length;j=i++)m=Math.min(m,km(pt,r[j],r[i]));return m;}));
const area=r=>{let s=0;for(let i=0,j=r.length-1;i<r.length;j=i++)s+=r[j][0]*r[i][1]-r[i][0]*r[j][1];return Math.abs(s/2);};
// 다른 나라와 맞닿은(약 15km 이내) 조각이거나 대륙 규모(호주 본토 등)면 본토로 봐요.
const touches=new Map();
function mainland(part){
  if(touches.has(part))return touches.get(part);
  let result=area(part.rings[0])>300;
  if(!result){const pts=part.rings[0].filter((_,i)=>i%2===0);result=parts.some(o=>o.code!==part.code&&pts.some(p=>edgeDistance(p,o.rings)<15));}
  touches.set(part,result);return result;
}

const errors=[],added=[],existing=new Set(base.map(p=>p.countryCode+':'+p.cityEn.toLowerCase()));
for(const [code,city,cityEn,area_,lat,lon] of cities){
  const info=countryInfo.get(code);if(!info){errors.push(`${city}: 국가 정보 없음 ${code}`);continue;}
  if(info.continent==='Africa')errors.push(`${city}: 아프리카는 제외해요`);
  if(existing.has(code+':'+cityEn.toLowerCase())){errors.push(`${city}: 이미 있는 도시`);continue;}
  const own=parts.filter(p=>p.code===code);if(!own.length){errors.push(`${city}: 지도에 ${code} 경계 없음`);continue;}
  const pt=[lon,lat];
  let part=own.find(p=>inRing(pt,p.rings[0])&&!p.rings.slice(1).some(r=>inRing(pt,r)));
  if(!part){const near=own.map(p=>({p,d:edgeDistance(pt,p.rings)})).sort((a,b)=>a.d-b.d)[0];if(near.d<=25)part=near.p;}
  if(!part){const other=parts.find(p=>inRing(pt,p.rings[0]));errors.push(`${city}: ${code} 경계 밖${other?' ('+other.code+' 안)':''}`);continue;}
  if(!mainland(part)){errors.push(`${city}: 섬 조각으로 판정`);continue;}
  const slug=cityEn.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  added.push({id:`rp-${code.toLowerCase()}-${slug}`,countryCode:code,country:info.country,city,cityEn,area:area_,lon,lat,continent:info.continent,
    landmass:'continental-mainland',sourceId:null,curation:'korean-traveler-famous-city',addedBy:'randomplace'});
}
const ids=added.map(p=>p.id),names=[...base,...added].map(p=>p.city);
for(const id of ids.filter((v,i)=>ids.indexOf(v)!==i))errors.push('중복 ID '+id);
for(const n of names.filter((v,i)=>names.indexOf(v)!==i))errors.push('중복 이름 '+n);
if(errors.length)throw new Error('해외 추가 도시 검증 실패\n'+errors.join('\n'));

overseas.destinations=[...base,...added];
overseas.selection.countryCount=new Set(overseas.destinations.filter(p=>p.countryCode!=='KOR').map(p=>p.countryCode)).size;
overseas.selection.additions='RandomPlace가 대륙 본토의 여행 도시를 더 편집 선정했습니다(addedBy: randomplace). 좌표는 도시 중심의 근사값입니다.';
fs.writeFileSync(new URL('overseas.json',dataDir),JSON.stringify(overseas));
const per={};for(const p of added)per[p.continent]=(per[p.continent]||0)+1;
console.log({added:added.length,total:overseas.destinations.length,countries:overseas.selection.countryCount,per});
