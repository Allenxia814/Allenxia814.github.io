CREATE TABLE IF NOT EXISTS music_sessions (hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS music_albums (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, artist TEXT NOT NULL, released TEXT NOT NULL,
 cover TEXT, cover_checked INTEGER NOT NULL DEFAULT 0, discovered INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS music_release_date ON music_albums(released);
CREATE TABLE IF NOT EXISTS music_genres (album_id TEXT NOT NULL REFERENCES music_albums(id), genre TEXT NOT NULL, PRIMARY KEY(album_id, genre));
CREATE INDEX IF NOT EXISTS music_genre_name ON music_genres(genre, album_id);
CREATE TABLE IF NOT EXISTS music_history (
 album_id TEXT PRIMARY KEY REFERENCES music_albums(id), user_id TEXT NOT NULL,
 recommended INTEGER NOT NULL, mode TEXT NOT NULL, genre TEXT NOT NULL, request_id TEXT NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS music_history_time ON music_history(recommended);
CREATE TABLE IF NOT EXISTS music_sync (key TEXT PRIMARY KEY, updated INTEGER NOT NULL, total INTEGER NOT NULL DEFAULT 0, cursor INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS music_locks (key TEXT PRIMARY KEY, until_ms INTEGER NOT NULL);
INSERT OR IGNORE INTO music_locks VALUES ('musicbrainz', 0);
