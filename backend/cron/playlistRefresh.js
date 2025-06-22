// cron/playlistRefresh.js
const axios = require('axios');
const pool = require('../db/pool');
const cron = require('node-cron');

const CLIENT_ID = '82e8a238ab1644a99aca389bc7e3224a';
const CLIENT_SECRET = '82faf54b14d647a8a0d4b48d875239f4';

function startPlaylistRefreshJob() {
  cron.schedule('* * * * *', async () => {
    console.log('Starting hourly playlist refresh job...');
    try {
      const { rows: users } = await pool.query(
        'SELECT user_id, refresh_token, playlist_id, song_count FROM spotify_app.user_playlists WHERE refresh_token IS NOT NULL AND playlist_id IS NOT NULL'
      );
      for (const user of users) {
        try {
          const tokenRes = await axios.post(
            'https://accounts.spotify.com/api/token',
            new URLSearchParams({
              grant_type: 'refresh_token',
              refresh_token: user.refresh_token,
              client_id: CLIENT_ID,
              client_secret: CLIENT_SECRET,
            }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
          );
          const accessToken = tokenRes.data.access_token;
          if (tokenRes.data.refresh_token) {
            await pool.query(
              'UPDATE spotify_app.user_playlists SET refresh_token = $1 WHERE user_id = $2',
              [tokenRes.data.refresh_token, user.user_id]
            );
          }
          const likedRes = await axios.get(
            `https://api.spotify.com/v1/me/tracks?limit=${user.song_count || 20}`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          const trackUris = likedRes.data.items.map(item => item.track.uri);
          if (trackUris.length > 0) {
            await axios.put(
              `https://api.spotify.com/v1/playlists/${user.playlist_id}/tracks`,
              { uris: trackUris },
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );
          }
          await pool.query(
            'UPDATE spotify_app.user_playlists SET last_updated = NOW() WHERE user_id = $1',
            [user.user_id]
          );
          console.log(`Refreshed playlist for user ${user.user_id}`);
        } catch (err) {
          const errorData = err.response?.data || err.message;
          console.error(`Failed to refresh playlist for user ${user.user_id}:`, errorData);
          if (errorData && errorData.error === 'invalid_grant') {
            await pool.query(
              'UPDATE spotify_app.user_playlists SET refresh_token = NULL WHERE user_id = $1',
              [user.user_id]
            );
            console.log(`Refresh token revoked for user ${user.user_id}, set to NULL in DB.`);
          }
        }
      }
    } catch (err) {
      console.error('Error running daily playlist refresh job:', err.message);
    }
  });
}

module.exports = startPlaylistRefreshJob;
