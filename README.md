# Proctara — AI Interview Platform

Proctara is a production-grade, end-to-end AI Technical Interview Platform (similar to Micro1). It allows companies to conduct automated, adaptive AI interviews for candidates. The platform handles everything from campaign creation and candidate invitations to conducting the live interview (with speech-to-text, text-to-speech, and live code editing) and generating comprehensive evaluation reports.

## 🚀 Tech Stack

### Frontend (`apps/web`)
- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS, Framer Motion (for premium, dynamic animations)
- **Icons:** Lucide React
- **Real-time:** Socket.io-client
- **Audio/Speech:** Browser-native Web Speech API (`SpeechRecognition`, `speechSynthesis`)
- **State/Auth:** React Context (`AuthProvider`), JWT tokens in `localStorage`
- **Features:** Dark mode aesthetic with amber/blue glow accents, Code Editor

### Backend (`apps/api`)
- **Framework:** Node.js, Express.js
- **Architecture:** Modular, Service-oriented architecture
- **Real-time Engine:** Socket.io (WebSocket for live interviews)
- **AI Integration:** Groq API (fallback to OpenAI) via Official OpenAI Node SDK
- **Language:** TypeScript
- **Auth:** JWT `jsonwebtoken`, bcrypt for password hashing, Google OAuth

### Database (`packages/database` / Prisma)
- **ORM:** Prisma Client
- **Database:** PostgreSQL (or CockroachDB/Neon based on connection string)
- **Schema Key Models:** `Company`, `CompanyUser`, `Candidate`, `JobRole`, `InterviewTemplate`, `Campaign`, `InterviewSession`

---

## 📂 Monorepo Setup & Folder Structure

We use Turborepo / NPM Workspaces to manage the monorepo structure. 

```text
Proctara/
├── apps/
│   ├── web/                     # Next.js Frontend application
│   │   ├── src/
│   │   │   ├── app/             # Application routes (App Router)
│   │   │   │   ├── (landing)    # Public marketing / career pages
│   │   │   │   ├── dashboard/   # Company Dashboard (analytics, campaigns, candidates)
│   │   │   │   ├── interview/   # Live AI Interview Engine (WebSocket + Code Editor)
│   │   │   │   ├── candidate/   # Candidate Portal
│   │   │   │   ├── login/       # Authentication pages
│   │   │   │   └── register/
│   │   │   ├── lib/             # Utilities (`api.ts` API Client, `auth-context.tsx`)
│   │   │   └── types/           # Global type declarations (e.g., Speech API)
│   │   ├── public/              # Static assets
│   │   └── package.json
│   │
│   └── api/                     # Express.js / Node.js Backend application
│       ├── src/
│       │   ├── controllers/     # Route logic
│       │   ├── middleware/      # Auth guards (`authenticateCompany`, `authenticateCandidate`)
│       │   ├── routes/          # Express Routers (`auth`, `campaigns`, `candidates`, `interviews`)
│       │   ├── services/        # Core logic (`aiEvaluation.ts`, `groqClient.ts`, `socketServer.ts`)
│       │   ├── utils/           # Helper functions
│       │   └── server.ts        # Entry point for HTTP server
│       ├── prisma/              # Prisma schema and migrations
│       │   └── schema.prisma    # Database schema definition
│       └── package.json
├── package.json                 # Monorepo root
└── .env                         # Root environment variables
```

---

## 🔄 Flow of States & Architecture

### 1. Authentication Flow
- **Companies:** Register with Name, Email, Password, or login with Google OAuth. They get a `userType: 'company'` JWT.
- **Candidates:** Added by recruiters manually or via bulk upload. The API auto-generates a secure `loginId` and `password` for them. Candidates log in at `/candidate/login` using these credentials. They get a `userType: 'candidate'` JWT.

### 2. Campaign & Invitation Flow
1. Recruiter goes to the Dashboard -> Campaigns.
2. Selects a Job Role (e.g., "Senior React Developer") and a Template (e.g., "45 min Frontend check").
3. Invites Candidates by Email.
4. The system automatically provisions an `InterviewSession` for each candidate with a unique `/interview/:token` URL.

