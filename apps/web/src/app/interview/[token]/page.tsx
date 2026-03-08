'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  Timer,
  Send,
  Code,
  MessageSquare,
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Volume2,
  X,
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { interviewApi } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Message {
  id: string;
  role: 'ai' | 'candidate';
  content: string;
  type: 'question' | 'answer' | 'system' | 'code';
  timestamp: Date;
}

interface InterviewInfo {
  sessionId: string;
  company: { name: string };
  jobRole: { title: string; skills: string[] };
  template: { name: string; durationMin: number };
  status: string;
}

export default function InterviewPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  // State
  const [info, setInfo] = useState<InterviewInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [mode, setMode] = useState<'chat' | 'code'>('chat');
  const [codeValue, setCodeValue] = useState('');
  const [codeLang, setCodeLang] = useState('javascript');
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [tabWarning, setTabWarning] = useState(false);
  const [ended, setEnded] = useState(false);

  // Refs
  const socketRef = useRef<Socket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Load interview info
  useEffect(() => {
    interviewApi.join(token)
      .then(res => {
        const data = res.data as unknown as InterviewInfo;
        setInfo(data);
        setTimeLeft(data.template.durationMin * 60);
        setLoading(false);
      })
      .catch(() => {
        setError('Invalid or expired interview link');
        setLoading(false);
      });
  }, [token]);

  // WebSocket connection
  useEffect(() => {
    if (!info) return;

    const socket = io(API_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('interview:start', { sessionId: info.sessionId });
    });

    socket.on('interview:question', (data: { questionText: string; type: string; sequenceNum: number }) => {
      const msg: Message = {
        id: `q-${data.sequenceNum}-${Date.now()}`,
        role: 'ai',
        content: data.questionText,
        type: 'question',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, msg]);
      speakText(data.questionText);

      // Switch to code mode for coding questions
      if (data.type === 'coding') {
        setMode('code');
      }
    });

    socket.on('interview:feedback', (data: { message: string }) => {
      setMessages(prev => [...prev, {
        id: `sys-${Date.now()}`,
        role: 'ai',
        content: data.message,
        type: 'system',
        timestamp: new Date(),
      }]);
    });

    socket.on('interview:code_result', (data: { status: string; message: string }) => {
      setMessages(prev => [...prev, {
        id: `code-${Date.now()}`,
        role: 'ai',
        content: data.message,
        type: 'system',
        timestamp: new Date(),
      }]);
    });

    socket.on('disconnect', () => setConnected(false));

    return () => {
      socket.disconnect();
    };
  }, [info]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft <= 0 || ended) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleEndInterview();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft, ended]);

  // Tab visibility detection
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        setTabWarning(true);
        setTimeout(() => setTabWarning(false), 5000);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ---- Speech ----

  const speakText = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      synthRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  const toggleRecording = useCallback(() => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this browser. Please use Chrome.');
      return;
    }

    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInputText(transcript);
    };

    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }, [isRecording]);

  // ---- Send Answer ----

  const sendAnswer = useCallback(() => {
    if (!inputText.trim() || !socketRef.current || !info) return;

    const msg: Message = {
      id: `a-${Date.now()}`,
      role: 'candidate',
      content: inputText.trim(),
      type: 'answer',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, msg]);

    socketRef.current.emit('interview:answer', {
      sessionId: info.sessionId,
      answerText: inputText.trim(),
    });

    setInputText('');
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    }
  }, [inputText, info, isRecording]);

  const submitCode = useCallback(() => {
    if (!codeValue.trim() || !socketRef.current || !info) return;

    const msg: Message = {
      id: `code-ans-${Date.now()}`,
      role: 'candidate',
      content: `\`\`\`${codeLang}\n${codeValue}\n\`\`\``,
      type: 'code',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, msg]);

    socketRef.current.emit('interview:code_submit', {
      sessionId: info.sessionId,
      code: codeValue,
      language: codeLang,
    });
  }, [codeValue, codeLang, info]);

  const handleEndInterview = useCallback(() => {
    if (socketRef.current && info) {
      socketRef.current.emit('interview:end', { sessionId: info.sessionId });
    }
    setEnded(true);
    window.speechSynthesis?.cancel();
    recognitionRef.current?.stop();
  }, [info]);

  // ---- Formatting ----

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // ---- Loading & Error States ----

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-white animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4 text-center">
        <div>
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl text-white mb-2">Error</h2>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (ended) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4 text-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Interview Complete</h2>
          <p className="text-gray-500 mb-6">
            Thank you for completing the interview for {info?.jobRole.title} at {info?.company.name}.
            <br />Your responses are being evaluated. You&apos;ll be notified of the results.
          </p>
          <button
            onClick={() => router.push('/candidate/portal')}
            className="px-6 py-3 rounded-xl bg-white text-black text-sm font-semibold hover:bg-gray-100 transition-all"
          >
            Back to Portal
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-black flex flex-col overflow-hidden">
      {/* Tab Warning */}
      <AnimatePresence>
        {tabWarning && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-50 bg-red-500/90 text-white text-center py-2 text-sm font-medium"
          >
            <AlertTriangle className="w-4 h-4 inline mr-2" />
            Tab switching detected. This may affect your trust score.
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="border-b border-white/[0.06] px-4 h-14 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-base font-semibold text-white">
            Proctara<span className="text-amber-400">.</span>
          </span>
          <span className="text-xs text-gray-600">|</span>
          <span className="text-xs text-gray-400">{info?.company.name}</span>
          <span className="text-xs text-gray-600">—</span>
          <span className="text-xs text-gray-400">{info?.jobRole.title}</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Connection Status */}
          <div className={`flex items-center gap-1.5 text-xs ${connected ? 'text-green-400' : 'text-red-400'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
            {connected ? 'Connected' : 'Reconnecting...'}
          </div>

          {/* Timer */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${
            timeLeft < 300 ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
            timeLeft < 600 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
            'bg-white/[0.04] text-white border border-white/[0.06]'
          } font-mono text-sm`}>
            <Timer className="w-4 h-4" />
            {formatTime(timeLeft)}
          </div>

          {/* End Interview */}
          <button
            onClick={handleEndInterview}
            className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium border border-red-500/20 hover:bg-red-500/20 transition-all"
          >
            End Interview
          </button>
        </div>
      </header>

      {/* Mode Toggle */}
      <div className="border-b border-white/[0.06] px-4 py-2 flex items-center gap-2 shrink-0">
        <button
          onClick={() => setMode('chat')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            mode === 'chat' ? 'bg-white text-black' : 'text-gray-500 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Interview
        </button>
        <button
          onClick={() => setMode('code')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            mode === 'code' ? 'bg-white text-black' : 'text-gray-500 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <Code className="w-3.5 h-3.5" />
          Code Editor
        </button>

        {isSpeaking && (
          <div className="ml-auto flex items-center gap-1.5 text-xs text-amber-400">
            <Volume2 className="w-3.5 h-3.5 animate-pulse" />
            AI Speaking...
            <button onClick={() => window.speechSynthesis.cancel()} className="ml-1 hover:text-white">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Mode */}
        {mode === 'chat' && (
          <div className="flex-1 flex flex-col">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-gray-600 text-sm py-12">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                  Connecting to AI interviewer...
                </div>
              )}

              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`max-w-3xl ${msg.role === 'candidate' ? 'ml-auto' : 'mr-auto'}`}
                >
                  <div className={`rounded-2xl px-5 py-4 ${
                    msg.role === 'ai' && msg.type === 'question'
                      ? 'bg-white/[0.04] border border-white/[0.08]'
                      : msg.role === 'ai' && msg.type === 'system'
                      ? 'bg-blue-500/5 border border-blue-500/10'
                      : msg.role === 'candidate' && msg.type === 'code'
                      ? 'bg-green-500/5 border border-green-500/10'
                      : 'bg-amber-500/5 border border-amber-500/10'
                  }`}>
                    <div className="text-xs text-gray-600 mb-1.5">
                      {msg.role === 'ai' ? '🤖 AI Interviewer' : '👤 You'}
                    </div>
                    {msg.type === 'code' ? (
                      <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono overflow-x-auto">
                        {msg.content}
                      </pre>
                    ) : (
                      <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    )}
                    <div className="text-right mt-2">
                      <span className="text-[10px] text-gray-700">
                        {msg.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-white/[0.06] px-4 py-3 shrink-0">
              <div className="flex items-end gap-2 max-w-3xl mx-auto">
                {/* Mic Button */}
                <button
                  onClick={toggleRecording}
                  className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    isRecording
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'bg-white/[0.04] text-gray-500 hover:text-white hover:bg-white/[0.08] border border-white/[0.06]'
                  }`}
                  title={isRecording ? 'Stop recording' : 'Start voice input'}
                >
                  {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                {/* Text Input */}
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAnswer(); } }}
                  placeholder={isRecording ? 'Listening... speak your answer' : 'Type your answer or use the mic...'}
                  rows={1}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-amber-500/40 resize-none min-h-[40px] max-h-[120px]"
                  style={{ height: 'auto', overflow: 'hidden' }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                  }}
                />

                {/* Send Button */}
                <button
                  onClick={sendAnswer}
                  disabled={!inputText.trim()}
                  className="shrink-0 w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Code Mode */}
        {mode === 'code' && (
          <div className="flex-1 flex flex-col">
            {/* Language Selector */}
            <div className="border-b border-white/[0.06] px-4 py-2 flex items-center justify-between shrink-0">
              <div className="relative">
                <select
                  value={codeLang}
                  onChange={(e) => setCodeLang(e.target.value)}
                  className="appearance-none bg-white/[0.04] border border-white/[0.08] text-white text-xs px-3 py-1.5 rounded-lg pr-7 focus:outline-none cursor-pointer"
                >
                  {['javascript', 'typescript', 'python', 'java', 'cpp', 'go', 'rust'].map(lang => (
                    <option key={lang} value={lang} className="bg-black">{lang}</option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <button
                onClick={submitCode}
                disabled={!codeValue.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-green-500/10 text-green-400 text-xs font-medium border border-green-500/20 hover:bg-green-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <Send className="w-3.5 h-3.5" />
                Submit Code
              </button>
            </div>

            {/* Code Editor */}
            <div className="flex-1 relative">
              <textarea
                value={codeValue}
                onChange={(e) => setCodeValue(e.target.value)}
                className="w-full h-full bg-[#0d0d0d] text-green-400 font-mono text-sm p-4 resize-none focus:outline-none leading-6 tab-size-2"
                placeholder="// Write your code here..."
                spellCheck={false}
                onKeyDown={(e) => {
                  if (e.key === 'Tab') {
                    e.preventDefault();
                    const target = e.target as HTMLTextAreaElement;
                    const start = target.selectionStart;
                    const end = target.selectionEnd;
                    setCodeValue(codeValue.substring(0, start) + '  ' + codeValue.substring(end));
                    setTimeout(() => target.setSelectionRange(start + 2, start + 2), 0);
                  }
                }}
              />
              {/* Line numbers overlay */}
              <div className="absolute left-0 top-0 w-10 h-full bg-black/40 flex flex-col items-end pr-2 pt-4 text-xs text-gray-700 font-mono leading-6 pointer-events-none select-none">
                {codeValue.split('\n').map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
                {codeValue === '' && <div>1</div>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
