import mongoose from 'mongoose';
import fs from 'fs/promises';
import path from 'path';

// In-memory fallback if MongoDB isn't available
const inMemoryDocuments = new Map();
let documentIdCounter = 1;

// Create schema only if mongoose is connected
let KnowledgeBase;

try {
  if (mongoose.connection.readyState !== 0) {
    const knowledgeBaseSchema = new mongoose.Schema({
      title: {
        type: String,
        required: true,
        trim: true,
      },
      description: {
        type: String,
        trim: true,
      },
      filePath: {
        type: String,
        required: true,
      },
      fileType: {
        type: String,
        required: true,
      },
      fileSize: {
        type: Number,
        required: true,
      },
      uploadDate: {
        type: Date,
        default: Date.now,
      },
      userId: {
        type: String,
        required: true,
      },
      vectorIds: [{
        type: String,
      }],
    });

    try {
      KnowledgeBase = mongoose.model('KnowledgeBase');
    } catch (e) {
      KnowledgeBase = mongoose.model('KnowledgeBase', knowledgeBaseSchema);
    }
  } else {
    console.log('MongoDB not connected, using in-memory storage for knowledge base');
  }
} catch (error) {
  console.error('Error setting up knowledge base model:', error);
}

class KnowledgeBaseRepository {
  async addDocument(documentData) {
    try {
      if (KnowledgeBase && mongoose.connection.readyState === 1) {
        const document = new KnowledgeBase(documentData);
        await document.save();
        return document;
      } else {
        // Fallback to in-memory storage
        const id = documentIdCounter++;
        const doc = {
          _id: id.toString(),
          ...documentData,
          uploadDate: new Date()
        };
        inMemoryDocuments.set(doc._id, doc);
        return doc;
      }
    } catch (error) {
      console.error('Error saving document to knowledge base:', error);
      
      // Fallback to in-memory storage on error
      const id = documentIdCounter++;
      const doc = {
        _id: id.toString(),
        ...documentData,
        uploadDate: new Date()
      };
      inMemoryDocuments.set(doc._id, doc);
      return doc;
    }
  }

  async getAllDocuments(userId) {
    try {
      if (KnowledgeBase && mongoose.connection.readyState === 1) {
        return await KnowledgeBase.find({ userId }).sort({ uploadDate: -1 });
      } else {
        // Fallback to in-memory storage
        return Array.from(inMemoryDocuments.values())
          .filter(doc => doc.userId === userId)
          .sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
      }
    } catch (error) {
      console.error('Error retrieving documents from knowledge base:', error);
      
      // Fallback to in-memory storage on error
      return Array.from(inMemoryDocuments.values())
        .filter(doc => doc.userId === userId)
        .sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
    }
  }

  async getDocumentById(id) {
    try {
      if (KnowledgeBase && mongoose.connection.readyState === 1) {
        return await KnowledgeBase.findById(id);
      } else {
        // Fallback to in-memory storage
        return inMemoryDocuments.get(id);
      }
    } catch (error) {
      console.error('Error retrieving document from knowledge base:', error);
      return inMemoryDocuments.get(id); // Fallback
    }
  }

  async removeDocument(id, userId) {
    try {
      let document;
      
      if (KnowledgeBase && mongoose.connection.readyState === 1) {
        document = await KnowledgeBase.findOne({ _id: id, userId });
        
        if (!document) {
          throw new Error('Document not found or unauthorized');
        }
        
        await KnowledgeBase.deleteOne({ _id: id });
      } else {
        // Fallback to in-memory storage
        document = inMemoryDocuments.get(id);
        
        if (!document || document.userId !== userId) {
          throw new Error('Document not found or unauthorized');
        }
        
        inMemoryDocuments.delete(id);
      }
      
      // Delete the actual file
      if (document.filePath) {
        try {
          await fs.unlink(document.filePath);
        } catch (fileError) {
          console.error('Error deleting file:', fileError);
          // Continue with deletion even if file deletion fails
        }
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error removing document from knowledge base:', error);
      throw error;
    }
  }
}

export default new KnowledgeBaseRepository();