import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import React from "react";
import Welcome from "./Welcome";
import Home from "./Home";


function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="*" element={<h1>404 - Page Not Found</h1>} />
      </Routes>
    </Router>
  );
}

export default App;