<script>
	import { onMount } from 'svelte';
	let username = '';
	let password = '';
	let message = '';
	let busy = false;
	let inviteToken = '';
	let recoveryCode = '';
	let joinedInvite = false;
	let joinedRoomId = '';
	onMount(() => { inviteToken = new URLSearchParams(location.search).get('invite') ?? ''; });
	$: passwordOkay = password.length >= 7 && password.length <= 18 && /[a-z]/i.test(password) && /[0-9]/.test(password);
	async function submit(event) {
		event.preventDefault(); busy = true; message = '';
		try {
			const response = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
			const data = await response.json();
			if (!response.ok) throw new Error(data.message ?? 'Could not create your account.');
			recoveryCode = data.recoveryCode;
			if (inviteToken) {
				const joined = await fetch('/api/rooms/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: inviteToken }) });
				joinedInvite = joined.ok;
				if (joined.ok) joinedRoomId = (await joined.json()).roomId;
				if (!joined.ok) message = (await joined.json()).message ?? 'Account made, but the invite could not be joined. You can use the link again after saving your recovery code.';
			}
		} catch (error) { message = error.message; }
		finally { busy = false; }
	}
	async function copyCode() {
		try { await navigator.clipboard.writeText(recoveryCode); message = 'Recovery code copied. Save it somewhere private.'; }
		catch { message = 'Write down this code and keep it somewhere private.'; }
	}
</script>

<svelte:head><title>Create account · Our Trailer, Our Rules</title></svelte:head>
<section class="auth-page">
	<a href="/" class="back">← Back home</a>
	<div class="auth-card">
		{#if !recoveryCode}
			<p class="eyebrow">Start with a username</p><h1>Make your<br /><em>little studio.</em></h1>
			<p class="intro">No email list, no public profile. Just your account and a person you want to make something with.</p>
			{#if message}<p class="feedback" role="alert">{message}</p>{/if}
			<form onsubmit={submit}>
				<label>Username<input bind:value={username} autocomplete="username" minlength="3" maxlength="20" pattern="[A-Za-z0-9_]{3,20}" required placeholder="yourname" /></label>
				<small>3–20 letters, numbers, or underscores. It’s case-insensitive.</small>
				<label>Password<input bind:value={password} type="password" autocomplete="new-password" minlength="7" maxlength="18" required placeholder="7–18 characters" /></label>
				<div class:good={passwordOkay} class="password-hint"><span>{password.length}/18</span><span>{passwordOkay ? 'Looks good' : 'Use a letter and a number'}</span></div>
				<button class="button primary" disabled={busy || !passwordOkay}>{busy ? 'Setting up…' : 'Create account'}</button>
			</form>
			<p class="switch">Already have an account? <a href="/signin">Sign in</a></p>
		{:else}
			<p class="eyebrow">One important thing</p><h1>Save your<br /><em>recovery code.</em></h1>
			<p class="intro">This is your only way to reset a forgotten password. We don’t collect an email address. Save it somewhere private now.</p>
			<div class="recovery-code" aria-label="Your one-time recovery code">{recoveryCode}</div>
			<button class="button dark" onclick={copyCode}>Copy recovery code</button>
			{#if message}<p class="feedback" role="status">{message}</p>{/if}
			<p class="recovery-note">It’s stored as a one-way hash, so we can’t show it again later.</p>
			<a class="button primary continue" href={joinedInvite ? '/room/' + joinedRoomId : '/'}>{joinedInvite ? 'Open your room' : 'Go to your studio'} ↗</a>
		{/if}
	</div>
</section>

<style>
	.auth-page { max-width: 620px; margin: 0 auto; padding: 30px 0 56px; } .back { display: inline-block; margin-bottom: 25px; color: #68615e; font-size: 13px; text-decoration: none; }
	.auth-card { padding: clamp(26px,6vw,54px); border: 1px solid #e3daca; background: #fffaf2; border-radius: 21px; box-shadow: 0 18px 50px #49351b0b; }
	.eyebrow { color: #d61f68; font-size: 11px; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; }
	h1 { margin: 0 0 17px; font: 700 clamp(42px, 7vw, 58px)/.95 'Bricolage Grotesque',system-ui,sans-serif; letter-spacing: -.06em; } h1 em { color: #d61f68; font-style: normal; }
	.intro { color: #69615d; font-size: 14px; line-height: 1.65; margin-bottom: 26px; }
	form { display: grid; gap: 11px; } label { display: grid; gap: 8px; font-size: 12px; font-weight: 750; }
	input { width: 100%; min-height: 48px; padding: 0 14px; border: 1px solid #d8cec0; border-radius: 9px; background: #fffdf9; color: #272526; } input:focus { border-color: #367cb5; }
	small { color: #79716c; font-size: 11px; margin: -4px 0 4px; }
	.password-hint { display: flex; justify-content: space-between; color: #8b817b; font-size: 11px; margin-bottom: 8px; } .password-hint.good { color: #34726b; }
	.button { width: 100%; min-height: 48px; display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: 999px; font-weight: 750; text-decoration: none; cursor: pointer; } .button.primary { background: #d61f68; color: white; } .button.dark { background: #272526; color: white; } .button:disabled { opacity: .5; cursor: wait; }
	.switch { color: #756d68; font-size: 12px; margin: 20px 0 0; text-align: center; } .switch a { color: #d61f68; font-weight: 750; }
	.feedback { padding: 11px 13px; border-radius: 9px; background: #f9e6e8; color: #8e2344; font-size: 12px; line-height: 1.5; }
	.recovery-code { margin: 22px 0 12px; padding: 18px 14px; border-radius: 12px; text-align: center; background: #e5deb7; color: #272526; font: 700 26px/1.2 ui-monospace, monospace; letter-spacing: .14em; overflow-wrap: anywhere; }
	.recovery-note { margin: 18px 0; color: #77706c; font-size: 11px; line-height: 1.5; } .continue { margin-top: 4px; }
</style>
