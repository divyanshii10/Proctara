'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Code2,
  Shield,
  BarChart3,
  Zap,
  Users,
  ArrowRight,
  ChevronDown,
  Play,
  Briefcase,
  GraduationCap,
  Globe,
  Award,
  HeartHandshake,
  Plus,
  Minus,
} from 'lucide-react';

/* ═══════════════════════════════════════════
   Animation variants
   ═══════════════════════════════════════════ */

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94], delay: i * 0.1 },
  }),
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

/* ═══════════════════════════════════════════
   Navbar
   ═══════════════════════════════════════════ */

function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  if (typeof window !== 'undefined') {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useState(() => {
      const onScroll = () => setScrolled(window.scrollY > 40);
      window.addEventListener('scroll', onScroll);
    });
  }

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-black/70 backdrop-blur-xl border-b border-white/[0.06]'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="relative flex items-center justify-between h-16 lg:h-20">
          {/* Left nav */}
          <nav className="hidden lg:flex items-center gap-7 text-[15px] text-neutral-400">
            <a href="#features" className="hover:text-white transition-colors duration-200">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-white transition-colors duration-200">
              How it works
            </a>
            <a href="#pricing" className="hover:text-white transition-colors duration-200">
              Pricing
            </a>
          </nav>

          {/* Logo — strictly centered */}
          <a href="/" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <span className="text-2xl font-bold tracking-tight text-white">
              Proctara<span className="text-neutral-500">.</span>
            </span>
          </a>

          {/* Right nav */}
          <div className="flex items-center gap-5">
            <a
              href="/login"
              className="text-[15px] text-neutral-400 hover:text-white transition-colors duration-200 hidden sm:block"
            >
              Login
            </a>
            <a
              href="/register"
              className="inline-flex items-center px-5 py-2.5 text-sm font-medium text-white border border-white/20 rounded-full hover:bg-white hover:text-black transition-all duration-300"
            >
              Get Started
            </a>
          </div>
        </div>
      </div>
    </motion.header>
  );
}

/* ═══════════════════════════════════════════
   Hero Section
   ═══════════════════════════════════════════ */

