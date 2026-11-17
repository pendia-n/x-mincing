<script>
	import { onMount } from 'svelte';
	let currentPassword = ''; let newPassword = ''; let busy = false; let message = ''; let user = null; let deletePassword = ''; let deleting = false;
	onMount(async () => { const response = await fetch('/api/auth/me'); const data = await response.json(); user = data.user; if (!user) location.href = '/signin'; });
	async function changePassword(event) {
		event.preventDefault(); busy = true; message = '';
		try {
			const response = await fetch('/api/auth/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword, newPassword }) });
			const data = await response.json(); if (!response.ok) throw new Error(data.message ?? 'Could not update your password.');
			message = data.note ?? 'Password updated.'; currentPassword = ''; newPassword = '';
		} catch (error) { message = error.message; } finally { busy = false; }
	}
	async function deleteAccount() {
		if (!confirm('Permanently delete your account, every room you belong to, and all clips in those rooms? This also removes your partner’s copy of each shared room.')) return;
		deleting = true; message = '';
		try {
			const response = await fetch('/api/auth/delete-account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: deletePassword }) });
			const data = await response.json(); if (!response.ok) throw new Error(data.message ?? 'Could not delete your account.');
			location.href = '/';
		} catch (error) { message = error.message; } finally { deleting = false; }
	}
</script>
<svelte:head><title>Security · Our Trailer, Our Rules</title></svelte:head>
<section class="page"><p class="eyebrow">Account controls</p><h1>Keep your space<br /><em>yours.</em></h1><div class="security-card"><h2>Change password</h2><p>Choose 7–18 characters with at least one letter and one number. Other signed-in sessions close after a successful change.</p><form onsubmit={changePassword}><label>Current password<input bind:value={currentPassword} type="password" autocomplete="current-password" required /></label><label>New password<input bind:value={newPassword} type="password" autocomplete="new-password" minlength="7" maxlength="18" required /></label><button disabled={busy}>{busy ? 'Saving…' : 'Update password'}</button></form>{#if message}<p class="feedback" role="status">{message}</p>{/if}</div><div class="security-card"><h2>Recovery</h2><p>Your one-time recovery code is shown only when you create an account or reset your password. We store a one-way PBKDF2 hash, so support cannot retrieve it.</p><a href="/recover">Reset with recovery code ↗</a></div><div class="security-card"><h2>Your session</h2><p>Sign-in lasts up to 65 days in a secure, HttpOnly cookie. You can sign out from your profile at any time.</p></div><div class="security-card danger"><h2>Delete your account</h2><p>Deletion permanently removes your account, every room you belong to, and all clips and share links in those rooms. Your partner’s copy of a shared room is removed too.</p><form onsubmit={(event) => { event.preventDefault(); deleteAccount(); }}><label>Confirm with your password<input bind:value={deletePassword} type="password" autocomplete="current-password" required /></label><button class="delete-button" disabled={deleting}>{deleting ? 'Deleting…' : 'Permanently delete account'}</button></form></div></section>
<style>
	.page { max-width:760px; margin:auto; padding:55px 0 80px; } .eyebrow { color:#d61f68; font-size:10px; font-weight:800; letter-spacing:.13em; } h1 { font:700 clamp(42px,7vw,65px)/.98 'Bricolage Grotesque',system-ui,sans-serif; letter-spacing:-.06em; margin:8px 0 30px; } h1 em { color:#d61f68; font-style:normal; } .security-card { margin:14px 0; padding:23px; border:1px solid #e1d8ca; border-radius:14px; background:#fffaf2; } .danger { border-color:#ddb4b7; } .danger h2 { color:#8e3b49; } h2 { margin:0 0 8px; font:700 22px 'Bricolage Grotesque',system-ui,sans-serif; } .security-card p { color:#706965; font-size:12px; line-height:1.65; } .security-card a { font-size:12px; font-weight:700; color:#d61f68; } form { display:grid; gap:12px; } label { display:grid; gap:7px; font-size:12px; font-weight:700; } input { min-height:45px; border:1px solid #d8cec0; border-radius:8px; padding:0 12px; background:#fffdf9; } button { width:max-content; border:0; border-radius:999px; background:#272526; color:white; padding:13px 18px; font-weight:700; } .delete-button { background:#8d3745; } button:disabled { opacity:.5; } .feedback { margin:12px 0 0; color:#34726b!important; }
</style>
