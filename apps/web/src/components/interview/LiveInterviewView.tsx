'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useVad } from '@/hooks/useVad';
import LiveDocEditor from './LiveDocEditor';
import { Loader2, Mic, MicOff, AlertCircle } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Message {
  id: string;
  role: 'ai' | 'candidate';
  content: string;
  timestamp: Date;
}

interface LiveInterviewViewProps {
  token: string;
  sessionId: string;
  onEnd: () => void;
}

export default function LiveInterviewView({ token, sessionId, onEnd }: LiveInterviewViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [connected, setConnected] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [error, setError] = useState('');
  
  const socketRef = useRef<Socket | null>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const lastSpokenTextRef = useRef('');
  const editorRef = useRef<any>(null);
  // Track which sequence numbers have already been pasted to prevent infinite paste loop
  const pastedSequencesRef = useRef<Set<number>>(new Set());

  // Audio/TTS setup
  const speakText = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if ('speechSynthesis' in window) {
        if (lastSpokenTextRef.current === text) {
          resolve();
          return;
        }
        lastSpokenTextRef.current = text;

        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95;

        utterance.onstart = () => setAiSpeaking(true);
        utterance.onend = () => {
          setAiSpeaking(false);
          resolve();
        };
        utterance.onerror = () => {
          setAiSpeaking(false);
          resolve();
        };
        
        synthRef.current = utterance;
        setTimeout(() => {
          window.speechSynthesis.speak(utterance);
          if (window.speechSynthesis.resume) window.speechSynthesis.resume();
        }, 50);
      } else {
        resolve();
      }
    });
  }, []);

  const onEndRef = useRef(onEnd);
  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  // Socket setup
  useEffect(() => {
    const socket = io(API_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      // Join the specific interview session room
      socket.emit('interview:start', { sessionId, reset: false });
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('interview:question', (data: { questionText: string; sequenceNum: number; pasteContent?: string }) => {
      setMessages(prev => [...prev, {
        id: `q-${Date.now()}`,
        role: 'ai',
        content: data.questionText,
        timestamp: new Date()
      }]);
      
      // Paste question into the doc if requested — guard against duplicate pastes
      if (data.pasteContent && editorRef.current && !pastedSequencesRef.current.has(data.sequenceNum)) {
        pastedSequencesRef.current.add(data.sequenceNum);
        editorRef.current.commands.focus();
        editorRef.current.commands.insertContent(`<h2>Question ${data.sequenceNum || ''}</h2><p>${data.pasteContent.replace(/\n/g, '<br/>')}</p><p></p>`);
      }

      speakText(data.questionText);
    });

    socket.on('interview:feedback', (data: { message: string }) => {
      setMessages(prev => [...prev, {
        id: `sys-${Date.now()}`,
        role: 'ai',
        content: data.message,
        timestamp: new Date()
      }]);
    });

    socket.on('error', (data: { message: string }) => {
      setError(data.message);
      setTimeout(() => setError(''), 5000);
    });

    socket.on('interview:complete', () => {
      onEndRef.current();
    });

    return () => {
      socket.disconnect();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, [sessionId, speakText]);

  // VAD setup
  const { isSpeaking: userIsSpeaking, isListening: vadEnabled } = useVad({
    enabled: connected && !aiSpeaking, // Only listen when connected and AI isn't speaking
    onSpeechStart: () => {
      // Could show visual indicator
    },
    onSpeechEnd: (audioBlob) => {
      if (!socketRef.current) return;
      
      const reader = new FileReader();
      reader.onloadend = () => {
        socketRef.current?.emit('interview:audio_answer', {
          sessionId,
          audioBuffer: reader.result,
        });
      };
      reader.readAsArrayBuffer(audioBlob);
    }
  });

  return (
    <div className="flex h-screen w-full bg-neutral-950 text-zinc-100 overflow-hidden font-sans">
      
      {/* LEFT PANEL: Editor */}
      <div className="flex-1 flex flex-col border-r border-zinc-800 p-4">
        <LiveDocEditor sessionId={sessionId} onEditorReady={(editor) => editorRef.current = editor} />
      </div>

      {/* RIGHT PANEL: Interviewer Status & Captions */}
      <div className="w-96 flex flex-col bg-[#111111] border-l border-zinc-800 relative shadow-2xl">
        
        {/* Header / Waveform Area */}
        <div className="p-6 border-b border-zinc-800 flex flex-col items-center justify-center bg-[#1a1a1a] shadow-inner relative z-10">
          <div className="w-24 h-24 rounded-full bg-zinc-800 mb-4 flex items-center justify-center border-4 border-zinc-700 relative overflow-hidden">
             {aiSpeaking && (
                <div className="absolute inset-0 bg-blue-500/20 animate-pulse"></div>
             )}
             <span className="text-3xl font-semibold text-zinc-400 z-10">J</span>
          </div>
          <h2 className="text-xl font-bold text-zinc-200">Jorden</h2>
          <p className="text-sm text-zinc-500 mt-1">AI Interviewer</p>
          
          <div className="mt-6 flex items-center gap-3 w-full justify-center">
            {aiSpeaking ? (
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-400 rounded-full text-sm border border-blue-500/20 font-medium">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                </span>
                Speaking...
              </div>
            ) : userIsSpeaking ? (
              <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-400 rounded-full text-sm border border-green-500/20 font-medium">
                <Mic size={16} className="animate-pulse" />
                Listening...
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 bg-zinc-800 text-zinc-400 rounded-full text-sm border border-zinc-700">
                <MicOff size={16} />
                Idle
              </div>
            )}
          </div>
        </div>

        {/* Captions Log */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Transcript</h3>
          
          {messages.length === 0 && (
            <div className="text-sm text-zinc-600 italic text-center mt-10">
              Conversation history will appear here...
            </div>
          )}
          
          {messages.map((msg, i) => (
            <div key={msg.id} className={`flex flex-col ${msg.role === 'candidate' ? 'items-end' : 'items-start'}`}>
              <span className="text-[10px] text-zinc-600 font-medium uppercase tracking-wider mb-1">
                {msg.role === 'ai' ? 'Jorden' : 'You'}
              </span>
              <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed max-w-[90%] shadow-md ${
                msg.role === 'ai' 
                  ? 'bg-zinc-800 text-zinc-200 rounded-tl-sm' 
                  : 'bg-blue-600/90 text-white rounded-tr-sm'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
        </div>

        {/* Error Banner */}
        {error && (
          <div className="absolute bottom-4 left-4 right-4 bg-red-900/90 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg flex items-center gap-3 text-sm shadow-lg z-50">
            <AlertCircle size={18} className="flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
