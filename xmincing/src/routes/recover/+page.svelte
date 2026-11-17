<script>
	let username = '';
	let recoveryCode = '';
	let newPassword = '';
	let message = '';
	let nextCode = '';
	let busy = false;
	async function submit(event) {
		event.preventDefault(); busy = true; message = '';
		try {
			const response = await fetch('/api/auth/recover', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, recoveryCode, newPassword }) });
			const data = await response.json();
			if (!response.ok) throw new Error(data.message ?? 'Could not reset the password.');
			nextCode = data.recoveryCode;
		} catch (error) { message = error.message; }
		finally { busy = false; }
	}
</script>
<svelte:head><title>Recover account · Our Trailer, Our Rules</title></svelte:head>
<section class="auth-page"><a href="/signin" class="back">← Back to sign in</a><div class="auth-card"><p class="eyebrow">Account recovery</p><h1>Use your<br /><em>recovery code.</em></h1><p class="intro">Your recovery code is the only way to reset your password. It is not sent by email.</p>{#if message}<p class="feedback" role="alert">{message}</p>{/if}{#if nextCode}<p class="intro">Password changed. Your old recovery code has been replaced; save this new one somewhere private.</p><div class="recovery-code">{nextCode}</div><a class="button primary" href="/signin">Continue to sign in ↗</a>{:else}<form onsubmit={submit}><label>Username<input bind:value={username} autocomplete="username" required /></label><label>Recovery code<input bind:value={recoveryCode} autocomplete="one-time-code" maxlength="8" required /></label><label>New password<input bind:value={newPassword} type="password" autocomplete="new-password" minlength="7" maxlength="18" required /></label><small>Use 7–18 characters with at least one letter and one number.</small><button class="button primary" disabled={busy}>{busy ? 'Updating…' : 'Reset password'}</button></form>{/if}</div></section>
<style>
	.auth-page { max-width: 620px; margin: 0 auto; padding: 30px 0 56px; } .back { display: inline-block; margin-bottom: 25px; color: #68615e; font-size: 13px; text-decoration: none; } .auth-card { padding: clamp(26px,6vw,54px); border: 1px solid #e3daca; background: #fffaf2; border-radius: 21px; } .eyebrow { color: #d61f68; font-size: 11px; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; } h1 { margin: 0 0 17px; font: 700 clamp(42px,7vw,58px)/.95 'Bricolage Grotesque',system-ui,sans-serif; letter-spacing: -.06em; } h1 em { color: #d61f68; font-style: normal; } .intro { color: #69615d; font-size: 14px; line-height: 1.65; margin-bottom: 26px; } form { display: grid; gap: 14px; } label { display: grid; gap: 8px; font-size: 12px; font-weight: 750; } input { width: 100%; min-height: 48px; padding: 0 14px; border: 1px solid #d8cec0; border-radius: 9px; background: #fffdf9; } small { color: #79716c; font-size: 11px; margin-top: -8px; } .button { width: 100%; min-height: 48px; display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: 999px; background: #d61f68; color: white; font-weight: 750; text-decoration: none; } .feedback { padding: 11px 13px; border-radius: 9px; background: #f9e6e8; color: #8e2344; font-size: 12px; } .recovery-code { margin: 15px 0 22px; padding: 18px 14px; border-radius: 12px; text-align: center; background: #e5deb7; font: 700 26px/1.2 ui-monospace,monospace; letter-spacing: .14em; overflow-wrap: anywhere; }
</style>
