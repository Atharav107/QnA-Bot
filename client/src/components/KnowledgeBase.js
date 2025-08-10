import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaUpload, FaTrash, FaFilePdf, FaFileWord, FaFileAlt, FaFileCsv, FaTimes, FaDatabase } from 'react-icons/fa';

function KnowledgeBase({ isOpen, onClose }) {
  const [documents, setDocuments] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [stats, setStats] = useState({ documentChunkCount: 0 });
  
  useEffect(() => {
    if (isOpen) {
      fetchDocuments();
      fetchStats();
    }
  }, [isOpen]);
  
  const fetchDocuments = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/knowledge-base?userId=default-user');
      
      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }
      
      const data = await response.json();
      setDocuments(data.documents || []);
      
      if (data.totalDocumentChunks) {
        setStats(prev => ({ ...prev, documentChunkCount: data.totalDocumentChunks }));
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
      setError('Failed to load knowledge base documents');
    }
  };
  
  const fetchStats = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/knowledge-base/stats');
      
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };
  
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      // Set default title to filename without extension
      setTitle(file.name.split('.').slice(0, -1).join('.'));
    }
  };
  
  const handleUpload = async (e) => {
    e.preventDefault();
    
    if (!selectedFile) {
      setError('Please select a file to upload');
      return;
    }
    
    setIsUploading(true);
    setError(null);
    
    const formData = new FormData();
    formData.append('document', selectedFile);
    formData.append('title', title);
    formData.append('description', description);
    formData.append('userId', 'default-user'); // Simple user ID for now
    
    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          const newProgress = prev + 5;
          if (newProgress >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return newProgress;
        });
      }, 300);
      
      const response = await fetch('http://localhost:5001/api/knowledge-base/upload', {
        method: 'POST',
        body: formData,
      });
      
      clearInterval(progressInterval);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }
      
      setUploadProgress(100);
      
      // Reset form
      setSelectedFile(null);
      setTitle('');
      setDescription('');
      setShowUploadForm(false);
      
      // Fetch updated document list and stats
      fetchDocuments();
      fetchStats();
      
      // Reset progress after a moment
      setTimeout(() => {
        setUploadProgress(0);
      }, 1000);
    } catch (error) {
      console.error('Error uploading document:', error);
      setError(error.message || 'Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };
  
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this document?')) {
      return;
    }
    
    try {
      const response = await fetch(`http://localhost:5001/api/knowledge-base/${id}?userId=default-user`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete document');
      }
      
      // Update document list and stats
      fetchDocuments();
      fetchStats();
    } catch (error) {
      console.error('Error deleting document:', error);
      setError('Failed to delete document');
    }
  };
  
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };
  
  const getFileIcon = (fileType) => {
    switch (fileType) {
      case 'pdf':
        return <FaFilePdf />;
      case 'docx':
        return <FaFileWord />;
      case 'txt':
        return <FaFileAlt />;
      case 'csv':
        return <FaFileCsv />;
      default:
        return <FaFileAlt />;
    }
  };
  
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="knowledge-base-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div 
            className="knowledge-base-content"
            initial={{ scale: 0.9, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 50 }}
          >
            <div className="kb-header">
              <h2>Knowledge Base</h2>
              <button className="close-button" onClick={onClose}>
                <FaTimes />
              </button>
            </div>
            
            <div className="kb-actions">
              <button 
                className={`kb-action-button ${showUploadForm ? 'active' : ''}`}
                onClick={() => setShowUploadForm(!showUploadForm)}
              >
                <FaUpload /> Upload Document
              </button>
              <div className="kb-stats">
                <FaDatabase /> {stats.documentChunkCount} chunks indexed
              </div>
            </div>
            
            <AnimatePresence>
              {showUploadForm && (
                <motion.div
                  className="upload-form-container"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                >
                  <form onSubmit={handleUpload} className="upload-form">
                    <div className="form-group">
                      <label>
                        Document:
                        <input 
                          type="file" 
                          onChange={handleFileSelect}
                          accept=".pdf,.docx,.txt,.csv"
                          disabled={isUploading}
                        />
                      </label>
                      {selectedFile && (
                        <div className="selected-file">
                          {getFileIcon(selectedFile.name.split('.').pop())}
                          <span>{selectedFile.name}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="form-group">
                      <label>
                        Title:
                        <input 
                          type="text"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          disabled={isUploading}
                          required
                        />
                      </label>
                    </div>
                    
                    <div className="form-group">
                      <label>
                        Description:
                        <textarea 
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          disabled={isUploading}
                          rows={3}
                        />
                      </label>
                    </div>
                    
                    <div className="form-actions">
                      <button
                        type="submit"
                        className="upload-button"
                        disabled={isUploading || !selectedFile}
                      >
                        {isUploading ? 'Uploading...' : 'Upload'}
                      </button>
                      
                      <button
                        type="button"
                        className="cancel-button"
                        onClick={() => setShowUploadForm(false)}
                        disabled={isUploading}
                      >
                        Cancel
                      </button>
                    </div>
                    
                    {isUploading && (
                      <div className="progress-container">
                        <div 
                          className="progress-bar" 
                          style={{ width: `${uploadProgress}%` }}
                        />
                        <span className="progress-text">{uploadProgress}%</span>
                      </div>
                    )}
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
            
            {error && (
              <div className="kb-error">
                {error}
              </div>
            )}
            
            <div className="documents-list">
              <h3>Your Documents</h3>
              
              {documents.length === 0 ? (
                <div className="no-documents">
                  <p>No documents in your knowledge base yet.</p>
                  <p>Upload documents to help your AI assistant provide more accurate and personalized answers.</p>
                </div>
              ) : (
                <ul className="documents">
                  {documents.map(doc => (
                    <li key={doc.id} className="document-item">
                      <div className="document-icon">
                        {getFileIcon(doc.fileType)}
                      </div>
                      <div className="document-details">
                        <h4 className="document-title">{doc.title}</h4>
                        {doc.description && (
                          <p className="document-description">{doc.description}</p>
                        )}
                        <div className="document-meta">
                          <span className="document-type">{doc.fileType.toUpperCase()}</span>
                          <span className="document-size">{formatFileSize(doc.fileSize)}</span>
                          <span className="document-date">
                            {new Date(doc.uploadDate).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <button 
                        className="delete-document" 
                        onClick={() => handleDelete(doc.id)}
                        title="Delete document"
                      >
                        <FaTrash />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            
            <div className="kb-footer">
              <button className="close-kb-button" onClick={onClose}>
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default KnowledgeBase;