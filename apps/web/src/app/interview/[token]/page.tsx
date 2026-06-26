'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  Volume2,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Maximize,
  Sparkles,
  Clock,
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { interviewApi } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Message {
  id: string;
  role: 'ai' | 'candidate';
  content: string;
  type: 'question' | 'answer' | 'system';
  timestamp: Date;
}

interface InterviewInfo {
  sessionId: string;
  company: { name: string };
  jobRole: { title: string; skills: string[] };
  template: { name: string; durationMin: number };
  status: string;
  candidate?: { id: string; name: string; email: string };
}

// Rules are now natively generated and spoken by the AI during the HANDSHAKE phase.


export default function InterviewPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  // States
  const [info, setInfo] = useState<InterviewInfo | null>(null);
  const [lobbyConfirmed, setLobbyConfirmed] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [tabWarning, setTabWarning] = useState(false);
  const [cameraWarning, setCameraWarning] = useState(false);
  const [ended, setEnded] = useState(false);
  const [currentQuestionNum, setCurrentQuestionNum] = useState(1);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [activeText, setActiveText] = useState('');
  const [currentPhase, setCurrentPhase] = useState<'GREETING' | 'RULES_READING' | 'WAITING_FOR_ACK' | 'INTERVIEW_ACTIVE' | 'FALLBACK'>('GREETING');
  const [speechStatus, setSpeechStatus] = useState<'idle' | 'starting' | 'recording' | 'error'>('idle');
  const [speechErrorMsg, setSpeechErrorMsg] = useState('');
  const [interviewState, setInterviewState] = useState<'AI_SPEAKING' | 'IDLE_WAIT' | 'USER_SPEAKING' | 'PROCESSING'>('PROCESSING');
  const [micVolume, setMicVolume] = useState(0);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const totalQuestions = 5;

  // Refs
  const socketRef = useRef<Socket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const maxDurationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const silenceCheckTimerRef = useRef<NodeJS.Timeout | null>(null);
  const handshakeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const interviewStateRef = useRef(interviewState);
  const inputTextRef = useRef('');
  const infoRef = useRef<InterviewInfo | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const lastSpokenTextRef = useRef("");
  const hasFinishedSpeakingRef = useRef(false);
  const currentPhaseRef = useRef<'GREETING' | 'RULES_READING' | 'WAITING_FOR_ACK' | 'INTERVIEW_ACTIVE' | 'FALLBACK'>('GREETING');
  const shouldBeListeningRef = useRef(false);
  const micStartTimeRef = useRef(0);
  const rapidCrashCountRef = useRef(0);
  const hasStartedSequence = useRef(false);
  const isEndedRef = useRef(false);
  const fullscreenStrikesRef = useRef(0);

  useEffect(() => {
    inputTextRef.current = inputText;
  }, [inputText]);

  useEffect(() => {
    infoRef.current = info;
  }, [info]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    currentPhaseRef.current = currentPhase;
  }, [currentPhase]);

  useEffect(() => {
    interviewStateRef.current = interviewState;
  }, [interviewState]);

  // Instruction revealing is now event-driven via playIntroSequence

  // Redirect to setup page if setup check was not completed
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isSetupDone = sessionStorage.getItem(`setup_complete_${token}`);
      if (!isSetupDone) {
        router.push(`/interview/${token}/setup`);
      }
    }
  }, [token, router]);

  // Speech synthesis for AI Voice with loop protection
  const speakText = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if ('speechSynthesis' in window) {
        if (lastSpokenTextRef.current === text) {
          resolve();
          return;
        }
        lastSpokenTextRef.current = text;
        hasFinishedSpeakingRef.current = false;

        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95;
        utterance.pitch = 1.0;

        // Safety fallback: If speech doesn't start within 3 seconds, resolve to avoid hanging
        const startTimeoutId = setTimeout(() => {
          console.warn("SpeechSynthesis failed to start! Forcing resolve.");
          setIsSpeaking(false);
          hasFinishedSpeakingRef.current = true;
          resolve();
        }, 3000);

        utterance.onstart = () => {
          clearTimeout(startTimeoutId);
          setIsSpeaking(true);
          setInterviewState('AI_SPEAKING');

          // Safety fallback: Force end if speech takes ridiculously long
          const estimatedDuration = Math.max(text.length * 80, 5000);
          setTimeout(() => {
            if (!hasFinishedSpeakingRef.current) {
               console.warn("SpeechSynthesis hung during playback! Forcing resolve.");
               setIsSpeaking(false);
               hasFinishedSpeakingRef.current = true;
               resolve();
            }
          }, estimatedDuration);
        };
        utterance.onend = () => {
          setIsSpeaking(false);
          hasFinishedSpeakingRef.current = true;
          resolve();
        };
        utterance.onerror = () => {
          setIsSpeaking(false);
          hasFinishedSpeakingRef.current = true;
          resolve();
        };
        synthRef.current = utterance;
        
        // Wrap speak in a timeout to give cancel() time to clear the audio queue (Chrome bug fix)
        setTimeout(() => {
          window.speechSynthesis.speak(utterance);
          // Known Chrome hack to unstick the speech engine
          if (window.speechSynthesis.resume) window.speechSynthesis.resume();
        }, 50);
      } else {
        hasFinishedSpeakingRef.current = true;
        resolve();
      }
    });
  }, []);

  // Instruction revealing is now fully integrated into the conversational flow.

  // Load interview info
  useEffect(() => {
    interviewApi.join(token)
      .then(res => {
        const data = res.data as unknown as InterviewInfo;
        setInfo(data);
        setTimeLeft(data.template.durationMin * 60);
        setLoading(false);
      })
      .catch((err) => {
        if (err.status === 401 || err.status === 403) {
          router.push(`/candidate/login?callbackUrl=/interview/${token}`);
          return;
        }
        setError('Invalid or expired interview link');
        setLoading(false);
      });
  }, [token, router]);

  // Request camera and microphone stream for proctoring preview and volume analysis
  useEffect(() => {
    if (loading || ended || error || !lobbyConfirmed) return;

    navigator.mediaDevices.getUserMedia({ 
      video: { width: { ideal: 1280 }, height: { ideal: 720 } }, 
      audio: true 
    })
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(err => {
        console.error("Proctored hardware access error:", err);
      });

    return () => {
      // Cleanup tracks on unmount
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [loading, ended, error, lobbyConfirmed]);

  // Fullscreen and Visibility/Tab Blur enforcement
  useEffect(() => {
    if (loading || ended || error || !lobbyConfirmed) return;

    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);
      if (!isFull) {
        fullscreenStrikesRef.current += 1;
        if (fullscreenStrikesRef.current === 1) {
          setTabWarning(true);
          if (socketRef.current && infoRef.current) {
            socketRef.current.emit('interview:violation', { sessionId: infoRef.current.sessionId, type: 'fullscreen_exit' });
          }
        } else if (fullscreenStrikesRef.current >= 2) {
          // Strike 2: Auto-terminate the interview
          handleEndInterview();
        }
      } else {
        setTabWarning(false);
      }
    };

    const handleVisibility = () => {
      if (document.hidden) {
        setTabWarning(true);
        if (socketRef.current && infoRef.current) {
          socketRef.current.emit('interview:violation', { sessionId: infoRef.current.sessionId, type: 'tab_switch' });
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibility);

    // Initial fullscreen check
    setIsFullscreen(!!document.fullscreenElement);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [loading, ended, error, lobbyConfirmed]);

  // AI Proctoring Loop (Vision & Audio)
  useEffect(() => {
    if (loading || ended || error || !lobbyConfirmed || !videoRef.current) return;

    let faceDetector: any = null;
    let objectDetector: any = null;
    let landmarksDetector: any = null;
    let proctorInterval: NodeJS.Timeout;

    const loadModels = async () => {
      try {
        const tf = await import('@tensorflow/tfjs');
        await tf.ready();

        const [faceDetection, cocoSsd, faceLandmarks] = await Promise.all([
          import('@tensorflow-models/face-detection'),
          import('@tensorflow-models/coco-ssd'),
          import('@tensorflow-models/face-landmarks-detection')
        ]);

        faceDetector = await faceDetection.createDetector(faceDetection.SupportedModels.MediaPipeFaceDetector, { runtime: 'tfjs', maxFaces: 5 });
        objectDetector = await cocoSsd.load();
        landmarksDetector = await faceLandmarks.createDetector(faceLandmarks.SupportedModels.MediaPipeFaceMesh, { runtime: 'tfjs', maxFaces: 1 });

        startProctoringLoop();
      } catch (err) {
        console.error("Failed to load proctoring models:", err);
      }
    };

    const startProctoringLoop = () => {
      proctorInterval = setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2 || ended) return;
        
        try {
          const video = videoRef.current;
          
          // 1. Electronic Device Detection
          const objects = await objectDetector.detect(video);
          if (objects.length > 0) {
            console.log("[Proctoring] Objects detected in frame:", objects.map((o: any) => o.class).join(', '));
          }
          const hasDevice = objects.some((obj: any) => obj.class === 'cell phone');
          if (hasDevice && socketRef.current && infoRef.current) {
             socketRef.current.emit('interview:violation', { sessionId: infoRef.current.sessionId, type: 'phone_detected' });
          }

          // 2. Face Detection Count
          const faces = await faceDetector.estimateFaces(video);
          if (faces.length === 0 && socketRef.current && infoRef.current) {
             socketRef.current.emit('interview:violation', { sessionId: infoRef.current.sessionId, type: 'no_face_detected' });
             setCameraWarning(true);
          } else {
             setCameraWarning(false);
             if (faces.length > 1 && socketRef.current && infoRef.current) {
               socketRef.current.emit('interview:violation', { sessionId: infoRef.current.sessionId, type: 'multiple_faces' });
             }
          }

          // 3. Audio-Visual Lip Mismatch & 4. Gaze Detection
          const dynamicThresholdStr = sessionStorage.getItem(`audioThreshold_${token}`);
          const threshold = dynamicThresholdStr ? parseFloat(dynamicThresholdStr) : 40;
          
          if (faces.length > 0) {
             const landmarks = await landmarksDetector.estimateFaces(video);
             if (landmarks.length > 0) {
               const mesh = landmarks[0].keypoints;
               
               // Gaze Detection Heuristic (Head Pose via Nose and Cheek edges)
               const nose = mesh[1];
               const leftEdge = mesh[234];
               const rightEdge = mesh[454];
               const distLeft = nose.x - leftEdge.x;
               const distRight = rightEdge.x - nose.x;
               
               if (distLeft / distRight > 2.5 || distRight / distLeft > 2.5) {
                 if (socketRef.current && infoRef.current) {
                   socketRef.current.emit('interview:violation', { sessionId: infoRef.current.sessionId, type: 'looking_away' });
                 }
               }

               // Lip Mismatch Heuristic
               if ((window as any).currentMicVolume > threshold) {
                 const upperLip = mesh[13];
                 const lowerLip = mesh[14];
                 const distance = Math.abs(upperLip.y - lowerLip.y);
                 
                 // If voice is loud but mouth is closed (distance < 3px)
                 if (distance < 3 && socketRef.current && infoRef.current) {
                   socketRef.current.emit('interview:violation', { sessionId: infoRef.current.sessionId, type: 'audio_visual_mismatch' });
                 }
               }
             }
          }

        } catch (e) {
          // ignore transient CV errors
        }
      }, 1500);
    };

    loadModels();

    return () => {
      if (proctorInterval) clearInterval(proctorInterval);
      if (faceDetector) { try { faceDetector.dispose(); } catch(e){} }
      if (landmarksDetector) { try { landmarksDetector.dispose(); } catch(e){} }
    };
  }, [loading, ended, error, lobbyConfirmed, token]);

  // Force fullscreen request helper
  const reenterFullscreen = () => {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen()
        .then(() => {
          setIsFullscreen(true);
          setTabWarning(false);
        })
        .catch(err => {
          console.error("Re-entering fullscreen failed:", err);
        });
    }
  };

  // WebSocket connection & routing events
  useEffect(() => {
    if (!info || !lobbyConfirmed) return;

    const socket = io(API_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    const runOnboarding = async () => {
      if (hasStartedSequence.current) return;
      hasStartedSequence.current = true;

      const sequence = [
        { text: "Welcome to your interview. This is Jordan your Ai interviewer today, Before we begin, please ensure your camera and microphone are working properly.", uiText: "Welcome to your interview. Before we begin, please ensure your camera and microphone are working properly.", phase: "GREETING" as const },
        { text: "This interview is monitored using AI-powered proctoring technology. Any violations such as tab switching, multiple face detection, external assistance, or prolonged absence from the camera may be reported to the hiring team and could affect your evaluation.", uiText: "This interview is monitored using AI-powered proctoring technology. Any violations such as tab switching, multiple face detection, external assistance, or prolonged absence from the camera may be reported to the hiring team and could affect your evaluation.", phase: "RULES_READING" as const },
        { text: "Once you are ready, we will begin with the interview questions", uiText: "", phase: "WAITING_FOR_ACK" as const }
      ];

      for (const step of sequence) {
        setCurrentPhase(step.phase);
        setActiveText(step.uiText);
        await speakText(step.text);
      }
      
      setActiveText('');
      setInterviewState('IDLE_WAIT');
    };

    const startSession = () => {
      if (!socket.connected) return;
      if ((socket as any).hasStartedInterview) return;

      // TEMPORARILY BYPASSED FULLSCREEN FOR TESTING
      // if (document.fullscreenElement) {
        (socket as any).hasStartedInterview = true;
        setHasStarted(true);
        
        // Trigger the explicit backend reset on start
        if (info) {
          socket.emit('interview:reset', { sessionId: info.sessionId });
        }

        const needsReset = sessionStorage.getItem(`needs_reset_${token}`) === 'true';
        if (needsReset) {
          sessionStorage.removeItem(`needs_reset_${token}`);
        }
        
        setTimeout(() => {
          runOnboarding();
        }, 500);
      // }
    };

    socket.on('connect', () => {
      setConnected(true);
      startSession();
    });

    socket.on('interview:question', (data: { questionText: string; currentPhase?: string; type: string; sequenceNum: number }) => {
      const phase = (data.currentPhase as any) || 'INTERVIEW';
      
      if (lastSpokenTextRef.current === data.questionText) return;
      
      // Let speakText handle lastSpokenTextRef and hasFinishedSpeakingRef
      // otherwise it will instantly resolve without speaking!

      const msg: Message = {
        id: `q-${data.sequenceNum}-${Date.now()}`,
        role: 'ai',
        content: data.questionText,
        type: 'question',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, msg]);
      setCurrentQuestionNum(data.sequenceNum || 1);
      setCurrentPhase('INTERVIEW_ACTIVE');
      setActiveText(data.questionText);

      speakText(data.questionText).then(() => {
        setInterviewState('IDLE_WAIT');
      });
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

    socket.on('error', (data: { message: string }) => {
      console.error('Backend returned error:', data.message);
      setInterviewState('IDLE_WAIT'); // Unfreeze the UI
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: 'ai',
        content: `Error: ${data.message}. Please try answering again.`,
        type: 'system',
        timestamp: new Date(),
      }]);
    });

    socket.on('interview:complete', (data: { message: string }) => {
      setMessages(prev => [...prev, {
        id: `sys-${Date.now()}`,
        role: 'ai',
        content: data.message,
        type: 'system',
        timestamp: new Date(),
      }]);
      setIsGeneratingReport(true);
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (mediaRecorderRef.current) {
        try { mediaRecorderRef.current.stop(); } catch (e) {}
      }
    });

    socket.on('interview:report_saved', (data: { success: boolean }) => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      setEnded(true);
      router.push('/thank-you');
    });

    socket.on('disconnect', () => setConnected(false));

    // Monitor fullscreen change to start interview once candidate enters fullscreen
    const handleFullscreen = () => {
      if (document.fullscreenElement) {
        startSession();
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreen);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreen);
      socket.disconnect();
    };
  }, [info, speakText, lobbyConfirmed, token]);

  // Global test timer countdown
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


  // Real-time audio analyser for mic volume decibels monitor
  useEffect(() => {
    if (!streamRef.current) return;
    const audioTracks = streamRef.current.getAudioTracks();
    if (audioTracks.length === 0) return;

    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let animationFrameId: number;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContext = new AudioContextClass();
      analyser = audioContext.createAnalyser();
      source = audioContext.createMediaStreamSource(streamRef.current);
      source.connect(analyser);
      
      analyser.fftSize = 32;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkVolume = () => {
        if (!analyser) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        setMicVolume(average);
        (window as any).currentMicVolume = average; // Expose for CV loop without stale closures
        animationFrameId = requestAnimationFrame(checkVolume);
      };
      checkVolume();
    } catch (e) {
      console.warn("Failed to initialize audio analyser:", e);
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
      }
    };
  }, [streamRef.current]);

  const stopMediaRecorder = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.error("Error stopping media recorder:", e);
      }
    }
    
    if (maxDurationTimerRef.current) clearTimeout(maxDurationTimerRef.current);
    if (silenceCheckTimerRef.current) clearInterval(silenceCheckTimerRef.current);
    
    setIsRecording(false);
    setSpeechStatus('idle');
  }, []);

  const handleAudioFinalized = useCallback((audioBlob: Blob) => {
    if (isEndedRef.current) {
      console.log('Skipping audio upload because interview has already ended.');
      return;
    }
    
    setInterviewState('PROCESSING');

    if (handshakeTimeoutRef.current) {
      clearTimeout(handshakeTimeoutRef.current);
      handshakeTimeoutRef.current = null;
    }

    const msg: Message = {
      id: `a-${Date.now()}`,
      role: 'candidate',
      content: "[Audio Recorded. Transcribing...]",
      type: 'answer',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, msg]);

    if (!socketRef.current || !infoRef.current) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      socketRef.current?.emit('interview:audio_answer', {
        sessionId: infoRef.current!.sessionId,
        audioBuffer: reader.result,
      });
    };
    reader.readAsArrayBuffer(audioBlob);

    setSpeechStatus('idle');
    setIsRecording(false);
  }, []);

  const startMediaRecorder = useCallback(() => {
    if (!streamRef.current) {
      setSpeechErrorMsg('Camera/Microphone stream not available.');
      setSpeechStatus('error');
      return;
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }

    audioChunksRef.current = [];
    silenceStartRef.current = null;

    try {
      const audioTracks = streamRef.current.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error("No physical microphone detected by the browser.");
      }

      const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', ''];
      let selectedMimeType = '';
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          selectedMimeType = type;
          break;
        }
      }

      if (!streamRef.current.active) {
        throw new Error("Camera/Microphone stream is not active.");
      }

      const audioStream = new MediaStream(audioTracks);
      const recorder = new MediaRecorder(audioStream, {
        mimeType: selectedMimeType || undefined
      });
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstart = () => {
        setSpeechStatus('recording');
        setIsRecording(true);
        micStartTimeRef.current = Date.now();

        // Setup max duration hard cutoff (3 minutes)
        maxDurationTimerRef.current = setTimeout(() => {
          console.warn("Max recording duration reached. Auto-stopping.");
          stopMediaRecorder();
        }, 180000); // 3 minutes

        // Setup Silence VAD based on micVolume state.
        // To avoid stale state closures, we use the interviewStateRef
        silenceCheckTimerRef.current = setInterval(() => {
          // Calculate volume dynamically from latest available data
          let currentVol = 0;
          if (streamRef.current) {
            // we rely on the parent useEffect's micVolume update, which runs on requestAnimationFrame
            // The micVolume state is captured in closure, so we need to ensure we read it via a ref if it's stale.
            // Actually, we can read the micVolume state if we add it to dependency array, but then it restarts.
            // A better way is to check the duration since start. We'll use the timer to auto stop.
          }
        }, 500);
      };

      recorder.onstop = () => {
        if (maxDurationTimerRef.current) clearTimeout(maxDurationTimerRef.current);
        if (silenceCheckTimerRef.current) clearInterval(silenceCheckTimerRef.current);
        
        const type = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type });
        
        if (audioBlob.size === 0) {
           console.warn("Audio blob is completely empty, resetting");
           if (shouldBeListeningRef.current) setTimeout(startMediaRecorder, 500);
           return;
        }

        handleAudioFinalized(audioBlob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(); // Emit chunk only at the end
    } catch (e: any) {
      console.error("Failed to start MediaRecorder:", e);
      setSpeechStatus('error');
      setSpeechErrorMsg(e.message || 'Start failed');
      setIsRecording(false);
    }
  }, [handleAudioFinalized, stopMediaRecorder]);

  // VAD Check using useEffect to access fresh micVolume
  useEffect(() => {
    if (speechStatus === 'recording' && isRecording) {
      if (micVolume > 25) {
        if (interviewState !== 'USER_SPEAKING') {
          setInterviewState('USER_SPEAKING');
        }
        silenceStartRef.current = null;
      } else if (micVolume <= 25) {
        if (interviewState === 'USER_SPEAKING') {
          if (silenceStartRef.current === null) {
            silenceStartRef.current = Date.now();
          } else {
            if (Date.now() - silenceStartRef.current > 4000) { // 4 seconds silence
              stopMediaRecorder();
            }
          }
        } else if (interviewState === 'IDLE_WAIT') {
          // Wait up to 30 seconds for them to start speaking
          if (Date.now() - micStartTimeRef.current > 30000) {
             stopMediaRecorder();
          }
        }
      }
    }
  }, [micVolume, speechStatus, isRecording, interviewState, stopMediaRecorder]);

  // Automatic recording trigger based on interviewState
  useEffect(() => {
    if (interviewState === 'IDLE_WAIT' && !isRecording) {
      shouldBeListeningRef.current = true;
      startMediaRecorder();
    } else if ((interviewState === 'AI_SPEAKING' || interviewState === 'PROCESSING') && isRecording) {
      shouldBeListeningRef.current = false;
      stopMediaRecorder();
    }
  }, [interviewState, startMediaRecorder, stopMediaRecorder, isRecording]);

  // Resume conversation when returning to fullscreen
  useEffect(() => {
    if (isFullscreen && hasStarted && !ended && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === 'ai' && lastMsg.type === 'question') {
        if (!hasFinishedSpeakingRef.current) {
          speakText(lastMsg.content);
        } else {
          // If we finished speaking, we should just resume listening
          setInterviewState('IDLE_WAIT');
        }
      } else if (interviewState === 'IDLE_WAIT' && !isRecording) {
        startMediaRecorder();
      }
    }
  }, [isFullscreen, hasStarted, ended, messages, speakText, startMediaRecorder, interviewState]);

  // Terminate/conclude assessment execution
  const handleEndInterview = useCallback(() => {
    if (socketRef.current && info) {
      socketRef.current.emit('interview:end', { sessionId: info.sessionId });
    }
    setEnded(true);
    isEndedRef.current = true;
    window.speechSynthesis?.cancel();
    if (mediaRecorderRef.current) {
      try { mediaRecorderRef.current.stop(); } catch (e) {}
    }

    // Disable camera and mic completely upon mounting this final screen state
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  }, [info]);

  // Cleanup tracks on unmount if ended turns true
  useEffect(() => {
    if (ended && streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  }, [ended]);

  // Loading indicator
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
          <span className="text-zinc-500 text-sm font-medium">Entering Workspace...</span>
        </div>
      </div>
    );
  }

  // Report Generation indicator
  if (isGeneratingReport) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="flex flex-col items-center text-center gap-4">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-2" />
          <h2 className="text-2xl font-bold text-white tracking-tight">Interview Complete</h2>
          <span className="text-zinc-400 text-sm font-medium bg-zinc-900 px-4 py-2 rounded-full border border-zinc-800">
            Generating your final report...
          </span>
        </div>
      </div>
    );
  }

  // Error screen
  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Workspace Error</h2>
          <p className="text-zinc-500 text-sm leading-relaxed">{error}</p>
        </div>
      </div>
    );
  }

  // End of Test Handshake Screen
  if (ended) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4 font-sans select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-zinc-950 border border-zinc-900 rounded-2xl p-8 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8 text-green-500 animate-pulse" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight mb-3">Assessment Submitted Successfully ✅</h2>
          <p className="text-zinc-400 text-xs leading-relaxed mb-6">
            Thank you, <strong className="text-white">{info?.candidate?.name || 'Candidate'}</strong>. Your interview responses and automated resume analysis have been securely compiled and delivered to the hiring team. You can now close this browser window safely.
          </p>
          <div className="p-3 bg-zinc-900/30 border border-zinc-900 rounded-lg inline-flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Device Connections Terminated</span>
          </div>
        </motion.div>
      </div>
    );
  }  // Fetch the latest question display
  const currentQuestion = messages.filter(m => m.role === 'ai' && m.type === 'question').slice(-1)[0]?.content || "Connecting with the AI interviewer...";

  // Calculate timer values
  const totalDurationSeconds = info ? info.template.durationMin * 60 : 3600;

  if (!lobbyConfirmed && info) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 font-sans text-white selection:bg-blue-500/30">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
        >
          <div className="p-8 border-b border-zinc-800 bg-zinc-900/30">
            <h1 className="text-2xl font-bold tracking-tight mb-2">{info.company.name} Technical Assessment</h1>
            <p className="text-zinc-400 text-sm">AI-Proctored Voice Interview for {info.jobRole.title}</p>
          </div>
          
          <div className="p-8 space-y-8">
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-6">
              <h2 className="text-xl font-semibold text-white mb-2">Welcome, {info.candidate?.name || 'Candidate'}</h2>
              <p className="text-zinc-400 text-sm">
                You are securely logged in as <strong className="text-white bg-zinc-900 px-2 py-1 rounded">{info.candidate?.email || 'Unknown Email'}</strong>.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500">Assessment Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                  <span className="text-zinc-500 text-xs font-bold uppercase block mb-1">Expected Duration</span>
                  <span className="text-white text-sm font-medium">{info.template.durationMin} Minutes</span>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                  <span className="text-zinc-500 text-xs font-bold uppercase block mb-1">Format</span>
                  <span className="text-white text-sm font-medium">AI Conversational</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500">Strict Instructions</h3>
              <ul className="space-y-3 text-sm text-zinc-300">
                <li className="flex items-start gap-3">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>Ensure you are in a quiet, distraction-free environment. Background noise will affect the AI.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>You must remain in fullscreen mode. Exiting fullscreen or switching tabs will flag your session.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>Camera and microphone access are required. Your face must remain visible at all times.</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="p-8 border-t border-zinc-800 bg-zinc-900/30">
            <button
              onClick={() => {
                setLobbyConfirmed(true);
                if (document.documentElement.requestFullscreen) {
                  document.documentElement.requestFullscreen().catch(e => console.error(e));
                }
              }}
              className="w-full py-4 rounded-xl bg-white text-black font-bold text-lg hover:bg-zinc-200 transition-colors flex items-center justify-center gap-3"
            >
              I Confirm This Is Me <span className="text-zinc-400">→</span> Start Interview
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // TEMPORARILY BYPASSED FULLSCREEN FOR TESTING
  // If the socket connected but they are not in fullscreen and hasn't started yet, prompt them!
  if (false && !hasStarted && connected && !isFullscreen) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 font-sans text-white">
        <div className="text-center max-w-md">
          <Maximize className="w-12 h-12 text-amber-500 mx-auto mb-4 animate-bounce" />
          <h2 className="text-xl font-bold text-white mb-2">Fullscreen Required</h2>
          <p className="text-zinc-400 text-sm mb-6">
            Proctara assessments require fullscreen mode. Please click the button below to enter fullscreen and begin your interview.
          </p>
          <button
            onClick={reenterFullscreen}
            className="px-6 py-3 bg-white text-black font-bold rounded-lg hover:bg-zinc-200 transition-colors"
          >
            Enter Fullscreen & Start
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-black flex flex-col font-sans select-none overflow-hidden relative text-white">
      {/* Absolute Fullscreen Enforcer Modal */}
      <AnimatePresence>
        {(!isFullscreen || tabWarning) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-6 text-center"
          >
            <div className="max-w-sm bg-zinc-950 border border-zinc-900 p-6 rounded-2xl space-y-4 shadow-xl">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto animate-bounce" />
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Fullscreen Mode Required</h3>
                <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                  To preserve proctor integrity, tab visibility and fullscreen mode are strictly monitored. Click the button below to resume the assessment.
                </p>
              </div>
              <button
                onClick={reenterFullscreen}
                className="w-full py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold transition-all flex items-center justify-center gap-1.5"
              >
                <Maximize className="w-3.5 h-3.5" /> Re-enter Fullscreen
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Absolute Camera Warning Modal */}
      <AnimatePresence>
        {cameraWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 text-center"
          >
            <div className="max-w-sm bg-zinc-950 border border-zinc-900 p-6 rounded-2xl space-y-4 shadow-xl">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto animate-bounce" />
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">No Face Detected</h3>
                <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                  Your face is not visible to the camera. Please ensure you are clearly visible to continue the proctored assessment.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quit Confirmation Modal */}
      <AnimatePresence>
        {showQuitConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-6 text-center"
          >
            <div className="max-w-sm bg-zinc-950 border border-zinc-900 p-6 rounded-2xl space-y-4 shadow-xl">
              <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6 text-red-500 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">End Assessment?</h3>
                <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                  Are you sure you want to quit the assessment? This will submit your progress and terminate the session. You cannot undo this action.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowQuitConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-zinc-800 text-xs font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowQuitConfirm(false);
                    handleEndInterview();
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all"
                >
                  Yes, Quit
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header HUD Navigation bar */}
      <header className="bg-transparent border-b border-zinc-900/40 px-8 h-16 flex items-center justify-between shrink-0 relative z-10">
        <span className="text-base font-bold text-white tracking-tight uppercase">
          Proctara<span className="text-amber-500">.</span>
        </span>
        <div className="flex items-center gap-6 text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
          {/* Company / Job Info */}
          <span className="hidden sm:inline">
            {info?.company.name} <span className="text-zinc-800 mx-2">|</span> {info?.jobRole.title} Assessment
          </span>

          {/* live Socket Status */}
          <div className={`flex items-center gap-1.5 ${connected ? 'text-green-500' : 'text-red-500 animate-pulse'}`}>
            <span className={`w-1 h-1 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            {connected ? 'Live Sync' : 'Connecting'}
          </div>

          {/* Remaining countdown timer */}
          <div className="flex items-center gap-1.5 text-zinc-400">
            <Clock className="w-3.5 h-3.5 text-zinc-500" />
            <span className="font-mono">{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</span>
          </div>

          {/* End Assessment Option link */}
          <button
            onClick={() => setShowQuitConfirm(true)}
            className="text-red-500/80 hover:text-red-500 tracking-widest border-b border-transparent hover:border-red-500/20 uppercase transition-all"
          >
            Quit
          </button>
        </div>
      </header>

      {/* Floating Picture-in-Picture Proctor Feed */}
      <div className="absolute top-24 right-8 z-20 w-40 aspect-video bg-zinc-950 border border-zinc-900 rounded-xl overflow-hidden shadow-2xl">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover scale-x-[-1]"
        />
        {/* Overlay Blinking Red Badge REC */}
        <div className="absolute top-2.5 left-2.5 z-30 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-md border border-zinc-800">
          <div className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[8px] font-bold text-red-500 uppercase tracking-wider">REC</span>
        </div>
      </div>

      {/* Main Workspace (Centered visual pod) */}
      <main className="flex-1 flex items-center justify-center p-8 relative z-10">
        <AnimatePresence mode="wait">
            <motion.div
              key="active-interview-stage"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-2xl flex flex-col items-center justify-center text-center space-y-12"
            >
          
          {/* Dual-State Centered Interaction Pod */}
          <div className="flex items-center justify-center min-h-[220px]">
            { (interviewState === 'AI_SPEAKING' || interviewState === 'PROCESSING') ? (
              /* Golden Audio Orb */
              <div className="relative w-48 h-48 flex items-center justify-center">
                {/* Breathing background blur glows */}
                <motion.div
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.15, 0.35, 0.15],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 3,
                    ease: "easeInOut",
                  }}
                  className="absolute inset-0 rounded-full bg-amber-500/20 filter blur-xl"
                />
                
                {/* Core Undulating Orb */}
                <motion.div
                  animate={interviewState === 'AI_SPEAKING' ? {
                    scale: [1, 1.08, 1],
                    boxShadow: [
                      "0 0 30px 4px rgba(245, 158, 11, 0.25)",
                      "0 0 50px 12px rgba(245, 158, 11, 0.45)",
                      "0 0 30px 4px rgba(245, 158, 11, 0.25)"
                    ]
                  } : {
                    scale: [1, 1.02, 1],
                    boxShadow: "0 0 25px 2px rgba(245, 158, 11, 0.15)"
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: interviewState === 'AI_SPEAKING' ? 1.8 : 3,
                    ease: "easeInOut"
                  }}
                  className="w-36 h-36 rounded-full bg-gradient-to-tr from-amber-500/10 to-amber-500/5 border border-amber-500/30 flex items-center justify-center z-10"
                >
                  <motion.div
                    animate={interviewState === 'PROCESSING' ? {
                      rotate: 360
                    } : {}}
                    transition={interviewState === 'PROCESSING' ? {
                      repeat: Infinity,
                      duration: 2,
                      ease: "linear"
                    } : {}}
                  >
                    <Volume2 className={`w-8 h-8 ${interviewState === 'AI_SPEAKING' ? 'text-amber-500 animate-pulse' : 'text-amber-500/60'}`} />
                  </motion.div>
                </motion.div>
              </div>
            ) : (
              /* Vocal Wave String (Active voice monitor based on micVolume decibels) */
              <div className="flex items-center gap-2 h-20 px-8 rounded-full border border-zinc-900 bg-zinc-950/20 backdrop-blur-md shadow-inner">
                {[...Array(9)].map((_, i) => {
                  // Calculate dynamic height based on volume and index to create a wave shape
                  const volumeFactor = micVolume / 255;
                  const baseHeight = i === 4 ? 36 : i === 3 || i === 5 ? 28 : i === 2 || i === 6 ? 20 : i === 1 || i === 7 ? 12 : 6;
                  const activeHeight = baseHeight + (volumeFactor * (72 - baseHeight));
                  
                  const isUserSpeaking = interviewState === 'USER_SPEAKING';
                  const isIdleWait = interviewState === 'IDLE_WAIT';
                  
                  return (
                    <motion.div
                      key={i}
                      animate={isUserSpeaking ? {
                        height: [activeHeight, activeHeight * (0.3 + Math.random() * 0.7), activeHeight],
                      } : isIdleWait ? {
                        height: [baseHeight, baseHeight * 0.7, baseHeight],
                      } : {
                        height: 2
                      }}
                      transition={isUserSpeaking ? {
                        repeat: Infinity,
                        duration: 0.15 + (i % 3) * 0.08,
                        ease: "easeInOut"
                      } : isIdleWait ? {
                        repeat: Infinity,
                        duration: 1.2 + (i % 3) * 0.25,
                        ease: "easeInOut"
                      } : {
                        duration: 0.3
                      }}
                      className="w-1.5 rounded-full bg-amber-500/80"
                      style={{ height: isUserSpeaking ? undefined : isIdleWait ? undefined : 2 }}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* Subtitles & HUD Typography */}
          <div className="space-y-6 px-4 w-full">
            {/* Dynamic State Status Label */}
            <div className="flex flex-col items-center gap-3">
              {/* Manual Stop button removed in favor of purely VAD-driven silence cutoff */}
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-zinc-955 border border-zinc-900 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                {interviewState === 'AI_SPEAKING' && (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Jordan Speaking ({currentPhase === 'GREETING' ? 'Introduction' : currentPhase === 'RULES_READING' ? 'Setup Check' : currentPhase === 'FALLBACK' ? 'Pivot Question' : 'Interview'})
                  </>
                )}
                {interviewState === 'PROCESSING' && (
                  <>
                    <Loader2 className="w-3 h-3 text-amber-500 animate-spin" />
                    Jordan is Thinking...
                  </>
                )}
                {interviewState === 'IDLE_WAIT' && (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Jordan Listening (Standby)
                  </>
                )}
                {interviewState === 'USER_SPEAKING' && (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    Live Transcribing...
                  </>
                )}
              </span>
            </div>

            {/* Typography-Only HUD (Fading Conversation Stream Log) */}
            <div className="min-h-[140px] flex items-center justify-center w-full max-w-xl">
              <div className="w-full flex flex-col justify-end gap-5">
                {/* Single Text Renderer (Cinematic) */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="text-center"
                >
                  <p className="font-semibold leading-relaxed font-sans tracking-tight text-[24px] md:text-[28px] text-zinc-100">
                    {activeText}
                  </p>
                </motion.div>

                {/* Clean Listening Indicator */}
                {(interviewState === 'IDLE_WAIT' || interviewState === 'USER_SPEAKING') && (
                  <div className="flex flex-col items-center mt-8 animate-fade-in">
                     <span className="text-xs tracking-widest text-zinc-500 uppercase font-medium animate-pulse">
                        ● Listening...
                     </span>
                  </div>
                )}
              </div>
            </div>

            {/* Diagnostic Error Banner */}
            {speechStatus === 'error' && (
              <div className="text-xs text-red-500 flex items-center justify-center gap-1.5 bg-red-500/5 border border-red-500/10 rounded-lg p-2.5 max-w-md mx-auto">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Mic Error ({speechErrorMsg}). Please check browser permissions.</span>
              </div>
            )}
          </div>

            </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
