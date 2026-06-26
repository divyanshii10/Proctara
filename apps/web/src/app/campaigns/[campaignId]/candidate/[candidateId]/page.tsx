'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Loader2,
  User,
  Mail,
  Phone,
  FileText,
  TrendingUp,
  Award,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Zap,
  Activity
} from 'lucide-react';
import { campaignApi } from '@/lib/api';

interface Candidate {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  resumeUrl: string | null;
  metadata: any;
}

interface ResponseItem {
  id: string;
  questionText: string;
  answerText: string | null;
  sequenceNum: number;
  aiScore: number | null;
  aiFeedback: any;
}

interface Evaluation {
  id: string;
  overallScore: number;
  recommendation: string | null;
  scores: any; // Breakdown scores JSON e.g. { technical: 85, communication: 90 }
  summary: string | null;
  strengths: string[];
  weaknesses: string[];
}

interface Session {
  id: string;
  status: string;
  completedAt: string | null;
  trustScore: number | null;
  evaluation: Evaluation | null;
  responses: ResponseItem[];
}

interface EvaluationData {
  candidate: Candidate;
  session: Session;
}

export default function CandidateEvaluationPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.campaignId as string;
  const candidateId = params.candidateId as string;

  const [data, setData] = useState<EvaluationData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchEvaluation = useCallback(async () => {
    try {
      const res = await campaignApi.getCandidateEvaluation(campaignId, candidateId);
      if (res.success && res.data) {
        setData(res.data as unknown as EvaluationData);
      }
    } catch (err) {
      console.error('Error fetching candidate evaluation:', err);
    } finally {
      setLoading(false);
    }
  }, [campaignId, candidateId]);

  useEffect(() => {
    if (campaignId && candidateId) {
      fetchEvaluation();
    }
  }, [campaignId, candidateId, fetchEvaluation]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-white animate-spin" />
      </div>
    );
  }

  if (!data || !data.session) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-4">
        <ShieldCheck className="w-12 h-12 text-zinc-500 mb-4" />
        <h1 className="text-xl font-bold">Evaluation Report Not Available</h1>
        <p className="text-gray-400 text-sm mt-1">This report doesn't exist, is pending, or could not be loaded.</p>
        <Link
          href={`/campaigns/${campaignId}`}
          className="mt-6 flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-all underline"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Campaign
        </Link>
      </div>
    );
  }

  const { candidate, session } = data;
  const evaluation = session.evaluation;

  // Helpers to render score badge colors
  const getRecommendationColor = (rec: string | null) => {
    if (!rec) return 'bg-zinc-800 text-zinc-400 border-zinc-700/50';
    const lower = rec.toLowerCase();
    if (lower.includes('strong') || lower.includes('hire') || lower === 'fit') {
      return 'bg-green-500/10 text-green-400 border-green-500/20';
    }
    if (lower.includes('borderline') || lower.includes('maybe')) {
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    }
    return 'bg-red-500/10 text-red-400 border-red-500/20';
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-amber-400';
    return 'text-red-400';
  };

  // Extract resume text for short preview
  const resumeText = candidate.metadata?.resumeText || '';
  const parsedScores = evaluation?.scores ? (typeof evaluation.scores === 'string' ? JSON.parse(evaluation.scores) : evaluation.scores) : {};

  return (
    <div className="min-h-screen bg-black text-white relative">
      {/* Ambient background glow */}
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[550px] pointer-events-none z-0 opacity-40"
        style={{ background: 'radial-gradient(ellipse 65% 55% at 50% 0%, rgba(200,140,40,0.06) 0%, transparent 68%)' }}
      />

      <div className="max-w-5xl mx-auto px-8 py-8 relative z-10">
        {/* Back Link */}
        <Link
          href={`/campaigns/${campaignId}`}
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-all mb-8"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Campaign
        </Link>

        {/* Profile and Fit Tag Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 border-b border-zinc-900 pb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-zinc-950 border border-zinc-850 flex items-center justify-center font-bold text-white text-lg">
              {candidate.name ? candidate.name.charAt(0).toUpperCase() : 'C'}
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white">{candidate.name || 'Candidate'}</h1>
              <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 mt-1 font-sans">
                <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{candidate.email}</span>
                {candidate.phone && (
                  <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{candidate.phone}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {evaluation?.recommendation && (
              <span className={`text-xs px-3 py-1 rounded-full uppercase tracking-wider font-semibold border ${getRecommendationColor(evaluation.recommendation)}`}>
                {evaluation.recommendation}
              </span>
            )}
            {candidate.resumeUrl ? (
              <a
                href={candidate.resumeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white bg-zinc-950 border border-zinc-800 px-3.5 py-2 rounded-xl transition-all"
              >
                <FileText className="w-4 h-4" />
                Resume Link
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : candidate.metadata?.resumeText ? (
              <button
                onClick={() => {
                  const blob = new Blob([candidate.metadata.resumeText], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${candidate.name || 'candidate'}-resume.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white bg-zinc-950 border border-zinc-800 px-3.5 py-2 rounded-xl transition-all"
              >
                <FileText className="w-4 h-4" />
                Download Resume Text
              </button>
            ) : null}
          </div>
        </div>

        {/* Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT: Evaluation details / metrics */}
          <div className="lg:col-span-1 space-y-6">
            {/* Overall score card */}
            <div className="bg-zinc-950/40 border border-zinc-900 rounded-xl p-5 relative overflow-hidden flex flex-col items-center text-center">
              <div className="absolute top-0 right-0 w-[150px] h-[150px] pointer-events-none bg-gradient-to-br from-white/[0.02] to-transparent blur-md rounded-full z-0" />
              <Award className="w-8 h-8 text-zinc-400 mb-2 relative z-10" />
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider relative z-10">AI Overall Grade</h3>
              <div className={`text-6xl font-extrabold mt-3 tracking-tighter relative z-10 ${evaluation ? getScoreColor(Number(evaluation.overallScore)) : 'text-zinc-650'}`}>
                {evaluation ? Number(evaluation.overallScore).toFixed(0) : '—'}
                <span className="text-xl font-medium text-zinc-600">/100</span>
              </div>
              {evaluation?.summary && (
                <p className="text-xs text-zinc-400 mt-4 leading-relaxed text-left border-t border-zinc-900 pt-4 w-full">
                  {evaluation.summary}
                </p>
              )}
            </div>

            {/* Parameter Breakdown */}
            {Object.keys(parsedScores).length > 0 && (
              <div className="bg-zinc-950/40 border border-zinc-900 rounded-xl p-5">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-zinc-400" />
                  Breakdown Scores
                </h3>
                <div className="space-y-4">
                  {Object.entries(parsedScores).map(([key, val]: [string, any]) => {
                    const scoreNum = Number(val);
                    return (
                      <div key={key}>
                        <div className="flex justify-between text-xs mb-1.5 capitalize font-medium text-zinc-300">
                          <span>{key.replace(/_/g, ' ')}</span>
                          <span className="font-semibold text-white">{scoreNum}%</span>
                        </div>
                        <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              scoreNum >= 80 ? 'bg-green-500' : scoreNum >= 60 ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${scoreNum}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Strengths & Weaknesses */}
            {evaluation && (evaluation.strengths?.length > 0 || evaluation.weaknesses?.length > 0) && (
              <div className="bg-zinc-950/40 border border-zinc-900 rounded-xl p-5 space-y-5">
                {evaluation.strengths && evaluation.strengths.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <ThumbsUp className="w-4 h-4 text-green-400" /> Key Strengths
                    </h3>
                    <ul className="space-y-2 text-xs text-zinc-300">
                      {evaluation.strengths.map((str, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-green-500 mt-0.5 shrink-0">✓</span>
                          <span>{str}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {evaluation.weaknesses && evaluation.weaknesses.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <ThumbsDown className="w-4 h-4 text-red-400" /> Growth Areas
                    </h3>
                    <ul className="space-y-2 text-xs text-zinc-300">
                      {evaluation.weaknesses.map((weak, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-red-500 mt-0.5 shrink-0">⚠</span>
                          <span>{weak}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT: Detailed Transcript Breakdown */}
          <div className="lg:col-span-2 space-y-6 mt-8 lg:mt-0">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <MessageSquare className="w-4.5 h-4.5 text-zinc-400" />
                Detailed Transcript Breakdown
              </h3>
              <span className="text-xs text-zinc-500 font-mono">
                {parsedScores?.transcriptAnalysis?.length || session.responses.length} Turns
              </span>
            </div>

            {(!parsedScores?.transcriptAnalysis || parsedScores.transcriptAnalysis.length === 0) ? (
              <div className="bg-zinc-950/20 border border-zinc-900 rounded-xl p-12 text-center text-zinc-500 text-sm">
                No conversational transcript available for this session.
              </div>
            ) : (
              <div className="space-y-8">
                {parsedScores.transcriptAnalysis.map((item: any, idx: number) => {
                  const scoreNum = Number(item.score);
                  let scoreColor = 'text-red-400 bg-red-500/10 border-red-500/20';
                  if (scoreNum >= 8) scoreColor = 'text-green-400 bg-green-500/10 border-green-500/20';
                  else if (scoreNum >= 5) scoreColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20';

                  return (
                    <div key={idx} className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 shadow-sm">
                      {/* Header */}
                      <div className="flex justify-between items-center mb-4 border-b border-zinc-900/60 pb-3">
                        <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                          Question {idx + 1}
                        </span>
                        <div className={`px-3 py-1 rounded-full border text-xs font-bold font-mono ${scoreColor}`}>
                          {scoreNum}/10
                        </div>
                      </div>

                      {/* Question */}
                      <p className="text-sm font-bold text-zinc-100 leading-relaxed mb-5">
                        {item.questionAsked}
                      </p>

                      {/* Answer */}
                      <div className="pl-4 border-l-2 border-zinc-800 mb-5">
                        <p className="text-xs text-zinc-400 leading-relaxed">
                          {item.candidateResponse || <span className="italic text-zinc-600">No response recorded</span>}
                        </p>
                      </div>

                      {/* AI Feedback */}
                      {item.evaluation && (
                        <div className="mt-4 bg-zinc-900/30 rounded-lg p-4">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                            AI Feedback:
                          </span>
                          <p className="text-xs text-zinc-400 italic leading-relaxed">
                            {item.evaluation}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
