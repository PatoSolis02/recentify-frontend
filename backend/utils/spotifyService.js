// utils/spotifyService.js
const axios = require('axios');

function getAuthHeader(accessToken) {
  return { Authorization: `Bearer ${accessToken}` };
}

async function getUserLikedTracks(accessToken, limit = 20) {
  return axios.get(
    `https://api.spotify.com/v1/me/tracks?limit=${limit}`,
    { headers: getAuthHeader(accessToken) }
  );
}

async function replacePlaylistTracks(accessToken, playlistSpotifyId, trackUris) {
  return axios.put(
    `https://api.spotify.com/v1/playlists/${playlistSpotifyId}/tracks`,
    { uris: trackUris },
    { headers: getAuthHeader(accessToken) }
  );
}

async function getUserProfile(accessToken) {
  return axios.get('https://api.spotify.com/v1/me', {
    headers: getAuthHeader(accessToken)
  });
}

async function createPlaylist(accessToken, userSpotifyId, name, description, isPublic = true) {
  return axios.post(
    `https://api.spotify.com/v1/users/${userSpotifyId}/playlists`,
    { name, description, public: isPublic },
    { headers: getAuthHeader(accessToken) }
  );
}

async function addTracksToPlaylist(accessToken, playlistId, uris) {
  return axios.post(
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
    { uris },
    { headers: getAuthHeader(accessToken) }
  );
}

async function getPlaylist(accessToken, playlistId) {
  return axios.get(
    `https://api.spotify.com/v1/playlists/${playlistId}`,
    { headers: getAuthHeader(accessToken) }
  );
}

async function getUserPlaylists(accessToken, url = 'https://api.spotify.com/v1/me/playlists?limit=50') {
  return axios.get(url, { headers: getAuthHeader(accessToken) });
}

module.exports = {
  getUserLikedTracks,
  replacePlaylistTracks,
  getUserProfile,
  createPlaylist,
  addTracksToPlaylist,
  getPlaylist,
  getUserPlaylists,
};
