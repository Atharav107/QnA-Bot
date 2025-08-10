import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { FaLightbulb, FaMoon, FaPaperPlane, FaTrash, FaHistory, FaSave, 
         FaMicrophone, FaMicrophoneAlt, FaVolumeUp, FaVolumeMute, FaStop, FaCog, FaDatabase } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import useSpeechRecognition from './hooks/useSpeechRecognition';
import useTextToSpeech from './hooks/useTextToSpeech';
import KnowledgeBase from './components/KnowledgeBase';

function App() {
  const [question, setQuestion] = useState('');
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [savedConversations, setSavedConversations] = useState([]);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [showKnowledgeBase, setShowKnowledgeBase] = useState(false);
  const [usingKnowledgeBase, setUsingKnowledgeBase] = useState(false);
  
  // Store the conversation ID for the current active conversation
  const [activeConversationId, setActiveConversationId] = useState(null);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  
  // Voice hooks
  const { 
    transcript, 
    isListening, 
    toggleListening, 
    stopListening, 
    resetTranscript,
    browserSupportsRecognition 
  } = useSpeechRecognition();
  
  const {
    isSpeaking,
    voices,
    selectedVoice,
    rate,
    pitch,
    speakText,
    stopSpeaking,
    changeVoice,
    changeRate,
    changePitch,
    browserSupportsSpeech
  } = useTextToSpeech();
  
  // Load saved conversations from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('savedConversations');
    if (saved) {
      try {
        setSavedConversations(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved conversations');
      }
    }
    
    // Check user preference for dark mode
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDarkMode(prefersDark);
    
    // Generate a new conversation ID when the app starts
    if (!activeConversationId) {
      setActiveConversationId(Date.now().toString());
    }
  }, [activeConversationId]);
  
  // Save conversations to localStorage
  useEffect(() => {
    localStorage.setItem('savedConversations', JSON.stringify(savedConversations));
  }, [savedConversations]);
  
  // Auto-scroll to bottom of conversation
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations]);

  // Toggle dark/light mode
  useEffect(() => {
    document.body.className = darkMode ? 'dark-mode' : 'light-mode';
  }, [darkMode]);
  
  // Auto-submit when speech recognition finishes
  useEffect(() => {
    if (!isListening && transcript) {
      setQuestion(transcript);
      // Submit after a short delay to allow user to see the transcript
      const timer = setTimeout(() => {
        handleSubmit({ preventDefault: () => {} });
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [isListening, transcript]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!question.trim()) return;
    
    // Stop any ongoing speech when submitting a new question
    stopSpeaking();
    
    const currentQuestion = question;
    setQuestion('');
    setIsLoading(true);
    setError(null);
    
    // Add user question to conversation immediately
    const newUserMessage = { 
      role: 'user', 
      content: currentQuestion, 
      timestamp: new Date().toISOString() 
    };
    
    setConversations(prev => [...prev, newUserMessage]);
    
    try {
      // Prepare the full conversation history for context
      const conversationHistory = [...conversations, newUserMessage]
        .map(msg => ({ role: msg.role, content: msg.content }));
      
      const response = await fetch('http://localhost:5001/api/answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          question: currentQuestion,
          conversationId: activeConversationId,
          history: conversationHistory
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to get answer');
      }
      
      const data = await response.json();
      
      // Check if knowledge base was used
      setUsingKnowledgeBase(data.usedKnowledgeBase);
      
      // Add assistant response to conversation
      const assistantResponse = { 
        role: 'assistant', 
        content: data.answer, 
        timestamp: new Date().toISOString(),
        usedKnowledgeBase: data.usedKnowledgeBase
      };
      
      setConversations(prev => [...prev, assistantResponse]);
      
      // Auto-speak the answer if user used voice input
      if (transcript && browserSupportsSpeech) {
        speakText(data.answer);
      }
    } catch (err) {
      setError(err.message);
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
      resetTranscript();
      // Focus back on input after response
      inputRef.current?.focus();
    }
  };
  
  const saveCurrentConversation = () => {
    if (conversations.length === 0) return;
    
    const title = conversations[0].content.substring(0, 30) + '...';
    const newSavedConvo = {
      id: activeConversationId,
      title,
      messages: [...conversations],
      date: new Date().toLocaleString()
    };
    
    // Check if we're updating an existing conversation or adding a new one
    const existingIndex = savedConversations.findIndex(c => c.id === activeConversationId);
    
    if (existingIndex >= 0) {
      // Update existing conversation
      setSavedConversations(prev => 
        prev.map((convo, idx) => idx === existingIndex ? newSavedConvo : convo)
      );
    } else {
      // Add new conversation
      setSavedConversations(prev => [newSavedConvo, ...prev]);
    }
  };
  
  const loadConversation = (convo) => {
    setConversations(convo.messages);
    setActiveConversationId(convo.id);
    setShowHistory(false);
  };
  
  const startNewConversation = () => {
    setConversations([]);
    setActiveConversationId(Date.now().toString());
  };
  
  const deleteConversation = (id, e) => {
    e.stopPropagation();
    setSavedConversations(prev => prev.filter(convo => convo.id !== id));
    
    // If we deleted the active conversation, create a new one
    if (id === activeConversationId) {
      startNewConversation();
    }
  };
  
  const clearCurrentConversation = () => {
    stopSpeaking();
    setConversations([]);
  };

  return (
    <div className={`App ${darkMode ? 'dark' : 'light'}`}>
      <header className="App-header">
        <div className="header-content">
          <motion.h1 
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            AI Q&A Assistant
          </motion.h1>
          <div className="header-controls">
            <button 
              className="icon-button new-conversation-button" 
              onClick={startNewConversation}
              title="New Conversation"
            >
              <span className="button-text">New Chat</span>
            </button>
            <button 
              className="icon-button history-button" 
              onClick={() => setShowHistory(!showHistory)}
              title="Conversation History"
            >
              <FaHistory />
            </button>
            <button 
              className="icon-button theme-toggle" 
              onClick={() => setDarkMode(!darkMode)}
              title={darkMode ? "Light Mode" : "Dark Mode"}
            >
              {darkMode ? <FaLightbulb /> : <FaMoon />}
            </button>
            <button 
              className="icon-button knowledge-base-button" 
              onClick={() => setShowKnowledgeBase(true)}
              title="Knowledge Base"
            >
              <FaDatabase />
            </button>
          </div>
        </div>
      </header>
      
      <div className="content-wrapper">
        <AnimatePresence>
          {showHistory && (
            <motion.div 
              className="history-panel"
              initial={{ x: -300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              <h2>Conversation History</h2>
              {savedConversations.length === 0 ? (
                <p className="empty-history">No saved conversations yet</p>
              ) : (
                <ul className="history-list">
                  {savedConversations.map(convo => (
                    <li 
                      key={convo.id} 
                      onClick={() => loadConversation(convo)} 
                      className={`history-item ${convo.id === activeConversationId ? 'active' : ''}`}
                    >
                      <span className="history-title">{convo.title}</span>
                      <span className="history-date">{convo.date}</span>
                      <button 
                        className="delete-history" 
                        onClick={(e) => deleteConversation(convo.id, e)}
                        title="Delete conversation"
                      >
                        <FaTrash />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        
        <main className="App-main">
          <div className="conversation-container">
            {conversations.length === 0 ? (
              <div className="empty-conversation">
                <h2>Ask me anything!</h2>
                <p>I'm your AI assistant ready to help answer your questions.</p>
                <p className="context-hint">I'll remember our conversation context so you can ask follow-up questions!</p>
                
                {browserSupportsRecognition && (
                  <div className="voice-hint">
                    <FaMicrophone className="voice-icon" />
                    <p>Try using voice input - click the microphone icon below</p>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="conversation-controls">
                  <button className="control-button" onClick={clearCurrentConversation}>
                    <FaTrash /> Clear
                  </button>
                  <button className="control-button save-button" onClick={saveCurrentConversation}>
                    <FaSave /> Save
                  </button>
                </div>
                
                <div className="messages">
                  <AnimatePresence>
                    {conversations.map((msg, idx) => (
                      <motion.div 
                        key={idx}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className={`message ${msg.role === 'user' ? 'user-message' : 'assistant-message'}`}
                      >
                        <div className="message-header">
                          <span className="message-role">{msg.role === 'user' ? 'You' : 'Assistant'}</span>
                          <span className="message-time">
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </span>
                          
                          {msg.role === 'assistant' && browserSupportsSpeech && (
                            <div className="message-actions">
                              <button 
                                onClick={() => speakText(msg.content)} 
                                className={`message-action ${isSpeaking ? 'active' : ''}`}
                                title="Listen"
                              >
                                {isSpeaking ? <FaVolumeMute /> : <FaVolumeUp />}
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="message-content">
                          {msg.content}
                        </div>
                        
                        {msg.usedKnowledgeBase && (
                          <div className="knowledge-base-badge">
                            <FaDatabase /> Using Knowledge Base
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  <div ref={messagesEndRef} />
                  
                  {isLoading && (
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          
          {/* Voice settings panel */}
          <AnimatePresence>
            {showVoiceSettings && browserSupportsSpeech && (
              <motion.div 
                className="voice-settings-panel"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
              >
                <div className="voice-settings-header">
                  <h3>Voice Settings</h3>
                  <button 
                    onClick={() => setShowVoiceSettings(false)}
                    className="close-button"
                  >
                    &times;
                  </button>
                </div>
                
                <div className="settings-group">
                  <label htmlFor="voice-select">Voice:</label>
                  <select 
                    id="voice-select"
                    value={selectedVoice?.name || ''}
                    onChange={(e) => {
                      const selected = voices.find(v => v.name === e.target.value);
                      if (selected) changeVoice(selected);
                    }}
                  >
                    {voices.map(voice => (
                      <option key={voice.name} value={voice.name}>
                        {voice.name} ({voice.lang})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="settings-group">
                  <label htmlFor="rate-range">Speed: {rate.toFixed(1)}x</label>
                  <input 
                    id="rate-range"
                    type="range" 
                    min="0.5" 
                    max="2" 
                    step="0.1" 
                    value={rate}
                    onChange={(e) => changeRate(parseFloat(e.target.value))}
                  />
                </div>
                
                <div className="settings-group">
                  <label htmlFor="pitch-range">Pitch: {pitch.toFixed(1)}</label>
                  <input 
                    id="pitch-range"
                    type="range" 
                    min="0.5" 
                    max="2" 
                    step="0.1" 
                    value={pitch}
                    onChange={(e) => changePitch(parseFloat(e.target.value))}
                  />
                </div>
                
                <button 
                  className="test-voice-button"
                  onClick={() => speakText("This is a test of the selected voice.")}
                >
                  Test Voice
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          
          {error && (
            <motion.div 
              className="error-message"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <p>Error: {error}</p>
            </motion.div>
          )}
          
          <form onSubmit={handleSubmit} className="question-form">
            <div className="input-container">
              <div className="input-group">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={isListening ? 'Listening...' : 'Ask anything...'}
                  disabled={isLoading || isListening}
                  className={`question-input ${isListening ? 'listening' : ''}`}
                  ref={inputRef}
                />
                
                {browserSupportsRecognition && (
                  <button
                    type="button"
                    onClick={toggleListening}
                    className={`voice-button ${isListening ? 'listening' : ''}`}
                    disabled={isLoading}
                    title={isListening ? 'Stop listening' : 'Start voice input'}
                  >
                    {isListening ? <FaMicrophoneAlt /> : <FaMicrophone />}
                  </button>
                )}
                
                <motion.button 
                  type="submit" 
                  disabled={isLoading || (!question.trim() && !transcript)}
                  className="submit-button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <FaPaperPlane /> {isLoading ? 'Thinking...' : 'Ask'}
                </motion.button>
              </div>
              
              {/* Transcript preview */}
              {isListening && (
                <div className="transcript-preview">
                  <div className="listening-indicator">
                    <div className="wave"></div>
                    <div className="wave"></div>
                    <div className="wave"></div>
                    <div className="wave"></div>
                    <div className="wave"></div>
                  </div>
                  <p>{transcript || "I'm listening..."}</p>
                </div>
              )}
            </div>
          </form>
          
          {browserSupportsSpeech && (
            <div className="voice-settings-toggle">
              <button 
                onClick={() => setShowVoiceSettings(!showVoiceSettings)}
                className="icon-button settings-toggle"
                title="Voice settings"
              >
                <FaCog /> Voice Settings
              </button>
            </div>
          )}
        </main>
      </div>
      
      <KnowledgeBase 
        isOpen={showKnowledgeBase} 
        onClose={() => setShowKnowledgeBase(false)} 
      />
    </div>
  );
}

export default App;