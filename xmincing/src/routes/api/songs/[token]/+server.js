import { env as workerEnv } from 'cloudflare:workers';
import { json } from '@sveltejs/kit';
import { sha256 } from '#lib/server/identity.js';

async function roomFor(event) {
 const hash = await sha256(event.params.token);
 return workerEnv.DB.prepare('SELECT * FROM song_rooms WHERE (host_hash = ? OR invite_hash = ?) AND expires_at > ?').bind(hash, hash, Math.floor(Date.now() / 1000)).first();
}
export async function GET(event) {
 const room = await roomFor(event);
 if (!room) return json({ message: 'This link is invalid or has expired.' }, { status: 404 });
 const rows = await workerEnv.DB.prepare('SELECT name FROM song_contributions WHERE room_id = ? ORDER BY created_at').bind(room.id).all();
 return json({ occasion: room.occasion, recipient: room.recipient, mood: room.mood, capacity: room.capacity, names: rows.results.map((row) => row.name), status: room.status, lyrics: room.lyrics, paymentStatus: room.payment_status, generationStatus: room.generation_status, isHost: room.host_hash === await sha256(event.params.token), expiresAt: room.expires_at }, { headers: { 'Cache-Control': 'no-store' } });
}
export async function POST(event) {
 const origin = event.request.headers.get('origin');
 if (origin && origin !== event.url.origin) return json({ message: 'Invalid request origin.' }, { status: 403 });
 const room = await roomFor(event);
 if (!room || room.status !== 'collecting') return json({ message: 'This room is unavailable.' }, { status: 404 });
 let input;
 try { input = await event.request.json(); } catch { return json({ message: 'Invalid request.' }, { status: 400 }); }
 const name = String(input.name ?? '').trim();
 const contribution = String(input.contribution ?? '').trim();
 if (!name || name.length > 40 || !contribution || contribution.length > 200) return json({ message: 'Enter a name and a contribution of up to 200 characters.' }, { status: 400 });
 const id = crypto.randomUUID();
 const result = await workerEnv.DB.prepare("INSERT INTO song_contributions (id, room_id, token_hash, name, contribution, created_at) SELECT ?, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM song_contributions WHERE room_id = ?) < ? AND (SELECT status FROM song_rooms WHERE id = ?) = 'collecting'").bind(id, room.id, await sha256(id), name, contribution, Math.floor(Date.now()/1000), room.id, room.capacity, room.id).run();
 if (!result.meta.changes) return json({ message: 'This room is full.' }, { status: 409 });
 return json({ ok: true });
}
