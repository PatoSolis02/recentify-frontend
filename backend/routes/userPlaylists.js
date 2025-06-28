const express = require('express');
const router = express.Router();
const userPlaylistsController = require('../controllers/userPlaylistsController');

// Create or get user (by Spotify ID)
router.post('/createOrGetUser', userPlaylistsController.createOrGetUser);

// Get all playlists for a user (by internal user id)
router.post('/', userPlaylistsController.getUserPlaylists);

// Edit a playlist (by internal playlist id)
router.post('/edit', userPlaylistsController.editUserPlaylist);

// delete a playlist (by internal playlist id)
router.post('/delete', userPlaylistsController.deleteUserPlaylist);

module.exports = router;

module.exports = router;
