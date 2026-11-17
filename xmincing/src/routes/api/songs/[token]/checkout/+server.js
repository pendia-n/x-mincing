import { env as workerEnv } from 'cloudflare:workers';
import { json } from '@sveltejs/kit';
import { findSong, sameOrigin } from '#lib/server/song-service.js';
export async function POST(event) {
 if (!sameOrigin(event)) return json({message:'Invalid request.'},{status:403});
 const env=workerEnv; const room=await findSong(event,true);
 if (!room || room.status !== 'review' || room.payment_status !== 'unpaid') return json({message:'Room is not ready for checkout.'},{status:400});
 if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET || !env.OPENROUTER_API_KEY) return json({message:'Payments are not configured yet.'},{status:503});
 const amount=room.capacity===2 ? 300 : room.capacity*130;
 const fields=new URLSearchParams({mode:'payment',success_url:`${event.url.origin}/song/${event.params.token}?checkout=success`,cancel_url:`${event.url.origin}/song/${event.params.token}?checkout=cancelled`,'line_items[0][price_data][currency]':'usd','line_items[0][price_data][unit_amount]':String(amount),'line_items[0][price_data][product_data][name]':'Group song','line_items[0][quantity]':'1','metadata[room_id]':room.id});
 const response=await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{Authorization:`Bearer ${env.STRIPE_SECRET_KEY}`,'Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':`song-${room.id}`},body:fields});
 if (!response.ok) return json({message:'Checkout is temporarily unavailable.'},{status:502});
 const session=await response.json();
 await env.DB.prepare('UPDATE song_rooms SET checkout_id=? WHERE id=? AND payment_status=\'unpaid\'').bind(session.id,room.id).run();
 return json({url:session.url});
}
