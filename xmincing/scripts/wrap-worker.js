import fs from 'node:fs';
import path from 'node:path';

const output = path.resolve('.svelte-kit/cloudflare');
const workerPath = path.join(output, '_worker.js');
const appPath = path.join(output, 'app-worker.js');
const ignorePath = path.join(output, '.assetsignore');

if (!fs.existsSync(workerPath)) throw new Error('Cloudflare adapter did not create the Worker entrypoint.');
fs.renameSync(workerPath, appPath);
fs.writeFileSync(workerPath, `
import app from './app-worker.js';

export default {
  fetch(request, env, context) {
    return app.fetch(request, env, context);
  },
  async scheduled(_controller, env) {
    const now = Math.floor(Date.now() / 1000);
    const expiredSongs = await env.DB.prepare('SELECT id FROM song_rooms WHERE expires_at <= ?').bind(now).all();
    for (const song of expiredSongs.results ?? []) {
      for (const suffix of ['audio.mp3', 'cover', 'finished.mp3', 'lyrics.pdf']) await env.MEDIA.delete('songs/' + song.id + '/' + suffix);
      await env.DB.prepare('DELETE FROM song_contributions WHERE room_id = ?').bind(song.id).run();
      await env.DB.prepare('DELETE FROM song_rooms WHERE id = ?').bind(song.id).run();
    }
    const expiredRooms = await env.DB.prepare('SELECT id FROM rooms WHERE expires_at <= ?').bind(now).all();
    for (const room of expiredRooms.results ?? []) {
      const objects = await env.DB.prepare('SELECT object_key FROM clips WHERE room_id = ?').bind(room.id).all();
      for (const object of objects.results ?? []) await env.MEDIA.delete(object.object_key);
      await env.DB.prepare('DELETE FROM rooms WHERE id = ?').bind(room.id).run();
    }
    await env.DB.batch([
      env.DB.prepare('DELETE FROM auth_limits WHERE window_started_at < ?').bind(now - 24 * 60 * 60),
      env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ? OR revoked_at < ?').bind(now, now - 90 * 24 * 60 * 60),
      env.DB.prepare('DELETE FROM invitations WHERE expires_at <= ? OR used_at < ?').bind(now, now - 30 * 24 * 60 * 60),
      env.DB.prepare('DELETE FROM share_links WHERE expires_at <= ? OR revoked_at < ?').bind(now, now - 30 * 24 * 60 * 60)
    ]);
  }
};
`);

if (fs.existsSync(ignorePath)) {
	const current = fs.readFileSync(ignorePath, 'utf8').split(/\r?\n/);
	if (!current.includes('app-worker.js')) fs.appendFileSync(ignorePath, '\napp-worker.js\n');
}
