'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera,
  Mic,
  Volume2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Shield,
  Clock,
  Wifi,
  MonitorSmartphone,
  Loader2,
  Play,
  Globe,
  Monitor,
} from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { interviewApi } from '@/lib/api';

interface InterviewInfo {
  sessionId: string;
  company: { name: string };
  jobRole: { title: string; skills: string[] };
  template: { name: string; durationMin: number };
}

export default function InterviewSetupPage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;

  // Checks States
  const [cameraOk, setCameraOk] = useState(false);
  const [micOk, setMicOk] = useState(false);
  const [latencyStatus, setLatencyStatus] = useState('Checking...');
  const [latencyOk, setLatencyOk] = useState<boolean | null>(null);
  const [systemStatus, setSystemStatus] = useState('Checking...');
  const [systemOk, setSystemOk] = useState<boolean | null>(null);
  
  const [faceStatus, setFaceStatus] = useState('Initializing AI...');
  const [faceOk, setFaceOk] = useState<boolean>(false);

  const [isTestingAudio, setIsTestingAudio] = useState(false);
  const [audioTested, setAudioTested] = useState(false);
  const [loading, setLoading] = useState(true);
  const [interviewInfo, setInterviewInfo] = useState<InterviewInfo | null>(null);
  const [error, setError] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Load interview info
  useEffect(() => {
    interviewApi.join(token)
      .then(res => {
        setInterviewInfo(res.data as unknown as InterviewInfo);
        setLoading(false);
      })
      .catch((err) => {
        if (err.status === 403 && err.message === 'Interview session is no longer pending') {
          setError('This interview has already been completed.');
          setLoading(false);
          return;
        }
        if (err.status === 401 || err.status === 403) {
          router.push(`/candidate/login?callbackUrl=/interview/${token}/setup`);
          return;
        }
        setError('Invalid or expired interview link');
        setLoading(false);
      });
  }, [token, router]);

  // Request camera + mic
  const requestDevices = useCallback(async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setCameraOk(true);
      const audioTracks = stream.getAudioTracks();
      setMicOk(audioTracks.length > 0 && audioTracks[0].enabled);
    } catch (err) {
      console.error('Permission denied or no devices:', err);
      setCameraOk(false);
      setMicOk(false);
    }
  }, []);

  // Request permissions immediately when loading finishes
  useEffect(() => {
    if (!loading && interviewInfo) {
      requestDevices();
    }
    return () => {
      // Clean up stream tracks on unmount
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [loading, interviewInfo, requestDevices]);

  // Perform Internet Latency Check
  useEffect(() => {
    if (loading) return;

    const start = Date.now();
    // Fetch a HEAD request to calculate local server connection round-trip latency
    fetch(window.location.origin, { method: 'HEAD', cache: 'no-cache' })
      .then(() => {
        const duration = Date.now() - start;
        setLatencyStatus(`Stable (${duration}ms Latency)`);
        setLatencyOk(duration < 250); // Under 250ms is acceptable connection speed
      })
      .catch(() => {
        setLatencyStatus(navigator.onLine ? 'Unstable Connection' : 'Offline');
        setLatencyOk(false);
      });
  }, [loading]);

  // Perform System & Speech Synthesis/Recognition Compatibility Checks
  useEffect(() => {
    if (loading) return;

    const speechSupported = ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) && 'speechSynthesis' in window;
    const isDesktop = window.innerWidth >= 1024;

    if (!speechSupported) {
      setSystemStatus('Speech API unsupported. Please use Chrome.');
      setSystemOk(false);
    } else if (!isDesktop) {
      setSystemStatus('Compatible Browser (Desktop recommended)');
      setSystemOk(true); // Allow continuing, but display a soft desktop warning
    } else {
      setSystemStatus('Chrome WebRTC & Speech Synthesis compatible');
      setSystemOk(true);
    }
  }, [loading]);

  // Face Detection Check
  useEffect(() => {
    if (!cameraOk || !videoRef.current) return;

    let detector: any = null;
    let animationFrameId: number;
    let isDetecting = false;

    const loadModel = async () => {
      try {
        setFaceStatus('Loading Vision AI...');
        const tf = await import('@tensorflow/tfjs');
        await tf.ready();
        const faceDetection = await import('@tensorflow-models/face-detection');
        const model = faceDetection.SupportedModels.MediaPipeFaceDetector;
        const detectorConfig = {
          runtime: 'tfjs' as const,
          maxFaces: 10,
        };
        detector = await faceDetection.createDetector(model, detectorConfig);
        setFaceStatus('Looking for face...');
        detectFace();
      } catch (e) {
        console.error("Face detection load error:", e);
        setFaceStatus('AI Model Error');
        setFaceOk(false);
      }
    };

    const detectFace = async () => {
      if (!detector || !videoRef.current || isDetecting) {
        animationFrameId = requestAnimationFrame(detectFace);
        return;
      }
      
      try {
        if (videoRef.current.readyState >= 2) { // HAVE_CURRENT_DATA or more
          isDetecting = true;
          const faces = await detector.estimateFaces(videoRef.current);
          if (faces.length === 1) {
            setFaceStatus('Face Detected');
            setFaceOk(true);
          } else if (faces.length === 0) {
            setFaceStatus('No Face Detected');
            setFaceOk(false);
          } else {
            setFaceStatus(`Multiple Faces (${faces.length})`);
            setFaceOk(false);
          }
          isDetecting = false;
        }
      } catch (e) {
        isDetecting = false;
      }
      animationFrameId = requestAnimationFrame(detectFace);
    };

    loadModel();

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (detector) {
        try { detector.dispose(); } catch (e) {}
      }
    };
  }, [cameraOk]);

  // Test audio — record and play back + calibrate ambient noise
  const testAudio = useCallback(async () => {
    if (!streamRef.current) return;
    setIsTestingAudio(true);
    setAudioTested(false);

    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let animationFrameId: number;
    let maxAmbientVolume = 0;

    try {
      // Set up Audio Analyser for calibration
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContext = new AudioContextClass();
      analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(streamRef.current);
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
        if (average > maxAmbientVolume) {
          maxAmbientVolume = average;
        }
        animationFrameId = requestAnimationFrame(checkVolume);
      };
      checkVolume();

      const mediaRecorder = new MediaRecorder(streamRef.current);
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        if (audioContext && audioContext.state !== 'closed') audioContext.close();

        // Save the dynamic threshold (peak ambient noise + 15 padding, min 20, max 70)
        const calibratedThreshold = Math.min(Math.max(maxAmbientVolume + 15, 20), 70);
        sessionStorage.setItem(`audioThreshold_${token}`, calibratedThreshold.toString());
        console.log(`Calibrated audio threshold: ${calibratedThreshold} (peak: ${maxAmbientVolume})`);

        const blob = new Blob(chunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.play();
        setAudioTested(true);
        setIsTestingAudio(false);
      };

      mediaRecorder.start();
      setTimeout(() => {
        if (mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
      }, 3000); // Record 3 seconds
    } catch (err) {
      console.error('Audio recorder failed:', err);
      setIsTestingAudio(false);
      if (animationFrameId!) cancelAnimationFrame(animationFrameId!);
      if (audioContext && audioContext.state !== 'closed') audioContext.close();
    }
  }, [token]);

  // Start interview — navigate to interview page and request fullscreen
  const startInterview = () => {
    sessionStorage.setItem(`setup_complete_${token}`, 'true');
    sessionStorage.setItem(`needs_reset_${token}`, 'true');
    // Attempt fullscreen
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn("Fullscreen request rejected:", err);
      });
    }
    // Stop preview stream so interview page can request its own active stream
    streamRef.current?.getTracks().forEach(t => t.stop());
    router.push(`/interview/${token}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
          <span className="text-zinc-500 text-sm font-medium">Entering Waiting Room...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2 font-semibold">Interview Not Found</h2>
          <p className="text-zinc-500 text-sm leading-relaxed">{error}</p>
        </div>
      </div>
    );
  }

  // Verification conditions
  const permissionsConfigured = cameraOk && micOk && systemOk && faceOk;

  return (
    <div className="min-h-screen bg-black relative flex flex-col font-sans select-none text-white overflow-hidden">
      {/* Background Ambient Lighting (Low-Opacity Gold/White Radial Bleed) */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,184,0,0.035),transparent_60%)] pointer-events-none" />

      {/* Header */}
      <header className="bg-transparent border-b border-zinc-900/40 px-8 h-16 flex items-center justify-between shrink-0 relative z-10">
        <span className="text-base font-bold text-white tracking-tight uppercase">
          Proctara<span className="text-amber-500">.</span>
        </span>
        <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
          {interviewInfo?.company.name} <span className="text-zinc-800 mx-2">|</span> {interviewInfo?.jobRole.title} Assessment
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-6 md:p-12 relative z-10">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-stretch">
          
          {/* Left Column: Live Webcam Stream Preview */}
          <div className="lg:col-span-7 flex flex-col justify-between relative min-h-[350px]">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight mb-1.5">Pre-Interview Check</h1>
              <p className="text-xs text-zinc-500 mb-8">Verify your hardware status and system compatibility before starting.</p>
            </div>

            {/* Video Container */}
            <div className="bg-zinc-950 border border-zinc-850 rounded-2xl overflow-hidden aspect-video relative flex items-center justify-center flex-1 max-h-[360px] shadow-2xl">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover scale-x-[-1]"
              />
              {!cameraOk && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 gap-3 p-4">
                  <div className="w-12 h-12 rounded-full bg-zinc-950 flex items-center justify-center border border-zinc-900">
                    <Camera className="w-5 h-5 text-zinc-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-white">Camera Access Required</p>
                    <p className="text-xs text-zinc-500 mt-1.5 max-w-[280px] mx-auto leading-relaxed">
                      Please authorize camera permissions in your browser to proceed with the assessment.
                    </p>
                  </div>
                  <button
                    onClick={requestDevices}
                    className="mt-3 px-4 py-2 rounded-lg bg-white hover:bg-zinc-200 text-black text-xs font-semibold transition-all shadow-sm"
                  >
                    Grant Permissions
                  </button>
                </div>
              )}
            </div>

            {/* Micro-instructions */}
            <div className="mt-6 flex items-center gap-3 text-[11px] text-zinc-500 leading-normal">
              <Shield className="w-4 h-4 text-zinc-650 shrink-0" />
              <span>Webcam and microphone streams remain strictly local and confidential until the interview begins.</span>
            </div>
          </div>

          {/* Right Column: Device checks, audio test, start action */}
          <div className="lg:col-span-5 flex flex-col justify-between lg:pl-12 lg:border-l lg:border-zinc-900/60">
            
            {/* System Compatibility Verification */}
            <div className="space-y-6">
              <div>
                <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Compatibility Checklist</h3>
                <p className="text-[11px] text-zinc-500 mt-1">Please ensure all checks are green before launching.</p>
              </div>

              {/* Minimal Typographic Checklist */}
              <div className="space-y-1">
                {/* 1. Camera Status */}
                <div className="flex items-center justify-between py-3 border-b border-zinc-900/60">
                  <div className="flex items-center gap-3">
                    <Camera className={`w-4 h-4 ${cameraOk ? 'text-zinc-400' : 'text-zinc-600'}`} />
                    <span className="text-xs font-medium text-zinc-300">Camera</span>
                  </div>
                  <div className="flex items-center">
                    {cameraOk ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    )}
                  </div>
                </div>

                {/* 2. Microphone Status */}
                <div className="flex items-center justify-between py-3 border-b border-zinc-900/60">
                  <div className="flex items-center gap-3">
                    <Mic className={`w-4 h-4 ${micOk ? 'text-zinc-450' : 'text-zinc-600'}`} />
                    <span className="text-xs font-medium text-zinc-300">Microphone</span>
                  </div>
                  <div className="flex items-center">
                    {micOk ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    )}
                  </div>
                </div>

                {/* 3. Internet Check */}
                <div className="flex items-center justify-between py-3 border-b border-zinc-900/60">
                  <div className="flex items-center gap-3">
                    <Globe className={`w-4 h-4 ${latencyOk === true ? 'text-zinc-450' : 'text-zinc-600'}`} />
                    <span className="text-xs font-medium text-zinc-300">Internet Connection</span>
                  </div>
                  <div className="flex items-center">
                    {latencyOk === true ? (
                      <span title={latencyStatus}><CheckCircle2 className="w-4 h-4 text-emerald-500" /></span>
                    ) : latencyOk === false ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" title={latencyStatus} />
                    ) : (
                      <Loader2 className="w-3.5 h-3.5 text-zinc-650 animate-spin" />
                    )}
                  </div>
                </div>

                {/* 4. Browser/System Check */}
                <div className="flex items-center justify-between py-3 border-b border-zinc-900/60">
                  <div className="flex items-center gap-3">
                    <Monitor className={`w-4 h-4 ${systemOk === true ? 'text-zinc-400' : 'text-zinc-600'}`} />
                    <span className="text-xs font-medium text-zinc-300">Browser Compatibility</span>
                  </div>
                  <div className="flex items-center">
                    {systemOk === true ? (
                      <span title={systemStatus}><CheckCircle2 className="w-4 h-4 text-emerald-500" /></span>
                    ) : systemOk === false ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" title={systemStatus} />
                    ) : (
                      <Loader2 className="w-3.5 h-3.5 text-zinc-650 animate-spin" />
                    )}
                  </div>
                </div>

                {/* 5. Face Detection Check */}
                <div className="flex items-center justify-between py-3 border-b border-zinc-900/60">
                  <div className="flex items-center gap-3">
                    <Shield className={`w-4 h-4 ${faceOk ? 'text-zinc-400' : 'text-zinc-600'}`} />
                    <span className="text-xs font-medium text-zinc-300">Identity Verification</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">{faceStatus}</span>
                    {faceOk ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Loader2 className="w-3.5 h-3.5 text-zinc-650 animate-spin" />
                    )}
                  </div>
                </div>
              </div>

              {/* Audio Playback Test Section (Frameless) */}
              {cameraOk && micOk && (
                <div className="pt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-3.5 h-3.5 text-zinc-400" />
                    <span className="text-xs font-bold text-zinc-300">Test Your Audio Output</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    Verify your audio works. Click below, speak for 3 seconds, and listen to the playback.
                  </p>
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      onClick={testAudio}
                      disabled={isTestingAudio}
                      className="px-3.5 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-900 text-zinc-300 border border-zinc-800 text-xs font-semibold transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      {isTestingAudio ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Recording...
                        </>
                      ) : (
                        <>
                          <Mic className="w-3.5 h-3.5" /> Test Microphone
                        </>
                      )}
                    </button>
                    {audioTested && (
                      <span className="text-[11px] text-emerald-500 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Playback working
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Quick Checklist Guidelines */}
              <div className="space-y-3 pt-4 border-t border-zinc-900/60">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest block">Security Guidelines</span>
                <ul className="space-y-2.5">
                  <li className="flex gap-2.5 text-[11px] text-zinc-500 leading-relaxed">
                    <Clock className="w-4 h-4 text-zinc-650 shrink-0 mt-0.5" />
                    <span>Timed Assessment: Timed dynamic assessment for {interviewInfo?.template.durationMin || 45} minutes.</span>
                  </li>
                  <li className="flex gap-2.5 text-[11px] text-zinc-500 leading-relaxed">
                    <MonitorSmartphone className="w-4 h-4 text-zinc-650 shrink-0 mt-0.5" />
                    <span>Fullscreen Enforced: Exiting fullscreen or shifting tabs flags automated anomalies immediately.</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Start Button */}
            <div className="pt-6 border-t border-zinc-900/60 mt-8 lg:mt-0 flex flex-col gap-2">
              <button
                onClick={startInterview}
                disabled={!permissionsConfigured}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-white hover:bg-zinc-200 disabled:hover:bg-white text-black text-sm font-bold shadow-lg shadow-white/5 transition-all disabled:opacity-20 disabled:cursor-not-allowed group"
              >
                Start Assessment
                <span className="text-base font-semibold leading-none group-hover:translate-x-0.5 transition-transform">→</span>
              </button>
              {!permissionsConfigured && (
                <span className="text-[10px] text-zinc-650 mt-2 block text-center">
                  Please resolve device permissions & speech support checking to launch interview.
                </span>
              )}
            </div>

          </div>

        </div>
      </main>
    </div>
  );
}
