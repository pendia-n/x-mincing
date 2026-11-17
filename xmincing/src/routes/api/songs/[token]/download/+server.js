import { env as workerEnv } from 'cloudflare:workers';
import { findSong } from '#lib/server/song-service.js';
export async function GET(event) {
 const room=await findSong(event);
 if(!room?.song_key) return new Response('Song unavailable.',{status:404});
 const file=await workerEnv.MEDIA.get(room.song_key);
 if(!file) return new Response('Song unavailable.',{status:404});
 return new Response(file.body,{headers:{'Content-Type':'audio/mpeg','Content-Disposition':'attachment; filename="our-song.mp3"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
