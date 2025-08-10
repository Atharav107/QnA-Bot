import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import documentProcessor from './services/documentProcessor.js';
import knowledgeBaseRepository from './repositories/knowledgeBaseRepository.js';
import conversationService from './services/conversationService.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Connect to MongoDB with more robust configuration
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/qnabot', {
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => {
  console.error('MongoDB connection error:', err);
  console.log('Starting server without MongoDB. Some features may not work properly.');
});

// Add this to handle MongoDB connection errors
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + extension);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/csv'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type'), false);
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB limit
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve static files from the "public" directory

// OpenAI configuration
const token = process.env.GITHUB_TOKEN;
const endpoint = "https://models.github.ai/inference";
const model = "openai/gpt-4.1";

// Initialize API client
const openaiClient = new OpenAI({ baseURL: endpoint, apiKey: token });

// Add a knowledge base document
app.post('/api/knowledge-base/upload', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // For now using a simple userId
    const userId = req.body.userId || 'default-user';
    
    // Process document
    const processedChunks = await documentProcessor.processFile(req.file);
    
    console.log(`Processed ${processedChunks.length} chunks from document`);
    
    // Save document metadata to database
    const documentData = {
      title: req.body.title || req.file.originalname,
      description: req.body.description || '',
      filePath: req.file.path,
      fileType: path.extname(req.file.originalname).toLowerCase().substring(1),
      fileSize: req.file.size,
      userId,
      vectorIds: []
    };
    
    const savedDocument = await knowledgeBaseRepository.addDocument(documentData);
    
    res.status(201).json({
      message: 'Document uploaded and processed successfully',
      document: savedDocument,
      totalDocuments: documentProcessor.getDocumentCount()
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({ error: error.message || 'Failed to process document' });
  }
});

// Get all knowledge base documents
app.get('/api/knowledge-base', async (req, res) => {
  try {
    // For now using a simple userId
    const userId = req.query.userId || 'default-user';
    
    const documents = await knowledgeBaseRepository.getAllDocuments(userId);
    
    res.json({
      documents: documents.map(doc => ({
        id: doc._id,
        title: doc.title,
        description: doc.description,
        fileType: doc.fileType,
        fileSize: doc.fileSize,
        uploadDate: doc.uploadDate
      })),
      totalDocumentChunks: documentProcessor.getDocumentCount()
    });
  } catch (error) {
    console.error('Error retrieving documents:', error);
    res.status(500).json({ error: 'Failed to retrieve documents' });
  }
});

// Delete a knowledge base document
app.delete('/api/knowledge-base/:id', async (req, res) => {
  try {
    // For now using a simple userId
    const userId = req.query.userId || 'default-user';
    
    const result = await knowledgeBaseRepository.removeDocument(req.params.id, userId);
    
    // In a production system, we would remove only the vectors for this document
    // For simplicity, we're keeping all document chunks in memory
    
    res.json({ 
      success: true, 
      message: 'Document deleted successfully',
      totalDocumentChunks: documentProcessor.getDocumentCount()
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// Modified answer endpoint to incorporate knowledge base
app.post('/api/answer', async (req, res) => {
  try {
    const { question, conversationId, history } = req.body;
    
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }
    
    // Get conversation context
    let conversationMessages = [];
    if (conversationId) {
      conversationMessages = conversationService.getConversation(conversationId);
    }
    
    // Use provided history if available, otherwise use stored context
    const messageHistory = history || conversationMessages;
    
    // Search knowledge base for relevant information
    let contextFromKnowledgeBase = '';
    let usedKnowledgeBase = false;
    let relevantDocsFound = 0;
    
    console.log(`Knowledge base search for: "${question}"`);
    console.log(`Document count: ${documentProcessor.getDocumentCount()}`);
    
    try {
      // Force search even if no keywords match
      const relevantDocs = await documentProcessor.searchSimilarDocuments(question, 3);
      
      if (relevantDocs && relevantDocs.length > 0) {
        relevantDocsFound = relevantDocs.length;
        contextFromKnowledgeBase = relevantDocs
          .map(doc => `[Document: ${doc.metadata?.filename || 'Unknown'}]\n${doc.pageContent}`)
          .join('\n\n---\n\n');
        usedKnowledgeBase = true;
        
        console.log(`Using ${relevantDocs.length} document chunks as context`);
        console.log(`First chunk preview: ${relevantDocs[0].pageContent.substring(0, 100)}...`);
      } else {
        console.log('No relevant documents found');
        
        // If no relevant docs found but we have documents, use first document anyway
        if (documentProcessor.getDocumentCount() > 0) {
          const firstDoc = documentProcessor.documents[0];
          contextFromKnowledgeBase = `[No exact matches found, using available document]\n${firstDoc.pageContent}`;
          usedKnowledgeBase = true;
          relevantDocsFound = 1;
          console.log('Using first available document as fallback');
        }
      }
    } catch (error) {
      console.error('Error searching knowledge base:', error);
    }
    
    // Ensure system message is at the beginning
    let messages = [];
    
    // Add enhanced system message with knowledge base context
    if (contextFromKnowledgeBase) {
      messages.push({
        role: "system",
        content: `You are a helpful assistant. Use the following information from the knowledge base to inform your answer when relevant, but also rely on your general knowledge. The user has uploaded documents, and the information below comes from those documents. The user is asking about the content of these documents.\n\nKnowledge Base Information:\n${contextFromKnowledgeBase}\n\nMaintain conversation context and provide relevant, concise answers.`
      });
    } else {
      messages.push({
        role: "system",
        content: "You are a helpful assistant. Maintain conversation context and provide relevant, concise answers."
      });
    }
    
    // Add message history
    messages = [
      ...messages,
      ...messageHistory.filter(msg => msg.role !== 'system')
    ];
    
    // Add current question if using conversationId without history
    if (!history && conversationId) {
      messages.push({ role: "user", content: question });
    }
    
    const response = await openaiClient.chat.completions.create({
      messages: messages,
      temperature: 1,
      top_p: 1,
      model: model
    });
    
    const answer = response.choices[0].message.content;
    
    // Update conversation context
    if (conversationId) {
      // Add user question
      conversationService.addMessageToConversation(conversationId, { 
        role: "user", 
        content: question 
      });
      
      // Add assistant response
      conversationService.addMessageToConversation(conversationId, { 
        role: "assistant", 
        content: answer 
      });
    }
    
    // Return the answer with a flag indicating if knowledge base was used
    res.json({
      answer,
      usedKnowledgeBase,
      relevantDocsFound
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to get answer' });
  }
});

// Get document stats
app.get('/api/knowledge-base/stats', (req, res) => {
  res.json({
    documentChunkCount: documentProcessor.getDocumentCount()
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Debug endpoint to check document content
app.get('/api/knowledge-base/debug', (req, res) => {
  const docCount = documentProcessor.getDocumentCount();
  let sampleContent = [];
  
  // Get samples from the first few documents if available
  if (docCount > 0) {
    const sampleSize = Math.min(3, docCount);
    sampleContent = documentProcessor.documents.slice(0, sampleSize).map(doc => ({
      preview: doc.pageContent.substring(0, 200) + '...',
      metadata: doc.metadata
    }));
  }
  
  res.json({
    documentCount: docCount,
    samples: sampleContent
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});