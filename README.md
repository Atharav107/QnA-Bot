# QnA AI Bot

An interactive Q&A assistant that maintains conversation context and provides AI-powered responses to user questions.

## Features

- Real-time AI-powered responses using GitHub's AI models
- Conversation context tracking for natural follow-up questions
- Dark/Light mode toggle
- Conversation history saving and retrieval
- Modern, animated UI with React

## Installation

Follow these steps to set up the QnA Bot on your local machine:

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- GitHub account with a Personal Access Token

### Step 1: Clone the Repository

```bash
git clone https://github.com/Atharav107/QnA-Bot.git
cd QnA-Bot
```
# Navigate to the server directory
cd server

# Install dependencies
npm install

# Create a .env file
touch .env
```

PORT=5001
GITHUB_TOKEN=your_github_token_here

Note: To create a GitHub token, go to GitHub → Settings → Developer Settings → Personal Access Tokens → Generate new token. Ensure it has appropriate permissions.

# Setup the client
# Navigate to the client directory
cd ../client

# Install dependencies
npm install

# Start the server
cd server
npm install
npm start

# terminal 2- start the client
cd client
npm start
````markdown
/QnA-Bot
  /client             # React frontend
    /public
    /src
      App.js         # Main React component
      App.css        # Styling
      index.js       # React entry point
  /server             # Express backend
    server.js        # Main server file
    .env             # Environment variables (not in repo)
```