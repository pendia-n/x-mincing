import { env as workerEnv } from 'cloudflare:workers';
import { sha256 } from '#lib/server/identity.js';
export async function findSong(event, hostOnly = false) {
 const hash = await sha256(event.params.token);
 const room = await workerEnv.DB.prepare(`SELECT * FROM song_rooms WHERE ${hostOnly ? 'host_hash = ?' : '(host_hash = ? OR invite_hash = ?)'} AND expires_at > ?`).bind(...(hostOnly ? [hash] : [hash, hash]), Math.floor(Date.now()/1000)).first();
 return room;
}
export function sameOrigin(event) {
 const origin = event.request.headers.get('origin');
 return !origin || origin === event.url.origin;
}
export async function openRouter(env, path, body) {
 const response = await fetch(`https://openrouter.ai/api/v1/${path}`, { method: 'POST', headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
 if (!response.ok) throw new Error(`AI provider returned ${response.status}.`);
 return response;
}
