PRAGMA foreign_keys = ON;

CREATE TABLE users (
	id TEXT PRIMARY KEY NOT NULL,
	username TEXT NOT NULL COLLATE NOCASE UNIQUE,
	password_hash TEXT NOT NULL,
	password_salt TEXT NOT NULL,
	password_iterations INTEGER NOT NULL,
	recovery_hash TEXT NOT NULL,
	recovery_salt TEXT NOT NULL,
	created_at INTEGER NOT NULL
);

CREATE TABLE sessions (
	id TEXT PRIMARY KEY NOT NULL,
	user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	expires_at INTEGER NOT NULL,
	created_at INTEGER NOT NULL,
	revoked_at INTEGER
);

CREATE INDEX sessions_user_id_idx ON sessions(user_id);

CREATE TABLE auth_limits (
	key_hash TEXT PRIMARY KEY NOT NULL,
	attempts INTEGER NOT NULL,
	window_started_at INTEGER NOT NULL,
	locked_until INTEGER
);

CREATE TABLE recovery_challenges (
	id TEXT PRIMARY KEY NOT NULL,
	user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
	expires_at INTEGER NOT NULL,
	attempts INTEGER NOT NULL DEFAULT 0,
	verified_at INTEGER
);

CREATE TABLE password_change_events (
	id TEXT PRIMARY KEY NOT NULL,
	user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	changed_at INTEGER NOT NULL
);

CREATE INDEX password_change_events_user_time_idx
	ON password_change_events(user_id, changed_at);

CREATE TABLE rooms (
	id TEXT PRIMARY KEY NOT NULL,
	owner_user_id TEXT NOT NULL REFERENCES users(id),
	status TEXT NOT NULL DEFAULT 'inviting'
		CHECK (status IN ('inviting', 'recording', 'ready', 'revealed', 'deleted')),
	prompt_pack_version TEXT NOT NULL DEFAULT 'v1',
	created_at INTEGER NOT NULL,
	expires_at INTEGER NOT NULL
);

CREATE INDEX rooms_owner_user_id_idx ON rooms(owner_user_id);

CREATE TABLE participants (
	id TEXT PRIMARY KEY NOT NULL,
	room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
	user_id TEXT NOT NULL REFERENCES users(id),
	role TEXT NOT NULL CHECK (role IN ('A', 'B')),
	recording_consent_at INTEGER,
	share_approved_at INTEGER,
	joined_at INTEGER NOT NULL,
	UNIQUE (room_id, user_id),
	UNIQUE (room_id, role)
);

CREATE INDEX participants_user_id_idx ON participants(user_id);

CREATE TABLE invitations (
	id TEXT PRIMARY KEY NOT NULL,
	room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
	token_hash TEXT NOT NULL UNIQUE,
	expires_at INTEGER NOT NULL,
	accepted_by TEXT REFERENCES users(id),
	used_at INTEGER,
	created_at INTEGER NOT NULL
);

CREATE TABLE clips (
	id TEXT PRIMARY KEY NOT NULL,
	room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
	participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
	prompt_slot TEXT NOT NULL,
	object_key TEXT NOT NULL UNIQUE,
	content_type TEXT NOT NULL,
	size_bytes INTEGER NOT NULL,
	duration_ms INTEGER NOT NULL,
	caption_text TEXT NOT NULL DEFAULT '',
	created_at INTEGER NOT NULL,
	UNIQUE (participant_id, prompt_slot)
);

CREATE INDEX clips_room_id_idx ON clips(room_id);

CREATE TABLE trailers (
	room_id TEXT PRIMARY KEY NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
	object_key TEXT NOT NULL UNIQUE,
	content_type TEXT NOT NULL,
	size_bytes INTEGER NOT NULL,
	created_at INTEGER NOT NULL
);

CREATE TABLE share_links (
	id TEXT PRIMARY KEY NOT NULL,
	room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
	token_hash TEXT NOT NULL UNIQUE,
	expires_at INTEGER NOT NULL,
	revoked_at INTEGER,
	created_at INTEGER NOT NULL
);

CREATE INDEX share_links_room_id_idx ON share_links(room_id);
