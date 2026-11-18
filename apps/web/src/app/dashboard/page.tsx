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

const DynamicAvatar = ({ email, sizeClass = "w-5 h-5", borderClass = "border border-black" }: { email: string, sizeClass?: string, borderClass?: string }) => {
  const [error, setError] = useState(false);
  const initials = email.split('@')[0].substring(0, 2).toUpperCase();
  
  if (error) {
    return (
      <div className={`${sizeClass} rounded-full bg-white/[0.08] text-slate-300 font-semibold text-[10px] flex items-center justify-center shrink-0 ${borderClass}`}>
        {initials}
      </div>
    );
  }
  
  return (
    <img 
      src={`https://unavatar.io/${email}?fallback=false`}
      alt={email}
      onError={() => setError(true)}
      className={`${sizeClass} rounded-full object-cover shrink-0 ${borderClass}`}
    />
  );
};

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
  const [selectedLanguages, setSelectedLanguages] = useState({
    javascript: true,
    python: true,
    java: false,
    cpp: false,
  });
  


  // Step 2 states: Test configurations (AI Video Interview configs)
  const [aiTone, setAiTone] = useState<'strict' | 'friendly' | 'professional'>('professional');

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
        testType,
        durationMin,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        tone: aiTone,
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
      java: false,
      cpp: false,
    });

    setAiTone('professional');
    setCustomQuestions(['']);
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
    { label: 'Total Interviews', title: 'Total Pipeline', value: analytics?.totalInterviews ?? 0, icon: ClipboardCheck, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Completed', title: 'Evaluation Progress', value: analytics?.completedInterviews ?? 0, icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Avg Score', title: 'Scoring Metrics', value: analytics?.averageScore ? `${Number(analytics.averageScore).toFixed(0)}%` : '—', icon: Percent, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Active Roles', title: 'Active Vacancies', value: analytics?.activeRoles ?? 0, icon: Briefcase, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  ];

  return (
    <div className="min-h-screen bg-black flex text-white relative font-sans">
      {/* Ambient warm glow - top center (amber/warm) */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[1400px] h-[800px] pointer-events-none z-0"
        style={{
          background: 'radial-gradient(ellipse 70% 60% at 50% 0%, rgba(200, 150, 80, 0.25) 0%, rgba(160, 110, 50, 0.12) 30%, transparent 65%)',
        }}
      />
      {/* Left blue accent */}
      <div
        className="absolute top-0 left-0 w-[600px] h-[600px] pointer-events-none z-0"
        style={{
          background: 'radial-gradient(ellipse at 0% 0%, rgba(60, 90, 180, 0.15) 0%, transparent 60%)',
        }}
      />
      {/* Right blue accent */}
      <div
        className="absolute top-0 right-0 w-[600px] h-[600px] pointer-events-none z-0"
        style={{
          background: 'radial-gradient(ellipse at 100% 0%, rgba(50, 80, 170, 0.12) 0%, transparent 60%)',
        }}
      />

      {/* Sidebar */}
      <aside className="w-60 border-r border-white/[0.06] bg-black/40 backdrop-blur-xl flex flex-col shrink-0 sticky top-0 h-screen z-10">
        <div className="p-6">
          <Link href="/" className="text-xl font-bold text-white tracking-tight block">
            Proctara<span className="text-amber-500">.</span>
          </Link>
          <p className="text-[10px] tracking-[0.2em] text-slate-500 font-mono mt-1">NEXORA</p>
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-2">
          {[
            { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
            { id: 'campaigns' as const, label: 'Campaigns', icon: FolderOpen },
          ].map(item => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 transition-all ${
                  isActive
                    ? 'bg-white/[0.08]/60 border border-white/[0.12] text-white font-medium rounded-xl'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent rounded-xl'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            )
          })}
        </nav>

        <div className="p-4">
          <div className="bg-white/[0.04]/60 border border-white/[0.08] rounded-xl p-3 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-white/[0.08] flex items-center justify-center">
                  <User className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate leading-tight">{user?.name || user?.email || 'Nitin'}</p>
                  <p className="text-[10px] text-slate-500 capitalize">{user?.role || 'Owner'}</p>
                </div>
              </div>
              <button className="text-slate-400 hover:text-white transition-colors">
                <Settings className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={() => { logout(); router.push('/login'); }}
              className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-all pt-2 border-t border-white/[0.08]"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
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
                  <h1 className="text-2xl font-bold text-white">Overview</h1>
                  <p className="text-sm text-slate-400 mt-1">Overview of your interview pipeline</p>
                </div>
                <button
                  onClick={() => setShowCampaignModal(true)}
                  className="bg-slate-100 hover:bg-white text-slate-950 font-semibold px-4 py-2 rounded-xl text-sm transition-all shadow-sm flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  New Campaign
                </button>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 my-6">
                {stats.map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-white/[0.02] backdrop-blur-md transition-all duration-300 hover:scale-[0.98] hover:bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4"
                  >
                    <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center mb-3`}>
                      <stat.icon className={`w-4 h-4 ${stat.color}`} />
                    </div>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-xl font-bold text-white">{stat.value}</span>
                      <span className={`text-xs font-medium ${stat.color}`}>{stat.title}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">{stat.label}</div>
                  </motion.div>
                ))}
              </div>

              {/* Active Campaigns list preview */}
              <section className="mt-8">
                <h2 className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase mb-4">Active Campaigns</h2>
                {campaigns.length === 0 ? (
                  <div className="bg-white/[0.02] backdrop-blur-md transition-all duration-300 hover:scale-[0.98] hover:bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 text-center">
                    <FolderOpen className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-slate-500 text-sm">No campaigns yet</p>
                    <p className="text-slate-600 text-xs mt-1">Create a campaign to start interviewing candidates</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {campaigns.map((c) => {
                      const isCompleted = c.status === 'completed' || c.status === 'inactive';
                      
                      return (
                        <div
                          key={c.id}
                          onClick={() => router.push(`/campaigns/${c.id}`)}
                          className="bg-white/[0.02] backdrop-blur-md transition-all duration-300 hover:scale-[0.98] hover:bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4 hover:border-white/[0.12] transition-all flex flex-col justify-between cursor-pointer"
                        >
                          <div>
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                {isCompleted && (
                                  <span className="inline-block text-[9px] uppercase px-2 py-0.5 rounded bg-white/[0.08] text-slate-400 border border-white/[0.12] font-semibold mb-2">
                                    Completed
                                  </span>
                                )}
                                <h3 className="text-base font-bold text-white leading-tight">{c.title}</h3>
                                <p className="text-[11px] text-slate-400 mt-1">{c.jobRole?.title || 'Role'} • {c.template?.name || 'Interview'}</p>
                              </div>
                              <span className={`shrink-0 border text-[10px] px-2 py-1 rounded-md ${
                                c.status === 'active' 
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              }`}>
                                {c.status === 'active' ? 'Screening' : 'Review Complete'}
                              </span>
                            </div>
                            
                            <div className="mt-3">
                              <div className="flex justify-between items-center mb-2">
                                <p className="text-[11px] text-slate-300">
                                  {isCompleted 
                                    ? `Evaluated: ${c._count?.sessions ?? 0}`
                                    : `Candidates Invited: ${c._count?.sessions ?? 0} (${Math.floor((c._count?.sessions ?? 0) * 0.7)} reviewed, ${Math.ceil((c._count?.sessions ?? 0) * 0.3)} pending)`
                                  }
                                </p>
                                {!isCompleted && (c._count?.sessions ?? 0) > 0 && (
                                  <div className="flex -space-x-2 overflow-hidden">
                                    {[...Array(Math.min(3, c._count?.sessions ?? 0))].map((_, i) => (
                                      <DynamicAvatar
                                        key={i}
                                        email={`candidate${i}@example.com`}
                                        sizeClass="w-5 h-5"
                                      />
                                    ))}
                                    {(c._count?.sessions ?? 0) > 3 && (
                                      <div className="w-5 h-5 rounded-full border border-black bg-white/[0.08] flex items-center justify-center text-[9px] text-white font-medium z-10">
                                        +{(c._count?.sessions ?? 0) - 3}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              
                              {!isCompleted && (
                                <div className="h-1.5 w-full bg-white/[0.08] rounded-full overflow-hidden flex gap-1">
                                  <div className="h-full bg-emerald-500" style={{ width: '70%' }}></div>
                                  <div className="h-full bg-amber-500" style={{ width: '20%' }}></div>
                                  <div className="h-full bg-slate-600" style={{ width: '10%' }}></div>
                                </div>
                              )}
                              
                              {isCompleted && (
                                <div className="text-[11px] text-slate-400 space-y-1">
                                  <p>Time saved analysis: 11 minutes, 11 minutes</p>
                                  <p>Time saved efficiency: 20 minutes</p>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono pt-3 mt-3 border-t border-white/[0.04]">
                            <span>{c._count?.sessions ?? 0} candidate{(c._count?.sessions !== 1) ? 's' : ''}</span>
                            <span>{c.template?.durationMin ?? 45} minutes</span>
                            {!isCompleted && <span>20 minutes</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

            </>
          )}

          {/* SECTION: CAMPAIGNS LIST */}
          {activeSection === 'campaigns' && (
            <div>
              {/* Content for Campaigns tab, styled similarly */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-white">Campaigns</h1>
                  <p className="text-sm text-slate-400 mt-1">Manage your interview campaigns</p>
                </div>
                <button
                  onClick={() => setShowCampaignModal(true)}
                  className="bg-slate-100 hover:bg-white text-slate-950 font-semibold px-4 py-2 rounded-xl text-sm transition-all shadow-sm flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  New Campaign
                </button>
              </div>

              {campaigns.length === 0 ? (
                <div className="bg-white/[0.02] backdrop-blur-md transition-all duration-300 hover:scale-[0.98] hover:bg-white/[0.03] border border-white/[0.08] rounded-2xl p-12 text-center">
                  <FolderOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <h3 className="text-lg text-slate-400 mb-1">No campaigns yet</h3>
                  <p className="text-sm text-slate-500 mb-4">Create your first campaign to start inviting candidates</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {campaigns.map((c) => {
                    const isCompleted = c.status === 'completed' || c.status === 'inactive';
                    
                    return (
                      <div
                        key={c.id}
                        onClick={() => router.push(`/campaigns/${c.id}`)}
                        className="bg-white/[0.02] backdrop-blur-md transition-all duration-300 hover:scale-[0.98] hover:bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4 hover:border-white/[0.12] transition-all flex flex-col justify-between cursor-pointer"
                      >
                        <div>
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              {isCompleted && (
                                <span className="inline-block text-[9px] uppercase px-2 py-0.5 rounded bg-white/[0.08] text-slate-400 border border-white/[0.12] font-semibold mb-2">
                                  Completed
                                </span>
                              )}
                              <h3 className="text-base font-bold text-white leading-tight">{c.title}</h3>
                              <p className="text-[11px] text-slate-400 mt-1">{c.jobRole?.title || 'Role'} • {c.template?.name || 'Interview'}</p>
                            </div>
                            <span className={`shrink-0 border text-[10px] px-2 py-1 rounded-md ${
                              c.status === 'active' 
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            }`}>
                              {c.status === 'active' ? 'Screening' : 'Review Complete'}
                            </span>
                          </div>
                          
                          <div className="mt-3">
                            <div className="flex justify-between items-center mb-2">
                              <p className="text-[11px] text-slate-300">
                                {isCompleted 
                                  ? `Evaluated: ${c._count?.sessions ?? 0}`
                                  : `Candidates Invited: ${c._count?.sessions ?? 0} (${Math.floor((c._count?.sessions ?? 0) * 0.7)} reviewed, ${Math.ceil((c._count?.sessions ?? 0) * 0.3)} pending)`
                                }
                              </p>
                              {!isCompleted && (c._count?.sessions ?? 0) > 0 && (
                                <div className="flex -space-x-2 overflow-hidden">
                                  {[...Array(Math.min(3, c._count?.sessions ?? 0))].map((_, i) => (
                                    <img
                                      key={i}
                                      src={`https://unavatar.io/candidate${i}@example.com?fallback=https://api.dicebear.com/7.x/notionists/svg?seed=${i}`}
                                      alt="candidate"
                                      className="w-5 h-5 rounded-full border border-black"
                                    />
                                  ))}
                                  {(c._count?.sessions ?? 0) > 3 && (
                                    <div className="w-5 h-5 rounded-full border border-black bg-white/[0.08] flex items-center justify-center text-[9px] text-white font-medium z-10">
                                      +{(c._count?.sessions ?? 0) - 3}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            
                            {!isCompleted && (
                              <div className="h-1.5 w-full bg-white/[0.08] rounded-full overflow-hidden flex gap-1">
                                <div className="h-full bg-emerald-500" style={{ width: '70%' }}></div>
                                <div className="h-full bg-amber-500" style={{ width: '20%' }}></div>
                                <div className="h-full bg-slate-600" style={{ width: '10%' }}></div>
                              </div>
                            )}
                            
                            {isCompleted && (
                              <div className="text-[11px] text-slate-400 space-y-1">
                                <p>Time saved analysis: 11 minutes, 11 minutes</p>
                                <p>Time saved efficiency: 20 minutes</p>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono pt-3 mt-3 border-t border-white/[0.04]">
                          <span>{c._count?.sessions ?? 0} candidate{(c._count?.sessions !== 1) ? 's' : ''}</span>
                          <span>{c.template?.durationMin ?? 45} minutes</span>
                          {!isCompleted && <span>20 minutes</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      </main>

      {/* MULTI-STEP NEW CAMPAIGN WIZARD MODAL */}
      <AnimatePresence>
        {showCampaignModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            {/* Modal Container */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white/[0.02] backdrop-blur-md transition-all duration-300 hover:scale-[0.98] hover:bg-white/[0.03] border border-white/[0.08] rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Header Section */}
              <div className="flex items-start justify-between px-6 pt-6 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    Configure Campaign.
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Automated screening round setup</p>
                </div>
                <button
                  type="button"
                  onClick={resetCampaignWizard}
                  className="text-slate-400 hover:text-white hover:bg-white/[0.08] p-2 rounded-lg border border-white/[0.08] transition-colors focus:outline-none"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Step Breadcrumb */}
              <div className="px-6 mb-5">
                <div className="flex items-center gap-2">
                  <span className={`flex items-center gap-1.5 ${campaignStep === 1 ? 'text-sm font-semibold text-white' : 'text-sm font-normal text-slate-500'}`}>
                    {campaignStep === 1 && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                    Details
                  </span>
                  <span className="text-slate-600 text-sm">/</span>
                  <span className={`flex items-center gap-1.5 ${campaignStep === 2 ? 'text-sm font-semibold text-white' : 'text-sm font-normal text-slate-500'}`}>
                    {campaignStep === 2 && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                    Configure
                  </span>
                </div>
              </div>

              {/* Form errors */}
              {formError && (
                <div className="mx-5 mb-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-[11px] shrink-0">
                  {formError}
                </div>
              )}

              {/* Wizard Dynamic Step Views */}
              <div className="px-6 flex-1 overflow-y-auto max-h-[65vh]">
                <AnimatePresence mode="wait">
                  <motion.div
                     key={campaignStep}
                     initial={{ opacity: 0, x: 10 }}
                     animate={{ opacity: 1, x: 0 }}
                     exit={{ opacity: 0, x: -10 }}
                     transition={{ duration: 0.15 }}
                     className="w-full"
                  >
                    {/* STEP 1: Basic details */}
                    {campaignStep === 1 && (
                      <div className="space-y-5">
                        <div>
                          <label className="text-xs font-semibold text-slate-300 mb-1.5 block uppercase tracking-wider">Campaign Name</label>
                          <input
                            type="text"
                            required
                            value={roleTitle}
                            onChange={(e) => setRoleTitle(e.target.value)}
                            placeholder="e.g. Frontend Developer Intern"
                            className="bg-white/[0.04] backdrop-blur-sm border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/20 transition-all w-full"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-slate-300 mb-1.5 block uppercase tracking-wider">Test Type</label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 my-2">
                            {/* Coding Assessment */}
                            <div 
                              onClick={() => setTestType('coding')}
                              className={`border rounded-xl p-4 cursor-pointer transition-all ${
                                testType === 'coding' 
                                  ? 'bg-[#1c222b] border-amber-500/80' 
                                  : 'bg-white/[0.04] backdrop-blur-sm border-white/[0.08] hover:border-white/[0.2]'
                              }`}
                            >
                              <FileCode className={`w-5 h-5 mb-2 ${testType === 'coding' ? 'text-amber-500' : 'text-slate-500'}`} />
                              <strong className="block text-sm font-semibold text-white">Live Coding Interview</strong>
                              <span className="text-xs text-slate-500 block mt-0.5">Google Docs-style collaborative editor</span>
                            </div>

                            {/* AI Video Interview */}
                            <div 
                              onClick={() => setTestType('video')}
                              className={`border rounded-xl p-4 cursor-pointer transition-all ${
                                testType === 'video' 
                                  ? 'bg-[#1c222b] border-amber-500/80' 
                                  : 'bg-white/[0.04] backdrop-blur-sm border-white/[0.08] hover:border-white/[0.2]'
                              }`}
                            >
                              <Sparkles className={`w-5 h-5 mb-2 ${testType === 'video' ? 'text-amber-500' : 'text-slate-500'}`} />
                              <strong className="block text-sm font-semibold text-white">AI Video Interview</strong>
                              
                              <div className="flex -space-x-1.5 overflow-hidden mt-3">
                                <DynamicAvatar email="alex.j@example.com" sizeClass="w-7 h-7" borderClass="border-2 border-[#1c222b]" />
                                <DynamicAvatar email="sarah.w@example.com" sizeClass="w-7 h-7" borderClass="border-2 border-[#1c222b]" />
                                <DynamicAvatar email="michael.k@example.com" sizeClass="w-7 h-7" borderClass="border-2 border-[#1c222b]" />
                                <div className="w-7 h-7 rounded-full border-2 border-[#1c222b] bg-white/[0.08] flex items-center justify-center text-[9px] text-white font-medium z-10">
                                  +4
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-slate-300 mb-1.5 block uppercase tracking-wider">Job Description (JD)</label>
                          <textarea
                            required
                            value={jobDescription}
                            onChange={(e) => setJobDescription(e.target.value)}
                            placeholder="Paste the Job Description here..."
                            className="bg-white/[0.04] backdrop-blur-sm border border-white/[0.08] rounded-xl p-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/20 min-h-[100px] resize-y w-full"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4 mt-1">
                          <div>
                            <label className="text-xs font-semibold text-slate-300 mb-1.5 block uppercase tracking-wider">Duration (Minutes)</label>
                            <div className="relative">
                              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                              <input
                                type="number"
                                required
                                min={10}
                                max={120}
                                value={durationMin}
                                onChange={(e) => setDurationMin(Number(e.target.value))}
                                className="bg-white/[0.04] backdrop-blur-sm border border-white/[0.08] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/20 transition-all w-full"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-slate-300 mb-1.5 block uppercase tracking-wider">Expiry Date</label>
                            <div className="relative">
                              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                              <input
                                type="date"
                                value={expiresAt}
                                onChange={(e) => setExpiresAt(e.target.value)}
                                className="bg-white/[0.04] backdrop-blur-sm border border-white/[0.08] rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/20 transition-all w-full cursor-pointer [color-scheme:dark]"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* STEP 2: Configuration - AI Video Interview or Live Coding */}
                    {campaignStep === 2 && (
                      <div className="space-y-4">

                        <div>
                          <label className="text-[10px] font-semibold text-slate-300 mb-1 block uppercase tracking-wider">AI Tone</label>
                          <div className="flex gap-2 my-2">
                            {['professional', 'friendly', 'strict'].map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setAiTone(t as any)}
                                className={
                                  aiTone === t
                                    ? 'bg-white text-slate-950 font-semibold px-4 py-1.5 rounded-xl text-xs border border-white shadow-sm cursor-pointer transition-all capitalize'
                                    : 'bg-white/[0.04] backdrop-blur-sm text-slate-400 hover:text-white border border-white/[0.08] px-4 py-1.5 rounded-xl text-xs cursor-pointer hover:border-white/[0.12] transition-all capitalize'
                                }
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-semibold text-slate-300 mb-1 block uppercase tracking-wider">Groq API Key</label>
                          {hasStoredGroqApiKey ? (
                            <div className="flex items-center justify-between bg-white/[0.04] backdrop-blur-sm border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-slate-400 font-mono">
                              <span>•••••••••••• (Saved globally)</span>
                              <button
                                type="button"
                                onClick={() => setHasStoredGroqApiKey(false)}
                                className="text-[10px] text-slate-400 hover:text-white font-semibold underline focus:outline-none"
                              >
                                Change
                              </button>
                            </div>
                          ) : (
                            <div>
                              <input
                                type="password"
                                value={groqApiKey}
                                onChange={(e) => setGroqApiKey(e.target.value)}
                                placeholder="gsk_..."
                                className="bg-white/[0.04] backdrop-blur-sm border border-white/[0.08] rounded-xl font-mono px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/20 transition-all w-full"
                              />
                              <label className="flex items-center gap-2 mt-3 cursor-pointer text-[11px] text-slate-400 hover:text-slate-300 select-none">
                                <input
                                  type="checkbox"
                                  checked={saveAsGlobalDefault}
                                  onChange={(e) => setSaveAsGlobalDefault(e.target.checked)}
                                  className="w-3.5 h-3.5 rounded border border-white/[0.12] bg-white/[0.04] backdrop-blur-sm text-amber-500 focus:ring-amber-500/30"
                                />
                                Save as global profile default
                              </label>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* STEP 3 & 4 (Unchanged logic, just minimal style tweaks if any) */}
                    {campaignStep === 3 && (
                      <div className="space-y-4">
                        <p className="text-sm text-slate-400 text-center leading-relaxed">
                          Proctara will automatically invite all candidates uploaded via CSV.
                        </p>
                        <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-white/[0.04] backdrop-blur-sm max-h-48 overflow-y-auto divide-y divide-slate-800">
                          {candidatesList.length === 0 ? (
                            <div className="text-sm text-slate-500 py-8 text-center">
                              No candidates found. Please upload a candidates CSV first.
                            </div>
                          ) : (
                            candidatesList.map((c, idx) => (
                              <div key={c.id || idx} className="flex items-center justify-between px-4 py-3 text-sm">
                                <div className="min-w-0 flex-1 pr-2">
                                  <div className="font-semibold text-white truncate">{c.name}</div>
                                  <div className="text-xs text-slate-400 truncate">{c.email}</div>
                                </div>
                                <span className="text-[10px] font-semibold text-amber-500 bg-amber-500/10 px-2 py-1 rounded-md uppercase shrink-0">
                                  Pending Invite
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                        <div className="text-center text-xs text-slate-500">
                          Total: <strong className="text-white">{candidatesList.length} candidates</strong> will receive automated invites.
                        </div>
                      </div>
                    )}

                    {campaignStep === 4 && (
                      <div className="space-y-5 py-4">
                        <div className="text-center">
                          <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                            <Check className="w-7 h-7 text-emerald-500" />
                          </div>
                          <h4 className="text-lg font-bold text-white">Campaign Created Successfully!</h4>
                          <p className="text-sm text-slate-400 mt-1">Unique invite URLs generated for candidates.</p>
                        </div>

                        <div className="border border-white/[0.08] rounded-xl bg-white/[0.04] backdrop-blur-sm divide-y divide-slate-800 max-h-56 overflow-y-auto">
                          {invites.map((inv, idx) => {
                            const isCopied = copiedLinkIndex === idx;
                            return (
                              <div key={idx} className="p-4 flex items-center justify-between gap-3 text-sm">
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold text-white truncate">{inv.name || 'Candidate'}</div>
                                  <div className="text-xs text-slate-400 truncate">{inv.email}</div>
                                  <div className="text-[10px] text-slate-500 truncate mt-1 font-mono select-all bg-white/[0.04] px-2 py-1 rounded border border-white/[0.08] inline-block">{inv.inviteUrl}</div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleCopyLinkIndex(inv.inviteUrl, idx)}
                                  className="flex items-center gap-2 text-xs bg-slate-100 hover:bg-white text-slate-950 font-semibold px-3 py-2 rounded-lg shrink-0 transition-all shadow-sm focus:outline-none"
                                >
                                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
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

              {/* ACTION FOOTER BAR */}
              <div className="border-t border-white/[0.08] px-6 py-4 mt-6 flex items-center justify-end gap-3 bg-transparent">
                {campaignStep === 1 && (
                  <button
                    type="button"
                    onClick={resetCampaignWizard}
                    className="bg-transparent hover:bg-white/[0.08]/50 text-slate-300 hover:text-white border border-white/[0.12] px-6 py-2.5 rounded-xl text-sm font-medium transition-all focus:outline-none"
                  >
                    Cancel
                  </button>
                )}

                {campaignStep === 2 && (
                  <button
                    type="button"
                    onClick={() => setCampaignStep(1)}
                    disabled={formLoading}
                    className="bg-transparent hover:bg-white/[0.08]/50 text-slate-300 hover:text-white border border-white/[0.12] px-6 py-2.5 rounded-xl text-sm font-medium transition-all focus:outline-none disabled:opacity-40"
                  >
                    Back
                  </button>
                )}

                {campaignStep === 1 ? (
                  <button
                    type="button"
                    disabled={!roleTitle.trim() || !jobDescription.trim()}
                    onClick={() => setCampaignStep(2)}
                    className="bg-slate-200 hover:bg-white text-slate-900 font-semibold px-6 py-2.5 rounded-xl text-sm transition-all shadow-sm hover:scale-[1.01] flex items-center gap-2 disabled:opacity-40 disabled:hover:scale-100 focus:outline-none"
                  >
                    Continue
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCreateCampaign}
                    disabled={formLoading || (!hasStoredGroqApiKey && !groqApiKey.trim())}
                    className="bg-slate-200 hover:bg-white text-slate-900 font-semibold px-6 py-2.5 rounded-xl text-sm transition-all shadow-sm hover:scale-[1.01] flex items-center gap-2 disabled:opacity-40 disabled:hover:scale-100 focus:outline-none"
                  >
                    {formLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Create Campaign
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
