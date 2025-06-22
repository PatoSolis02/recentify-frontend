// routes/userPlaylists.js
const express = require('express');
const router = express.Router();
const userPlaylistsController = require('../controllers/userPlaylistsController');

router.post('/', userPlaylistsController.createOrGetUserPlaylist);
router.post('/update', userPlaylistsController.updateUserPlaylistId);
router.post('/edit', userPlaylistsController.editUserPlaylist);

module.exports = router;
