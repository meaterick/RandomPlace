import http from 'node:http';
import fs from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
export function serve(port=4173){const root=fileURLToPath(new URL('../public/',import.meta.url));const server=http.createServer(async(req,res)=>{try{let path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(!path.startsWith(resolve(root)+sep)&&path!==resolve(root))throw Error();if((await fs.stat(path)).isDirectory())path=resolve(path,'index.html');res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'})[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(await fs.readFile(path));}catch{res.writeHead(404);res.end('Not found');}});return new Promise(r=>server.listen(port,'127.0.0.1',()=>r(server)));}
if(process.argv[1]===fileURLToPath(import.meta.url)){const server=await serve(Number(process.env.PORT)||4173);console.log(`Local: http://127.0.0.1:${server.address().port}`);}
