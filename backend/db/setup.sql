CREATE SCHEMA IF NOT EXISTS spotify_app;

CREATE TABLE IF NOT EXISTS spotify_app.users (
  id SERIAL PRIMARY KEY,
  spotify_id VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255),
  email VARCHAR(255),
  refresh_token VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS spotify_app.songs (
  id SERIAL PRIMARY KEY,
  spotify_song_id VARCHAR(255) UNIQUE NOT NULL,
  title VARCHAR(255),
  artist VARCHAR(255),
  album VARCHAR(255),
  duration INTEGER
);

CREATE TABLE IF NOT EXISTS spotify_app.playlists (
  id SERIAL PRIMARY KEY,
  spotify_id VARCHAR(255) UNIQUE NOT NULL,
  user_id INTEGER NOT NULL REFERENCES spotify_app.users(id) ON DELETE CASCADE,
  name VARCHAR(255),
  song_count INTEGER,
  last_updated TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS spotify_app.playlist_songs (
  id SERIAL PRIMARY KEY,
  playlist_id INTEGER NOT NULL REFERENCES spotify_app.playlists(id) ON DELETE CASCADE,
  song_id INTEGER NOT NULL REFERENCES spotify_app.songs(id) ON DELETE CASCADE,
  added_at TIMESTAMP DEFAULT NOW()
);

-- Optional: Indexes for performance
CREATE INDEX IF NOT EXISTS idx_playlist_songs_playlist_id ON spotify_app.playlist_songs (playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_songs_song_id ON spotify_app.playlist_songs (song_id);
