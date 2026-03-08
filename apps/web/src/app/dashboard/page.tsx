'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
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
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { companyApi, campaignApi, candidateApi, interviewApi } from '@/lib/api';
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

export default function DashboardPage() {
  const { user, company, logout, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [recentInterviews, setRecentInterviews] = useState<RecentInterview[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'dashboard' | 'campaigns' | 'candidates'>('dashboard');

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Fetch dashboard data
  const fetchData = useCallback(async () => {
    try {
      const [analyticsRes, campaignsRes, interviewsRes] = await Promise.all([
        companyApi.analytics(),
        campaignApi.list(),
        interviewApi.list(1, 10),
      ]);
      setAnalytics(analyticsRes.data || null);
      setCampaigns((campaignsRes.data || []) as unknown as Campaign[]);
      setRecentInterviews((interviewsRes.data || []) as unknown as RecentInterview[]);
    } catch {
      // API may not be running — show empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

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
    <div className="min-h-screen bg-black flex">
      {/* Sidebar */}
      <aside className="w-60 border-r border-white/[0.06] flex flex-col shrink-0 sticky top-0 h-screen">
        <div className="p-5 border-b border-white/[0.06]">
          <Link href="/" className="text-lg font-bold text-white tracking-tight">
            Proctara<span className="text-amber-400">.</span>
          </Link>
          <p className="text-xs text-gray-600 mt-0.5">{company?.name}</p>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {[
            { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
            { id: 'campaigns' as const, label: 'Campaigns', icon: FolderOpen },
            { id: 'candidates' as const, label: 'Candidates', icon: UserPlus },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                activeSection === item.id
                  ? 'bg-white/[0.06] text-white font-medium'
                  : 'text-gray-500 hover:text-white hover:bg-white/[0.03]'
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
              <p className="text-[10px] text-gray-600 capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={() => { logout(); router.push('/login'); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-600 hover:text-white hover:bg-white/[0.04] transition-all mt-1"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-8 py-8">
          {activeSection === 'dashboard' && (
            <>
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                  <p className="text-sm text-gray-500">Overview of your interview pipeline</p>
                </div>
                <button
                  onClick={() => setActiveSection('campaigns')}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-gray-100 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  New Campaign
                </button>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-4 gap-4 mb-8">
                {stats.map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-9 h-9 rounded-lg ${stat.bg} flex items-center justify-center`}>
                        <stat.icon className={`w-4.5 h-4.5 ${stat.color}`} />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-white">{stat.value}</div>
                    <div className="text-xs text-gray-600 mt-0.5">{stat.label}</div>
                  </motion.div>
                ))}
              </div>

              {/* Active Campaigns */}
              <section className="mb-8">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Active Campaigns</h2>
                {campaigns.length === 0 ? (
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-8 text-center">
                    <FolderOpen className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">No campaigns yet</p>
                    <p className="text-gray-600 text-xs mt-1">Create a campaign to start interviewing candidates</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {campaigns.slice(0, 5).map((c) => (
                      <div key={c.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 flex items-center justify-between hover:border-white/[0.1] transition-all">
                        <div>
                          <h3 className="text-sm font-medium text-white">{c.title}</h3>
                          <p className="text-xs text-gray-600 mt-0.5">{c.jobRole.title} • {c._count.sessions} candidates</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs px-2 py-0.5 rounded-md capitalize ${
                            c.status === 'active' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                            'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                          }`}>{c.status}</span>
                          <ArrowUpRight className="w-4 h-4 text-gray-600" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Recent Interviews */}
              <section>
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Recent Interviews</h2>
                {recentInterviews.length === 0 ? (
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-8 text-center">
                    <Users className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">No interviews conducted yet</p>
                  </div>
                ) : (
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/[0.06] text-gray-600 text-xs">
                          <th className="text-left px-4 py-3 font-medium">Candidate</th>
                          <th className="text-left px-4 py-3 font-medium">Role</th>
                          <th className="text-left px-4 py-3 font-medium">Status</th>
                          <th className="text-left px-4 py-3 font-medium">Score</th>
                          <th className="text-left px-4 py-3 font-medium">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentInterviews.map((interview) => (
                          <tr key={interview.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-medium text-white">{interview.candidate.name || '—'}</div>
                              <div className="text-xs text-gray-600">{interview.candidate.email}</div>
                            </td>
                            <td className="px-4 py-3 text-gray-400">{interview.jobRole.title}</td>
                            <td className="px-4 py-3">
                              <span className={`text-xs px-2 py-0.5 rounded-md capitalize ${
                                interview.status === 'completed' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                                interview.status === 'in_progress' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                interview.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                              }`}>{interview.status.replace('_', ' ')}</span>
                            </td>
                            <td className="px-4 py-3">
                              {interview.evaluation ? (
                                <span className="text-white font-mono font-medium">
                                  {Number(interview.evaluation.overallScore).toFixed(0)}
                                </span>
                              ) : <span className="text-gray-700">—</span>}
                            </td>
                            <td className="px-4 py-3 text-gray-600 text-xs">
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

          {activeSection === 'campaigns' && (
            <div>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h1 className="text-2xl font-bold text-white">Campaigns</h1>
                  <p className="text-sm text-gray-500">Manage your interview campaigns</p>
                </div>
              </div>

              {campaigns.length === 0 ? (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-12 text-center">
                  <FolderOpen className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                  <h3 className="text-lg text-gray-400 mb-1">No campaigns yet</h3>
                  <p className="text-sm text-gray-600 mb-4">Create your first campaign to start interviewing</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {campaigns.map(c => (
                    <div key={c.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 hover:border-white/[0.1] transition-all">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-base font-medium text-white">{c.title}</h3>
                          <p className="text-xs text-gray-500 mt-1">{c.jobRole.title} • {c.template.name} • {c.template.durationMin}min</p>
                          <p className="text-xs text-gray-600 mt-2">{c._count.sessions} candidates invited</p>
                        </div>
                        <span className={`text-xs px-2.5 py-1 rounded-lg capitalize ${
                          c.status === 'active' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                          c.status === 'paused' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                          'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                        }`}>{c.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeSection === 'candidates' && (
            <div>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h1 className="text-2xl font-bold text-white">Candidates</h1>
                  <p className="text-sm text-gray-500">Manage your candidate pool</p>
                </div>
              </div>

              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-12 text-center">
                <UserPlus className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                <h3 className="text-lg text-gray-400 mb-1">Candidate Management</h3>
                <p className="text-sm text-gray-600">Add candidates via the API or bulk import</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
