// backend/utils/dbHelpers.js
const pool = require('../db/pool');

async function upsertSong(track) {
  const songRes = await pool.query(
    `INSERT INTO spotify_app.songs (spotify_song_id, title, artist, album, duration)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (spotify_song_id) DO UPDATE SET
       title = EXCLUDED.title,
       artist = EXCLUDED.artist,
       album = EXCLUDED.album,
       duration = EXCLUDED.duration
     RETURNING id`,
    [
      track.id,
      track.name,
      track.artists.map(a => a.name).join(', '),
      track.album.name,
      track.duration_ms
    ]
  );
  return songRes.rows[0].id;
}

/**
 * Batch insert multiple songs into a playlist in a single query.
 * @param {number} playlistId - The playlist's internal DB id.
 * @param {number[]} songIds - Array of song internal DB ids.
 */
async function insertPlaylistSongsBulk(playlistId, songIds) {
  if (!songIds.length) return;
  const values = songIds.map((_, i) => `($1, $${i + 2}, NOW())`).join(', ');
  const params = [playlistId, ...songIds];
  await pool.query(
    `INSERT INTO spotify_app.playlist_songs (playlist_id, song_id, added_at)
     VALUES ${values}`,
    params
  );
}

module.exports = { upsertSong, insertPlaylistSong, insertPlaylistSongsBulk };