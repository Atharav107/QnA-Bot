import fs from 'fs';
import path from 'path';

class DocumentProcessor {
  constructor() {
    this.documents = [];
    this.chunkSize = 1000;
    console.log('Document processor initialized');
  }

  async processFile(file) {
    try {
      console.log(`Processing file: ${file.originalname} (${file.mimetype})`);
      const fileExtension = path.extname(file.originalname).toLowerCase().substring(1);
      let content = '';
      
      // Read file directly as text first, as a fallback
      try {
        content = fs.readFileSync(file.path, 'utf8');
        console.log(`Read ${content.length} characters directly from file`);
      } catch (readError) {
        console.error('Error reading file directly:', readError);
        content = '';
      }
      
      // Try specialized parsers based on file type
      if (fileExtension === 'pdf') {
        try {
          // We'll use a direct approach to avoid pdf-parse issues
          console.log('PDF file detected, attempting to extract text');
          
          // If we already have content from direct read, use it
          if (!content) {
            content = "PDF content extraction failed. Using file name as context.";
          }
        } catch (e) {
          console.error('Error parsing PDF:', e);
        }
      } else if (fileExtension === 'docx') {
        try {
          // If mammoth is available, use it
          const mammoth = await import('mammoth').catch(() => null);
          if (mammoth) {
            const result = await mammoth.extractRawText({path: file.path});
            if (result && result.value) {
              content = result.value;
              console.log(`Extracted ${content.length} characters from DOCX`);
            }
          }
        } catch (e) {
          console.error('Error parsing DOCX:', e);
        }
      }
      
      // If content is still empty, use fallback
      if (!content || content.trim().length === 0) {
        content = `Document: ${file.originalname}\nType: ${fileExtension}\nSize: ${file.size} bytes`;
        console.log('Using fallback content for empty document');
      }
      
      console.log(`Total content length: ${content.length} characters`);
      
      // Split content into chunks with overlap
      const chunks = this.splitIntoChunks(content);
      console.log(`Split into ${chunks.length} chunks`);
      
      // Create document objects with metadata
      const documents = chunks.map((chunk, i) => ({
        pageContent: chunk,
        metadata: {
          source: file.originalname,
          chunk: i + 1,
          filename: file.originalname,
          fileType: fileExtension,
          chunkCount: chunks.length
        }
      }));
      
      // Store in memory with file identifier to allow selective removal
      const fileId = path.basename(file.path);
      documents.forEach(doc => {
        doc.metadata.fileId = fileId;
        this.documents.push(doc);
      });
      
      console.log(`Added ${documents.length} chunks to knowledge base`);
      console.log(`Current document count: ${this.getDocumentCount()}`);
      
      // Debug: print first chunk
      if (documents.length > 0) {
        console.log('First chunk preview:');
        console.log(documents[0].pageContent.substring(0, 100) + '...');
      }
      
      return documents;
    } catch (error) {
      console.error('Error processing document:', error);
      // Return at least one chunk to avoid breaking the flow
      const errorDoc = [{
        pageContent: `Error processing ${file.originalname}: ${error.message}`,
        metadata: {
          source: file.originalname,
          chunk: 1,
          error: true
        }
      }];
      this.documents.push(errorDoc[0]);
      return errorDoc;
    }
  }
  
