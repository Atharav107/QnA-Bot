import { useState, useEffect, useCallback } from 'react';

const useTextToSpeech = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [speechSynthesis, setSpeechSynthesis] = useState(null);
  
  useEffect(() => {
    if ('speechSynthesis' in window) {
      setSpeechSynthesis(window.speechSynthesis);
      
      // Load available voices
      const loadVoices = () => {
        const availableVoices = window.speechSynthesis.getVoices();
        setVoices(availableVoices);
        
        // Select default English voice
        const defaultVoice = availableVoices.find(voice => 
          voice.lang.includes('en-') && voice.default
        ) || availableVoices[0];
        
        setSelectedVoice(defaultVoice);
      };
      
      // Chrome loads voices asynchronously
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
      
      loadVoices();
    } else {
      console.error('Text-to-speech not supported in this browser');
    }
  }, []);
  
  const speakText = useCallback((text) => {
    if (speechSynthesis) {
      // Cancel any ongoing speech
      stopSpeaking();
      
      const utterance = new SpeechSynthesisUtterance(text);
      
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      
      utterance.rate = rate;
      utterance.pitch = pitch;
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      
      speechSynthesis.speak(utterance);
    }
  }, [speechSynthesis, selectedVoice, rate, pitch]);
  
  const stopSpeaking = useCallback(() => {
    if (speechSynthesis) {
      speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [speechSynthesis]);
  
  const changeVoice = useCallback((voice) => {
    setSelectedVoice(voice);
  }, []);
  
  const changeRate = useCallback((newRate) => {
    setRate(newRate);
  }, []);
  
  const changePitch = useCallback((newPitch) => {
    setPitch(newPitch);
  }, []);
  
  return {
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
    browserSupportsSpeech: !!speechSynthesis
  };
};

export default useTextToSpeech;