<script>
	import { onMount } from 'svelte';
	let message = 'Checking this invite…';
	let authenticated = false;
	let busy = true;
	let token = '';
	onMount(async () => {
		token = location.pathname.split('/').filter(Boolean).at(-1);
		try {
			const me = await fetch('/api/auth/me').then((response) => response.json());
			authenticated = Boolean(me.user);
			if (!authenticated) { message = 'Sign in or make an account to join this private room.'; busy = false; return; }
			const response = await fetch('/api/rooms/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
			const data = await response.json();
			if (!response.ok) throw new Error(data.message ?? 'Could not use this invite.');
			location.replace(`/room/${data.roomId}`);
		} catch (error) { message = error.message; busy = false; }
	});
</script>
<svelte:head><title>Join a private room · Our Trailer, Our Rules</title><meta name="robots" content="noindex" /></svelte:head>
<section class="invite-page"><div class="invite-card"><span class="spark">✳</span><p class="eyebrow">You’re invited</p><h1>A little story<br /><em>for two.</em></h1><p class="copy">{message}</p>{#if busy}<div class="loader" aria-label="Loading"></div>{:else if !authenticated}<div class="actions"><a class="button primary" href={'/signup?invite=' + encodeURIComponent(token)}>Create an account</a><a class="button secondary" href={'/signin?next=' + encodeURIComponent('/join/' + token)}>Sign in</a></div>{:else}<a class="button secondary" href="/">Back to your studio</a>{/if}</div></section>
<style>
	.invite-page { min-height:55vh; display:grid; place-items:center; padding:35px 0 65px; } .invite-card { width:min(520px,100%); text-align:center; padding:clamp(27px,6vw,48px); background:#fffaf2; border:1px solid #e1d8ca; border-radius:20px; } .spark { display:block; color:#ee710b; font-size:28px; margin-bottom:12px; } .eyebrow { color:#d61f68; text-transform:uppercase; letter-spacing:.13em; font-size:10px; font-weight:800; } h1 { font:700 clamp(42px,7vw,58px)/.95 'Bricolage Grotesque',system-ui,sans-serif; letter-spacing:-.06em; margin:0 0 15px; } h1 em { color:#d61f68; font-style:normal; } .copy { color:#6c645f; font-size:14px; line-height:1.6; } .actions { display:grid; gap:10px; margin-top:24px; } .button { display:inline-flex; justify-content:center; align-items:center; min-height:47px; border-radius:999px; font-weight:750; text-decoration:none; } .primary { color:white; background:#d61f68; } .secondary { color:#272526; border:1px solid #bdb3a5; background:transparent; padding:0 20px; } .loader { width:28px; height:28px; margin:24px auto 0; border:3px solid #e5deb7; border-top-color:#d61f68; border-radius:50%; animation:turn .8s linear infinite; } @keyframes turn { to { transform:rotate(360deg); } } @media(prefers-reduced-motion:reduce){.loader{animation:none}}
</style>
