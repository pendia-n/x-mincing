CREATE TABLE IF NOT EXISTS song_rooms (
 id TEXT PRIMARY KEY,
 host_hash TEXT NOT NULL UNIQUE,
 invite_hash TEXT NOT NULL UNIQUE,
 occasion TEXT NOT NULL,
 recipient TEXT NOT NULL,
 mood TEXT NOT NULL,
 capacity INTEGER NOT NULL CHECK (capacity BETWEEN 2 AND 8),
 status TEXT NOT NULL DEFAULT 'collecting',
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS song_contributions (
 id TEXT PRIMARY KEY,
 room_id TEXT NOT NULL REFERENCES song_rooms(id) ON DELETE CASCADE,
 token_hash TEXT NOT NULL UNIQUE,
 name TEXT NOT NULL,
 contribution TEXT NOT NULL,
 created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS song_contributions_room ON song_contributions(room_id);
