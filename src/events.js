const clients=new Set();
export function subscribe(req,res){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive','X-Accel-Buffering':'no'});res.write(`event: ready\ndata: ${JSON.stringify({at:new Date().toISOString()})}\n\n`);clients.add(res);const t=setInterval(()=>res.write(': ping\n\n'),20000);req.on('close',()=>{clearInterval(t);clients.delete(res)})}
export function broadcast(event,payload){const body=`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;for(const res of clients){try{res.write(body)}catch{clients.delete(res)}}}
