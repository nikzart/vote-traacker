# Vote Tracker System

A comprehensive voter management and tracking system for electoral operations. Built with React, TypeScript, and Supabase.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Usage Guide](#usage-guide)
- [API Reference](#api-reference)

---

## Overview

Vote Tracker is a full-stack application designed to manage voter information during elections. It provides two main interfaces:

1. **Admin Dashboard** - For administrators to manage wards, import voter data, create credentials, and view statistics
2. **Ward Access Portal** - For polling station agents to track voters, mark votes, and manage voter groups

The system supports a hierarchical geographic structure:
```
District → Local Body → Ward → Polling Station → Voters
```

---

## Features

### Admin Dashboard

| Feature | Description |
|---------|-------------|
| **Dashboard** | View voting statistics with charts - total voters, voted count, political leaning distribution |
| **Ward Management** | Create and manage districts, local bodies, and wards |
| **Data Import** | Import voter data from CSV files with validation |
| **Credentials** | Generate and manage login credentials for polling station agents |

### Ward Access Portal

| Feature | Description |
|---------|-------------|
| **Voter Entry** | Search voters by serial number, view details, mark as voted |
| **Infinite Scroll** | Load voters progressively as you scroll (50 at a time) |
| **Filters** | Filter by voted status and political leaning |
| **Quick Vote** | One-tap vote marking with confirmation |
| **Voter Groups** | Create groups (families) and add voters to organize them |
| **Real-time Updates** | Changes sync instantly across all connected devices |
| **View-Only Mode** | Restricted access for observers without edit permissions |
| **Voter Details** | Edit political leaning, mobile number, abroad/deceased status |

### Authentication

- **Admin**: Supabase Auth (email/password)
- **Portal**: Custom credentials per ward/polling station

---

## Tech Stack

| Category | Technology |
|----------|------------|
| **Frontend** | React 18, TypeScript 5.5 |
| **Build Tool** | Vite 5.4 |
| **Styling** | Tailwind CSS 3.4, shadcn/ui components |
| **State Management** | Zustand 4.5 |
| **Routing** | React Router 6.26 |
| **Backend** | Supabase (PostgreSQL + Auth + Realtime) |
| **Charts** | Recharts 2.12 |
| **Icons** | Lucide React |

---

## Project Structure

```
vote-tracker/
├── src/
│   ├── components/
│   │   ├── ui/                 # Reusable UI components (Button, Card, Dialog, etc.)
│   │   └── portal/             # Portal-specific components
│   │       └── AddToGroupDialog.tsx
│   ├── pages/
│   │   ├── admin/              # Admin dashboard pages
│   │   │   ├── Layout.tsx      # Admin layout with sidebar
│   │   │   ├── Login.tsx       # Admin login (Supabase Auth)
│   │   │   ├── Dashboard.tsx   # Statistics dashboard
│   │   │   ├── WardManagement.tsx
│   │   │   ├── ImportData.tsx  # CSV import
│   │   │   └── Credentials.tsx # Credential management
│   │   └── portal/             # Ward access portal pages
│   │       ├── Layout.tsx      # Portal layout with tabs
│   │       ├── Login.tsx       # Portal login
│   │       ├── VoterEntry.tsx  # Main voter list & editing
│   │       └── Groups.tsx      # Voter groups management
│   ├── stores/
│   │   ├── authStore.ts        # Authentication state
│   │   └── uiStore.ts          # UI state (sidebar, toasts)
│   ├── lib/
│   │   ├── supabase.ts         # Supabase client & helper functions
│   │   └── utils.ts            # Utility functions
│   ├── types/
│   │   └── index.ts            # TypeScript type definitions
│   ├── App.tsx                 # Main app with routing
│   └── main.tsx                # Entry point
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql  # Database schema
├── public/                     # Static assets
├── .env.local                  # Environment variables (create this)
├── tailwind.config.js
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## Database Schema

### Tables

#### Geographic Hierarchy

```sql
districts
├── id (UUID, PK)
├── name (TEXT)
└── created_at (TIMESTAMPTZ)

local_bodies
├── id (UUID, PK)
├── district_id (FK → districts)
├── name (TEXT)
├── body_type (TEXT) -- 'municipality', 'panchayat', 'corporation'
└── created_at (TIMESTAMPTZ)

wards
├── id (UUID, PK)
├── local_body_id (FK → local_bodies)
├── ward_number (INTEGER)
├── name (TEXT)
└── created_at (TIMESTAMPTZ)

polling_stations
├── id (UUID, PK)
├── ward_id (FK → wards)
├── code (TEXT)
├── name (TEXT)
├── address (TEXT)
└── created_at (TIMESTAMPTZ)
```

#### Voter Data

```sql
voters
├── id (UUID, PK)
├── polling_station_id (FK → polling_stations)
├── serial_no (INTEGER)
├── sec_id (TEXT)              -- Electoral ID
├── name (TEXT)
├── guardian_name (TEXT)
├── house_no (TEXT)
├── house_name (TEXT)
├── age (INTEGER)
├── gender (TEXT)              -- 'M' or 'F'
├── political_leaning (TEXT)   -- 'UDF', 'LDF', 'NDA', 'Other', 'Neutral'
├── mobile_number (TEXT)
├── is_abroad (BOOLEAN)
├── is_deceased (BOOLEAN)
├── has_voted (BOOLEAN)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)
```

#### Voter Groups

```sql
voter_groups
├── id (UUID, PK)
├── ward_id (FK → wards)
├── name (TEXT)
├── group_type (TEXT)          -- 'family', 'custom'
└── created_at (TIMESTAMPTZ)

voter_group_members
├── id (UUID, PK)
├── group_id (FK → voter_groups)
├── voter_id (FK → voters)
└── created_at (TIMESTAMPTZ)
```

#### Authentication

```sql
ward_credentials
├── id (UUID, PK)
├── ward_id (FK → wards)
├── polling_station_id (FK → polling_stations, nullable)
├── username (TEXT, UNIQUE)
├── password_hash (TEXT)
├── is_master (BOOLEAN)        -- Can access all polling stations in ward
├── is_view_only (BOOLEAN)     -- Read-only access
├── is_active (BOOLEAN)
└── created_at (TIMESTAMPTZ)
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account (free tier works)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/nikzart/vote-traacker.git
   cd vote-tracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Supabase**

   a. Create a new project at [supabase.com](https://supabase.com)

   b. Go to SQL Editor and run the migration script:
   ```sql
   -- Copy contents from supabase/migrations/001_initial_schema.sql
   ```

   c. Create an admin user in Supabase Auth:
   - Go to Authentication → Users → Add user
   - Create with email/password (e.g., admin@example.com)

4. **Configure environment variables**

   Create `.env.local` in the project root:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

   Find these values in Supabase Dashboard → Settings → API

5. **Start development server**
   ```bash
   npm run dev
   ```

   Open http://localhost:5173

### Build for Production

```bash
npm run build
npm run preview  # Preview the build
```

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Your Supabase project URL | Yes |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous/public key | Yes |

---

## Usage Guide

### Admin Workflow

1. **Login** at `/admin/login` with your Supabase Auth credentials

2. **Set up geographic hierarchy**
   - Go to Ward Management
   - Create Districts → Local Bodies → Wards → Polling Stations

3. **Import voter data**
   - Go to Import Data
   - Select ward and polling station
   - Upload CSV with columns: serial_no, sec_id, name, guardian_name, house_no, house_name, age, gender

4. **Create portal credentials**
   - Go to Credentials
   - Create credentials for each ward/polling station
   - Share username/password with agents

5. **Monitor progress**
   - View Dashboard for real-time voting statistics

### Portal Workflow

1. **Login** at `/portal/login` with ward credentials

2. **Track voters**
   - Search by serial number
   - Use filters to find specific voters
   - Scroll to load more voters

3. **Mark votes**
   - Click the checkmark button for quick vote
   - Or open voter details and toggle "Voted" button

4. **Update voter info**
   - Click on a voter card
   - Update political leaning, mobile number
   - Mark as abroad or deceased if needed

5. **Manage groups**
   - Go to Groups tab
   - Create family/custom groups
   - Add voters to groups for easier tracking

---

## API Reference

### Supabase Helper Functions (`src/lib/supabase.ts`)

#### Authentication

```typescript
// Admin auth (Supabase Auth)
signInAdmin(email: string, password: string): Promise<AuthResponse>
signOutAdmin(): Promise<void>
getAdminSession(): Promise<Session | null>

// Portal auth (custom credentials)
verifyPortalCredentials(username: string, password: string): Promise<WardCredential>
```

#### Data Fetching

```typescript
// Geographic data
getDistricts(): Promise<District[]>
getLocalBodies(districtId?: string): Promise<LocalBody[]>
getWards(localBodyId?: string): Promise<Ward[]>
getPollingStations(wardId?: string): Promise<PollingStation[]>

// Voter data
getVoters(pollingStationId: string, options?: VoterQueryOptions): Promise<VoterResponse>
getVotersByWard(wardId: string, options?: VoterQueryOptions): Promise<VoterResponse>
updateVoter(voterId: string, updates: VoterUpdates): Promise<Voter>

// Voter groups
getVoterGroups(wardId: string): Promise<VoterGroup[]>
createVoterGroup(wardId: string, name: string, type: GroupType): Promise<VoterGroup>
getGroupMembers(groupId: string): Promise<VoterGroupMember[]>
addVoterToGroup(groupId: string, voterId: string): Promise<void>
removeVoterFromGroup(groupId: string, voterId: string): Promise<void>
deleteVoterGroup(groupId: string): Promise<void>

// Statistics
getVotingStats(filters?: StatsFilters): Promise<VotingStats>
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

---

## License

MIT

---

## Author

Pareekshith (nikzart)
