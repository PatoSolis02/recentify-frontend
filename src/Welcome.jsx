import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

function Welcome() {
  const location = useLocation();
  const [accessToken, setAccessToken] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get("access_token");
    if (token) {
      setAccessToken(token);
      // Optionally store in localStorage or context
      localStorage.setItem("access_token", token);
    }
  }, [location]);
``
  return (
    <div>
      {accessToken ? (
        <h2>Logged in! Access token is available.</h2>
      ) : (
        <p>No access token found.</p>
      )}
    </div>
  );
}

export default Welcome;
