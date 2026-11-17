<script>
	import { onMount, tick } from 'svelte';
	let data = null;
	let message = '';
	let busy = false;
	let inviteUrl = '';
	let shareUrl = '';
	let consentAccepted = false;
	let uploadingSlot = '';
	let captions = {};
	let playIndex = -1;
	let videoEl;
	let roomId = '';
	$: orderedClips = data?.clips ? [...data.clips].sort((a, b) => a.prompt_slot.localeCompare(b.prompt_slot)) : [];
	$: currentVideo = playIndex >= 0 ? orderedClips[playIndex] : null;
	onMount(async () => {
		roomId = location.pathname.split('/').filter(Boolean).at(-1);
		const me = await fetch('/api/auth/me').then((response) => response.json());
		if (!me.user) { location.replace('/signin?next=' + encodeURIComponent(location.pathname)); return; }
		inviteUrl = sessionStorage.getItem(`xmincing-invite-${roomId}`) ?? '';
		await loadRoom();
	});
	async function loadRoom() {
		try {
			const response = await fetch(`/api/rooms/${roomId}`);
			const result = await response.json();
			if (!response.ok) throw new Error(result.message ?? 'Could not open this room.');
			data = result;
			const nextCaptions = { ...captions };
			for (const clip of result.clips) if (clip.isMine) nextCaptions[clip.prompt_slot] = clip.caption_text;
			captions = nextCaptions;
		} catch (error) { message = error.message; }
	}
	async function makeInvite() {
		busy = true; message = '';
		try {
			const response = await fetch(`/api/rooms/${roomId}/invitation`, { method: 'POST' });
			const result = await response.json(); if (!response.ok) throw new Error(result.message ?? 'Could not make a new invite.');
			inviteUrl = result.inviteUrl; sessionStorage.setItem(`xmincing-invite-${roomId}`, inviteUrl);
		} catch (error) { message = error.message; } finally { busy = false; }
	}
	async function copy(value, label) {
		try { await navigator.clipboard.writeText(value); message = `${label} copied.`; }
		catch { message = 'Copy the link from its field below.'; }
	}
	function durationMs(file) {
		return new Promise((resolve, reject) => {
			const video = document.createElement('video'); const url = URL.createObjectURL(file); video.preload = 'metadata';
			video.onloadedmetadata = () => { const ms = Math.round(video.duration * 1000); URL.revokeObjectURL(url); resolve(ms); };
			video.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This video could not be read. Try another file.')); };
			video.src = url;
		});
	}
	async function upload(event, prompt) {
		const file = event.currentTarget.files?.[0]; if (!file) return;
		if (!consentAccepted) { message = 'Please confirm you made this clip and agree to private storage first.'; event.currentTarget.value = ''; return; }
		if (!captions[prompt.slot]?.trim()) { message = 'Add captions or a short description of the sound first.'; event.currentTarget.value = ''; return; }
		if (!data?.storageReady) { message = 'Private video storage is not connected.'; return; }
		uploadingSlot = prompt.slot; message = '';
		try {
			const duration = await durationMs(file);
			if (duration < 500 || duration > 20_000) throw new Error('Keep each clip between half a second and 20 seconds.');
			if (file.size > 30 * 1024 * 1024) throw new Error('Each clip must be smaller than 30 MB.');
			const response = await fetch(`/api/rooms/${roomId}/clips/${prompt.slot}`, { method: 'POST', headers: { 'Content-Type': file.type, 'X-Clip-Duration-Ms': String(duration), 'X-Clip-Consent': 'yes', 'X-Clip-Caption': encodeCaption(captions[prompt.slot]) }, body: file });
			const result = await response.json(); if (!response.ok) throw new Error(result.message ?? 'Could not upload this clip.');
			consentAccepted = false; await loadRoom(); message = 'Clip saved privately.';
		} catch (error) { message = error.message; }
		finally { uploadingSlot = ''; event.currentTarget.value = ''; }
	}
	async function reveal() {
		busy = true; message = '';
		try { const response = await fetch(`/api/rooms/${roomId}/reveal`, { method: 'POST' }); const result = await response.json(); if (!response.ok) throw new Error(result.message ?? 'Could not reveal.'); await loadRoom(); }
		catch (error) { message = error.message; } finally { busy = false; }
	}
	async function share(action) {
		busy = true; message = ''; shareUrl = '';
		try { const response = await fetch(`/api/rooms/${roomId}/share-approval`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) }); const result = await response.json(); if (!response.ok) throw new Error(result.message ?? 'Could not update sharing.'); shareUrl = result.shareUrl ?? ''; await loadRoom(); message = action === 'revoke' ? 'Your sharing approval was removed. The old link is now disabled.' : result.bothApproved ? 'You both agreed. The link is live for 14 days.' : 'Your approval is saved. The link stays private until your partner agrees.'; }
		catch (error) { message = error.message; } finally { busy = false; }
	}
	async function startTrailer() { if (!orderedClips.length) return; playIndex = 0; await tick(); try { await videoEl?.play(); } catch { message = 'Press play to start your trailer.'; } }
	async function nextClip() { if (playIndex + 1 < orderedClips.length) { playIndex += 1; await tick(); videoEl?.play(); } else { playIndex = -1; } }
	function promptTitle(slot) { return [...(data?.prompts ?? []), ...(data?.otherPrompts ?? [])].find((prompt) => prompt.slot === slot)?.title ?? slot.toUpperCase(); }
	function encodeCaption(value) { const bytes = new TextEncoder().encode(value.trim()); let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,''); }
	async function closeRoom() { if (!confirm('Close this room and permanently delete its clips?')) return; const response = await fetch(`/api/rooms/${roomId}`, { method: 'DELETE' }); if (response.ok) location.href = '/'; else message = 'Could not close this room.'; }
