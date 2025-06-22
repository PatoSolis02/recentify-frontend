import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import React from "react";

function Home() {
  const handleLogin = () => {
    window.location.href = "http://127.0.0.1:5173/api/spotify/login";
  };

  return (
    <div>
      <h1>Spotify App</h1>
      <button onClick={handleLogin}>Login with Spotify</button>
    </div>
  );
}

export default Home;