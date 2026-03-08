'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera,
  Mic,
  Volume2,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Shield,
  Clock,
  Wifi,
  MonitorSmartphone,
  Play,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { interviewApi } from '@/lib/api';

type Step = 'device' | 'audio' | 'instructions' | 'ready';

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

  const [step, setStep] = useState<Step>('device');
  const [cameraOk, setCameraOk] = useState(false);
  const [micOk, setMicOk] = useState(false);
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
      .catch(() => {
        setError('Invalid or expired interview link');
        setLoading(false);
      });
  }, [token]);

  // Request camera + mic
  const requestDevices = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setCameraOk(true);

      // Check audio tracks
      const audioTracks = stream.getAudioTracks();
      setMicOk(audioTracks.length > 0 && audioTracks[0].enabled);
    } catch {
      setCameraOk(false);
      setMicOk(false);
    }
  }, []);

  // Test audio — record and play back
  const testAudio = useCallback(async () => {
    if (!streamRef.current) return;
    setAudioTested(false);

    const mediaRecorder = new MediaRecorder(streamRef.current);
    const chunks: Blob[] = [];

    mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'audio/webm' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play();
      setAudioTested(true);
    };

    mediaRecorder.start();
    setTimeout(() => mediaRecorder.stop(), 3000); // Record 3 seconds
  }, []);

  // Start interview — navigate to interview page
  const startInterview = () => {
    // Stop preview stream
    streamRef.current?.getTracks().forEach(t => t.stop());
    router.push(`/interview/${token}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-white animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl text-white mb-2">Interview Not Found</h2>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  const steps: { id: Step; label: string }[] = [
    { id: 'device', label: 'Device Check' },
    { id: 'audio', label: 'Audio Test' },
    { id: 'instructions', label: 'Instructions' },
    { id: 'ready', label: 'Ready' },
  ];

  const currentIndex = steps.findIndex(s => s.id === step);

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <header className="border-b border-white/[0.06] px-6 h-14 flex items-center justify-between">
        <span className="text-lg font-semibold text-white">
          Proctara<span className="text-amber-400">.</span>
        </span>
        <div className="text-sm text-gray-500">
          {interviewInfo?.company.name} — {interviewInfo?.jobRole.title}
        </div>
      </header>

      {/* Progress Bar */}
      <div className="px-6 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 max-w-2xl mx-auto">
          {steps.map((s, i) => (
            <div key={s.id} className="flex items-center flex-1">
              <div className={`flex items-center gap-2 ${i <= currentIndex ? 'text-white' : 'text-gray-700'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  i < currentIndex ? 'bg-green-500 text-white' :
                  i === currentIndex ? 'bg-white text-black' :
                  'bg-white/[0.06] text-gray-600'
                }`}>
                  {i < currentIndex ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                </div>
                <span className="text-xs font-medium hidden sm:inline">{s.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-px mx-2 ${i < currentIndex ? 'bg-green-500' : 'bg-white/[0.06]'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <AnimatePresence mode="wait">
          {/* Step 1: Device Check */}
          {step === 'device' && (
            <motion.div key="device" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="w-full max-w-lg text-center">
              <h2 className="text-2xl font-bold text-white mb-2">Device Check</h2>
              <p className="text-gray-500 text-sm mb-8">We need access to your camera and microphone</p>

              {/* Video Preview */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden mb-6 aspect-video relative">
                <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                {!cameraOk && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                    <Camera className="w-12 h-12 text-gray-700" />
                  </div>
                )}
              </div>

              {/* Status */}
              <div className="flex justify-center gap-6 mb-8">
                <div className="flex items-center gap-2 text-sm">
                  {cameraOk ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-gray-600" />}
                  <span className={cameraOk ? 'text-green-400' : 'text-gray-600'}>Camera</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {micOk ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-gray-600" />}
                  <span className={micOk ? 'text-green-400' : 'text-gray-600'}>Microphone</span>
                </div>
              </div>

              <div className="flex gap-3 justify-center">
                {!cameraOk && (
                  <button
                    onClick={requestDevices}
                    className="px-6 py-3 rounded-xl bg-white text-black text-sm font-semibold hover:bg-gray-100 transition-all"
                  >
                    Allow Camera & Mic
                  </button>
                )}
                {cameraOk && micOk && (
                  <button
                    onClick={() => setStep('audio')}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-black text-sm font-semibold hover:bg-gray-100 transition-all"
                  >
                    Continue <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* Step 2: Audio Test */}
          {step === 'audio' && (
            <motion.div key="audio" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="w-full max-w-lg text-center">
              <h2 className="text-2xl font-bold text-white mb-2">Audio Test</h2>
              <p className="text-gray-500 text-sm mb-8">Speak for a few seconds to verify your microphone</p>

              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8 mb-6">
                <div className="w-20 h-20 rounded-full bg-white/[0.06] flex items-center justify-center mx-auto mb-4">
                  <Volume2 className="w-8 h-8 text-amber-400" />
                </div>
                <p className="text-sm text-gray-400 mb-6">Click the button below and speak clearly for 3 seconds. Your audio will be played back.</p>
                <button
                  onClick={testAudio}
                  className="px-6 py-3 rounded-xl bg-amber-500/20 text-amber-400 text-sm font-medium border border-amber-500/30 hover:bg-amber-500/30 transition-all"
                >
                  <Mic className="w-4 h-4 inline mr-2" />
                  Test My Audio
                </button>
                {audioTested && (
                  <p className="text-green-400 text-sm mt-4 flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Audio playback complete
                  </p>
                )}
              </div>

              <button
                onClick={() => setStep('instructions')}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-black text-sm font-semibold hover:bg-gray-100 transition-all mx-auto"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* Step 3: Instructions */}
          {step === 'instructions' && (
            <motion.div key="instructions" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="w-full max-w-lg">
              <h2 className="text-2xl font-bold text-white mb-2 text-center">Interview Guidelines</h2>
              <p className="text-gray-500 text-sm mb-8 text-center">Please read these carefully before starting</p>

              <div className="space-y-4 mb-8">
                {[
                  { icon: Clock, title: `Duration: ${interviewInfo?.template.durationMin || 45} minutes`, desc: 'The interview is timed. Make sure you have enough uninterrupted time.' },
                  { icon: MonitorSmartphone, title: 'No tab switching', desc: 'Switching tabs or windows will be flagged and may affect your trust score.' },
                  { icon: Wifi, title: 'Stable internet connection', desc: 'Ensure a strong and stable connection throughout the interview.' },
                  { icon: Camera, title: 'Camera & microphone must stay on', desc: 'Your video and audio will be used for AI evaluation.' },
                  { icon: Shield, title: 'Fair evaluation', desc: 'Your answers are evaluated only on technical content. No bias based on appearance or accent.' },
                ].map((item, i) => (
                  <div key={i} className="flex gap-4 p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl">
                    <div className="w-10 h-10 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
                      <item.icon className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-white">{item.title}</h4>
                      <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setStep('ready')}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-black text-sm font-semibold hover:bg-gray-100 transition-all mx-auto"
              >
                I Understand <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* Step 4: Ready */}
          {step === 'ready' && (
            <motion.div key="ready" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-lg text-center">
              <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">You&apos;re All Set!</h2>
              <p className="text-gray-500 text-sm mb-8">
                Your interview for <span className="text-white">{interviewInfo?.jobRole.title}</span> at{' '}
                <span className="text-white">{interviewInfo?.company.name}</span> is ready to begin.
              </p>

              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 mb-8 inline-block">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Clock className="w-4 h-4" />
                  <span>Duration: <strong className="text-white">{interviewInfo?.template.durationMin} minutes</strong></span>
                </div>
              </div>

              <div>
                <button
                  onClick={startInterview}
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white text-black text-base font-bold hover:bg-gray-100 transition-all shadow-lg shadow-white/10"
                >
                  <Play className="w-5 h-5" />
                  Start Interview
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
