const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();
// const setupDatabase = require('./db/setup');
const startPlaylistRefreshJob = require('./cron/playlistRefresh');

const spotifyRoutes = require('./routes/spotify');
const userPlaylistsRoutes = require('./routes/userPlaylists');

const app = express();

// Use port from environment or fallback to 3000 for local dev
const port = process.env.PORT || 3000;

// For Elastic Beanstalk, listen on all interfaces (0.0.0.0)
app.use(
  cors({
    origin: '*', // For testing only, restrict in production!
  })
);
app.use(bodyParser.json());

// If you need to initialize the DB locally, run setupDatabase() manually.
// For production, do not run setupDatabase() automatically.
startPlaylistRefreshJob();

// Mount routes
app.use('/api/spotify', spotifyRoutes);
app.use('/api/user_playlists', userPlaylistsRoutes);

// Listen without specifying host to bind all interfaces
app.listen(port, () => {
  console.log(`Backend server listening on port ${port}`);
});