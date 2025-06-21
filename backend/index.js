const express = require('express');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const { Pool } = require('pg');
const { type } = require('os');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
const port = 5173;
const host = '127.0.0.1';

const CLIENT_ID = '82e8a238ab1644a99aca389bc7e3224a';
const CLIENT_SECRET = '82faf54b14d647a8a0d4b48d875239f4';
const REDIRECT_URI = 'http://127.0.0.1:5173/callback';

app.use(
  cors({
    origin: 'http://127.0.0.1:4000', // Allow your frontend's origin
  })
);

app.use(bodyParser.json());

// In-memory store for code_verifiers, keyed by state
const codeVerifierStore = new Map();

function base64URLEncode(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function generateCodeVerifier(length = 128) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let text = '';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function generateCodeChallenge(codeVerifier) {
  const hash = crypto.createHash('sha256').update(codeVerifier).digest();
  return base64URLEncode(hash);
}

// Postgres setup (unchanged)
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'postgres',
  password: '@areaSport42',
  port: 5432,
});

// Ensure spotify_app schema exists
pool.query('CREATE SCHEMA IF NOT EXISTS spotify_app')
  .then(() => {
    console.log('spotify_app schema is ready');
    // Set search_path after schema is ready
    pool.query('SET search_path TO spotify_app');
  })
  .then(() => {
    // Now create the table
    return pool.query(`
      CREATE TABLE IF NOT EXISTS spotify_app.user_playlists (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) UNIQUE NOT NULL,
        playlist_id VARCHAR(255),
        song_count INT2,
        last_updated TIMESTAMP,
        refresh_token VARCHAR(255)
      )
    `);
  })
  .then(() => {
    console.log('user_playlists table is ready');
  })
  .catch((err) => {
    console.error('Error setting up schema or table:', err);
  });

app.get('/login', (req, res) => {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  
  const state = crypto.randomBytes(16).toString('hex');
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
});

app.get('/callback', async (req, res) => {
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
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token, refresh_token } = response.data;

    codeVerifierStore.delete(state);

    // Store refresh_token in user_playlists table if user exists
    try {
      // Get user id from Spotify API
      const userRes = await axios.get('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      const userId = userRes.data.id;
      if (refresh_token && userId) {
        // Check if user exists in user_playlists
        const userCheck = await pool.query(
          'SELECT * FROM spotify_app.user_playlists WHERE user_id = $1',
          [userId]
        );
        if (userCheck.rows.length === 0) {
          // Insert new user with refresh_token
          await pool.query(
            'INSERT INTO spotify_app.user_playlists (user_id, refresh_token) VALUES ($1, $2)',
            [userId, refresh_token]
          );
        } else {
          // Update existing user's refresh_token
          await pool.query(
            'UPDATE spotify_app.user_playlists SET refresh_token = $1 WHERE user_id = $2',
            [refresh_token, userId]
          );
        }
      }
    } catch (err) {
      console.error('Error storing refresh token:', err.response?.data || err.message);
    }

    // Redirect to the frontend
    const redirectUrl = `http://127.0.0.1:4000/welcome?access_token=${access_token}`;
    console.log('Redirecting to:', redirectUrl);
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Error fetching tokens:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch tokens' });
  }
});

app.post('/api/user_playlists', async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  try {
    // Check if user already exists
    const check = await pool.query(
      'SELECT * FROM spotify_app.user_playlists WHERE user_id = $1',
      [userId]
    );
    if (check.rows.length > 0) {
      // User already exists, return existing row
      console.log('User already exists:', check.rows[0]);
      return res.json({ userPlaylist: check.rows[0], alreadyExists: true });
    }
    // Insert if not exists
    const result = await pool.query(
      'INSERT INTO spotify_app.user_playlists (user_id) VALUES ($1) RETURNING *',
      [userId]
    );
    res.json({ userPlaylist: result.rows[0], alreadyExists: false });
  } catch (error) {
    console.error('Error inserting user:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Endpoint to update playlist_id for a user in user_playlists
app.post('/api/user_playlists/update', async (req, res) => {
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
});

// Endpoint to create a playlist on Spotify and in the local DB
app.post('/api/spotify/create_playlist', async (req, res) => {
  const { accessToken, userId, name, maxSongs } = req.body;
  if (!accessToken || !userId || !name || !maxSongs) {
    return res.status(400).json({ error: 'accessToken, userId, name, and maxSongs are required' });
  }
  try {
    // Create playlist on Spotify
    console.log('maxSongs:', maxSongs, typeof maxSongs);
    const spotifyRes = await axios.post(
      `https://api.spotify.com/v1/users/${userId}/playlists`,
      { name, description: `Recentify playlist (${maxSongs} songs)`, public: true },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const spotifyPlaylistId = spotifyRes.data.id;
    // Update user_playlists with Spotify playlist id and song_count

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
});

// Endpoint to check if a playlist exists on Spotify
app.post('/api/spotify/check_playlist', async (req, res) => {
  const { accessToken, playlistId } = req.body;
  if (!accessToken || !playlistId) {
    return res.status(400).json({ error: 'accessToken and playlistId are required' });
  }
  try {
    await axios.get(
      `https://api.spotify.com/v1/playlists/${playlistId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    // If no error, playlist exists
    res.json({ exists: true });
    console.log('Playlist exists:', playlistId);
  } catch (err) {
    const statusCode = err.response?.status;
    console.log(`Spotify API response status for playlist ${playlistId}:`, statusCode);
    if (statusCode === 404 || statusCode === 403) {
      // 404: Not found, 403: Forbidden (e.g., deleted or access revoked)
      console.log('Playlist does not exist or access denied:', playlistId);
      res.json({ exists: false });
    } else {
      console.error('Error checking playlist existence:', err.response?.data || err.message);
      res.status(500).json({ error: 'Failed to check playlist existence' });
    }
  }
});

// Endpoint to check if a playlist exists in the user's playlist list
app.post('/api/spotify/playlist_exists_in_list', async (req, res) => {
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
    console.error('Error checking playlist in user list:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to check playlist in user list' });
  }
});

cron.schedule('0 * * * *', async () => {
  console.log('Starting hourly playlist refresh job...');
  try {
    // Get all users with refresh tokens and playlist info
    const { rows: users } = await pool.query(
      'SELECT user_id, refresh_token, playlist_id, song_count FROM spotify_app.user_playlists WHERE refresh_token IS NOT NULL AND playlist_id IS NOT NULL'
    );

    for (const user of users) {
      try {
        // 1. Get a new access token using the refresh token
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

        // 2. Fetch the latest liked songs
        const likedRes = await axios.get(
          `https://api.spotify.com/v1/me/tracks?limit=${user.song_count || 20}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const trackUris = likedRes.data.items.map(item => item.track.uri);

        // 3. Replace the playlist's tracks with the new set
        if (trackUris.length > 0) {
          await axios.put(
            `https://api.spotify.com/v1/playlists/${user.playlist_id}/tracks`,
            { uris: trackUris },
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
        }

        // 4. Update last_updated timestamp
        await pool.query(
          'UPDATE spotify_app.user_playlists SET last_updated = NOW() WHERE user_id = $1',
          [user.user_id]
        );

        console.log(`Refreshed playlist for user ${user.user_id}`);
      } catch (err) {
        const errorData = err.response?.data || err.message;
        console.error(`Failed to refresh playlist for user ${user.user_id}:`, errorData);
        // If refresh token is invalid, nullify it in the DB
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

app.listen(port, host, () => {
  console.log(`Backend server listening at http://${host}:${port}`);
});