function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center pt-20 pb-12">
      {/* Ambient warm glow — top center (amber/warm) */}
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

      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
        <motion.h1
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          custom={0}
          className="text-[clamp(2.5rem,6vw,4.5rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-white text-balance"
        >
          Conduct AI interviews
          <br />
          that find real talent
        </motion.h1>

        <motion.p
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          custom={1}
          className="mt-7 max-w-2xl mx-auto text-lg sm:text-xl text-neutral-400 leading-relaxed"
        >
          Adaptive technical interviews, live coding challenges, and detailed
          candidate evaluations — eliminating bias from your hiring pipeline.
        </motion.p>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          custom={2}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <a
            href="/register"
            className="group inline-flex items-center gap-3 pl-5 pr-7 py-3.5 bg-white text-black rounded-full text-base font-medium hover:bg-neutral-100 transition-all duration-300"
          >
            <span className="w-8 h-8 rounded-full bg-black flex items-center justify-center">
              <ArrowRight className="w-4 h-4 text-white" />
            </span>
            Start Free Trial
          </a>
          <a
            href="#how-it-works"
            className="inline-flex items-center gap-2 px-7 py-3.5 text-base text-neutral-400 hover:text-white transition-colors duration-200"
          >
            See How It Works
            <ChevronDown className="w-4 h-4" />
          </a>
        </motion.div>
      </div>

      {/* Dashboard Preview */}
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative z-10 mt-20 w-full max-w-5xl mx-auto px-6"
      >
        <div className="relative rounded-2xl border border-white/[0.08] bg-neutral-950/80 backdrop-blur-sm overflow-hidden p-1">
          <div className="rounded-xl bg-black border border-white/[0.05] overflow-hidden">
            {/* Browser chrome */}
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/[0.06]">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="px-6 py-1.5 rounded-lg bg-white/[0.04] text-xs text-neutral-600 font-mono">
                  app.proctara.com/dashboard
                </div>
              </div>
            </div>

            {/* Dashboard content */}
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-white">Interview Dashboard</h3>
                  <p className="text-sm text-neutral-600 mt-0.5">Real-time candidate pipeline</p>
                </div>
                <div className="flex gap-2">
                  <span className="px-3 py-1.5 text-xs font-medium rounded-full bg-white/[0.06] text-neutral-400">
                    142 Active
                  </span>
                  <span className="px-3 py-1.5 text-xs font-medium rounded-full bg-white/[0.06] text-neutral-400">
                    89 Completed
                  </span>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Total Interviews', value: '2,847', change: '+12%' },
                  { label: 'Avg Score', value: '74.2', change: '+3.1' },
                  { label: 'Pass Rate', value: '38%', change: '+5%' },
                  { label: 'Time Saved', value: '412h', change: 'This month' },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="p-4 rounded-xl border border-white/[0.05] bg-white/[0.02]"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-neutral-600">{stat.label}</span>
                      <span className="text-xs text-neutral-500">{stat.change}</span>
                    </div>
                    <div className="text-xl font-semibold text-white">{stat.value}</div>
                  </div>
                ))}
              </div>

              {/* Candidate rows */}
              <div className="space-y-2">
                {[
                  { name: 'Candidate A', role: 'Senior Frontend', score: 92, status: 'Strong Yes', dot: 'bg-emerald-400' },
                  { name: 'Candidate B', role: 'Backend Engineer', score: 78, status: 'Yes', dot: 'bg-blue-400' },
                  { name: 'Candidate C', role: 'Full Stack', score: 65, status: 'Maybe', dot: 'bg-amber-400' },
                ].map((c) => (
                  <div
                    key={c.name}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-white/[0.05] bg-white/[0.015]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center text-sm font-medium text-neutral-400">
                        {c.name.charAt(c.name.length - 1)}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">{c.name}</div>
                        <div className="text-xs text-neutral-600">{c.role}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-mono text-neutral-300">{c.score}/100</span>
                      <span className="flex items-center gap-1.5 text-xs text-neutral-400">
                        <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                        {c.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black to-transparent pointer-events-none" />
      </motion.div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   Value propositions (Why section)
   ═══════════════════════════════════════════ */

const valueProps = [
  {
    icon: Briefcase,
    title: 'Scale your hiring pipeline',
    desc: 'Conduct thousands of interviews simultaneously with the same quality and fairness.',
  },
  {
    icon: GraduationCap,
    title: 'Adaptive AI questioning',
    desc: 'Our AI adjusts difficulty in real-time based on candidate performance.',
  },
  {
    icon: Award,
    title: 'Unbiased evaluations',
    desc: 'Text-only scoring with blind evaluation. Pure skill-based assessment.',
  },
  {
    icon: Globe,
    title: 'Enterprise ready',
    desc: 'SOC 2 compliant. ATS integrations, SSO support, and dedicated management.',
  },
  {
    icon: HeartHandshake,
    title: 'Detailed candidate reports',
    desc: 'Structured rubric-based scoring across technical accuracy and communication.',
  },
];

function WhySection() {
  return (
    <section className="relative py-32 px-6">
      <div className="max-w-5xl mx-auto">
        <motion.h2
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={fadeUp}
          className="text-[clamp(2rem,4vw,3rem)] font-semibold leading-tight tracking-[-0.02em] text-white text-center"
        >
          Why the best teams choose Proctara
        </motion.h2>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
          variants={stagger}
          className="mt-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-14"
        >
          {valueProps.map((item, i) => (
            <motion.div key={item.title} variants={fadeUp} custom={i} className="group">
              <div className="w-12 h-12 rounded-xl border border-dashed border-white/[0.15] flex items-center justify-center mb-5 group-hover:border-white/30 transition-colors duration-300">
                <item.icon className="w-5 h-5 text-neutral-400 group-hover:text-white transition-colors duration-300" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">{item.title}</h3>
              <p className="text-[15px] text-neutral-500 leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mt-16 flex justify-center"
        >
          <a
            href="/register"
            className="group inline-flex items-center gap-3 pl-5 pr-7 py-3.5 bg-white text-black rounded-full text-base font-medium hover:bg-neutral-100 transition-all duration-300"
          >
            <span className="w-8 h-8 rounded-full bg-black flex items-center justify-center">
              <ArrowRight className="w-4 h-4 text-white" />
            </span>
            Get Started
          </a>
        </motion.div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   Features Grid
   ═══════════════════════════════════════════ */

const features = [
  {
    icon: Brain,
    title: 'Adaptive AI Interviewer',
    description:
      'Our AI adjusts question difficulty in real-time based on candidate performance. No two interviews are the same.',
  },
  {
    icon: Code2,
    title: 'Live Coding Challenges',
    description:
      'In-browser Monaco editor with sandboxed execution. Support for JavaScript, Python, Java, C++, and Go.',
  },
  {
    icon: Shield,
    title: 'Bias-Free Evaluation',
    description:
      'Text-only scoring with blind evaluation. No video analysis, no accent detection. Pure skill-based assessment.',
  },
  {
    icon: BarChart3,
    title: 'Detailed Reports',
    description:
      'Structured rubric-based scoring across technical accuracy, problem-solving, depth, and communication.',
  },
  {
    icon: Zap,
    title: 'Scale Effortlessly',
    description:
      'Conduct thousands of interviews simultaneously. From 10 to 10,000 candidates — same quality, same fairness.',
  },
  {
    icon: Globe,
    title: 'Enterprise Ready',
    description:
      'SOC 2 compliant architecture, ATS integrations, SSO support, and dedicated account management.',
  },
];

function FeaturesSection() {
  return (
    <section id="features" className="relative py-32 px-6">
      {/* Subtle wave-like background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute w-full h-full opacity-[0.03]"
          style={{
            backgroundImage: `repeating-linear-gradient(
              0deg,
              transparent,
              transparent 100px,
              rgba(255,255,255,0.5) 100px,
              rgba(255,255,255,0.5) 101px
            )`,
          }}
        />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger}
          className="text-center mb-20"
        >
          <motion.h2
            variants={fadeUp}
            className="text-[clamp(2rem,4vw,3rem)] font-semibold leading-tight tracking-[-0.02em] text-white"
          >
            Everything you need to
            <br />
            hire without bias
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="mt-5 max-w-2xl mx-auto text-lg text-neutral-500"
          >
            A complete AI-powered interview platform that replaces inconsistent
            human screening with fair, structured evaluations.
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
          variants={stagger}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              variants={fadeUp}
              custom={i}
              className="group p-7 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.12] transition-all duration-300"
            >
              <div className="w-11 h-11 rounded-lg border border-dashed border-white/[0.12] flex items-center justify-center mb-5 group-hover:border-white/25 transition-colors duration-300">
                <feature.icon className="w-5 h-5 text-neutral-500 group-hover:text-white transition-colors duration-300" />
              </div>
              <h3 className="text-[17px] font-medium text-white mb-2.5">
                {feature.title}
              </h3>
              <p className="text-[15px] text-neutral-500 leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   How It Works
   ═══════════════════════════════════════════ */

const steps = [
  {
    step: '01.',
    title: 'Create your interview',
    description:
      'Define the role, skills, and difficulty. Our AI generates a tailored question bank with scoring rubrics.',
  },
  {
    step: '02.',
    title: 'Invite candidates',
    description:
      'Send invite links via email. Candidates join from any browser — no downloads, no apps, no friction.',
  },
  {
    step: '03.',
    title: 'AI conducts the interview',
    description:
      'Our AI adapts questions in real-time, runs coding challenges, and captures everything for evaluation.',
  },
  {
    step: '04.',
    title: 'Review detailed reports',
    description:
      'Get structured scores, evidence-based recommendations, and side-by-side candidate comparisons.',
  },
];

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger}
          className="grid lg:grid-cols-2 gap-16 lg:gap-24"
        >
          {/* Left — Steps */}
          <div>
            <motion.h2
              variants={fadeUp}
              className="text-[clamp(2rem,4vw,3rem)] font-semibold leading-tight tracking-[-0.02em] text-white mb-14"
            >
              How it works
            </motion.h2>

            <div className="space-y-10">
              {steps.map((step, i) => (
                <motion.div
                  key={step.step}
                  variants={fadeUp}
                  custom={i}
                  className="flex gap-6"
                >
                  <span className="text-sm text-neutral-600 font-mono pt-1 flex-shrink-0 w-8">
                    {step.step}
                  </span>
                  <div>
                    <h3 className="text-lg font-medium text-white mb-1.5">
                      {step.title}
                    </h3>
                    <p className="text-[15px] text-neutral-500 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Right — App preview card */}
          <motion.div
            variants={fadeUp}
            custom={2}
            className="flex items-center"
          >
            <div className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
              {/* Top bar */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
                <span className="text-sm font-semibold text-white">Proctara</span>
                <div className="w-16 h-1.5 rounded-full bg-emerald-500/60" />
                <span className="text-xs text-neutral-600">Logout</span>
              </div>
              {/* Content skeleton */}
              <div className="p-6 space-y-4">
                <div className="h-3 bg-white/[0.04] rounded-full w-3/4" />
                <div className="h-3 bg-white/[0.04] rounded-full w-1/2" />
                <div className="mt-6 grid grid-cols-3 gap-3">
                  <div className="h-20 rounded-xl bg-white/[0.03] border border-white/[0.05]" />
                  <div className="h-20 rounded-xl bg-white/[0.03] border border-white/[0.05]" />
                  <div className="h-20 rounded-xl bg-white/[0.03] border border-white/[0.05]" />
                </div>
                <div className="mt-4 space-y-2">
                  <div className="h-10 rounded-lg bg-white/[0.03] border border-white/[0.05]" />
                  <div className="h-10 rounded-lg bg-white/[0.03] border border-white/[0.05]" />
                  <div className="h-10 rounded-lg bg-white/[0.03] border border-white/[0.05]" />
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   Pricing
   ═══════════════════════════════════════════ */

const plans = [
  {
    name: 'Starter',
    price: 'Free',
    period: '',
    description: 'Perfect for trying out Proctara',
    features: [
      '5 interviews / month',
      '3 job roles',
      'Basic reports',
      'Email support',
    ],
    cta: 'Start Free',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$99',
    period: '/mo',
    description: 'For growing teams that hire regularly',
    features: [
      '100 interviews / month',
      'Unlimited roles',
      'Advanced analytics',
      'Custom rubrics',
      'Priority support',
      'ATS webhooks',
    ],
    cta: 'Start Pro Trial',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For large organizations',
    features: [
      'Unlimited interviews',
      'SSO & SAML',
      'Custom AI models',
      'Dedicated CSM',
      'SLA guarantee',
      'SOC 2 report',
    ],
    cta: 'Contact Sales',
    highlighted: false,
  },
];

function PricingSection() {
  return (
    <section id="pricing" className="relative py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger}
          className="text-center mb-16"
        >
          <motion.h2
            variants={fadeUp}
            className="text-[clamp(2rem,4vw,3rem)] font-semibold leading-tight tracking-[-0.02em] text-white"
          >
            Simple, transparent pricing
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="mt-5 text-lg text-neutral-500"
          >
            Start free. Scale as you grow. No hidden fees.
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
          variants={stagger}
          className="grid md:grid-cols-3 gap-6"
        >
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              variants={fadeUp}
              custom={i}
              className={`relative p-8 rounded-2xl border transition-all duration-300 ${
                plan.highlighted
                  ? 'border-white/20 bg-white/[0.04]'
                  : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-white text-black text-xs font-semibold">
                  Most Popular
                </div>
              )}

              <h3 className="text-xl font-semibold text-white">{plan.name}</h3>
              <p className="text-sm text-neutral-600 mt-1 mb-6">
                {plan.description}
              </p>

              <div className="mb-8">
                <span className="text-4xl font-bold text-white">
                  {plan.price}
                </span>
                <span className="text-neutral-500 text-sm">{plan.period}</span>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-center gap-3 text-sm text-neutral-400"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-neutral-600 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href="/register"
                className={`block text-center py-3 rounded-full text-sm font-medium transition-all duration-300 ${
                  plan.highlighted
                    ? 'bg-white text-black hover:bg-neutral-100'
                    : 'border border-white/[0.12] text-neutral-300 hover:bg-white/[0.06] hover:border-white/20'
                }`}
              >
                {plan.cta}
              </a>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   Testimonials
   ═══════════════════════════════════════════ */

const testimonials = [
  {
    text: 'Proctara has completely transformed our hiring process. We went from spending 40+ hours per week on first-round screens to automated evaluations that are more consistent and fair.',
    name: 'Sarah Chen',
    title: 'VP Engineering, TechCorp',
  },
  {
    text: 'The coding challenges are exceptional — real-world problems with proper sandboxed execution. Candidates actually enjoy the interview experience, which improves our employer brand.',
    name: 'Marcus Johnson',
    title: 'Head of Talent, ScaleAI',
  },
  {
    text: 'We reduced time-to-hire by 60% and improved quality of hires measured by 90-day retention. The bias-free approach gave us confidence in our hiring decisions.',
    name: 'Priya Sharma',
    title: 'CTO, DataFlow',
  },
];

function TestimonialsSection() {
  return (
    <section className="relative py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.h2
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={fadeUp}
          className="text-[clamp(2rem,4vw,3rem)] font-semibold leading-tight tracking-[-0.02em] text-white text-center mb-16"
        >
          Hear from our customers
        </motion.h2>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
          variants={stagger}
          className="grid md:grid-cols-3 gap-6"
        >
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              variants={fadeUp}
              custom={i}
              className="p-7 rounded-2xl border border-white/[0.06] bg-white/[0.02]"
            >
              <p className="text-[15px] text-neutral-400 leading-relaxed mb-8">
                &quot;{t.text}&quot;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/[0.06] flex items-center justify-center text-sm font-medium text-neutral-400">
                  {t.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </div>
                <div>
                  <div className="text-sm font-medium text-white">
                    {t.name}
                  </div>
                  <div className="text-xs text-neutral-600">{t.title}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   FAQ Section
   ═══════════════════════════════════════════ */

const faqs = [
  {
    q: 'How does Proctara conduct interviews?',
    a: 'Proctara uses an AI interviewer that asks adaptive technical questions and runs coding challenges. The AI adjusts difficulty based on candidate responses, creating a personalized interview experience.',
  },
  {
    q: 'What happens after a candidate completes an interview?',
    a: 'You receive a detailed evaluation report with structured scores across technical accuracy, problem-solving depth, and communication. Candidates are ranked with evidence-based recommendations.',
  },
  {
    q: 'How does Proctara eliminate bias?',
    a: 'All evaluations are text-based with blind scoring. We do not analyze video, voice, or accent. Scoring rubrics are standardized and applied consistently across all candidates for the same role.',
  },
  {
    q: 'What coding languages are supported?',
    a: 'We support JavaScript, TypeScript, Python, Java, C++, Go, and Ruby. Code is executed in a sandboxed environment with real-time compilation and test case validation.',
  },
  {
    q: 'Can I integrate Proctara with my existing ATS?',
    a: 'Yes. We offer native integrations with Greenhouse, Lever, Workday, and Ashby, plus a REST API and webhook support for custom integrations.',
  },
  {
    q: 'Is my data secure?',
    a: 'Proctara is built on SOC 2 Type II compliant infrastructure. All data is encrypted at rest and in transit. We offer SSO/SAML for enterprise customers and support data residency requirements.',
  },
];

function FAQItem({ faq }: { faq: { q: string; a: string } }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-white/[0.06] last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-6 text-left group"
      >
        <span className="text-[17px] font-medium text-white pr-8 group-hover:text-neutral-200 transition-colors">
          {faq.q}
        </span>
        <span className="flex-shrink-0 w-8 h-8 rounded-full border border-white/[0.12] flex items-center justify-center">
          {open ? (
            <Minus className="w-4 h-4 text-neutral-400" />
          ) : (
            <Plus className="w-4 h-4 text-neutral-400" />
          )}
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <p className="pb-6 text-[15px] text-neutral-500 leading-relaxed max-w-3xl">
              {faq.a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FAQSection() {
  return (
    <section className="relative py-32 px-6">
      <div className="max-w-3xl mx-auto">
        <motion.h2
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={fadeUp}
          className="text-[clamp(2rem,4vw,3rem)] font-semibold leading-tight tracking-[-0.02em] text-white mb-14"
        >
          Frequently asked
          <br />
          questions
        </motion.h2>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
          variants={stagger}
        >
          {faqs.map((faq, i) => (
            <motion.div key={faq.q} variants={fadeUp} custom={i}>
              <FAQItem faq={faq} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   CTA Section
   ═══════════════════════════════════════════ */

function CTASection() {
  return (
    <section className="relative py-32 px-6 overflow-hidden">
      {/* Background texture */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, white 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto text-center">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
        >
          <motion.h2
            variants={fadeUp}
            className="text-[clamp(2rem,5vw,3.5rem)] font-semibold leading-tight tracking-[-0.02em] text-white"
          >
            Ready to transform
            <br />
            your hiring process?
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="mt-6 text-lg text-neutral-500 max-w-xl mx-auto"
          >
            Join forward-thinking companies replacing biased, inconsistent interviews
            with fair AI-powered evaluations.
          </motion.p>
          <motion.div variants={fadeUp} className="mt-10">
            <a
              href="/register"
              className="group inline-flex items-center gap-3 pl-5 pr-7 py-3.5 bg-white text-black rounded-full text-base font-medium hover:bg-neutral-100 transition-all duration-300"
            >
              <span className="w-8 h-8 rounded-full bg-black flex items-center justify-center">
                <ArrowRight className="w-4 h-4 text-white" />
              </span>
              Get Started for Free
            </a>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   Footer
   ═══════════════════════════════════════════ */

function Footer() {
  return (
    <footer className="border-t border-white/[0.06] py-16 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <span className="text-xl font-bold text-white">
              Proctara<span className="text-neutral-600">.</span>
            </span>
            <p className="mt-3 text-sm text-neutral-600 leading-relaxed">
              AI-powered technical
              <br />
              interviews, without bias.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-sm font-medium text-neutral-400 mb-4">
              Product
            </h4>
            <ul className="space-y-2.5 text-sm text-neutral-600">
              <li>
                <a href="#features" className="hover:text-white transition-colors">
                  Features
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-white transition-colors">
                  Pricing
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-white transition-colors">
                  How it works
                </a>
              </li>
              <li>
                <a href="/jobs" className="hover:text-white transition-colors">
                  Open Jobs
                </a>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-sm font-medium text-neutral-400 mb-4">
              Company
            </h4>
            <ul className="space-y-2.5 text-sm text-neutral-600">
              <li>
                <a href="/about" className="hover:text-white transition-colors">
                  About
                </a>
              </li>
              <li>
                <a href="/careers" className="hover:text-white transition-colors">
                  Careers
                </a>
              </li>
              <li>
                <a href="/blog" className="hover:text-white transition-colors">
                  Blog
                </a>
              </li>
              <li>
                <a href="mailto:support@proctara.com" className="hover:text-white transition-colors">
                  Contact
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-medium text-neutral-400 mb-4">
              Legal
            </h4>
            <ul className="space-y-2.5 text-sm text-neutral-600">
              <li>
                <a href="/privacy" className="hover:text-white transition-colors">
                  Privacy
                </a>
              </li>
              <li>
                <a href="/terms" className="hover:text-white transition-colors">
                  Terms
                </a>
              </li>
              <li>
                <a href="/security" className="hover:text-white transition-colors">
                  Security
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-white/[0.06] flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-neutral-700">
            © {new Date().getFullYear()} Proctara. All rights reserved.
          </p>
          <p className="text-sm text-neutral-700">
            support@proctara.com
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════ */

export default function LandingPage() {
  return (
    <div className="page-wrapper">
      <Navbar />
      <HeroSection />
      <WhySection />
      <FeaturesSection />
      <HowItWorksSection />
      <PricingSection />
      <TestimonialsSection />
      <FAQSection />
      <CTASection />
      <Footer />
    </div>
  );
}
