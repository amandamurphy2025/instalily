import React, { useState } from "react";
import "./App.css";
import ChatWindow from "./components/ChatWindow.js";
import logo from './assets/partselectlogo.png';

function App() {

  return (
    <div className="App">
      <div className="heading">
        <div className="logo">
          <a href="https://www.partselect.com">
            <img src={logo} alt=""></img>
          </a>
        </div>
        <div className="info">
          <div className="phone">
            Call: 1-866-319-8402
          </div>
          <div className="hours">
            <i>The ultimate home repair resource for do-it-yourselfers.</i>
          </div>
        </div>
      </div>
        <ChatWindow/>
    </div>
  );
}

export default App;
