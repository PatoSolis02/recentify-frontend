// controllers/spotifyController.js
require('dotenv').config();
const pool = require('../db/pool');
const { generateCodeVerifier, generateCodeChallenge, getSpotifyTokens } = require('../utils/auth');
const { upsertSong, insertPlaylistSongsBulk } = require('../utils/dbHelpers');
const { exchangeRefreshToken } = require('../utils/auth');
const { getUserLikedTracks, getUserProfile, createPlaylist, addTracksToPlaylist, getPlaylist, getUserPlaylists } = require('../utils/spotifyService');

// In-memory store for code_verifiers, keyed by state
const codeVerifierStore = new Map();

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;

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
    const tokenData = await getSpotifyTokens({
      code,
      codeVerifier,
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI
    });
    const { access_token, refresh_token } = tokenData;
    codeVerifierStore.delete(state);
    try {
      const userRes = await getUserProfile(access_token);
      const userId = userRes.data.id;
      const displayName = userRes.data.display_name;
      const email = userRes.data.email;
      if (userId) {
        // Insert or update user in DB with all info
        await pool.query(`
          INSERT INTO spotify_app.users (spotify_id, display_name, email, refresh_token)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (spotify_id) DO UPDATE SET
            display_name = EXCLUDED.display_name,
            email = EXCLUDED.email,
            refresh_token = EXCLUDED.refresh_token
        `, [userId, displayName, email, refresh_token]);
      }
    } catch (err) {
      console.error('Error storing user info:', err.response?.data || err.message);
    }
    const redirectUrl = `http://127.0.0.1:4000/welcome?access_token=${access_token}`;
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Error fetching tokens:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch tokens' });
  }
};

exports.createPlaylist = async (req, res) => {
  const { userId, name, maxSongs } = req.body;
  console.log('req.body:', req.body);
  if (!userId || !name || !maxSongs) {
    return res.status(400).json({ error: 'userId, name, and maxSongs are required' });
  }
  try {
    // Get refresh token from DB
    const userRes = await pool.query('SELECT spotify_id, refresh_token FROM spotify_app.users WHERE spotify_id = $1', [userId]);
    if (userRes.rows.length === 0) {
      return res.status(400).json({ error: 'User not found in database' });
    }
    const { spotify_id, refresh_token } = userRes.rows[0];
    if (!refresh_token) {
      return res.status(400).json({ error: 'No refresh token for user' });
    }
    // Exchange refresh token for access token
    const tokenData = await exchangeRefreshToken(refresh_token, CLIENT_ID, CLIENT_SECRET);
    const accessToken = tokenData.access_token;
    if (tokenData.refresh_token) {
      await pool.query(
         'UPDATE spotify_app.users SET refresh_token = $1 WHERE spotify_id = $2',
        [tokenData.refresh_token, spotify_id]
      );
    }
    // Create playlist on Spotify
    const spotifyRes = await createPlaylist(accessToken, spotify_id, name, `Recentify playlist (${maxSongs} songs)`, true);
    const spotifyPlaylistId = spotifyRes.data.id;
    // Get liked tracks
    const likedRes = await getUserLikedTracks(accessToken, maxSongs);
    const trackUris = likedRes.data.items.map(item => item.track.uri);
    if (trackUris.length > 0) {
      // Add tracks to playlist
      await addTracksToPlaylist(accessToken, spotifyPlaylistId, trackUris);
    }
    // Find the user's internal id
    const internalUserRes = await pool.query('SELECT id FROM spotify_app.users WHERE spotify_id = $1', [spotify_id]);
    if (internalUserRes.rows.length === 0) {
      return res.status(400).json({ error: 'User not found in database' });
    }
    const internalUserId = internalUserRes.rows[0].id;
    // Check if playlist already exists in the DB by Spotify playlist id
    let playlistRes = await pool.query(
      'SELECT id FROM spotify_app.playlists WHERE spotify_id = $1',
      [spotifyPlaylistId]
    );
    let playlistDbId;
    if (playlistRes.rows.length > 0) {
      // Update existing playlist
      playlistDbId = playlistRes.rows[0].id;
      await pool.query(
        'UPDATE spotify_app.playlists SET user_id = $1, name = $2, song_count = $3, last_updated = NOW() WHERE id = $4',
        [internalUserId, name, trackUris.length, playlistDbId]
      );
    } else {
      // Insert new playlist
      const insertRes = await pool.query(
        'INSERT INTO spotify_app.playlists (spotify_id, user_id, name, song_count, last_updated) VALUES ($1, $2, $3, $4, NOW()) RETURNING id',
        [spotifyPlaylistId, internalUserId, name, trackUris.length]
      );
      playlistDbId = insertRes.rows[0].id;
    }
    // Optionally, update playlist_songs table (clear and insert new)
    await pool.query('DELETE FROM spotify_app.playlist_songs WHERE playlist_id = $1', [playlistDbId]);
    if (trackUris.length > 0) {
      const songIds = [];
      for (const item of likedRes.data.items) {
        const track = item.track;
        const songId = await upsertSong(track);
        songIds.push(songId);
      }
      await insertPlaylistSongsBulk(playlistDbId, songIds);
    }
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
    await getPlaylist(accessToken, playlistId);
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
      const response = await getUserPlaylists(accessToken, url);
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
