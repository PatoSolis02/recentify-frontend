// cron/playlistRefresh.js
require('dotenv').config();
const pool = require('../db/pool');
const cron = require('node-cron');
const { upsertSong, insertPlaylistSongsBulk } = require('../utils/dbHelpers');
const { exchangeRefreshToken } = require('../utils/auth');
const { getUserLikedTracks, replacePlaylistTracks } = require('../utils/spotifyService');

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

async function refreshUserPlaylist(user) {
  try {
    // Exchange refresh token for access token
    const tokenData = await exchangeRefreshToken(user.refresh_token, CLIENT_ID, CLIENT_SECRET);
    const accessToken = tokenData.access_token;
    if (tokenData.refresh_token) {
      await pool.query(
        'UPDATE spotify_app.users SET refresh_token = $1 WHERE id = $2',
        [tokenData.refresh_token, user.user_id]
      );
    }
    const likedRes = await getUserLikedTracks(accessToken, user.song_count || 20);
    const trackUris = likedRes.data.items.map(item => item.track.uri);
    if (trackUris.length > 0) {
      await replacePlaylistTracks(accessToken, user.playlist_spotify_id, trackUris);
      // Update playlist_songs table in DB
      await pool.query('DELETE FROM spotify_app.playlist_songs WHERE playlist_id = $1', [user.playlist_db_id]);
      // For each track, upsert into songs and collect songIds
      const songIds = [];
      for (const item of likedRes.data.items) {
        const track = item.track;
        const songId = await upsertSong(track);
        songIds.push(songId);
      }
      await insertPlaylistSongsBulk(user.playlist_db_id, songIds);
    }
    await pool.query(
      'UPDATE spotify_app.playlists SET last_updated = NOW() WHERE id = $1',
      [user.playlist_db_id]
    );
    console.log(`Refreshed playlist for user ${user.user_id}`);
  } catch (err) {
    const errorData = err.response?.data || err.message;
    console.error(`Failed to refresh playlist for user ${user.user_id}:`, errorData);
    if (errorData && errorData.error === 'invalid_grant') {
      await pool.query(
        'UPDATE spotify_app.users SET refresh_token = NULL WHERE id = $1',
        [user.user_id]
      );
      console.log(`Refresh token revoked for user ${user.user_id}, set to NULL in DB.`);
    }
  }
}

function startPlaylistRefreshJob() {
  cron.schedule('* * * * *', async () => {
    console.log('Starting hourly playlist refresh job...');
    try {
      // Get all users with refresh tokens and their playlists
      const { rows: users } = await pool.query(
        `SELECT u.id as user_id, u.refresh_token, u.spotify_id, p.id as playlist_db_id, p.spotify_id as playlist_spotify_id, p.song_count
         FROM spotify_app.users u
         JOIN spotify_app.playlists p ON p.user_id = u.id
         WHERE u.refresh_token IS NOT NULL AND p.spotify_id IS NOT NULL`
      );
      await Promise.all(users.map(user => refreshUserPlaylist(user)));
    } catch (err) {
      console.error('Error running daily playlist refresh job:', err.message);
    }
  });
}

module.exports = startPlaylistRefreshJob;
