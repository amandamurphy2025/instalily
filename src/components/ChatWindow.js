import React, { useState, useEffect, useRef } from "react";
import "./ChatWindow.css";
import { getAIMessage } from "../api/api.js";
import PartCard from "./PartCard.jsx";
import MarkdownRenderer from "./MarkdownRenderer.jsx";
import QuickPromptButtons from "./QuickPromptButtons.jsx";

function ChatWindow() {
  const defaultMessage = [{
    role: "assistant",
    content: "🛠 🫧 Hello! I can assist you with your refrigerator or dishwasher.\nHere are some things I could help you with:\n- Show you how to install a part\n- Give information on pricing and ordering\n- Show you how to check if you have the right part for your model\n- Help you with a problem your appliance is having\n\nLet me know how I can help!"
  }];

  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState(defaultMessage);
  const [input, setInput] = useState("");
  const inputRef = useRef(null);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (input) => {
    if (input.trim() !== "") {
      // Set user message
      setMessages(prevMessages => [...prevMessages, { role: "user", content: input }]);
      setInput("");

      setIsLoading(true);

      try {
        // Call API & set assistant message
        const response = await getAIMessage(input);
        
        // Check if partData is available in the response
        const newMessage = {
          role: "assistant",
          content: response.reply || response.content,
          partData: response.partData || null
        };
        
        setMessages(prevMessages => [...prevMessages, newMessage]);
      } catch (error) {
        console.error("Error getting AI response:", error);
        
        // Add error message
        setMessages(prevMessages => [
          ...prevMessages, 
          { 
            role: "assistant", 
            content: "I'm sorry, I encountered an error processing your request. Please try again." 
          }
        ]);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleSelectPrompt = (promptTemplate) => {
    setInput(promptTemplate);
    // Focus the input after selecting a prompt
    if (inputRef.current) {
      inputRef.current.focus();
      
      // Place cursor at the end of the text or at the position where part number should be inserted
      const cursorPosition = promptTemplate.includes('part number') 
        ? promptTemplate.indexOf('part number') + 'part number'.length
        : promptTemplate.length;
        
      setTimeout(() => {
        inputRef.current.setSelectionRange(cursorPosition, cursorPosition);
      }, 0);
    }
  };

  return (
    <div className="messages-container">
      {messages.map((message, index) => (
        <div key={index} className={`${message.role}-message-container`}>
          {message.content && (
            <div className={`message ${message.role}-message`}>
              <MarkdownRenderer content={message.content} />
              
              {message.partData && <PartCard part={message.partData} />}
            </div>
          )}
        </div>
      ))}
      <div ref={messagesEndRef} />
      
      {isLoading && (
        <div className="assistant-message-container">
          <div className="message assistant-message">
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      )}
      
      <div className="input-area">
        <div className="input-container">
      <QuickPromptButtons onSelectPrompt={handleSelectPrompt} />
        <div className="input-wrapper">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me about refrigerator or dishwasher parts..."
            onKeyPress={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                handleSend(input);
                e.preventDefault();
              }
            }}
            rows="3"
          />
          <button className="send-button" onClick={() => handleSend(input)}>
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="24" 
              height="24" 
              fill="none" 
              stroke="orange" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className="feather feather-send"
            >
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}

export default ChatWindow;