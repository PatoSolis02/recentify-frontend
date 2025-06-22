// routes/spotify.js
const express = require('express');
const router = express.Router();
const spotifyController = require('../controllers/spotifyController');

router.get('/login', spotifyController.login);
router.get('/callback', spotifyController.callback);
router.post('/create_playlist', spotifyController.createPlaylist);
router.post('/check_playlist', spotifyController.checkPlaylist);
router.post('/playlist_exists_in_list', spotifyController.playlistExistsInList);

module.exports = router;
