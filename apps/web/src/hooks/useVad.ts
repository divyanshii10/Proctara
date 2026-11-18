'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { utils } from '@ricky0123/vad-web';
import { useMicVAD } from '@ricky0123/vad-react';

interface UseVadProps {
  onSpeechEnd: (audioBlob: Blob) => void;
  onSpeechStart?: () => void;
  enabled?: boolean;
}

export function useVad({ onSpeechEnd, onSpeechStart, enabled = true }: UseVadProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  const vad = useMicVAD({
    startOnLoad: false,
    onSpeechStart: () => {
      setIsSpeaking(true);
      if (onSpeechStart) onSpeechStart();
    },
    onSpeechEnd: (audio: Float32Array) => {
      setIsSpeaking(false);
      // Discard very short audio clips (< 1 second at 16kHz) — these are noise/false positives
      if (audio.length < 16000) return;
      // Convert Float32Array to WAV Blob
      const wavBuffer = utils.encodeWAV(audio);
      const audioBlob = new Blob([wavBuffer], { type: 'audio/wav' });
      onSpeechEnd(audioBlob);
    },
    positiveSpeechThreshold: 0.92,
    negativeSpeechThreshold: 0.7,
    redemptionMs: 1500,
  });

  useEffect(() => {
    if (enabled && !vad.listening) {
      vad.start();
      setIsListening(true);
    } else if (!enabled && vad.listening) {
      vad.pause();
      setIsListening(false);
      setIsSpeaking(false);
    }
    
    return () => {
      // Cleanup handled by useMicVAD mostly, but we can pause
      // vad.pause();
    };
  }, [enabled, vad]);

  return {
    isSpeaking,
    isListening,
    vad,
  };
}
