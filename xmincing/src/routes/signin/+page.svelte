<script>
	let username = '';
	let password = '';
	let message = '';
	let busy = false;
	function safeNext() { const next = new URLSearchParams(location.search).get('next') ?? '/'; return next.startsWith('/') && !next.startsWith('//') ? next : '/'; }
	async function submit(event) {
		event.preventDefault(); busy = true; message = '';
		try {
			const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
			const data = await response.json();
			if (!response.ok) throw new Error(data.message ?? 'Could not sign in.');
			location.href = safeNext();
		} catch (error) { message = error.message; }
		finally { busy = false; }
	}
</script>
<svelte:head><title>Sign in · Our Trailer, Our Rules</title></svelte:head>
<section class="auth-page"><a href="/" class="back">← Back home</a><div class="auth-card"><p class="eyebrow">Welcome back</p><h1>Back to<br /><em>your studio.</em></h1><p class="intro">Pick up where your shared story left off.</p>{#if message}<p class="feedback" role="alert">{message}</p>{/if}<form onsubmit={submit}><label>Username<input bind:value={username} autocomplete="username" required /></label><label>Password<input bind:value={password} type="password" autocomplete="current-password" required /></label><button class="button primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button></form><p class="switch"><a href="/recover">Forgot your password?</a></p><p class="switch">New around here? <a href="/signup">Create an account</a></p></div></section>
<style>
	.auth-page { max-width: 620px; margin: 0 auto; padding: 30px 0 56px; } .back { display: inline-block; margin-bottom: 25px; color: #68615e; font-size: 13px; text-decoration: none; } .auth-card { padding: clamp(26px,6vw,54px); border: 1px solid #e3daca; background: #fffaf2; border-radius: 21px; box-shadow: 0 18px 50px #49351b0b; } .eyebrow { color: #d61f68; font-size: 11px; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; } h1 { margin: 0 0 17px; font: 700 clamp(42px,7vw,58px)/.95 'Bricolage Grotesque',system-ui,sans-serif; letter-spacing: -.06em; } h1 em { color: #d61f68; font-style: normal; } .intro { color: #69615d; font-size: 14px; line-height: 1.65; margin-bottom: 26px; } form { display: grid; gap: 16px; } label { display: grid; gap: 8px; font-size: 12px; font-weight: 750; } input { width: 100%; min-height: 48px; padding: 0 14px; border: 1px solid #d8cec0; border-radius: 9px; background: #fffdf9; color: #272526; } .button { width: 100%; min-height: 48px; border: 0; border-radius: 999px; background: #d61f68; color: white; font-weight: 750; cursor: pointer; } .button:disabled { opacity: .5; } .switch { color: #756d68; font-size: 12px; margin: 18px 0 0; text-align: center; } .switch a { color: #d61f68; font-weight: 750; } .feedback { padding: 11px 13px; border-radius: 9px; background: #f9e6e8; color: #8e2344; font-size: 12px; }
</style>
