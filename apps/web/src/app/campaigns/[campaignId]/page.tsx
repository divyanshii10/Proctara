'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Upload,
  Loader2,
  Check,
  Copy,
  Users,
  CheckCircle2,
  Percent,
  FolderOpen,
  Calendar,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import { campaignApi } from '@/lib/api';

interface Candidate {
  id: string;
  email: string;
  name: string | null;
}

interface Evaluation {
  overallScore: number;
  recommendation: string;
}

interface Session {
  id: string;
  status: string;
  inviteToken: string;
  createdAt: string;
  candidate: Candidate;
  evaluation?: Evaluation | null;
}

interface CampaignDetail {
  id: string;
  title: string;
  description: string | null;
  status: string;
  durationMin: number;
  expiresAt: string | null;
  createdAt: string;
  jobRole: { title: string; description: string | null };
  template: { name: string; durationMin: number; config: any };
  sessions: Session[];
  metrics: {
    invited: number;
    completed: number;
    avgScore: number;
  };
}

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.campaignId as string;

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [csvUploading, setCsvUploading] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchCampaignDetails = useCallback(async () => {
    try {
      const res = await campaignApi.get(campaignId);
      if (res.success && res.data) {
        setCampaign(res.data as unknown as CampaignDetail);
      }
    } catch (err) {
      console.error('Error fetching campaign details:', err);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    if (campaignId) {
      fetchCampaignDetails();
    }
  }, [campaignId, fetchCampaignDetails]);

  const handleCopyInviteLink = (token: string) => {
    const inviteUrl = `${window.location.origin}/interview/${token}/setup`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      try {
        const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
        if (lines.length <= 1) {
          alert('CSV file is empty or only contains headers');
          return;
        }

        // Parse headers: expect name, email
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/["']/g, ''));
        const emailIdx = headers.indexOf('email');
        const nameIdx = headers.indexOf('name');
        const phoneIdx = headers.indexOf('phone');
        const resumeIdx = headers.indexOf('resume');

        if (emailIdx === -1 || nameIdx === -1) {
          alert('CSV must contain "name" and "email" headers.');
          return;
        }

        const parsedCandidates = [];
        for (let i = 1; i < lines.length; i++) {
          const row = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^["']|["']$/g, ''));
          if (row.length < headers.length) continue;

          parsedCandidates.push({
            name: row[nameIdx],
            email: row[emailIdx],
            phone: (phoneIdx !== -1 && row[phoneIdx]) ? row[phoneIdx] : undefined,
            resume: (resumeIdx !== -1 && row[resumeIdx]) ? row[resumeIdx] : undefined,
          });
        }

        if (parsedCandidates.length === 0) {
          alert('No valid candidate rows found in CSV');
          return;
        }

        setCsvUploading(true);
        const res = await campaignApi.bulkAddCandidates(campaignId, parsedCandidates);
        if (res.success) {
          alert(`Successfully uploaded ${res.data?.created || 0} candidates (${res.data?.skipped || 0} skipped).`);
          fetchCampaignDetails();
        } else {
          alert(res.error || 'Failed to upload candidates');
        }
      } catch (err: any) {
        console.error(err);
        alert('Error parsing CSV: ' + (err.message || err));
      } finally {
        setCsvUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-white animate-spin" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-4">
        <ShieldAlert className="w-12 h-12 text-red-500 mb-4" />
        <h1 className="text-xl font-bold">Campaign Not Found</h1>
        <p className="text-gray-400 text-sm mt-1">This campaign doesn't exist or you don't have access to it.</p>
        <Link href="/dashboard" className="mt-6 flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-all underline">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
      </div>
    );
  }

  const metrics = [
    { label: 'Invited Candidates', value: campaign.metrics.invited, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Completed Interviews', value: campaign.metrics.completed, icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10' },
    { label: 'Average Score', value: campaign.metrics.avgScore > 0 ? `${campaign.metrics.avgScore}%` : '—', icon: Percent, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  ];

  return (
    <div className="min-h-screen bg-black text-white relative">
      {/* Ambient top glow */}
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[550px] pointer-events-none z-0 opacity-40"
        style={{ background: 'radial-gradient(ellipse 65% 55% at 50% 0%, rgba(200,140,40,0.06) 0%, transparent 68%)' }}
      />

      <div className="max-w-5xl mx-auto px-8 py-8 relative z-10">
        {/* Back Link */}
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-all mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-3">
              <span className={`text-[10px] uppercase px-2.5 py-0.5 rounded-md font-mono font-semibold ${
                campaign.status === 'active' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                'bg-zinc-800 text-zinc-400 border border-zinc-700/50'
              }`}>
                {campaign.status}
              </span>
              <span className="text-xs text-zinc-500 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Created {new Date(campaign.createdAt).toLocaleDateString()}
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight mt-2 text-white">{campaign.title}</h1>
            <p className="text-sm text-zinc-400 mt-1 font-medium">{campaign.jobRole?.title}</p>
            {campaign.description && (
              <p className="text-xs text-zinc-500 mt-2 max-w-2xl leading-relaxed">{campaign.description}</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleCSVUpload}
              accept=".csv"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={csvUploading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-800 bg-transparent text-zinc-300 text-sm font-semibold hover:bg-zinc-900/50 hover:text-white transition-all shadow-md focus:outline-none"
            >
              {csvUploading ? (
                <Loader2 className="w-4.5 h-4.5 animate-spin" />
              ) : (
                <Upload className="w-4.5 h-4.5 text-zinc-450" />
              )}
              Upload Candidates CSV
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {metrics.map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-zinc-950/40 border border-zinc-900 rounded-xl p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-9 h-9 rounded-lg ${m.bg} flex items-center justify-center`}>
                  <m.icon className={`w-4.5 h-4.5 ${m.color}`} />
                </div>
              </div>
              <div className="text-2xl font-bold text-white">{m.value}</div>
              <div className="text-xs text-zinc-500 mt-0.5">{m.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Configurations Banner */}
        <div className="bg-zinc-950/20 border border-zinc-900 rounded-xl p-5 mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-850 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-zinc-400" />
            </div>
            <div>
              <span className="text-xs font-semibold text-zinc-400 block">AI Screening Interview Configured</span>
              <span className="text-[10px] text-zinc-500 mt-0.5 block">
                Tone: <span className="capitalize text-zinc-300 font-medium">{campaign.template?.config?.tone || 'Professional'}</span> •
                Duration: <span className="text-zinc-300 font-medium">{campaign.durationMin} mins</span> •
                Think Time: <span className="text-zinc-300 font-medium">{campaign.template?.config?.thinkTime || 30}s</span>
              </span>
            </div>
          </div>
        </div>

        {/* Candidates Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Campaign Candidates</h2>
            <span className="text-xs text-zinc-500 font-mono">{campaign.sessions.length} Candidates</span>
          </div>

          {campaign.sessions.length === 0 ? (
            <div className="bg-zinc-950/20 border border-zinc-900 rounded-xl p-12 text-center">
              <FolderOpen className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
              <h3 className="text-base text-zinc-400 font-semibold mb-1">No Candidates Uploaded</h3>
              <p className="text-xs text-zinc-500 mb-4 max-w-sm mx-auto">
                Upload a CSV containing your candidates' details to automatically generate invitation credentials and test URLs.
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-zinc-100 text-black text-xs font-semibold rounded-xl mx-auto shadow-md transition-all focus:outline-none"
              >
                <Upload className="w-4 h-4" />
                Upload CSV
              </button>
            </div>
          ) : (
            <div className="bg-zinc-950/20 border border-zinc-900 rounded-xl overflow-hidden shadow-xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-900 text-zinc-500 text-xs bg-zinc-950/40">
                    <th className="text-left px-6 py-4 font-medium">Candidate</th>
                    <th className="text-left px-6 py-4 font-medium">Status</th>
                    <th className="text-left px-6 py-4 font-medium">Score</th>
                    <th className="text-left px-6 py-4 font-medium">Invite URL</th>
                    <th className="text-right px-6 py-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {campaign.sessions.map((session) => {
                    const isCopied = copiedToken === session.inviteToken;
                    return (
                      <tr key={session.id} className="border-b border-zinc-900 last:border-0 hover:bg-zinc-900/10 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-850 flex items-center justify-center font-semibold text-zinc-400">
                              {session.candidate.name ? session.candidate.name.charAt(0).toUpperCase() : 'C'}
                            </div>
                            <div>
                              <div className="font-semibold text-zinc-200">{session.candidate.name || '—'}</div>
                              <div className="text-xs text-zinc-500">{session.candidate.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-xs px-2.5 py-0.5 rounded-md capitalize font-semibold ${
                            session.status === 'completed' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                            session.status === 'in_progress' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                            'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}>
                            {session.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono font-semibold text-zinc-300">
                          {session.evaluation ? (
                            <span className="text-white">
                              {Number(session.evaluation.overallScore).toFixed(0)}/100
                            </span>
                          ) : <span className="text-zinc-650">—</span>}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 max-w-[200px]">
                              <span className="text-[10px] text-zinc-500 truncate font-mono">
                                {`${window.location.origin}/interview/${session.inviteToken}/setup`}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyInviteLink(session.inviteToken)}
                                className="p-1 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors focus:outline-none shrink-0"
                                title="Copy Invite URL"
                              >
                                {isCopied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                            <span className="text-[9px] text-green-400/90 font-sans font-medium flex items-center gap-1 select-none">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                              Email Dispatched
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {session.status === 'completed' ? (
                            <Link
                              href={`/campaigns/${campaignId}/candidate/${session.candidate.id}`}
                              className="inline-flex items-center gap-1 text-xs text-white bg-white/[0.06] hover:bg-white text-zinc-200 hover:text-black font-semibold border border-zinc-800 hover:border-white px-3 py-1.5 rounded-lg transition-all shadow-md focus:outline-none"
                            >
                              View Report
                              <ChevronRight className="w-3 h-3" />
                            </Link>
                          ) : (
                            <button
                              disabled
                              className="inline-flex items-center gap-1 text-xs text-zinc-600 bg-zinc-950 border border-zinc-900/50 px-3 py-1.5 rounded-lg cursor-not-allowed select-none"
                            >
                              Awaiting Interview
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
