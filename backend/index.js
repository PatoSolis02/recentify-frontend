const express = require('express');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const { Pool } = require('pg');
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

const createTableQuery = `
CREATE TABLE IF NOT EXISTS spotify_app.playlists (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  max_songs INTEGER NOT NULL CHECK (max_songs <= 50)
)
`;

pool.on('connect', (client) => {
  client.query('SET search_path TO spotify_app');
});

pool.query(createTableQuery)
  .then(() => console.log('Playlists table ready'))
  .catch((err) => console.error('Error creating table', err));

app.get('/login', (req, res) => {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  
  const state = crypto.randomBytes(16).toString('hex');
  codeVerifierStore.set(state, codeVerifier);

  const scope = 'playlist-modify-public playlist-modify-private user-read-private user-read-email';

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

    // Redirect to the frontend
    const redirectUrl = `http://127.0.0.1:4000/welcome?access_token=${access_token}`;
    console.log('Redirecting to:', redirectUrl);
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Error fetching tokens:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch tokens' });
  }
});

// Endpoint to insert playlist (unchanged)
app.post('/api/playlists', async (req, res) => {
  const { name, maxSongs } = req.body;

  if (!name || !maxSongs || maxSongs < 1 || maxSongs > 50) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO playlists (name, max_songs) VALUES ($1, $2) RETURNING *',
      [name, maxSongs]
    );

    res.json({ playlist: result.rows[0] });
  } catch (error) {
    console.error('Error inserting playlist:', error);
    res.status(500).json({ error: 'Database error' });
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
      'SELECT * FROM user_playlists WHERE user_id = $1',
      [userId]
    );
    if (check.rows.length > 0) {
      // User already exists, return existing row
      console.log('User already exists:', check.rows[0]);
      return res.json({ userPlaylist: check.rows[0], alreadyExists: true });
    }
    // Insert if not exists
    const result = await pool.query(
      'INSERT INTO user_playlists (user_id) VALUES ($1) RETURNING *',
      [userId]
    );
    res.json({ userPlaylist: result.rows[0], alreadyExists: false });
  } catch (error) {
    console.error('Error inserting user:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.listen(port, host, () => {
  console.log(`Backend server listening at http://${host}:${port}`);
});
