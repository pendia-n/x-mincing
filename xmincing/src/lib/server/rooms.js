import { error } from '@sveltejs/kit';
import { randomToken, sha256 } from './identity.js';

export const ROOM_LIFETIME = 30 * 24 * 60 * 60;
export const INVITE_LIFETIME = 7 * 24 * 60 * 60;

export async function getRoomAccess(db, roomId, userId) {
	const access = await db.prepare(
		`SELECT r.id, r.owner_user_id, r.status, r.created_at, r.expires_at,
		        p.id AS participant_id, p.role, p.share_approved_at
		 FROM rooms r JOIN participants p ON p.room_id = r.id
		 WHERE r.id = ? AND p.user_id = ? AND r.status != 'deleted' AND r.expires_at > ?`
	).bind(roomId, userId, Math.floor(Date.now() / 1000)).first();
	if (!access) error(404, 'This room was not found or has expired.');
	return access;
}

export async function acceptInvitation(db, token, userId) {
	const digest = await sha256(token);
	const now = Math.floor(Date.now() / 1000);
	const invitation = await db.prepare(
		`SELECT i.id AS invitation_id, i.room_id, r.owner_user_id, r.status
		 FROM invitations i JOIN rooms r ON r.id = i.room_id
		 WHERE i.token_hash = ? AND i.used_at IS NULL AND i.expires_at > ? AND r.expires_at > ?`
	).bind(digest, now, now).first();
	if (!invitation) error(400, 'This invite link has expired or was already used. Ask your partner for a fresh one.');
	if (invitation.owner_user_id === userId) error(400, 'Open the invite link from the other person’s account.');
	const count = await db.prepare('SELECT COUNT(*) AS count FROM participants WHERE room_id = ?').bind(invitation.room_id).first();
	if (count.count >= 2) error(409, 'This room already has two people.');
	const participantId = crypto.randomUUID();
	await db.batch([
		db.prepare('INSERT INTO participants (id, room_id, user_id, role, joined_at) VALUES (?, ?, ?, ?, ?)')
			.bind(participantId, invitation.room_id, userId, 'B', now),
		db.prepare('UPDATE invitations SET accepted_by = ?, used_at = ? WHERE id = ? AND used_at IS NULL')
			.bind(userId, now, invitation.invitation_id),
		db.prepare("UPDATE rooms SET status = 'recording' WHERE id = ? AND status = 'inviting'").bind(invitation.room_id)
	]);
	return invitation.room_id;
}

export async function makeInvitation(db, roomId) {
	const token = randomToken(32);
	const now = Math.floor(Date.now() / 1000);
	await db.prepare('INSERT INTO invitations (id, room_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)')
		.bind(crypto.randomUUID(), roomId, await sha256(token), now + INVITE_LIFETIME, now).run();
	return token;
}

export async function refreshRoomStatus(db, roomId) {
	const row = await db.prepare(
		`SELECT COUNT(*) AS clips,
		       COUNT(DISTINCT participant_id) AS participants
		 FROM clips WHERE room_id = ?`
	).bind(roomId).first();
	if (row.clips === 6 && row.participants === 2) {
		await db.prepare("UPDATE rooms SET status = 'ready' WHERE id = ? AND status IN ('recording', 'inviting')")
			.bind(roomId).run();
	} else {
		await db.prepare("UPDATE rooms SET status = 'recording' WHERE id = ? AND status = 'ready'").bind(roomId).run();
	}
}
