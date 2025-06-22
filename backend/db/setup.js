// db/setup.js
const pool = require('./pool');

async function setupDatabase() {
  try {
    await pool.query('CREATE SCHEMA IF NOT EXISTS spotify_app');
    await pool.query('SET search_path TO spotify_app');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS spotify_app.user_playlists (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) UNIQUE NOT NULL,
        playlist_id VARCHAR(255),
        song_count INT2,
        last_updated TIMESTAMP,
        refresh_token VARCHAR(255)
      )
    `);
    console.log('Database schema and table are ready');
  } catch (err) {
    console.error('Error setting up schema or table:', err);
    throw err;
  }
}

module.exports = setupDatabase;
