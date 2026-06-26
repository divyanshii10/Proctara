'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3,
  Users,
  ClipboardCheck,
  Briefcase,
  ArrowUpRight,
  LogOut,
  Plus,
  Loader2,
  User,
  TrendingUp,
  Percent,
  LayoutDashboard,
  FolderOpen,
  UserPlus,
  Settings,
  ChevronDown,
  Copy,
  Check,
  Mail,
  Calendar,
  Clock,
  Shield,
  Trash2,
  FileCode,
  Sliders,
  PlusCircle,
  X,
  Sparkles,
  Upload,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { companyApi, campaignApi, interviewApi, candidateApi } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Analytics {
  totalInterviews: number;
  completedInterviews: number;
  averageScore: number | null;
  activeRoles: number;
  completionRate: number;
}

interface Campaign {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  jobRole: { title: string };
  template: { name: string; durationMin: number };
  _count: { sessions: number };
}

interface RecentInterview {
  id: string;
  status: string;
  createdAt: string;
  candidate: { id: string; email: string; name: string | null };
  jobRole: { id: string; title: string };
  evaluation?: { overallScore: number; recommendation: string } | null;
}

interface QuestionPoolItem {
  id: string;
  title: string;
  difficulty: string;
  topic: string;
}

export default function DashboardPage() {
  const { user, company, logout, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [recentInterviews, setRecentInterviews] = useState<RecentInterview[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'dashboard' | 'campaigns'>('dashboard');

  // CSV Uploader states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const [candidatesList, setCandidatesList] = useState<any[]>([]);

  // Multi-step Campaign Modal state
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [campaignStep, setCampaignStep] = useState(1);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Step 1 states: Basic details
  const [roleTitle, setRoleTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [testType, setTestType] = useState<'coding' | 'video'>('video');
  const [durationMin, setDurationMin] = useState(45);
  const [expiresAt, setExpiresAt] = useState('');

  // Step 2 states: Test configurations (AI Video Interview configs)
  const [aiTone, setAiTone] = useState<'strict' | 'friendly' | 'professional'>('professional');
  const [thinkTime, setThinkTime] = useState(30);
  const [retakeLimit, setRetakeLimit] = useState(0);
  const [groqApiKey, setGroqApiKey] = useState('');
  const [saveAsGlobalDefault, setSaveAsGlobalDefault] = useState(false);
  const [hasStoredGroqApiKey, setHasStoredGroqApiKey] = useState(false);

  // Sync stored Groq status from Auth Context
  useEffect(() => {
    if (company) {
      setHasStoredGroqApiKey(!!company.hasGroqApiKey);
    }
  }, [company]);

  // Step 4 states: Success & Link Copy
  const [invites, setInvites] = useState<Array<{ name: string | null; email: string; inviteUrl: string }>>([]);
  const [copiedLinkIndex, setCopiedLinkIndex] = useState<number | null>(null);

  // Legacy state placeholders to prevent compilation issues
  const [selectedLanguages, setSelectedLanguages] = useState<Record<string, boolean>>({
    javascript: true,
    python: true,
  });
  const [selectedQuestions, setSelectedQuestions] = useState<Record<string, boolean>>({});
  const [questionPool, setQuestionPool] = useState<QuestionPoolItem[]>([]);
  const [showQuestionDropdown, setShowQuestionDropdown] = useState(false);
  const [customQuestions, setCustomQuestions] = useState<string[]>(['']);
  const [candidateName, setCandidateName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Fetch Dashboard data
  const fetchData = useCallback(async () => {
    try {
      const [analyticsRes, campaignsRes, interviewsRes, candidatesRes] = await Promise.all([
        companyApi.analytics(),
        campaignApi.list(),
        interviewApi.list(1, 10),
        candidateApi.list(1, 100),
      ]);
      setAnalytics(analyticsRes.data || null);
      setCampaigns((campaignsRes.data || []) as unknown as Campaign[]);
      setRecentInterviews((interviewsRes.data || []) as unknown as RecentInterview[]);
      setCandidatesList(candidatesRes.data || []);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, fetchData]);

  // Copy invite link from Step 4 Success screen at index
  const handleCopyLinkIndex = (url: string, index: number) => {
    navigator.clipboard.writeText(url);
    setCopiedLinkIndex(index);
    setTimeout(() => setCopiedLinkIndex(null), 2000);
  };

  // CSV file parser and bulk uploader
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

        // Parse headers: expect name, email, resume
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/["']/g, ''));
        const emailIdx = headers.indexOf('email');
        const nameIdx = headers.indexOf('name');
        const resumeIdx = headers.indexOf('resume');

        if (emailIdx === -1 || nameIdx === -1 || resumeIdx === -1) {
          alert('CSV must contain "name", "email", and "resume" headers.');
          return;
        }

        const parsedCandidates = [];
        for (let i = 1; i < lines.length; i++) {
          const row = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^["']|["']$/g, ''));
          if (row.length < headers.length) continue;

          parsedCandidates.push({
            name: row[nameIdx],
            email: row[emailIdx],
            resume: row[resumeIdx],
          });
        }

        if (parsedCandidates.length === 0) {
          alert('No valid candidate rows found in CSV');
          return;
        }

        setCsvUploading(true);
        const res = await candidateApi.bulkAdd(parsedCandidates);
        if (res.success) {
          alert(`Successfully uploaded ${res.data?.created || 0} candidates (${res.data?.skipped || 0} skipped).`);
          fetchData(); // Refresh candidates list
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

  // Submit Multi-step wizard campaign creation
  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    if (!roleTitle.trim()) {
      setFormError('Job role title is required.');
      setFormLoading(false);
      return;
    }
    if (!jobDescription.trim()) {
      setFormError('Job description is required.');
      setFormLoading(false);
      return;
    }
    if (!hasStoredGroqApiKey && !groqApiKey.trim()) {
      setFormError('Please enter a Groq API key.');
      setFormLoading(false);
      return;
    }

    try {
      const payload = {
        roleTitle,
        jobDescription,
        testType: 'video',
        durationMin,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        tone: aiTone,
        thinkTime,
        retakeLimit,
        groqApiKey: groqApiKey.trim() || null,
        saveAsGlobalDefault,
      };

      const res = await campaignApi.create(payload);

      if (res.success && res.data) {
        const campaign = (res.data as any).campaign;
        resetCampaignWizard();
        router.push(`/campaigns/${campaign.id}`);
      }
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Error creating campaign';
      setFormError(msg);
    } finally {
      setFormLoading(false);
    }
  };

  // Reset Campaign Wizard form values
  const resetCampaignWizard = () => {
    setRoleTitle('');
    setJobDescription('');
    setTestType('video');
    setDurationMin(45);
    setExpiresAt('');
    setSelectedLanguages({
      javascript: true,
      python: true,
    });
    setSelectedQuestions({});
    setAiTone('professional');
    setCustomQuestions(['']);
    setThinkTime(30);
    setRetakeLimit(0);
    setCandidateName('');
    setCandidateEmail('');
    setGeneratedInviteUrl('');
    setGroqApiKey('');
    setSaveAsGlobalDefault(false);
    setInvites([]);
    setCampaignStep(1);
    setFormError('');
    setShowCampaignModal(false);
    setShowQuestionDropdown(false);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-white animate-spin" />
      </div>
    );
  }

  const stats = [
    { label: 'Total Interviews', value: analytics?.totalInterviews ?? 0, icon: ClipboardCheck, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Completed', value: analytics?.completedInterviews ?? 0, icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-500/10' },
    { label: 'Avg Score', value: analytics?.averageScore ? `${Number(analytics.averageScore).toFixed(0)}%` : '—', icon: Percent, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Active Roles', value: analytics?.activeRoles ?? 0, icon: Briefcase, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  ];

  return (
    <div className="min-h-screen bg-black flex text-white relative">
      {/* Glow gradient background */}
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[550px] pointer-events-none z-0 opacity-40"
        style={{ background: 'radial-gradient(ellipse 65% 55% at 50% 0%, rgba(200,140,40,0.07) 0%, transparent 68%)' }}
      />

      {/* Sidebar */}
      <aside className="w-60 border-r border-white/[0.06] bg-black/40 backdrop-blur-md flex flex-col shrink-0 sticky top-0 h-screen z-10">
        <div className="p-5 border-b border-white/[0.06]">
          <Link href="/" className="text-lg font-bold text-white tracking-tight">
            Proctara<span className="text-amber-400">.</span>
          </Link>
          <p className="text-xs text-gray-500 mt-1 font-mono uppercase tracking-wider">{company?.name}</p>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {[
            { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
            { id: 'campaigns' as const, label: 'Campaigns', icon: FolderOpen },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                activeSection === item.id
                  ? 'bg-white/[0.07] text-white font-medium border border-white/[0.05]'
                  : 'text-gray-400 hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center">
              <User className="w-4 h-4 text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white truncate">{user?.name || user?.email}</p>
              <p className="text-[10px] text-gray-500 capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={() => { logout(); router.push('/login'); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-500 hover:text-white hover:bg-white/[0.04] transition-all mt-1"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto z-10 relative">
        <div className="max-w-5xl mx-auto px-8 py-8">
          
          {/* SECTION: DASHBOARD */}
          {activeSection === 'dashboard' && (
            <>
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
                  <p className="text-sm text-gray-400">Overview of your interview pipeline</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowCampaignModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-gray-100 transition-all shadow-md"
                  >
                    <Plus className="w-4 h-4" />
                    New Campaign
                  </button>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-4 gap-4 mb-8">
                {stats.map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-9 h-9 rounded-lg ${stat.bg} flex items-center justify-center`}>
                        <stat.icon className={`w-4.5 h-4.5 ${stat.color}`} />
                      </div>
                    </div>
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
                  </motion.div>
                ))}
              </div>

              {/* Active Campaigns list preview */}
              <section className="mb-8">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Active Campaigns</h2>
                {campaigns.length === 0 ? (
                  <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-8 text-center">
                    <FolderOpen className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">No campaigns yet</p>
                    <p className="text-gray-600 text-xs mt-1">Create a campaign to start interviewing candidates</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {campaigns.map((c) => (
                      <Link
                        key={c.id}
                        href={`/campaigns/${c.id}`}
                        className="bg-white/[0.02] border border-white/[0.06] hover:border-zinc-700 rounded-xl p-5 hover:bg-white/[0.03] transition-all flex flex-col justify-between cursor-pointer"
                      >
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] uppercase px-2 py-0.5 rounded font-mono font-semibold bg-green-500/10 text-green-400 border border-green-500/20">
                              {c.status}
                            </span>
                            <span className="text-[10px] text-gray-500">{new Date(c.createdAt).toLocaleDateString()}</span>
                          </div>
                          <h3 className="text-base font-bold text-white mb-1">{c.title}</h3>
                          <p className="text-xs text-gray-400 font-medium">{c.jobRole?.title}</p>
                          <p className="text-xs text-gray-500 mt-1">{c.template?.name}</p>
                        </div>
                        <div className="border-t border-white/[0.04] pt-3.5 mt-4 flex items-center justify-between text-xs text-gray-500">
                          <span>{c._count?.sessions ?? 0} candidates invited</span>
                          <span className="font-mono">{c.template?.durationMin ?? 0} minutes</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </section>

              {/* Recent Interviews */}
              <section>
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Recent Interviews</h2>
                {recentInterviews.length === 0 ? (
                  <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-8 text-center">
                    <Users className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">No interviews conducted yet</p>
                  </div>
                ) : (
                  <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/[0.06] text-gray-500 text-xs bg-white/[0.01]">
                          <th className="text-left px-4 py-3 font-medium">Candidate</th>
                          <th className="text-left px-4 py-3 font-medium">Role</th>
                          <th className="text-left px-4 py-3 font-medium">Status</th>
                          <th className="text-left px-4 py-3 font-medium">Score</th>
                          <th className="text-left px-4 py-3 font-medium">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentInterviews.map((interview) => (
                          <tr key={interview.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.01] transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-semibold text-white">{interview.candidate.name || '—'}</div>
                              <div className="text-xs text-gray-500">{interview.candidate.email}</div>
                            </td>
                            <td className="px-4 py-3 text-gray-400">{interview.jobRole.title}</td>
                            <td className="px-4 py-3">
                              <span className={`text-xs px-2 py-0.5 rounded-md capitalize ${
                                interview.status === 'completed' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                                interview.status === 'in_progress' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              }`}>{interview.status.replace('_', ' ')}</span>
                            </td>
                            <td className="px-4 py-3 font-mono">
                              {interview.evaluation ? (
                                <span className="text-white font-semibold">
                                  {Number(interview.evaluation.overallScore).toFixed(0)}/100
                                </span>
                              ) : <span className="text-gray-600">—</span>}
                            </td>
                            <td className="px-4 py-3 text-gray-500 text-xs">
                              {new Date(interview.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}

          {/* SECTION: CAMPAIGNS LIST */}
          {activeSection === 'campaigns' && (
            <div>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">Campaigns</h1>
                  <p className="text-sm text-gray-400">Manage your interview campaigns</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowCampaignModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-gray-100 transition-all shadow-md"
                  >
                    <Plus className="w-4 h-4" />
                    New Campaign
                  </button>
                </div>
              </div>

              {campaigns.length === 0 ? (
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-12 text-center">
                  <FolderOpen className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <h3 className="text-lg text-gray-400 mb-1">No campaigns yet</h3>
                  <p className="text-sm text-gray-500 mb-4">Create your first campaign to start inviting candidates</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {campaigns.map(c => (
                    <Link
                      key={c.id}
                      href={`/campaigns/${c.id}`}
                      className="bg-white/[0.02] border border-white/[0.06] hover:border-zinc-700 rounded-xl p-5 hover:bg-white/[0.03] transition-all flex flex-col justify-between cursor-pointer"
                    >
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className={`text-xs px-2.5 py-0.5 rounded-md capitalize font-semibold ${
                            c.status === 'active' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                            'bg-gray-500/10 text-gray-500 border border-gray-500/20'
                          }`}>{c.status}</span>
                        </div>
                        <h3 className="text-base font-bold text-white mb-1">{c.title}</h3>
                        <p className="text-xs text-gray-400">{c.jobRole?.title} • {c.template?.name}</p>
                      </div>
                      <div className="border-t border-white/[0.04] pt-3.5 mt-4 flex items-center justify-between text-xs text-gray-500">
                        <span>{c._count?.sessions ?? 0} candidates invited</span>
                        <span className="font-mono">{c.template?.durationMin ?? 0} minutes</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Candidates tab removed as candidates are now campaign-specific */}

        </div>
      </main>

      {/* MULTI-STEP NEW CAMPAIGN WIZARD MODAL */}
      <AnimatePresence>
        {showCampaignModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={resetCampaignWizard}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#09090b] border border-zinc-800/80 rounded-2xl w-full max-w-[440px] h-[560px] p-6 relative z-10 overflow-hidden shadow-2xl flex flex-col justify-between"
            >
              {/* Top ambient glow gradient */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[240px] h-[120px] pointer-events-none bg-gradient-to-b from-white/[0.03] to-transparent blur-xl rounded-full z-0" />

              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-zinc-900 pb-4 mb-4 shrink-0 z-10">
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-1.5 text-zinc-100 font-sans">
                    <Sparkles className="w-4 h-4 text-zinc-400" />
                    Configure Campaign
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5 font-sans">Automated screening round setup</p>
                </div>
                <button
                  type="button"
                  onClick={resetCampaignWizard}
                  className="p-1.5 rounded-lg border border-zinc-800 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900/50 transition-all animate-none focus:outline-none"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Stepper Timeline */}
              <div className="flex items-center gap-2 mb-6 shrink-0 text-xs font-sans text-zinc-500 font-medium z-10 select-none">
                {[
                  { label: 'Details', step: 1 },
                  { label: 'Configure', step: 2 },
                ].map((s, idx) => (
                  <span key={s.step} className="flex items-center gap-2">
                    <span className={`transition-colors duration-200 ${
                      campaignStep === s.step ? 'text-white font-semibold' : 
                      campaignStep > s.step ? 'text-zinc-400 font-normal' : 'text-zinc-600 font-normal'
                    }`}>
                      {s.label}
                    </span>
                    {idx < 1 && <span className="text-zinc-800 font-normal">/</span>}
                  </span>
                ))}
              </div>

              {/* Form errors */}
              {formError && (
                <div className="mb-4 px-3.5 py-2 bg-red-950/20 border border-red-900/30 rounded-xl text-red-400 text-xs shrink-0 font-sans z-10">
                  {formError}
                </div>
              )}

              {/* Wizard Dynamic Step Views */}
              <div className="flex-1 overflow-y-auto mb-6 pr-1 relative flex flex-col justify-center min-h-[340px] z-10">
                <AnimatePresence mode="wait">
                  <motion.div
                     key={campaignStep}
                     initial={{ opacity: 0, x: 10 }}
                     animate={{ opacity: 1, x: 0 }}
                     exit={{ opacity: 0, x: -10 }}
                     transition={{ duration: 0.15 }}
                     className="space-y-4 w-full"
                  >
                    {/* STEP 1: Basic details */}
                    {campaignStep === 1 && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-medium text-zinc-400 mb-1.5 font-sans">Job Role / Title</label>
                          <input
                            type="text"
                            required
                            value={roleTitle}
                            onChange={(e) => setRoleTitle(e.target.value)}
                            placeholder="e.g. Frontend Developer Intern"
                            className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-700/50 rounded-xl px-3.5 py-2.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none transition-all font-sans"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-zinc-400 mb-2 font-sans">Test Type</label>
                          <div className="grid grid-cols-2 gap-4">
                            {/* Coding Assessment - Disabled/Coming Soon */}
                            <div className="p-4 border border-zinc-900 text-zinc-600 rounded-xl cursor-not-allowed opacity-40 select-none flex flex-col justify-between h-24 relative overflow-hidden bg-transparent">
                              <div className="absolute top-1 right-2 bg-zinc-900 text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded text-zinc-500 font-mono font-semibold border border-zinc-850">
                                Coming Soon
                              </div>
                              <FileCode className="w-5 h-5 text-zinc-700" />
                              <div>
                                <strong className="block text-xs font-semibold">Coding Assessment</strong>
                                <span className="text-[10px] text-zinc-650 font-normal block mt-0.5">Algorithmic coding tests</span>
                              </div>
                            </div>

                            {/* AI Video Interview */}
                            <div className="p-4 border rounded-xl cursor-default bg-white/[0.04] border-zinc-200 text-white font-medium shadow-sm flex flex-col justify-between h-24 relative overflow-hidden">
                              <Sparkles className="w-5 h-5 text-zinc-200" />
                              <div>
                                <strong className="block text-xs font-semibold">AI Video Interview</strong>
                                <span className="text-[10px] text-zinc-400 font-normal block mt-0.5">Adaptive video interview</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-zinc-405 mb-1.5 font-sans">Job Description (JD)</label>
                          <textarea
                            required
                            rows={3}
                            value={jobDescription}
                            onChange={(e) => setJobDescription(e.target.value)}
                            placeholder="Paste the Job Description here. The AI will generate customized interview questions matching these requirements..."
                            className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-700/50 rounded-xl px-3.5 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none transition-all font-sans resize-none"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-1.5 font-sans">Duration (Minutes)</label>
                            <input
                              type="number"
                              required
                              min={10}
                              max={120}
                              value={durationMin}
                              onChange={(e) => setDurationMin(Number(e.target.value))}
                              className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-700/50 rounded-xl px-3.5 py-2.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none transition-all font-sans"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-1.5 font-sans">Expiry Date</label>
                            <input
                              type="date"
                              value={expiresAt}
                              onChange={(e) => setExpiresAt(e.target.value)}
                              className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-700/50 rounded-xl px-3.5 py-2.5 text-xs text-zinc-350 focus:outline-none transition-all font-sans cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* STEP 2: Configuration - AI Video Interview */}
                    {campaignStep === 2 && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-2">
                          <div className="col-span-3">
                            <label className="block text-xs font-medium text-zinc-400 mb-2 font-sans">AI Tone</label>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              {['professional', 'friendly', 'strict'].map((t) => (
                                <button
                                  key={t}
                                  type="button"
                                  onClick={() => setAiTone(t as any)}
                                  className={`px-3 py-1.5 border rounded-full capitalize transition-all ${
                                    aiTone === t
                                      ? 'bg-white/[0.06] border-zinc-200 text-white font-medium shadow-sm'
                                      : 'bg-transparent border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
                                  }`}
                                >
                                  {t}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="col-span-3 grid grid-cols-2 gap-4 mt-1">
                            <div>
                              <label className="block text-xs font-medium text-zinc-400 mb-1.5 font-sans">Think Time (Sec)</label>
                              <input
                                type="number"
                                required
                                min={10}
                                max={120}
                                value={thinkTime}
                                onChange={(e) => setThinkTime(Number(e.target.value))}
                                className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-700/50 rounded-xl px-3.5 py-2 text-xs focus:outline-none text-zinc-200"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-zinc-400 mb-1.5 font-sans">Retakes Limit</label>
                              <input
                                type="number"
                                required
                                min={0}
                                max={5}
                                value={retakeLimit}
                                onChange={(e) => setRetakeLimit(Number(e.target.value))}
                                className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-700/50 rounded-xl px-3.5 py-2 text-xs focus:outline-none text-zinc-200"
                              />
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-zinc-400 mb-1.5 font-sans">Groq API Key</label>
                          {hasStoredGroqApiKey ? (
                            <div className="flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-450 font-mono">
                              <span>•••••••••••• (Saved globally)</span>
                              <button
                                type="button"
                                onClick={() => setHasStoredGroqApiKey(false)}
                                className="text-[10px] text-zinc-500 hover:text-zinc-350 font-semibold underline focus:outline-none"
                              >
                                Change
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <input
                                type="password"
                                value={groqApiKey}
                                onChange={(e) => setGroqApiKey(e.target.value)}
                                placeholder="gsk_..."
                                className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-700/50 rounded-xl px-3.5 py-2.5 text-xs text-zinc-200 placeholder-zinc-505 font-mono focus:outline-none transition-all"
                              />
                              <label className="flex items-center gap-2 cursor-pointer text-[10px] text-zinc-450 font-sans font-medium select-none pt-1">
                                <input
                                  type="checkbox"
                                  checked={saveAsGlobalDefault}
                                  onChange={(e) => setSaveAsGlobalDefault(e.target.checked)}
                                  className="rounded border-zinc-805 bg-zinc-955 text-white focus:ring-0 w-3.5 h-3.5"
                                />
                                Save as global profile default
                              </label>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* STEP 3: Candidate list preview */}
                    {campaignStep === 3 && (
                      <div className="space-y-3">
                        <p className="text-xs text-zinc-500 text-center leading-relaxed font-sans">
                          Proctara will automatically invite all candidates uploaded via CSV.
                        </p>
                        <div className="border border-zinc-800/80 rounded-xl overflow-hidden bg-zinc-950/20 max-h-48 overflow-y-auto divide-y divide-zinc-900">
                          {candidatesList.length === 0 ? (
                            <div className="text-xs text-zinc-500 py-8 text-center font-sans">
                              No candidates found. Please upload a candidates CSV first.
                            </div>
                          ) : (
                            candidatesList.map((c, idx) => (
                              <div key={c.id || idx} className="flex items-center justify-between px-4 py-2.5 text-xs font-sans">
                                <div className="min-w-0 flex-1 pr-2">
                                  <div className="font-semibold text-zinc-200 truncate">{c.name}</div>
                                  <div className="text-[10px] text-zinc-500 truncate">{c.email}</div>
                                </div>
                                <span className="text-[9px] font-medium text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-full uppercase shrink-0">
                                  Pending Invite
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                        <div className="text-center text-[10px] text-zinc-500">
                          Total: <strong className="text-zinc-300">{candidatesList.length} candidates</strong> will receive automated invites.
                        </div>
                      </div>
                    )}

                    {/* STEP 4: Success & Multi Link Copy */}
                    {campaignStep === 4 && (
                      <div className="space-y-4">
                        <div className="text-center py-1">
                          <div className="w-11 h-11 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-2">
                            <Check className="w-5.5 h-5.5 text-green-400" />
                          </div>
                          <h4 className="text-sm font-semibold text-zinc-150 font-sans">Campaign Created Successfully!</h4>
                          <p className="text-xs text-zinc-505 mt-0.5 font-sans">Unique invite URLs generated for candidates.</p>
                        </div>

                        <div className="border border-zinc-800/85 rounded-xl bg-zinc-950/40 divide-y divide-zinc-900 max-h-44 overflow-y-auto pr-1">
                          {invites.map((inv, idx) => {
                            const isCopied = copiedLinkIndex === idx;
                            return (
                              <div key={idx} className="p-3 flex items-center justify-between gap-3 text-xs">
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold text-zinc-200 truncate">{inv.name || 'Candidate'}</div>
                                  <div className="text-[10px] text-zinc-500 truncate">{inv.email}</div>
                                  <div className="text-[9px] text-zinc-650 truncate mt-0.5 font-mono select-all">{inv.inviteUrl}</div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleCopyLinkIndex(inv.inviteUrl, idx)}
                                  className="flex items-center gap-1.5 text-[10px] text-black bg-white hover:bg-zinc-100 font-semibold px-2.5 py-1.5 rounded-lg shrink-0 transition-all shadow-md focus:outline-none"
                                >
                                  {isCopied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                                  {isCopied ? 'Copied' : 'Copy'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Modal Footer Controls */}
              <div className="flex justify-end gap-3 border-t border-zinc-900 pt-4 shrink-0 text-xs font-semibold font-sans z-10">
                {campaignStep === 1 && (
                  <button
                    type="button"
                    onClick={resetCampaignWizard}
                    className="px-4 py-2.5 rounded-xl border border-zinc-800 bg-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/30 transition-all font-medium text-xs focus:outline-none"
                  >
                    Cancel
                  </button>
                )}

                {campaignStep === 2 && (
                  <button
                    type="button"
                    onClick={() => setCampaignStep(1)}
                    disabled={formLoading}
                    className="px-4 py-2.5 rounded-xl border border-zinc-800 bg-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/30 transition-all font-medium text-xs focus:outline-none disabled:opacity-40"
                  >
                    Back
                  </button>
                )}

                {campaignStep === 1 ? (
                  <button
                    type="button"
                    disabled={!roleTitle.trim() || !jobDescription.trim()}
                    onClick={() => setCampaignStep(2)}
                    className="px-5 py-2.5 rounded-xl bg-white text-black hover:bg-zinc-100 font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all text-xs focus:outline-none shadow-md"
                  >
                    Continue
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCreateCampaign}
                    disabled={formLoading || (!hasStoredGroqApiKey && !groqApiKey.trim())}
                    className="px-5 py-2.5 rounded-xl bg-white text-black hover:bg-zinc-100 font-semibold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-all text-xs focus:outline-none shadow-md"
                  >
                    {formLoading ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : 'Create Campaign'}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