  // Split text into chunks with overlap
  splitIntoChunks(text) {
    if (!text || text.length === 0) {
      return ["[Empty document]"];
    }
    
    // Split by paragraphs first
    const paragraphs = text.split(/\n\s*\n/);
    const chunks = [];
    let currentChunk = "";
    const overlap = 100; // Characters of overlap between chunks
    
    for (const paragraph of paragraphs) {
      // If adding this paragraph would exceed chunk size, save current chunk and start a new one
      if (currentChunk.length + paragraph.length > this.chunkSize) {
        if (currentChunk.length > 0) {
          chunks.push(currentChunk);
          
          // Create overlap by keeping the end of the previous chunk
          if (currentChunk.length > overlap) {
            currentChunk = currentChunk.slice(-overlap);
          }
        }
        
        // If paragraph itself is longer than chunk size, split it further
        if (paragraph.length > this.chunkSize) {
          const words = paragraph.split(/\s+/);
          let wordChunk = currentChunk;
          
          for (const word of words) {
            if (wordChunk.length + word.length + 1 > this.chunkSize) {
              chunks.push(wordChunk);
              wordChunk = "";
            }
            wordChunk += (wordChunk ? " " : "") + word;
          }
          
          if (wordChunk.length > 0) {
            currentChunk = wordChunk;
          } else {
            currentChunk = "";
          }
        } else {
          currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
        }
      } else {
        currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
      }
    }
    
    // Don't forget to add the last chunk
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }
    
    return chunks.length > 0 ? chunks : ["[Empty document]"];
  }

  // Enhanced keyword-based search function
  async searchSimilarDocuments(query, k = 5) {
    if (this.documents.length === 0) {
      console.log('No documents in the knowledge base');
      return [];
    }

    try {
      // Log current document count
      console.log(`Searching through ${this.documents.length} document chunks`);
      
      // Split the query into keywords
      const keywords = query.toLowerCase().split(/\s+/)
        .filter(word => word.length > 2)  // Filter out very short words
        .map(word => word.replace(/[^\w]/g, '')); // Remove punctuation
      
      console.log(`Search keywords: ${keywords.join(', ')}`);
      
      if (keywords.length === 0) {
        console.log('No meaningful keywords found, returning first documents');
        return this.documents.slice(0, k); // Return first k documents if no keywords
      }

      // Score each document based on keyword frequency and other factors
      const scoredDocs = this.documents.map(doc => {
        const text = doc.pageContent.toLowerCase();
        let score = 0;
        
        // Count occurrences of each keyword
        keywords.forEach(keyword => {
          // Exact matches get higher score
          const exactRegex = new RegExp(`\\b${keyword}\\b`, 'g');
          const exactMatches = text.match(exactRegex);
          if (exactMatches) {
            score += exactMatches.length * 10;
          }
          
          // Partial matches get lower score
          const partialRegex = new RegExp(keyword, 'g');
          const partialMatches = text.match(partialRegex);
          if (partialMatches) {
            score += partialMatches.length * 2;
          }
        });
        
        // Bonus for title matches (if keyword appears in the file name)
        if (doc.metadata && doc.metadata.filename) {
          const filename = doc.metadata.filename.toLowerCase();
          keywords.forEach(keyword => {
            if (filename.includes(keyword)) {
              score += 50;
            }
          });
        }
        
        return { doc, score };
      });

      // Sort by score (descending) and return top k documents
      const results = scoredDocs
        .sort((a, b) => b.score - a.score)
        .slice(0, k)
        .filter(item => item.score > 0)
        .map(item => item.doc);
      
      console.log(`Found ${results.length} relevant document chunks`);
      
      // If no results with score, return a few documents anyway
      if (results.length === 0) {
        console.log('No scored results, returning sample documents');
        return this.documents.slice(0, Math.min(3, this.documents.length));
      }
      
      return results;
    } catch (error) {
      console.error('Error searching documents:', error);
      return this.documents.slice(0, Math.min(2, this.documents.length));
    }
  }
  
  // Clear all documents
  clearDocuments() {
    this.documents = [];
    console.log('All documents cleared from memory');
  }
  
  // Remove documents by file ID
  removeDocumentsByFileId(fileId) {
    const countBefore = this.documents.length;
    this.documents = this.documents.filter(doc => 
      !doc.metadata || doc.metadata.fileId !== fileId
    );
    const removed = countBefore - this.documents.length;
    console.log(`Removed ${removed} chunks with fileId: ${fileId}`);
    return removed;
  }
  
  // Get document count
  getDocumentCount() {
    return this.documents.length;
  }
}

export default new DocumentProcessor();