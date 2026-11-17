<script>
 let occasion = 'birthday'; let recipient = ''; let mood = 'heartfelt'; let capacity = 2; let busy = false; let message = ''; let hostUrl = ''; let inviteUrl = '';
 async function create() {
  busy = true; message = '';
  try {
   const response = await fetch('/api/songs', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({occasion,recipient,mood,capacity:Number(capacity)}) });
   const data = await response.json();
   if (!response.ok) throw new Error(data.message || 'Could not create the room.');
   hostUrl = data.hostUrl; inviteUrl = data.inviteUrl;
  } catch (error) { message = error.message; } finally { busy = false; }
 }
</script>
<svelte:head><title>Create a song | xmincing</title></svelte:head>
<section><p class="label">MAKE IT TOGETHER</p><h1>Start your song.</h1>
{#if hostUrl}<p>Save your private host link. Share the invitation with your group.</p><label>Host link<input readonly value={hostUrl} /></label><label>Invitation link<input readonly value={inviteUrl} /></label><a class="button" href={hostUrl}>Open your room</a>
{:else}<form onsubmit={(event) => { event.preventDefault(); create(); }}><label>Occasion<select bind:value={occasion}><option value="birthday">Birthday</option><option value="farewell">Farewell</option></select></label><label>Who is it for?<input bind:value={recipient} maxlength="80" required /></label><label>Mood<select bind:value={mood}><option value="heartfelt">Heartfelt</option><option value="funny">Funny</option></select></label><label>People, including you<select bind:value={capacity}>{#each [2,3,4,5,6,7,8] as count}<option value={count}>{count}</option>{/each}</select></label><button class="button" disabled={busy}>{busy ? 'Creating…' : 'Create room'}</button></form>{/if}{#if message}<p role="alert">{message}</p>{/if}</section>
<style>section{max-width:620px;margin:60px auto}h1{font-size:3rem;letter-spacing:-.05em}.label{font-size:.75rem;color:#d52b62;letter-spacing:.15em;font-weight:800}form,label{display:grid;gap:10px}form{gap:20px}input,select{width:100%;padding:14px;border:1px solid #d2c8bb;border-radius:8px;background:white;font:inherit}label{margin-bottom:18px;font-weight:700}.button{display:inline-block;border:0;border-radius:99px;padding:15px 22px;background:#252124;color:white;text-decoration:none;font:inherit;cursor:pointer}</style>
