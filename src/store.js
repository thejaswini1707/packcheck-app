import fs from 'node:fs';
import crypto from 'node:crypto';
import { config } from './config.js';

const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const blank = () => ({ users: [], products: [], scans: [], rules: [], ecommerceListings: [], reports: [] });
function load(){ if(!fs.existsSync(config.dbFile)) return blank(); try{return {...blank(),...JSON.parse(fs.readFileSync(config.dbFile,'utf8'))}}catch{return blank()} }
let db=load();
function save(){const tmp=config.dbFile+'.tmp';fs.writeFileSync(tmp,JSON.stringify(db,null,2));fs.renameSync(tmp,config.dbFile)}
function hashPassword(password,salt=crypto.randomBytes(16).toString('hex')){return `${salt}:${crypto.scryptSync(String(password),salt,64).toString('hex')}`}
export function verifyPassword(password,stored){try{const [salt,key]=stored.split(':');const actual=crypto.scryptSync(String(password),salt,64).toString('hex');return crypto.timingSafeEqual(Buffer.from(key,'hex'),Buffer.from(actual,'hex'))}catch{return false}}
export function seed(){
  if(db.users.length)return;
  const demoId=id(), t=now();
  db.users.push({id:demoId,name:'Demo Team',email:'demo@packcheck.local',passwordHash:hashPassword('Demo@12345'),role:'admin',createdAt:t});
  const products=[
    ['Britannia Marie Gold','Britannia',200,40,'Britannia Industries Ltd.','10012011000122','2025-08','Biscuits'],
    ['Amul Butter','Amul',100,62,'GCMMF Ltd.','','2025-08','Dairy'],
    ['Tata Salt','Tata',1000,30,'Tata Consumer Products Ltd.','10012011000219','2025-07','Staples'],
    ['Maggi Noodles','Nestlé',70,15,'Nestlé India Ltd.','10013011000418','2025-07','Instant Food']
  ];
  for(const [name,brand,quantity,mrp,manufacturer,fssai,manufactureDate,category] of products) db.products.push({id:id(),name,brand,quantity,mrp,manufacturer,fssai,manufactureDate,category,imageUrl:'',createdAt:t,updatedAt:t});
  const rules=[
    ['mrp_present','MRP is present and greater than zero','mrp','gt',0,'high'],
    ['quantity_present','Net quantity is present and greater than zero','quantity','gt',0,'high'],
    ['manufacturer_present','Manufacturer / packer details are present','manufacturer','not_empty',null,'medium'],
    ['fssai_present','FSSAI licence number is present','fssai','not_empty',null,'high'],
    ['product_name_present','Product name is present','name','not_empty',null,'medium']
  ];
  for(const [key,label,field,operator,threshold,severity] of rules) db.rules.push({id:id(),key,label,field,operator,threshold,severity,active:true,createdAt:t,updatedAt:t});
  const byName=Object.fromEntries(db.products.map(p=>[p.name,p]));
  const examples=[['Britannia Marie Gold',true,12],['Amul Butter',false,68],['Tata Salt',true,6],['Maggi Noodles',false,71]];
  for(const [name,ok,risk] of examples){const p=byName[name];db.scans.push({id:id(),userId:demoId,productId:p.id,product:{...p},source:'seed',status:ok?'Compliant':'Non-Compliant',riskScore:risk,complianceScore:100-risk,issues:ok?[]:[{severity:'high',message:'Required declaration is missing',ruleKey:'fssai_present'}],checks:db.rules.map(r=>({ruleId:r.id,key:r.key,label:r.label,passed:ok || r.key!=='fssai_present',severity:r.severity})),createdAt:new Date(Date.now()-Math.floor(Math.random()*5)*86400000).toISOString()})}
  db.ecommerceListings.push({id:id(),productName:'Britannia Marie Gold',seller:'Marketplace A',mrp:40,quantity:200,brand:'Britannia',url:'https://example.com/listing-a',updatedAt:t},{id:id(),productName:'Britannia Marie Gold',seller:'Marketplace B',mrp:40,quantity:200,brand:'Britannia',url:'https://example.com/listing-b',updatedAt:t});
  save();
}
export const store={
 get db(){return db},save,
 findUserByEmail(email){return db.users.find(u=>u.email.toLowerCase()===String(email).toLowerCase())},getUser(id){return db.users.find(u=>u.id===id)},addUser(u){db.users.push(u);save();return u},
 getRules(){return db.rules.filter(r=>r.active)},addProduct(p){db.products.push(p);save();return p},getProduct(id){return db.products.find(p=>p.id===id)},
 addScan(s){db.scans.unshift(s);save();return s},getScan(id){return db.scans.find(s=>s.id===id)},getScans({userId,limit=100}={}){return db.scans.filter(s=>!userId||s.userId===userId).slice(0,limit)},
 addReport(r){db.reports.unshift(r);save();return r},getReports(userId){return db.reports.filter(r=>r.userId===userId)},getListings(name){return db.ecommerceListings.filter(l=>!name||l.productName.toLowerCase()===name.toLowerCase())},
 getDashboard(userId){const scans=store.getScans({userId});const total=scans.length,ok=scans.filter(s=>s.status==='Compliant').length;return{totalScans:total,compliantProducts:ok,nonCompliantProducts:total-ok,reportsGenerated:db.reports.filter(r=>r.userId===userId).length,complianceRate:total?Math.round(ok/total*100):0,recentScans:scans.slice(0,10)}}
};
seed();
export { id, now, hashPassword };
