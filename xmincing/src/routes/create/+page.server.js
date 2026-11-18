import { env } from 'cloudflare:workers';

export async function load() {
	const [occasions, moods] = await env.DB.batch([
		env.DB.prepare('SELECT id, label, category FROM song_occasions ORDER BY category, label'),
		env.DB.prepare('SELECT id, label FROM song_moods ORDER BY label')
	]);
	const groups = Object.groupBy(occasions.results, (occasion) => occasion.category);
	return { groups, moods: moods.results };
}
