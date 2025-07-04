import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

const BACKEND_URL = "http://recentify.us-east-1.elasticbeanstalk.com";

function Welcome() {
  const location = useLocation();
  const [accessToken, setAccessToken] = useState(null);
  const [spotifyUserId, setSpotifyUserId] = useState(null); // Spotify user id
  const [internalUserId, setInternalUserId] = useState(null); // Internal DB user id
  const [playlistName, setPlaylistName] = useState("");
  const [maxSongs, setMaxSongs] = useState(1);
  const [userPlaylist, setUserPlaylist] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [userDisplayName, setUserDisplayName] = useState(""); // User's display name

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get("access_token");
    if (token) {
      setAccessToken(token);
      // Optionally store in localStorage or context
      localStorage.setItem("access_token", token);
    }
  }, [location]);

  // Get Spotify user id
  useEffect(() => {
    if (accessToken) {
      fetch("https://api.spotify.com/v1/me", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
        .then((response) => response.json())
        .then((data) => {
          console.log("User data:", data);
          setSpotifyUserId(data.id);
          // Get or create internal user row
      fetch(`${BACKEND_URL}/api/user_playlists/createOrGetUser`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              spotifyId: data.id,
              displayName: data.display_name,
              email: data.email,
            }),
          })
            .then((res) => res.json())
            .then((userData) => {
              if (userData && userData.user && userData.user.id) {
                setInternalUserId(userData.user.id);
                setUserDisplayName(userData.user.display_name || "");
              } else {
                setError("Could not get internal user ID from backend");
              }
            });
        })
        .catch((error) => {
          console.error("Error fetching user info:", error);
        });
    }
  }, [accessToken]);

  // Get playlists for internal user id
  useEffect(() => {
    console.log("Fetching user playlists for internal user ID:", internalUserId);
    if (internalUserId) {
      setLoading(true);
      fetch(`${BACKEND_URL}/api/user_playlists`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: internalUserId }),
      })
        .then((res) => res.json())
        .then((data) => {
          console.log("Fetched user playlists:", data);
          // If playlists array exists and is not empty, set first playlist; else set to null
          if (data.playlists && data.playlists.length > 0) {
            setUserPlaylist(data.playlists[0]);
          } else {
            setUserPlaylist(null);
          }
          setLoading(false);
        })
        .catch((err) => {
          setError("Error loading user playlist row");
          setLoading(false);
        });
    }
  }, [internalUserId]);

  // Check if playlist exists after loading userPlaylist
  useEffect(() => {
    if (accessToken && userPlaylist && userPlaylist.spotify_id) {
      fetch(`${BACKEND_URL}/api/spotify/playlist_exists_in_list`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accessToken,
          playlistId: userPlaylist.spotify_id, // Spotify playlist id
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (!data.exists) {
            // Call backend to delete playlist from DB
            fetch(`${BACKEND_URL}/api/user_playlists/delete`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ spotifyId: userPlaylist.spotify_id }),
            });
            setUserPlaylist((prev) => ({ ...prev, spotify_id: null }));
            setError("Your playlist was deleted. Please create a new one.");
          }
        })
        .catch(() => {
          setError("Error checking playlist existence");
        });
    }
  }, [accessToken, userPlaylist && userPlaylist.spotify_id]);

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
        userId: spotifyUserId, // use internal user id
        name: playlistName,
        maxSongs: Number(maxSongs),
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.spotifyPlaylistId) {
          // After creation, set userPlaylist so only edit is shown
          setUserPlaylist({
            playlist_id: data.spotifyPlaylistId,
            id: data.internalPlaylistId, // if your backend returns this
            song_count: maxSongs,
            // add any other fields you need
          });
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
        internalUserId ? (
          <>
            <h2>Logged in! {userDisplayName ? `Welcome, ${userDisplayName}` : spotifyUserId}</h2>
            {loading && <p>Loading...</p>}
            {error && <p style={{ color: "red" }}>{error}</p>}
            {userPlaylist && userPlaylist.spotify_id ? (
              <div>
                <h3>Your Playlist</h3>
                <p>Playlist Name: {userPlaylist.name}</p>
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
                    fetch(`${BACKEND_URL}/api/user_playlists/edit`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        playlistId: userPlaylist.spotify_id, // internal playlist id for DB
                        newName: playlistName,
                        newSongCount: Number(maxSongs),
                        userId: spotifyUserId, // pass Spotify user id for backend to get/refresh token
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
                <p>Description: Recentify playlist ({userPlaylist.song_count} songs)</p>
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
