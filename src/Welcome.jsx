import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

function Welcome() {
  const location = useLocation();
  const [accessToken, setAccessToken] = useState(null);
  const [userId, setUserId] = useState(null);
  const [playlistName, setPlaylistName] = useState("");
  const [maxSongs, setMaxSongs] = useState(1);
  const [userPlaylist, setUserPlaylist] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get("access_token");
    if (token) {
      setAccessToken(token);
      // Optionally store in localStorage or context
      localStorage.setItem("access_token", token);
    }
  }, [location]);

  useEffect(() => {
    if (accessToken) {
      fetch("https://api.spotify.com/v1/me", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
        .then((response) => response.json())
        .then((data) => {
          setUserId(data.id);
        })
        .catch((error) => {
          console.error("Error fetching user info:", error);
        });
    }
  }, [accessToken]);

  useEffect(() => {
    if (userId) {
      setLoading(true);
      fetch("http://127.0.0.1:5173/api/user_playlists", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
      })
        .then((res) => res.json())
        .then((data) => {
          setUserPlaylist(data.userPlaylist);
          setLoading(false);
        })
        .catch((err) => {
          setError("Error loading user playlist row");
          setLoading(false);
        });
    }
  }, [userId]);

  // Check if playlist exists after loading userPlaylist
  useEffect(() => {
    if (accessToken && userPlaylist && userPlaylist.playlist_id) {
      fetch("http://127.0.0.1:5173/api/spotify/playlist_exists_in_list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accessToken,
          playlistId: userPlaylist.playlist_id,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (!data.exists) {
            setUserPlaylist((prev) => ({ ...prev, playlist_id: null }));
            setError("Your playlist was deleted. Please create a new one.");
          }
        })
        .catch(() => {
          setError("Error checking playlist existence");
        });
    }
  }, [accessToken, userPlaylist && userPlaylist.playlist_id]);

  const handleCreatePlaylist = () => {
    setError("");
    if (!playlistName || !maxSongs || maxSongs < 1 || maxSongs > 50) {
      setError("Please enter a playlist name and a valid number of songs (1-50)");
      return;
    }
    setLoading(true);
    fetch("http://127.0.0.1:5173/api/spotify/create_playlist", {
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

  return (
    <div>
      {accessToken ? (
        userId ? (
          <>
            <h2>Logged in! User ID: {userId}</h2>
            {loading && <p>Loading...</p>}
            {error && <p style={{ color: "red" }}>{error}</p>}
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
                <button
                  onClick={async () => {
                    setError("");
                    if (!playlistName || !maxSongs || maxSongs < 1 || maxSongs > 50) {
                      setError("Please enter a playlist name and a valid number of songs (1-50)");
                      return;
                    }
                    setLoading(true);
                    fetch("http://127.0.0.1:5173/api/user_playlists/edit", {
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
                  }}
                  disabled={loading}
                >
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
          </>
        ) : (
          <h2>Logged in! Access token is available.</h2>
        )
      ) : (
        <p>No access token found.</p>
      )}
    </div>
  );
}

export default Welcome;
