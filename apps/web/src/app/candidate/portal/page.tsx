'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Clock,
  Play,
  CheckCircle2,
  AlertCircle,
  LogOut,
  ChevronRight,
  Loader2,
  Building2,
  Briefcase,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { interviewApi } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface InterviewSession {
  id: string;
  status: string;
  inviteToken: string;
  createdAt: string;
  jobRole: { title: string; skills: string[]; level: string | null };
  template: { name: string; durationMin: number };
  company: { name: string; logoUrl: string | null };
  evaluation?: { overallScore: number; recommendation: string } | null;
}

export default function CandidatePortalPage() {
  const { candidate, logout, isLoading } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !candidate) {
      router.push('/candidate/login');
      return;
    }
    if (candidate) {
      interviewApi.mySessions().then(res => {
        setSessions((res.data || []) as unknown as InterviewSession[]);
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [candidate, isLoading, router]);

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-white animate-spin" />
      </div>
    );
  }

  const pending = sessions.filter(s => s.status === 'pending');
  const completed = sessions.filter(s => s.status === 'completed');
  const inProgress = sessions.filter(s => s.status === 'in_progress');

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="border-b border-white/[0.06] bg-black/90 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">
              Proctara<span className="text-amber-400">.</span>
            </h1>
            <p className="text-xs text-gray-600">Candidate Portal</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">{candidate?.name || candidate?.email}</span>
            <button
              onClick={() => { logout(); router.push('/candidate/login'); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:text-white hover:bg-white/[0.04] transition-all"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Welcome */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-2xl font-bold text-white mb-1">
            Welcome back, {candidate?.name || 'Candidate'}
          </h2>
          <p className="text-gray-500 text-sm">
            {pending.length > 0
              ? `You have ${pending.length} interview${pending.length > 1 ? 's' : ''} waiting`
              : 'No pending interviews at the moment'}
          </p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6 mb-8">
          {[
            { label: 'Pending', value: pending.length, color: 'text-amber-400' },
            { label: 'In Progress', value: inProgress.length, color: 'text-blue-400' },
            { label: 'Completed', value: completed.length, color: 'text-green-400' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
              <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-xs text-gray-600 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Pending Interviews */}
        {pending.length > 0 && (
          <section className="mb-8">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Ready to Start
            </h3>
            <div className="space-y-3">
              {pending.map((session, i) => (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 hover:border-white/[0.12] transition-all group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Building2 className="w-4 h-4 text-gray-600" />
                        <span className="text-xs text-gray-500">{session.company.name}</span>
                      </div>
                      <h4 className="text-lg font-medium text-white flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-gray-500" />
                        {session.jobRole.title}
                      </h4>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {session.template.durationMin} minutes
                        </span>
                        {session.jobRole.level && (
                          <span className="px-2 py-0.5 rounded-md bg-white/[0.04] capitalize">
                            {session.jobRole.level}
                          </span>
                        )}
                      </div>
                      {session.jobRole.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {session.jobRole.skills.slice(0, 5).map(skill => (
                            <span key={skill} className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 text-xs border border-blue-500/20">
                              {skill}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => router.push(`/interview/${session.inviteToken}/setup`)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-gray-100 transition-all group-hover:shadow-lg group-hover:shadow-white/5"
                    >
                      <Play className="w-4 h-4" />
                      Start Interview
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* Completed */}
        {completed.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Completed Interviews
            </h3>
            <div className="space-y-3">
              {completed.map((session) => (
                <div
                  key={session.id}
                  className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span className="text-sm font-medium text-white">{session.jobRole.title}</span>
                    </div>
                    <span className="text-xs text-gray-600">{session.company.name}</span>
                  </div>
                  {session.evaluation && (
                    <div className="text-right">
                      <div className="text-lg font-bold font-mono text-white">
                        {Number(session.evaluation.overallScore).toFixed(0)}
                        <span className="text-gray-600 text-sm font-normal">/100</span>
                      </div>
                      <span className={`text-xs capitalize ${
                        session.evaluation.recommendation === 'strong_yes' || session.evaluation.recommendation === 'yes'
                          ? 'text-green-400' : session.evaluation.recommendation === 'maybe'
                          ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {session.evaluation.recommendation?.replace('_', ' ')}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {sessions.length === 0 && (
          <div className="text-center py-20">
            <AlertCircle className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <h3 className="text-lg text-gray-400">No interviews yet</h3>
            <p className="text-sm text-gray-600 mt-1">
              Your assigned interviews will appear here once your recruiter sends them.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