</script>

<svelte:head><title>Your room · Our Trailer, Our Rules</title><meta name="robots" content="noindex" /></svelte:head>
<section class="room-page">
	<a class="back" href="/">← Your trailers</a>
	{#if message}<p class="notice" role="status">{message}</p>{/if}
	{#if !data}<div class="loading">Opening your room…</div>{:else}
		<header class="room-head"><div><p class="eyebrow">A private room for two</p><h1>{data.partner ? 'You + ' + data.partner.username : 'Your story starts here.'}</h1><p>Room expires {new Date(data.room.expiresAt * 1000).toLocaleDateString()} · {data.clips.length} clips saved</p></div><span class="room-seal">✳<small>{data.room.status === 'revealed' ? 'REVEALED' : data.room.status === 'ready' ? 'READY' : data.partner ? 'IN THE MAKING' : 'INVITING'}</small></span></header>
		{#if !data.partner && data.self.role === 'A'}
			<div class="invite-card"><div><p class="eyebrow">One person only</p><h2>Invite your co-director.</h2><p>This private link works once and expires in 7 days.</p></div>{#if inviteUrl}<div class="link-row"><input readonly aria-label="Room invite link" value={inviteUrl} /><button onclick={() => copy(inviteUrl, 'Invite')}>Copy invite</button></div>{:else}<button class="dark-button" onclick={makeInvite} disabled={busy}>{busy ? 'Making link…' : 'Make a new invite link'}</button>{/if}</div>
		{:else if data.partner && data.room.status === 'inviting'}<p class="notice">Your partner joined. Refresh this room to see them.</p>{/if}
		{#if data.room.status !== 'revealed'}
			<div class="recording-intro"><div><p class="eyebrow">Your side of the story</p><h2>Three prompts.<br /><em>Three short clips.</em></h2></div><p>Your prompts are just for you until the reveal. Use your camera or choose a saved video. Your partner’s recordings remain hidden.</p></div>
			{#if !data.storageReady}<p class="warning">Private video storage is still being connected. You can look around, but uploads will work after deployment setup finishes.</p>{/if}
			<label class="consent"><input type="checkbox" bind:checked={consentAccepted} /><span>I made the clip (or have permission to share it) and agree it will be stored privately for up to 30 days.</span></label>
			<div class="prompt-grid">{#each data.prompts as prompt}<article class="prompt"><div class="prompt-top"><span class="prompt-num">{prompt.slot.toUpperCase()}</span><span>{prompt.title}</span></div><h3>{prompt.prompt}</h3>{#if data.clips.find((clip) => clip.prompt_slot === prompt.slot)}<div class="saved"><span>✓ Saved privately</span><video controls playsinline preload="metadata" src={data.clips.find((clip) => clip.prompt_slot === prompt.slot).url}><track kind="captions" srclang="en" label="English" src={data.clips.find((clip) => clip.prompt_slot === prompt.slot).captionUrl} default /></video><label class="caption-field">Captions or sound description<input bind:value={captions[prompt.slot]} maxlength="500" /></label><label class="upload-button">Replace clip<input type="file" accept="video/mp4,video/webm,video/quicktime" capture="user" disabled={!data.storageReady || uploadingSlot !== ''} onchange={(event) => upload(event, prompt)} /></label><small>Saved clips can be replaced until the reveal.</small></div>{:else}<label class="caption-field">Captions or sound description<input bind:value={captions[prompt.slot]} maxlength="500" placeholder="What’s said or heard?" /></label><label class="upload-button">{uploadingSlot === prompt.slot ? 'Uploading…' : 'Record or choose video'}<input type="file" accept="video/mp4,video/webm,video/quicktime" capture="user" disabled={!data.storageReady || uploadingSlot !== '' || !captions[prompt.slot]?.trim()} onchange={(event) => upload(event, prompt)} /></label><small>Up to 20 sec · 30 MB · video stays private</small>{/if}</article>{/each}</div>
			<div class="progress-row"><span>{data.clips.length} of 6 clips recorded</span><div class="progress"><i style={`width:${(data.clips.length / 6) * 100}%`}></i></div></div>
			{#if data.room.status === 'ready'}<div class="reveal-cta"><p>All six moments are in. The prompts and clips will become visible to both of you.</p><button class="primary-button" onclick={reveal} disabled={busy}>{busy ? 'Opening…' : 'Reveal our trailer ✳'}</button></div>{/if}
		{:else}
			<section class="reveal-panel"><div class="reveal-heading"><p class="eyebrow">Your private premiere</p><h2>Here’s what you made<br /><em>together.</em></h2><p>Six real moments. Your little trailer. Only the two of you can see it until you both choose to share.</p></div><div class="prompt-reveal"><h3>Two prompt sets, now revealed</h3><div>{#each data.prompts as prompt}<article><span>YOU · {prompt.slot.toUpperCase()}</span><b>{prompt.title}</b><p>{prompt.prompt}</p></article>{/each}{#each data.otherPrompts as prompt}<article><span>{data.partner?.username.toUpperCase()} · {prompt.slot.toUpperCase()}</span><b>{prompt.title}</b><p>{prompt.prompt}</p></article>{/each}</div></div>{#if orderedClips.length}<div class="player"><div class="player-top"><span>OUR TRAILER · {String(Math.max(playIndex + 1,1)).padStart(2,'0')} / 06</span><span>PRIVATE PREMIERE</span></div>{#if currentVideo}<video bind:this={videoEl} controls playsinline preload="metadata" src={currentVideo.url} onended={nextClip}><track kind="captions" srclang="en" label="English" src={currentVideo.captionUrl} default /></video><p class="clip-caption">{promptTitle(currentVideo.prompt_slot)} · {data.clips.find((clip) => clip.id === currentVideo.id)?.isMine ? 'your camera' : data.partner?.username + '’s camera'}</p>{:else}<div class="player-idle"><span>✳</span><p>Six everyday moments, one shared memory.</p><button class="primary-button" onclick={startTrailer}>Play your trailer ↗</button></div>{/if}</div>{/if}</section>
			<div class="share-card"><div><p class="eyebrow">Sharing is a joint choice</p><h2>Want to share the trailer?</h2><p>You: {data.self.shareApproved ? 'approved' : 'not yet'} · {data.partner?.username}: {data.partner?.shareApproved ? 'approved' : 'not yet'}</p><small>Both people must approve. The link expires in 14 days; either person can revoke it.</small></div><div class="share-actions"><button class="dark-button" onclick={() => share('approve')} disabled={busy}>{data.self.shareApproved && data.partner?.shareApproved ? 'Create a fresh link' : 'Approve sharing'}</button>{#if data.self.shareApproved}<button class="plain-button" onclick={() => share('revoke')} disabled={busy}>Revoke my approval</button>{/if}{#if shareUrl}<div class="link-row"><input readonly aria-label="Public trailer link" value={shareUrl} /><button onclick={() => copy(shareUrl, 'Share link')}>Copy</button></div>{/if}</div></div>
		{/if}
		{#if data.self.role === 'A'}<button class="close-room" onclick={closeRoom}>Permanently delete this room and its clips</button>{/if}
	{/if}
</section>

<style>
	.room-page { max-width:960px; margin:auto; padding:30px 0 72px; } .back { display:inline-block; margin-bottom:25px; font-size:12px; text-decoration:none; color:#706864; } .notice,.warning { margin:0 0 18px; padding:12px 15px; border-radius:9px; font-size:12px; line-height:1.5; } .notice { color:#285b59; background:#e5f0ec; border:1px solid #b7d2c8; } .warning { color:#8b5a13; background:#fff1cf; } .loading { padding:45px 0; color:#756d68; }
	.room-head { display:flex; justify-content:space-between; align-items:center; gap:20px; padding:25px 0 30px; border-bottom:1px solid #dbd2c5; } .eyebrow { color:#d61f68; font-size:10px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; margin:0 0 10px; } h1,h2,h3 { font-family:'Bricolage Grotesque',system-ui,sans-serif; letter-spacing:-.045em; } .room-head h1 { font-size:clamp(37px,6vw,58px); line-height:1; margin:0 0 9px; } .room-head p:not(.eyebrow) { color:#766e68; font-size:12px; margin:0; } .room-seal { flex:none; display:grid; place-content:center; width:86px; height:86px; border-radius:50%; text-align:center; background:#367cb5; color:#fff; font-size:24px; transform:rotate(7deg); } .room-seal small { font-size:8px; font-weight:800; letter-spacing:.08em; }
	.invite-card { display:flex; justify-content:space-between; align-items:center; gap:22px; padding:22px 24px; margin:24px 0; border-radius:14px; background:#e5deb7; } .invite-card h2 { margin:0 0 5px; font-size:25px; } .invite-card p:not(.eyebrow) { margin:0; color:#665f58; font-size:12px; } .link-row { display:flex; gap:8px; width:min(440px,100%); } .link-row input { min-width:0; flex:1; border:1px solid #c9be9b; border-radius:8px; background:#fffaf2; padding:0 10px; font-size:10px; } .link-row button,.dark-button,.primary-button,.plain-button { border:0; border-radius:999px; padding:12px 16px; font-weight:750; font-size:11px; cursor:pointer; white-space:nowrap; } .link-row button,.dark-button { color:white; background:#272526; } .dark-button:disabled,.primary-button:disabled { opacity:.5; cursor:wait; }
	.recording-intro { display:grid; grid-template-columns:1fr .8fr; align-items:end; gap:25px; margin:38px 0 22px; } .recording-intro h2,.reveal-heading h2 { font-size:clamp(32px,5vw,46px); line-height:.98; margin:0; } .recording-intro h2 em,.reveal-heading h2 em { color:#d61f68; font-style:normal; } .recording-intro > p,.reveal-heading > p:last-child { color:#6c645f; font-size:13px; line-height:1.65; margin:0; }
	.consent { display:flex; align-items:flex-start; gap:10px; margin:20px 0 13px; max-width:720px; color:#68615d; font-size:11px; line-height:1.5; } .consent input { width:17px; height:17px; flex:none; accent-color:#d61f68; }
	.prompt-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:13px; } .prompt { min-width:0; display:flex; flex-direction:column; padding:18px; border-radius:13px; border:1px solid #ded5c7; background:#fffaf2; } .prompt-top { display:flex; justify-content:space-between; gap:10px; align-items:center; color:#367cb5; font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:.08em; } .prompt-num { color:#d61f68; font:18px Georgia,serif; } .prompt h3 { min-height:86px; margin:20px 0; font-size:19px; line-height:1.22; } .caption-field { display:grid; gap:6px; margin:0 0 10px; color:#6c645f; font-size:10px; font-weight:700; } .caption-field input { width:100%; min-height:38px; padding:0 10px; border:1px solid #d8cec0; border-radius:7px; background:#fffdf9; font-size:11px; } .upload-button { display:grid; place-items:center; min-height:43px; margin-top:auto; border-radius:999px; color:white; background:#272526; font-size:11px; font-weight:750; cursor:pointer; text-align:center; padding:8px 11px; } .upload-button input { position:absolute; width:1px; height:1px; opacity:0; } .upload-button:has(input:disabled) { opacity:.5; cursor:not-allowed; } .prompt > small { margin-top:9px; color:#817873; font-size:9px; } .saved { margin-top:auto; } .saved > span { display:block; margin-bottom:8px; color:#34726b; font-size:10px; font-weight:750; } .saved video { width:100%; max-height:160px; background:#272526; border-radius:8px; }
	.progress-row { display:flex; align-items:center; gap:15px; margin:21px 0; color:#756d68; font-size:11px; } .progress { flex:1; height:6px; overflow:hidden; border-radius:99px; background:#e4dbce; } .progress i { display:block; height:100%; background:#d61f68; transition:width .3s ease; } .reveal-cta { display:flex; align-items:center; justify-content:space-between; gap:20px; padding:18px 21px; border-radius:12px; background:#e5deb7; } .reveal-cta p { margin:0; color:#5e5751; font-size:12px; } .primary-button { color:white; background:#d61f68; font-size:12px; }
	.reveal-panel { padding:45px 0 26px; } .reveal-heading { text-align:center; max-width:620px; margin:0 auto 27px; } .reveal-heading .eyebrow { margin-bottom:11px; } .reveal-heading h2 { margin:0 0 12px; } .prompt-reveal { max-width:820px; margin:0 auto 25px; } .prompt-reveal > h3 { margin:0 0 10px; font-size:15px; text-align:center; } .prompt-reveal > div { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; } .prompt-reveal article { padding:12px; border:1px solid #ded5c7; border-radius:9px; background:#fffaf2; } .prompt-reveal article span { color:#367cb5; font-size:8px; font-weight:800; letter-spacing:.08em; } .prompt-reveal article b { display:block; margin:6px 0 4px; font:700 14px 'Bricolage Grotesque',system-ui,sans-serif; } .prompt-reveal article p { margin:0; color:#766e68; font-size:9px; line-height:1.45; } .player { max-width:690px; margin:auto; overflow:hidden; border-radius:14px; background:#272526; color:white; box-shadow:0 15px 40px #27252624; } .player-top { display:flex; justify-content:space-between; padding:13px 16px; color:#e5deb7; font-size:9px; font-weight:800; letter-spacing:.11em; } .player video { width:100%; max-height:440px; display:block; background:#1d1b1b; } .clip-caption { margin:0; padding:10px 15px; color:#d0c7be; font-size:10px; } .player-idle { min-height:220px; display:grid; place-items:center; align-content:center; gap:10px; text-align:center; background:radial-gradient(circle at 50% 10%,#9568d0,#272526 55%); } .player-idle span { color:#ffd67a; font-size:28px; } .player-idle p { margin:0 0 7px; font:20px 'Bricolage Grotesque',system-ui,sans-serif; }
	.share-card { display:grid; grid-template-columns:1fr auto; gap:25px; align-items:center; padding:22px; border:1px solid #ded5c7; border-radius:14px; background:#fffaf2; } .share-card h2 { margin:0 0 9px; font-size:23px; } .share-card p { margin:0 0 4px; color:#5e5853; font-size:12px; } .share-card small { color:#817873; font-size:10px; line-height:1.5; } .share-actions { min-width:250px; display:grid; justify-items:start; gap:9px; } .plain-button { background:transparent; border:1px solid #bdb2a5; color:#5f5651; } .share-actions .link-row { grid-column:1/-1; } .close-room { display:block; margin:32px 0 0 auto; border:0; background:transparent; color:#8e4a53; text-decoration:underline; text-underline-offset:3px; font-size:10px; cursor:pointer; }
	@media(max-width:760px){ .prompt-grid{grid-template-columns:1fr;} .prompt-reveal > div{grid-template-columns:repeat(2,1fr);} .prompt h3{min-height:0;margin:16px 0;} .recording-intro{grid-template-columns:1fr;gap:13px;} .invite-card,.share-card{grid-template-columns:1fr;display:grid;} .link-row{width:100%;} .share-actions{min-width:0;} .reveal-cta{align-items:flex-start;flex-direction:column;} }
	@media(prefers-reduced-motion:reduce){.progress i{transition:none;}}
</style>
