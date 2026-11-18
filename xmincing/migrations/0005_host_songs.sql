ALTER TABLE song_rooms ADD COLUMN host_variations TEXT;
ALTER TABLE song_rooms ADD COLUMN host_answers TEXT;
ALTER TABLE song_rooms ADD COLUMN paid_at INTEGER;
ALTER TABLE song_rooms ADD COLUMN submitted_at INTEGER;
ALTER TABLE song_rooms ADD COLUMN ready_at INTEGER;
ALTER TABLE song_rooms ADD COLUMN lyric_credits TEXT;
ALTER TABLE song_rooms ADD COLUMN recovery_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE song_rooms ADD COLUMN recovery_reset_at INTEGER NOT NULL DEFAULT 0;
