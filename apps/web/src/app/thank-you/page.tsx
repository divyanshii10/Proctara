import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function ThankYouPage() {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4 font-sans text-white">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-900 rounded-2xl p-8 text-center shadow-2xl">
        <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-8 h-8 text-green-500" />
        </div>
        
        <h1 className="text-2xl font-bold text-white tracking-tight mb-3">
          Assessment Submitted Successfully
        </h1>
        
        <p className="text-zinc-400 text-sm leading-relaxed mb-8">
          Thank you for completing the interview. Your responses and the AI evaluation report have been securely saved and submitted to the hiring team. They will reach out to you with the next steps.
        </p>
        
        <div className="space-y-4">
          <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg inline-flex items-center justify-center gap-2 w-full">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs text-zinc-300 font-medium tracking-wider">Device Connections Terminated</span>
          </div>
          
          <p className="text-xs text-zinc-500">
            You may now safely close this browser window.
          </p>
        </div>
      </div>
    </div>
  );
}
