const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();
// const setupDatabase = require('./db/setup');
const startPlaylistRefreshJob = require('./cron/playlistRefresh');

const spotifyRoutes = require('./routes/spotify');
const userPlaylistsRoutes = require('./routes/userPlaylists');

const app = express();
const port = 5173;
const host = '127.0.0.1';

app.use(
  cors({
    origin: 'http://127.0.0.1:4000',
  })
);
app.use(bodyParser.json());

// If you need to initialize the DB locally, run setupDatabase() manually.
// For production, do not run setupDatabase() automatically.
startPlaylistRefreshJob();

// Mount routes
app.use('/api/spotify', spotifyRoutes);
app.use('/api/user_playlists', userPlaylistsRoutes);

app.listen(port, host, () => {
  console.log(`Backend server listening at http://${host}:${port}`);
});
