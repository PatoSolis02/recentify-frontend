
// Set your backend URL here (production only)
const BACKEND_URL = "http://recentify.us-east-1.elasticbeanstalk.com";

import React, { useState } from "react";

function PlaylistManager({
  userPlaylist,
  setUserPlaylist,
  accessToken,
  userId,
  loading,
  setLoading,
  error,
  setError,
  playlistName,
  setPlaylistName,
  maxSongs,
  setMaxSongs
}) {
  const handleCreatePlaylist = () => {
    setError("");
    if (!playlistName || !maxSongs || maxSongs < 1 || maxSongs > 50) {
      setError("Please enter a playlist name and a valid number of songs (1-50)");
      return;
    }
    setLoading(true);
    fetch(`${BACKEND_URL}/api/spotify/create_playlist`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accessToken,
        userId,
        name: playlistName,
        maxSongs: Number(maxSongs),
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.spotifyPlaylistId) {
          setUserPlaylist({ ...userPlaylist, playlist_id: data.spotifyPlaylistId });
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Error creating Spotify playlist");
        setLoading(false);
      });
  };

  const handleEditPlaylist = () => {
    setError("");
    if (!playlistName || !maxSongs || maxSongs < 1 || maxSongs > 50) {
      setError("Please enter a playlist name and a valid number of songs (1-50)");
      return;
    }
    setLoading(true);
    fetch(`${BACKEND_URL}/api/user_playlists/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        playlistId: userPlaylist.playlist_id,
        newName: playlistName,
        newSongCount: Number(maxSongs),
        accessToken,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setUserPlaylist({ ...userPlaylist, song_count: maxSongs });
          setError("");
        } else {
          setError("Failed to edit playlist");
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Error editing playlist");
        setLoading(false);
      });
  };

  return (
    <div>
      {userPlaylist && userPlaylist.playlist_id ? (
        <div>
          <h3>Your Playlist</h3>
          <p>Playlist ID: {userPlaylist.playlist_id}</p>
          <input
            type="text"
            placeholder="Edit Playlist Name"
            value={playlistName}
            onChange={(e) => setPlaylistName(e.target.value)}
          />
          <input
            type="number"
            min={1}
            max={50}
            value={maxSongs}
            onChange={(e) => setMaxSongs(Number(e.target.value))}
          />
          <button onClick={handleEditPlaylist} disabled={loading}>
            Save Changes
          </button>
          <p>Description: Recentify playlist ({maxSongs} songs)</p>
        </div>
      ) : (
        <div>
          <input
            type="text"
            placeholder="Playlist Name"
            value={playlistName}
            onChange={(e) => setPlaylistName(e.target.value)}
          />
          <input
            type="number"
            min={1}
            max={50}
            value={maxSongs}
            onChange={(e) => setMaxSongs(Number(e.target.value))}
          />
          <button onClick={handleCreatePlaylist} disabled={loading}>
            Create Playlist
          </button>
        </div>
      )}
    </div>
  );
}

export default PlaylistManager;