### 3. Interview Setup Flow
1. Candidate logs into the Candidate Portal `/candidate/portal`.
2. Sees pending interviews. Clicks **Start**.
3. Reaches Setup Wizard (`/interview/:token/setup`):
   - **Step 1:** Device check (requires Camera & Mic permission).
   - **Step 2:** Audio test (records 3 seconds of audio and plays it back).
   - **Step 3:** Guidelines (reminds candidate about time limits, tab tracking, continuous recording).
   - **Step 4:** Ready to start.

### 4. Live AI Interview Engine Flow
1. The frontend initiates a WebSocket connection to the backend via `Socket.io`.
2. Backend validates the session and AI asks the first question -> Emits `interview:question`.
3. Frontend uses `SpeechSynthesis` to read the question out loud to the candidate.
4. If it's a coding question, the UI switches to the Code Editor mode.
5. Candidate replies via Voice (using browser `SpeechRecognition`) or Code (typing and submitting).
6. Result sent back to backend via WebSocket -> `interview:answer` or `interview:code_submit`.
7. Backend AI processes the answer, generates the next adaptive question, and replies.
8. Loop continues until the timer runs out or the AI determines the interview is complete.
9. Backend finalizes the session and calculates the overall score & recommendation via Groq AI.

---

## 🔐 Environment Variables

Create a `.env` file in the root folder (or inside `apps/api` and `apps/web` respectively). Use `.env.example` as a baseline.

### Backend (`apps/api/.env`)
```env
# Server
PORT=3001
NODE_ENV=development

# Database (PostgreSQL)
DATABASE_URL="postgresql://user:password@localhost:5432/proctara"

# Auth
JWT_SECRET="your-super-secret-jwt-key-change-in-production"

# AI Provider (Using Groq for extreme speed, falls back to OpenAI)
GROQ_API_KEY="gsk_..."
# OPENAI_API_KEY="sk-..." # Optional fallback

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_CALLBACK_URL="http://localhost:3001/api/auth/google/callback"

# Frontend URL
FRONTEND_URL="http://localhost:3000"
```

### Frontend (`apps/web/.env.local`)
```env
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

---

## 🛠️ Getting Started (Intern Onboarding)

### 1. Clone & Install
```bash
# Clone the repository
git clone https://github.com/your-org/Proctara.git
cd Proctara

# Install monorepo dependencies (using npm or pnpm workspaces)
npm install
```

### 2. Database Setup
Make sure you have PostgreSQL running locally or grab a URL from Neon / Supabase.
```bash
# Navigate to the API app
cd apps/api

# Push the schema to your database
npx prisma db push

# (Optional) generate the prisma client manually if needed
npx prisma generate
```

### 3. Start the Development Servers

**Run the Backend API:**
```bash
# Open terminal 1
cd apps/api
npm run dev
# The API will start on http://localhost:3001
```

**Run the Frontend Web App:**
```bash
# Open terminal 2
cd apps/web
npm run dev
# The Next.js app will start on http://localhost:3000
```

### 4. How to Test End-to-End
1. Go to `http://localhost:3000/register` and create a Company Account.
2. Go to the Dashboard, configure a job role and template (via API or UI).
3. Use the API or UI to Add a Candidate. Note their generated `loginId` and `password`.
4. Create a Campaign and Invite the Candidate.
5. Log out. Go to `http://localhost:3000/candidate/login` and log in with the Candidate's credentials.
6. Click "Start Interview" on the dashboard.
7. Go through the pre-interview setup wizard, allow camera and mic permissions.
8. Start talking to the AI Interviewer! 

---

## 📝 Key Design Decisions

- **Why Groq over OpenAI?** Natural conversation requires extremely low latency. Groq's LPU provides ~800 tokens/second, making voice conversations fluid and human-like without the typical 3-second GPT-4 delay.
- **Why WebSpeech API vs Custom Transcriber?** Using native `SpeechRecognition` saves backend transcription costs and reduces complexity. For complete production hardening, replacing this with deepgram/whisper WebSockets would be the next step.
- **Why Separate JWT User Types?** Strict role isolation. Recruiter queries shouldn't leak candidate data. Modifying `userType` ensures endpoints strictly enforce access boundaries via `authenticateCompany` and `authenticateCandidate` middleware.
- **Dynamic CSS Aesthetic (Premium Feel):** Used pure CSS radial gradients and pure black backgrounds with subtle white transparent borders `/0.06` to emulate the clean, premium feel of Micro1.

---
*Built for the future of unbiased, scalable hiring.*