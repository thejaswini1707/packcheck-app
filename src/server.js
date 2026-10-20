import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { URL } from 'node:url';
import crypto from 'node:crypto';
import { config } from './config.js';
import { store, id, now, hashPassword, verifyPassword } from './store.js';
import { analyzeProduct } from './compliance.js';
import { signToken, authUser } from './auth.js';
import { subscribe, broadcast } from './events.js';

const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon'};
function send(res,status,data,type='application/json'){res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store'});res.end(type.startsWith('application/json')?JSON.stringify(data):data)}
function body(req){return new Promise((resolve,reject)=>{let size=0,chunks=[];req.on('data',c=>{size+=c.length;if(size>Math.max(2,config.maxUploadMb+2)*1024*1024){reject(Object.assign(new Error('Request too large'),{status:413}));req.destroy();return}chunks.push(c)});req.on('end',()=>{try{const raw=Buffer.concat(chunks).toString('utf8');resolve(raw?JSON.parse(raw):{})}catch(e){reject(Object.assign(new Error('Invalid JSON body'),{status:400}))}});req.on('error',reject)})}
function requireUser(req,res){const user=authUser(req);if(!user){send(res,401,{error:'Authentication required'});return null}return user}
function safeFile(name){return path.join(config.publicDir,name)}
function staticFile(req,res,urlPath){let rel=urlPath==='/'?'/index.html':urlPath;let base=config.publicDir;if(rel.startsWith('/uploads/'))base=config.uploadDir;const clean=path.normalize(rel).replace(/^([.][.][/\\])+/, '');const file=path.join(base,clean.replace(/^[/\\]+/,''));if(!file.startsWith(base))return false;if(!fs.existsSync(file)||!fs.statSync(file).isFile())return false;const ext=path.extname(file).toLowerCase();res.writeHead(200,{'Content-Type':mime[ext]||'application/octet-stream','Cache-Control':'no-cache'});fs.createReadStream(file).pipe(res);return true}
async function route(req,res){
 const u=new URL(req.url,`http://${req.headers.host||'localhost'}`);const p=u.pathname;
 if(req.method==='GET'&&p==='/api/health')return send(res,200,{ok:true,time:now()});
 if(req.method==='GET'&&p==='/api/config')return send(res,200,{maxUploadMb:config.maxUploadMb});
 if(req.method==='GET'&&p==='/api/events'){if(!requireUser(req,res))return;return subscribe(req,res)}
 if(req.method==='POST'&&p==='/api/auth/login'){const b=await body(req),user=store.findUserByEmail(b.email||'');if(!user||!verifyPassword(b.password||'',user.passwordHash))return send(res,401,{error:'Invalid email or password'});return send(res,200,{token:signToken(user),user:{id:user.id,name:user.name,email:user.email,role:user.role}})}
 if(req.method==='POST'&&p==='/api/auth/register'){const b=await body(req);if(!b.name||!b.email||!b.password||String(b.password).length<8)return send(res,400,{error:'Name, email and an 8+ character password are required'});if(store.findUserByEmail(b.email))return send(res,409,{error:'An account with this email already exists'});const user=store.addUser({id:id(),name:String(b.name).trim(),email:String(b.email).trim().toLowerCase(),passwordHash:hashPassword(b.password),role:'analyst',createdAt:now()});return send(res,201,{token:signToken(user),user:{id:user.id,name:user.name,email:user.email,role:user.role}})}
 if(req.method==='GET'&&!p.startsWith('/api/')){if(staticFile(req,res,p))return;}
 const user=requireUser(req,res);if(!user)return;
 if(req.method==='GET'&&p==='/api/dashboard')return send(res,200,store.getDashboard(user.id));
 if(req.method==='GET'&&p==='/api/rules')return send(res,200,{rules:store.db.rules});
 if(req.method==='GET'&&p==='/api/scans')return send(res,200,{scans:store.getScans({userId:user.id,limit:Math.min(Number(u.searchParams.get('limit'))||100,500)})});
 const scanMatch=p.match(/^\/api\/scans\/([^/]+)$/);const reportMatch=p.match(/^\/api\/scans\/([^/]+)\/report$/);
 if(req.method==='GET'&&scanMatch){const s=store.getScan(scanMatch[1]);if(!s||s.userId!==user.id)return send(res,404,{error:'Scan not found'});return send(res,200,s)}
 if(req.method==='POST'&&reportMatch){const s=store.getScan(reportMatch[1]);if(!s||s.userId!==user.id)return send(res,404,{error:'Scan not found'});const r=store.addReport({id:id(),userId:user.id,scanId:s.id,productName:s.product.name,generatedAt:now(),format:'json',payload:s});broadcast('report.created',r);return send(res,201,r)}
 if(req.method==='POST'&&p==='/api/scans'){
   const b=await body(req);let imageUrl='';
   if(b.imageData){const m=String(b.imageData).match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);if(!m)return send(res,400,{error:'Unsupported image format'});const bytes=Buffer.from(m[2],'base64');if(bytes.length>config.maxUploadMb*1024*1024)return send(res,413,{error:`Image exceeds ${config.maxUploadMb} MB`});const ext=m[1].split('/')[1].replace('jpeg','jpg');const filename=`${crypto.randomUUID()}.${ext}`;fs.writeFileSync(path.join(config.uploadDir,filename),bytes);imageUrl=`/uploads/${filename}`}
   const product={id:id(),name:String(b.name||'').trim(),brand:String(b.brand||'').trim(),quantity:Number(b.quantity||0),mrp:Number(b.mrp||0),manufacturer:String(b.manufacturer||'').trim(),fssai:String(b.fssai||'').trim(),manufactureDate:String(b.manufactureDate||'').trim(),category:String(b.category||'').trim(),imageUrl,createdAt:now(),updatedAt:now()};
   const result=analyzeProduct(product,store.getRules());store.addProduct(product);const scan=store.addScan({id:id(),userId:user.id,productId:product.id,product,source:imageUrl?'upload':'manual',...result,createdAt:now()});broadcast('scan.created',scan);return send(res,201,scan)
 }
 if(req.method==='GET'&&p==='/api/reports')return send(res,200,{reports:store.getReports(user.id)});
 if(req.method==='GET'&&p==='/api/ecommerce/compare')return send(res,200,{product:u.searchParams.get('product')||'',listings:store.getListings(u.searchParams.get('product')||'')});
 if(req.method==='GET'&&p==='/api/me')return send(res,200,{id:user.id,name:user.name,email:user.email,role:user.role});
 send(res,404,{error:'Not found'});
}
const server=http.createServer((req,res)=>{route(req,res).catch(e=>{console.error(e);send(res,e.status||500,{error:e.message||'Internal server error'})})});
server.listen(config.port,()=>console.log(`PackCheck running at http://localhost:${config.port}`));
