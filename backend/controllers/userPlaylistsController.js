// controllers/userPlaylistsController.js
const pool = require('../db/pool');
const axios = require('axios');

exports.createOrGetUserPlaylist = async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  try {
    const check = await pool.query(
      'SELECT * FROM spotify_app.user_playlists WHERE user_id = $1',
      [userId]
    );
    if (check.rows.length > 0) {
      return res.json({ userPlaylist: check.rows[0], alreadyExists: true });
    }
    const result = await pool.query(
      'INSERT INTO spotify_app.user_playlists (user_id) VALUES ($1) RETURNING *',
      [userId]
    );
    res.json({ userPlaylist: result.rows[0], alreadyExists: false });
  } catch (error) {
    console.error('Error inserting user:', error);
    res.status(500).json({ error: 'Database error' });
  }
};

exports.updateUserPlaylistId = async (req, res) => {
  const { userId, playlistId } = req.body;
  if (!userId || !playlistId) {
    return res.status(400).json({ error: 'userId and playlistId are required' });
  }
  try {
    const result = await pool.query(
      'UPDATE spotify_app.user_playlists SET playlist_id = $1 WHERE user_id = $2 RETURNING *',
      [playlistId, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ userPlaylist: result.rows[0] });
  } catch (error) {
    console.error('Error updating user playlist:', error);
    res.status(500).json({ error: 'Database error' });
  }
};

exports.editUserPlaylist = async (req, res) => {
  const { userId, playlistId, newName, newSongCount, accessToken } = req.body;
  if (!userId || !playlistId || !newName || !newSongCount || !accessToken) {
    return res.status(400).json({ error: 'userId, playlistId, newName, newSongCount, and accessToken are required' });
  }
  try {
    await axios.put(
      `https://api.spotify.com/v1/playlists/${playlistId}`,
      {
        name: newName,
        description: `Recentify playlist (${newSongCount} songs)`
      },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const likedRes = await axios.get(
      `https://api.spotify.com/v1/me/tracks?limit=${newSongCount}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const trackUris = likedRes.data.items.map(item => item.track.uri);
    if (trackUris.length > 0) {
      await axios.put(
        `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
        { uris: trackUris },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
    }
    await pool.query(
      'UPDATE spotify_app.user_playlists SET song_count = $1, last_updated = NOW() WHERE user_id = $2',
      [parseInt(newSongCount, 10), userId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error editing playlist:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to edit playlist' });
  }
};
