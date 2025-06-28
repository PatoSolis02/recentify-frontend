// controllers/userPlaylistsController.js
require('dotenv').config();
const pool = require('../db/pool');
const { upsertSong, insertPlaylistSongsBulk } = require('../utils/dbHelpers');
const { exchangeRefreshToken } = require('../utils/auth');
const { getUserLikedTracks, replacePlaylistTracks } = require('../utils/spotifyService');

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

// Get a user by Spotify ID (returns internal user row)
exports.createOrGetUser = async (req, res) => {
  const { spotifyId } = req.body;
  if (!spotifyId) {
    return res.status(400).json({ error: 'spotifyId is required' });
  }
  try {
    let userRes = await pool.query(
      'SELECT * FROM spotify_app.users WHERE spotify_id = $1',
      [spotifyId]
    );
    if (userRes.rows.length > 0) {
      return res.json({ user: userRes.rows[0], alreadyExists: true });
    } else {
      return res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Database error' });
  }
};

// Get all playlists for a user (by internal user id)
exports.getUserPlaylists = async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  try {
    const playlists = await pool.query(
      'SELECT * FROM spotify_app.playlists WHERE user_id = $1',
      [userId]
    );
    res.json({ playlists: playlists.rows });
  } catch (error) {
    console.error('Error fetching playlists:', error);
    res.status(500).json({ error: 'Database error' });
  }
};

// Update playlist name and song count (by internal playlist id)
exports.editUserPlaylist = async (req, res) => {
  console.log('req.body:', req.body);
  const { playlistId, newName, newSongCount, userId } = req.body;
  if (!playlistId || !newName || !newSongCount || !userId) {
    return res.status(400).json({ error: 'playlistId, newName, newSongCount, and userId are required' });
  }
  try {
    // Get refresh token from DB
    const userRes = await pool.query('SELECT refresh_token FROM spotify_app.users WHERE spotify_id = $1', [userId]);
    if (userRes.rows.length === 0) {
      return res.status(400).json({ error: 'User not found in database' });
    }
    const refresh_token = userRes.rows[0].refresh_token;
    if (!refresh_token) {
      return res.status(400).json({ error: 'No refresh token for user' });
    }
    // Exchange refresh token for access token
    const tokenData = await exchangeRefreshToken(refresh_token, CLIENT_ID, CLIENT_SECRET);
    const accessToken = tokenData.access_token;
    if (tokenData.refresh_token) {
      await pool.query(
        'UPDATE spotify_app.users SET refresh_token = $1 WHERE spotify_id = $2',
        [tokenData.refresh_token, userId]
      );
    }
    // Update on Spotify
    await replacePlaylistTracks(accessToken, playlistId, []); // Use a new helper for playlist update if needed
    // Get new liked tracks from Spotify
    const likedRes = await getUserLikedTracks(accessToken, newSongCount);
    const trackUris = likedRes.data.items.map(item => item.track.uri);
    // Replace playlist tracks on Spotify
    if (trackUris.length > 0) {
      await replacePlaylistTracks(accessToken, playlistId, trackUris);
    }
    // Update in DB
    await pool.query(
      'UPDATE spotify_app.playlists SET name = $1, song_count = $2, last_updated = NOW() WHERE spotify_id = $3',
      [newName, parseInt(newSongCount, 10), playlistId]
    );
    // Optionally, update playlist_songs table in DB
    // Get internal playlist id
    const playlistRes = await pool.query('SELECT id FROM spotify_app.playlists WHERE spotify_id = $1', [playlistId]);
    if (playlistRes.rows.length > 0) {
      const playlistDbId = playlistRes.rows[0].id;
      await pool.query('DELETE FROM spotify_app.playlist_songs WHERE playlist_id = $1', [playlistDbId]);
      // For each track, upsert into songs and collect songIds
      const songIds = [];
      for (const item of likedRes.data.items) {
        const track = item.track;
        const songId = await upsertSong(track);
        songIds.push(songId);
      }
      await insertPlaylistSongsBulk(playlistDbId, songIds);
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error editing playlist:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to edit playlist' });
  }
};

// In userPlaylistsController.js
exports.deleteUserPlaylist = async (req, res) => {
  const { spotifyId } = req.body;
  if (!spotifyId) {
    return res.status(400).json({ error: 'spotifyId is required' });
  }
  try {
    await pool.query('DELETE FROM spotify_app.playlists WHERE spotify_id = $1', [spotifyId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete playlist' });
  }
};
