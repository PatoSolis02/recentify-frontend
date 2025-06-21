import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

function Welcome() {
  const location = useLocation();
  const [accessToken, setAccessToken] = useState(null);
  const [userId, setUserId] = useState(null);

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
    fetch("http://127.0.0.1:5173/api/user_playlists", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId }),
    })
      .then((res) => res.json())
      .then((data) => {
        // Optionally handle response
        console.log("User playlist row inserted:", data);
      })
      .catch((err) => {
        console.error("Error inserting user playlist row:", err);
      });
  }
}, [userId]);

  return (
    <div>
      {accessToken ? (
        userId ? (
          <h2>Logged in! User ID: {userId}</h2>
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
