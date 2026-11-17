<script>
	import { onMount, tick } from 'svelte';
	let token = '';
	let data = null;
	let message = 'Opening the shared trailer…';
	let playIndex = -1;
	let videoEl;
	$: clips = data?.clips ? [...data.clips].sort((a, b) => a.prompt_slot.localeCompare(b.prompt_slot)) : [];
	$: activeClip = playIndex >= 0 ? clips[playIndex] : null;
	onMount(async () => {
		token = location.pathname.split('/').filter(Boolean).at(-1);
		try {
			const response = await fetch(`/api/shares/${token}`);
			const result = await response.json();
			if (!response.ok) throw new Error(result.message ?? 'This share link is no longer available.');
			data = result; message = '';
		} catch (error) { message = error.message; }
	});
	function clipTitle(clip) {
		const role = clip.prompt_slot.startsWith('a') ? 'A' : 'B';
		return data?.prompts?.[role]?.find((prompt) => prompt.slot === clip.prompt_slot)?.title ?? 'A little moment';
	}
	async function playTrailer() { playIndex = 0; await tick(); try { await videoEl?.play(); } catch { message = 'Press play to start.'; } }
	async function nextClip() { if (playIndex + 1 < clips.length) { playIndex += 1; await tick(); videoEl?.play(); } else playIndex = -1; }
</script>

<svelte:head><title>A shared little trailer · Our Trailer, Our Rules</title><meta name="robots" content="noindex, nofollow" /></svelte:head>
<section class="share-page">
	{#if message}<div class="message"><span>✳</span><p>{message}</p><a href="/">Make your own ↗</a></div>
	{:else if data}
		<p class="eyebrow">A private link, shared by two people</p><h1>A tiny movie<br /><em>made by two.</em></h1><p class="byline">{data.members.map((member) => member.username).join(' + ')}</p>
		<div class="spotlight">
			{#if activeClip}<video bind:this={videoEl} controls playsinline preload="metadata" src={activeClip.url} onended={nextClip}><track kind="captions" srclang="en" label="English" src={activeClip.captionUrl} default /></video><div class="spotlight-caption"><span>{String(playIndex + 1).padStart(2,'0')} / 06</span><b>{clipTitle(activeClip)}</b></div>
			{:else}<div class="poster"><span class="poster-star">✳</span><p>Six real moments.<br />One shared memory.</p><button onclick={playTrailer}>Play the trailer ↗</button></div>{/if}
		</div>
		<div class="clip-grid">{#each clips as clip}<article><span class="clip-no">{clip.prompt_slot.toUpperCase()}</span><h2>{clipTitle(clip)}</h2><p>with {data.members.find((member) => member.role === (clip.prompt_slot.startsWith('a') ? 'A' : 'B'))?.username}</p><video controls playsinline preload="metadata" src={clip.url}><track kind="captions" srclang="en" label="English" src={clip.captionUrl} default /></video><p class="caption-text">{clip.caption_text}</p></article>{/each}</div>
		<p class="footer-note">This link was approved by both people. It will stop working after 14 days or if either person revokes it.</p>
	{/if}
</section>

<style>
	.share-page { max-width:900px; margin:auto; padding:52px 0 75px; text-align:center; } .eyebrow { color:#367cb5; font-size:10px; text-transform:uppercase; letter-spacing:.14em; font-weight:800; } h1 { margin:11px 0; font:700 clamp(46px,8vw,76px)/.95 'Bricolage Grotesque',system-ui,sans-serif; letter-spacing:-.06em; } h1 em { color:#d61f68; font-style:normal; } .byline { margin:0 0 26px; color:#6f6762; font-size:13px; }
	.spotlight { overflow:hidden; max-width:720px; margin:0 auto 33px; border-radius:15px; background:#272526; box-shadow:0 18px 45px #27252622; } .spotlight video { width:100%; display:block; max-height:480px; background:#191818; } .spotlight-caption { display:flex; justify-content:space-between; padding:13px 17px; text-align:left; color:#f5f0e7; font-size:11px; } .spotlight-caption span { color:#e5deb7; font-size:9px; letter-spacing:.12em; } .poster { min-height:300px; display:grid; place-content:center; justify-items:center; gap:12px; color:white; background:radial-gradient(circle at 50% 15%,#9568d0,#272526 64%); } .poster-star { color:#ffd67a; font-size:28px; } .poster p { font:24px/1.25 'Bricolage Grotesque',system-ui,sans-serif; } .poster button { border:0; border-radius:999px; padding:13px 20px; color:white; background:#d61f68; font-weight:750; cursor:pointer; }
	.clip-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:13px; text-align:left; } .clip-grid article { padding:15px; border:1px solid #ded5c7; border-radius:12px; background:#fffaf2; } .clip-no { color:#d61f68; font:17px Georgia,serif; } .clip-grid h2 { margin:12px 0 5px; font:700 19px 'Bricolage Grotesque',system-ui,sans-serif; letter-spacing:-.035em; } .clip-grid p { color:#766e68; font-size:10px; } .clip-grid video { display:block; width:100%; max-height:180px; border-radius:7px; background:#272526; } .clip-grid .caption-text { line-height:1.5; } .footer-note { margin:25px 0 0; color:#79716b; font-size:10px; line-height:1.5; } .message { max-width:500px; margin:80px auto; padding:40px; border-radius:16px; border:1px solid #ded5c7; background:#fffaf2; } .message span { color:#ee710b; font-size:30px; } .message p { color:#68615d; line-height:1.6; } .message a { color:#d61f68; font-weight:750; text-decoration:none; }
	@media(max-width:720px){.clip-grid{grid-template-columns:repeat(2,1fr);}} @media(max-width:480px){.clip-grid{grid-template-columns:1fr;} .poster{min-height:245px;}}
</style>
