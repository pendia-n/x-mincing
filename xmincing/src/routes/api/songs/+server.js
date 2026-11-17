import { env as workerEnv } from 'cloudflare:workers';
import { json } from '@sveltejs/kit';
import { randomToken, sha256 } from '#lib/server/identity.js';

export async function POST(event) {
 const origin = event.request.headers.get('origin');
 if (origin && origin !== event.url.origin) return json({ message: 'Invalid request origin.' }, { status: 403 });
 const db = workerEnv.DB;
 if (!db) return json({ message: 'Database unavailable.' }, { status: 503 });
 let input;
 try { input = await event.request.json(); } catch { return json({ message: 'Invalid request.' }, { status: 400 }); }
 const occasion = String(input.occasion ?? '').trim();
 const recipient = String(input.recipient ?? '').trim();
 const mood = String(input.mood ?? '').trim();
 const capacity = Number(input.capacity);
 if (!['birthday', 'farewell'].includes(occasion) || !recipient || recipient.length > 80 || !['heartfelt', 'funny'].includes(mood) || !Number.isInteger(capacity) || capacity < 2 || capacity > 8) return json({ message: 'Please complete the form.' }, { status: 400 });
 const id = crypto.randomUUID();
 const host = randomToken();
 const invite = randomToken();
 const now = Math.floor(Date.now() / 1000);
 await db.prepare('INSERT INTO song_rooms (id, host_hash, invite_hash, occasion, recipient, mood, capacity, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, await sha256(host), await sha256(invite), occasion, recipient, mood, capacity, now, now + 604800).run();
 return json({ hostUrl: `${event.url.origin}/song/${host}`, inviteUrl: `${event.url.origin}/song/${invite}` }, { headers: { 'Cache-Control': 'no-store' } });
}
