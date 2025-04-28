# PartSelect ChatBot

Welcome to PartSelect's refigerator and dishwasher chatbot!

# How to run

To run this chat bot, navigate to the case-study directory.

Add a '.env' file with this:
"DEEPSEEK_API_KEY=xxxxxxxxxxxxxxxxx"

Next, run the frontend with npm start.
And then, run the back npm run start-server.

And that's it! Open http://localhost:3001.

# Techstack and Overview of chatbot
This chatbot uses React (and base HTML/CSS) on the frontend.  The backend is Express.js + Node.js. The database is SQLite.  This chatbot is integrated with DeepSeek's Chat API, and uses Axios to make requests.

# User flow
The user sends a message! And then...
 - the frontend calls getAIMessage() to send user input to server
 - server processes the message (in scope, filtering for part or model numbers, etc)
 - server queries the database, and gives this information as context to LLM
 - server requests DeepSeek
 - server returns DeepSeek's response to frontend