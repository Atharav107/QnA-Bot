import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// OpenAI configuration
const token = process.env.GITHUB_TOKEN;
const endpoint = "https://models.github.ai/inference";
const model = "openai/gpt-4.1";

// Initialize OpenAI client
const openaiClient = new OpenAI({ baseURL: endpoint, apiKey: token });

// In-memory store for conversation contexts
// In production, use a database instead
const conversations = new Map();

// API endpoint for answering questions with context
app.post('/api/answer', async (req, res) => {
  try {
    const { question, conversationId, history } = req.body;
    
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }
    
    // Initialize or retrieve conversation context
    let conversationMessages = [];
    
    if (conversationId) {
      // Get existing conversation or initialize a new one
      if (conversations.has(conversationId)) {
        conversationMessages = conversations.get(conversationId);
      } else {
        conversations.set(conversationId, conversationMessages);
      }
    }
    
    // Use provided history if available, otherwise use stored context
    const messageHistory = history || conversationMessages;
    
    // Ensure system message is at the beginning
    let messages = messageHistory;
    if (messages.length === 0 || messages[0].role !== 'system') {
      messages = [
        { role: "system", content: "You are a helpful assistant. Maintain conversation context and provide relevant, concise answers." },
        ...messages
      ];
    }
    
    // If we don't have history provided but have the conversation ID,
    // add just the current question
    if (!history && conversationId) {
      messages.push({ role: "user", content: question });
    }
    
    // Log for debugging
    console.log(`Processing question for conversation ${conversationId}`);
    console.log(`Message count: ${messages.length}`);
    
    const response = await openaiClient.chat.completions.create({
      messages: messages,
      temperature: 1,
      top_p: 1,
      model: model
    });
    
    const answer = response.choices[0].message.content;
    
    // Update conversation context with the new exchange
    if (conversationId) {
      const updatedMessages = [
        ...messages.filter(msg => msg.role !== 'system'), // Keep all non-system messages
        { role: "assistant", content: answer }
      ];
      
      // Store only the last 10 messages to prevent context from getting too large
      conversations.set(
        conversationId, 
        updatedMessages.slice(-20)
      );
    }
    
    res.json({ answer });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to get answer' });
  }
});

// Add a new endpoint to get conversation history
app.get('/api/conversations/:id', (req, res) => {
  const { id } = req.params;
  
  if (conversations.has(id)) {
    res.json({ messages: conversations.get(id) });
  } else {
    res.status(404).json({ error: 'Conversation not found' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});