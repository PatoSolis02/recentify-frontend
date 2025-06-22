// controllers/spotifyController.js
const axios = require('axios');
const pool = require('../db/pool');
const { generateCodeVerifier, generateCodeChallenge } = require('../utils/auth');

// In-memory store for code_verifiers, keyed by state
const codeVerifierStore = new Map();

const CLIENT_ID = '82e8a238ab1644a99aca389bc7e3224a';
const CLIENT_SECRET = '82faf54b14d647a8a0d4b48d875239f4';
const REDIRECT_URI = 'http://127.0.0.1:5173/api/spotify/callback';

exports.login = (req, res) => {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = require('crypto').randomBytes(16).toString('hex');
  codeVerifierStore.set(state, codeVerifier);
  const scope = 'playlist-modify-public playlist-modify-private user-read-private user-read-email user-library-read';
  const authURL = new URL('https://accounts.spotify.com/authorize');
  authURL.searchParams.append('client_id', CLIENT_ID);
  authURL.searchParams.append('response_type', 'code');
  authURL.searchParams.append('redirect_uri', REDIRECT_URI);
  authURL.searchParams.append('scope', scope);
  authURL.searchParams.append('code_challenge_method', 'S256');
  authURL.searchParams.append('code_challenge', codeChallenge);
  authURL.searchParams.append('state', state);
  res.redirect(authURL.toString());
};

exports.callback = async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) {
    return res.status(400).send('Missing code or state');
  }
  const codeVerifier = codeVerifierStore.get(state);
  if (!codeVerifier) {
    return res.status(400).send('Invalid or expired state');
  }
  try {
    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({
        client_id: CLIENT_ID,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: codeVerifier,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    const { access_token, refresh_token } = response.data;
    codeVerifierStore.delete(state);
    try {
      const userRes = await axios.get('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      const userId = userRes.data.id;
      if (refresh_token && userId) {
        const userCheck = await pool.query(
          'SELECT * FROM spotify_app.user_playlists WHERE user_id = $1',
          [userId]
        );
        if (userCheck.rows.length === 0) {
          await pool.query(
            'INSERT INTO spotify_app.user_playlists (user_id, refresh_token) VALUES ($1, $2)',
            [userId, refresh_token]
          );
        } else {
          await pool.query(
            'UPDATE spotify_app.user_playlists SET refresh_token = $1 WHERE user_id = $2',
            [refresh_token, userId]
          );
        }
      }
    } catch (err) {
      console.error('Error storing refresh token:', err.response?.data || err.message);
    }
    const redirectUrl = `http://127.0.0.1:4000/welcome?access_token=${access_token}`;
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Error fetching tokens:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch tokens' });
  }
};

exports.createPlaylist = async (req, res) => {
  const { accessToken, userId, name, maxSongs } = req.body;
  if (!accessToken || !userId || !name || !maxSongs) {
    return res.status(400).json({ error: 'accessToken, userId, name, and maxSongs are required' });
  }
  try {
    const spotifyRes = await axios.post(
      `https://api.spotify.com/v1/users/${userId}/playlists`,
      { name, description: `Recentify playlist (${maxSongs} songs)`, public: true },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const spotifyPlaylistId = spotifyRes.data.id;
    const likedRes = await axios.get(
      `https://api.spotify.com/v1/me/tracks?limit=${maxSongs}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const trackUris = likedRes.data.items.map(item => item.track.uri);
    if (trackUris.length > 0) {
      await axios.post(
        `https://api.spotify.com/v1/playlists/${spotifyPlaylistId}/tracks`,
        { uris: trackUris },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
    }
    await pool.query(
      'UPDATE spotify_app.user_playlists SET playlist_id = $1, song_count = $2 WHERE user_id = $3',
      [spotifyPlaylistId, parseInt(maxSongs, 10), userId]
    );
    res.json({ spotifyPlaylistId });
  } catch (error) {
    console.error('Error creating Spotify playlist:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to create Spotify playlist' });
  }
};

exports.checkPlaylist = async (req, res) => {
  const { accessToken, playlistId } = req.body;
  if (!accessToken || !playlistId) {
    return res.status(400).json({ error: 'accessToken and playlistId are required' });
  }
  try {
    await axios.get(
      `https://api.spotify.com/v1/playlists/${playlistId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    res.json({ exists: true });
  } catch (err) {
    const statusCode = err.response?.status;
    if (statusCode === 404 || statusCode === 403) {
      res.json({ exists: false });
    } else {
      res.status(500).json({ error: 'Failed to check playlist existence' });
    }
  }
};

exports.playlistExistsInList = async (req, res) => {
  const { accessToken, playlistId } = req.body;
  if (!accessToken || !playlistId) {
    return res.status(400).json({ error: 'accessToken and playlistId are required' });
  }
  try {
    let url = 'https://api.spotify.com/v1/me/playlists?limit=50';
    let exists = false;
    while (url) {
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (response.data && response.data.items) {
        if (response.data.items.some(pl => pl.id === playlistId)) {
          exists = true;
          break;
        }
      }
      url = response.data.next;
    }
    res.json({ exists });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check playlist in user list' });
  }
};
