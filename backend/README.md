# Recentify Backend Documentation

## Project Structure Overview

```
backend/
  index.js
  routes/
    spotify.js
    userPlaylists.js
  controllers/
    spotifyController.js
    userPlaylistsController.js
  db/
    pool.js
    setup.js
  utils/
    auth.js
  cron/
    playlistRefresh.js
  package.json
  .env
```

---

## File & Folder Descriptions

### index.js
- **Purpose:** Main entry point. Sets up Express, middleware, database, cron jobs, and mounts all routes.
- **What to change:** Only add new route imports, middleware, or app-level config here.

### routes/
- **spotify.js:** Defines all Spotify-related API endpoints (login, callback, playlist creation/checking, etc.). Forwards requests to `spotifyController.js`.
- **userPlaylists.js:** Defines all user playlist-related API endpoints (create, update, edit playlist). Forwards requests to `userPlaylistsController.js`.

### controllers/
- **spotifyController.js:** Contains the logic for Spotify endpoints (OAuth login/callback, creating/checking playlists, etc.).
- **userPlaylistsController.js:** Contains the logic for user playlist endpoints (creating user rows, updating playlist IDs, editing playlist details).

### db/
- **pool.js:** Exports the configured PostgreSQL connection pool for use throughout the app.
- **setup.js:** Contains the logic to create the database schema and tables if they don’t exist. Called on server startup.

### utils/
- **auth.js:** Helper functions for PKCE (code verifier/challenge) and other authentication-related utilities.

### cron/
- **playlistRefresh.js:** Contains the scheduled job (using node-cron) that refreshes user playlists on a schedule.

---

## Maintenance & Future Development

### Adding New Features
1. **Add a new route:**  
   - Create a new file in `routes/` if it’s a new resource, or add a new endpoint to an existing route file.
2. **Add controller logic:**  
   - Implement the business logic in a new or existing controller in `controllers/`.
3. **Database changes:**  
   - If you need new tables/columns, update `db/setup.js` and run the setup again.
4. **Utilities:**  
   - Place reusable helper functions in `utils/`.

### Best Practices
- **Keep controllers focused:** Only business logic, no direct route definitions.
- **Keep routes clean:** Only route definitions and forwarding to controllers.
- **Never put business logic in `index.js`.**
- **Use environment variables:** Store secrets and config in `.env` (never commit secrets).
- **Document new endpoints:** Add comments to new routes and controllers.
- **Test endpoints:** Use tools like Postman or Insomnia to test new/changed endpoints.

### Common Maintenance Tasks
- **Update dependencies:** Run `npm update` regularly.
- **Check for security issues:** Run `npm audit`.
- **Backup your database:** Regularly export your Postgres data.
- **Monitor logs:** Check server logs for errors, especially after deploying changes.

### Deployment
- **Environment variables:** Set all secrets and config in `.env` or your deployment environment.
- **Port and host:** Make sure your server is listening on the correct port and host for your deployment environment.
- **Database:** Ensure your production database is properly secured and backed up.

---

## Example: Adding a New Endpoint

Suppose you want to add an endpoint to get all playlists for a user:

1. **Add a route in `routes/userPlaylists.js`:**
   ```js
   router.get('/all', userPlaylistsController.getAllUserPlaylists);
   ```
2. **Add the controller logic in `controllers/userPlaylistsController.js`:**
   ```js
   exports.getAllUserPlaylists = async (req, res) => {
     // ...fetch and return playlists...
   };
   ```
3. **Test the endpoint using Postman or your frontend.**

---

## Troubleshooting

- **OAuth/callback issues:**  
  Ensure your Spotify Developer Dashboard redirect URI matches your backend’s callback route exactly.

- **Database errors:**  
  Check your Postgres server is running and credentials in `db/pool.js` are correct.

- **CORS issues:**  
  Make sure the `origin` in your CORS middleware matches your frontend’s URL.

---

If you follow this structure and these practices, your backend will remain maintainable, scalable, and easy to extend.
If you need a more detailed README or want to automate documentation, let me know!
