<script>
	import { onMount } from 'svelte';
	let user = null; let loading = true; let message = '';
	onMount(async () => {
		try { const response = await fetch('/api/auth/me'); const data = await response.json(); user = data.user; if (!user) location.href = '/signin'; }
		catch { message = 'Could not load your profile.'; }
		finally { loading = false; }
	});
	async function signOut() { await fetch('/api/auth/logout', { method: 'POST' }); location.href = '/'; }
</script>
<svelte:head><title>Your profile · Our Trailer, Our Rules</title></svelte:head>
<section class="page"><p class="eyebrow">Your space</p><h1>Your profile.</h1>{#if loading}<p>Loading…</p>{:else if user}<div class="card"><span class="avatar">{user.username.slice(0,1).toUpperCase()}</span><div><span class="label">USERNAME</span><h2>{user.username}</h2><p>Account created {new Date(user.createdAt * 1000).toLocaleDateString()}</p></div></div><div class="links"><a href="/">Your trailers <span>↗</span></a><a href="/security">Password and security <span>↗</span></a></div><button class="signout" onclick={signOut}>Sign out</button>{:else}<p>{message || 'Taking you to sign in…'}</p>{/if}</section>
<style>
	.page { max-width: 760px; margin: auto; padding: 55px 0 80px; } .eyebrow,.label { color: #d61f68; font-size: 10px; font-weight: 800; letter-spacing: .13em; } h1 { font: 700 clamp(44px,7vw,65px) 'Bricolage Grotesque',system-ui,sans-serif; letter-spacing: -.06em; margin: 8px 0 30px; } .card { display:flex; align-items:center; gap:18px; padding:24px; background:#fffaf2; border:1px solid #e1d8ca; border-radius:15px; } .avatar { display:grid; place-items:center; width:58px; height:58px; border-radius:50%; color:white; background:#367cb5; font:700 23px 'Bricolage Grotesque',system-ui,sans-serif; } .card h2 { margin:5px 0; font:700 25px 'Bricolage Grotesque',system-ui,sans-serif; } .card p { margin:0; color:#766e68; font-size:12px; } .links { margin:18px 0; border-top:1px solid #dcd2c3; } .links a { display:flex; justify-content:space-between; padding:17px 3px; border-bottom:1px solid #dcd2c3; text-decoration:none; font-weight:700; font-size:13px; } .signout { margin-top:20px; border:1px solid #bdb2a5; background:transparent; border-radius:999px; padding:12px 20px; font-weight:700; }
</style>
