import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import React from "react";


function Home() {
  const handleLogin = () => {
    // Use the local backend URL for login
    // window.location.href = "http://127.0.0.1:8888/api/spotify/login";
    window.location.href = "https://acca-2600-4040-57d7-b000-e063-308f-f49e-897e.ngrok-free.app/api/spotify/login";
  };

  return (
    <div>
      <h1>Spotify App</h1>
      <button onClick={handleLogin}>Login with Spotify</button>
    </div>
  );
}

export default Home;