import { env as workerEnv } from 'cloudflare:workers';
import { json } from '@sveltejs/kit';
export async function POST(event) {
 const env=workerEnv; const sig=event.request.headers.get('stripe-signature') || ''; const body=await event.request.text();
 if (!env.STRIPE_WEBHOOK_SECRET) return json({error:'Not configured'},{status:503});
 const fields=sig.split(',').map(x=>x.split('=')); const timestamp=fields.find(x=>x[0]==='t')?.[1]; const signatures=fields.filter(x=>x[0]==='v1').map(x=>x[1]);
 if (!timestamp || Math.abs(Date.now()/1000-Number(timestamp))>300 || !signatures.length) return json({error:'Invalid signature'},{status:400});
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.STRIPE_WEBHOOK_SECRET),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 let valid=false;
 for (const value of signatures) { if (!/^[0-9a-f]{64}$/i.test(value)) continue; const bytes=Uint8Array.from(value.match(/../g),x=>parseInt(x,16)); if(await crypto.subtle.verify('HMAC',key,bytes,new TextEncoder().encode(`${timestamp}.${body}`))) valid=true; }
 if(!valid) return json({error:'Invalid signature'},{status:400});
 let data; try { data=JSON.parse(body); } catch { return json({error:'Invalid body'},{status:400}); }
 if (['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(data.type)) {
  const session=data.data.object;
  if (session.payment_status === 'paid' && session.currency === 'usd') {
   const update=await env.DB.prepare("UPDATE song_rooms SET payment_status='paid', status='paid' WHERE id=? AND checkout_id=? AND payment_status='unpaid' AND ? = CASE WHEN capacity=2 THEN 300 ELSE capacity*130 END").bind(session.metadata?.room_id,session.id,session.amount_total).run();
   if(!update.meta.changes) { const existing=await env.DB.prepare("SELECT payment_status FROM song_rooms WHERE id=? AND checkout_id=?").bind(session.metadata?.room_id,session.id).first(); if(existing?.payment_status !== 'paid') return json({error:'Payment not yet linked'},{status:503}); }
  }
 }
 return json({received:true});
}
