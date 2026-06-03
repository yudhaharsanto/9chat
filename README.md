# 9Chat — AI Chat Assistant

Personal AI chat assistant powered by [9router](https://github.com/yudhaharsanto) gateway. Built with Next.js 15, React 19, shadcn/ui (base-ui), and Tailwind CSS v4.

## Features

### 💬 Chat
- Multi-conversation with **background streaming** (survives page close, auto-resumes on return)
- Edit message with branch carousel (ChatGPT-style editing in bottom input)
- Image upload via ImgBB (clipboard paste, drag & drop, file picker)
- Conversation auto-rename from first message
- Per-conversation model memory (remembers last used model)
- **Regenerate** responses (🔄 button on last AI message)
- **Web search grounding** (🌐 toggle, DuckDuckGo search results injected as context)
- **Pinned conversations** (📌 pin to top)
- Conversation search
- **Math rendering** (KaTeX: `$inline$` and `$$display$$`)
- **Code syntax highlighting** (highlight.js with atom-one-dark theme)
- **Code copy** button with toast notification
- **Long message collapse** — user messages > 2000 chars get "Show all" toggle
- **Timestamp** on every message (Indonesian format, Asia/Jakarta timezone)
- Message copy, edit, and retry actions on hover

### 🤖 AI Agents
- Custom system prompts, model, and temperature per agent
- Admin-created (public) and user-created (private) agents
- Agent selection from sidebar

### 🧠 Memory System
- **Global memory** — applies to all conversations (preferences, personal info)
- **Room memory** — scoped to specific conversation (project context)
- **Auto-memory extraction** — AI-powered memory detection from conversations
- Memory dialog for adding/editing memories
- Auto-injected into system prompt for personalized responses
- **AI name memory** — set a custom name for the AI that persists across models
- JSON content format with upsert logic (one row per user/category/scope)

### 📚 Skills & Knowledge
- **Skills** — predefined prompt templates (Code Review, Translator, Summarizer, Code Generator, Creative Writer)
- **Knowledge Sources** — per-user knowledge base, injected into system prompt
- Auto-matching: relevant knowledge injected based on message content

### 👥 Multi-User
- Admin/User separation with SHA-256 password authentication
- Per-user model assignment (admin controls which models each user can access)
- Default model per user
- User isolation — users can only see their own conversations
- **Per-user token tracking** (input/output) with limits
- Token usage dialog with per-model breakdown and recent logs

### 🎨 UI
- Orange/amber primary theme (oklch)
- Dark/Light mode with next-themes
- Mobile responsive with hamburger sidebar
- Geist Mono (UI) + JetBrains Mono (code) fonts
- Model selector sorted A-Z with image support badge
- Tooltips on action buttons

### ⚙️ Admin Panel (`/admin`)
- **Connection** — 9router URL/API key, ImgBB API key
- **Models** — enable/disable models, set display aliases, per-model image support toggle
- **Users** — create/delete users, assign models, set defaults, token limits
- **Agents** — CRUD agents with system prompts
- **Skills** — manage prompt templates
- **Knowledge** — manage knowledge sources
- **Security** — change admin password

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), React 19, TypeScript |
| UI | shadcn/ui (base-ui), Tailwind CSS v4, Lucide icons |
| Database | Supabase (PostgreSQL) |
| Auth | SHA-256 password hashing (Web Crypto API) |
| AI Gateway | 9router (OpenAI-compatible API) |
| Image Upload | ImgBB API |
| Search | DuckDuckGo HTML search |
| Math | KaTeX (remark-math + rehype-katex) |
| Code | highlight.js (rehype-highlight) |

## Quick Start

### Prerequisites
- Node.js 18+ (recommended: 22 via nvm/Herd)
- Supabase account with PostgreSQL
- 9router gateway running
- ImgBB API key (for image uploads)

### 1. Clone & Install
```bash
git clone <repo-url>
cd 9chat
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Setup Database

1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `lib/supabase/schema.sql` and run
3. Run all migrations from `migrations/2026-06-03_all.sql`

### 4. Run Development Server
```bash
npm run dev
```

Open http://localhost:3000

### 5. First Login
- Go to `/admin`
- Default password: `admin`
- Configure 9router URL and API key in Connection tab
- Create users in Users tab

## Project Structure

```
9chat/
├── app/
│   ├── admin/page.tsx                    # Admin panel
│   ├── api/
│   │   ├── chat/route.ts                 # Background generation API
│   │   ├── messages/
│   │   │   ├── stream/route.ts           # SSE endpoint for streaming
│   │   │   └── update/route.ts           # Message update endpoint
│   │   ├── auto-memory/route.ts          # AI memory extraction
│   │   ├── web-search/route.ts           # DuckDuckGo search
│   │   ├── token-usage/route.ts          # Token usage stats
│   │   ├── models/route.ts               # Fetch models from 9router
│   │   └── upload/route.ts               # Image upload to ImgBB
│   ├── globals.css                       # Tailwind + theme variables
│   ├── layout.tsx                        # Root layout with providers
│   └── page.tsx                          # Main page (login or chat)
├── components/
│   ├── chat/
│   │   ├── chat-area.tsx                 # Main chat view + SSE streaming
│   │   ├── chat-input.tsx                # Input with edit mode, image, web search
│   │   ├── chat-message.tsx              # Message bubble + timestamps
│   │   ├── memory-dialog.tsx             # Memory add/edit dialog
│   │   ├── message-branch-selector.tsx   # Edit branch carousel
│   │   ├── model-selector.tsx            # Model picker with image badge
│   │   ├── skill-selector.tsx            # Skill picker
│   │   ├── knowledge-selector.tsx        # Knowledge picker
│   │   ├── token-indicator.tsx           # Header token usage badge
│   │   └── token-usage-dialog.tsx        # Admin token usage dialog
│   ├── providers/
│   │   ├── auth-provider.tsx             # Authentication context
│   │   ├── chat-provider.tsx             # Chat state + CRUD
│   │   ├── settings-provider.tsx         # App settings from Supabase
│   │   └── theme-provider.tsx            # Dark/Light theme
│   ├── sidebar/
│   │   └── conversation-sidebar.tsx      # Main sidebar with pinning
│   └── ui/                               # shadcn/ui components
├── lib/
│   ├── supabase/
│   │   ├── client.ts                     # Supabase client
│   │   ├── server.ts                     # Server-side Supabase client
│   │   └── schema.sql                    # Full database schema
│   ├── types.ts                          # App types
│   └── utils.ts                          # Utility functions
├── migrations/
│   └── 2026-06-03_all.sql                # All migrations (run once)
├── .env.local                            # Environment variables
└── package.json
```

## Database Schema

| Table | Purpose |
|-------|---------|
| `app_settings` | Key-value config store (admin password, 9router, models) |
| `users` | User accounts with roles, model assignments, token tracking |
| `conversations` | Chat sessions with pinned flag |
| `messages` | Chat messages with edit branching and status (generating/done/failed) |
| `user_memory` | Memory system (global + per-room, JSON content) |
| `token_usage_log` | Per-request token usage logs |
| `agents` | AI agent configurations |
| `skills` | Prompt templates |
| `knowledge_sources` | Knowledge base per user |

## Key Features Deep Dive

### Background Generation
- Server creates message with `status=generating` and starts AI generation in background
- Partial content saved to DB every ~500 chars
- Client connects via SSE for real-time content
- If user closes page, generation continues server-side
- On return, client auto-reconnects and resumes from where it left off

### Memory System
- **Auto-memory**: AI extracts facts from conversations (names, preferences, projects)
- **Rule-based fallback**: Regex patterns for common Indonesian/English patterns
- **Upsert logic**: One row per (user, category, conversation), 60% word overlap = update
- **JSON content**: `{text, source, updatedAt}` format
- **AI name memory**: Set custom AI name that persists across model switches

### Token Tracking
- Input/output token estimation per request
- Cumulative per-user tracking
- Admin can set limits and reset usage
- Color-coded indicator in header (green → yellow → red)
- Per-model breakdown in admin dialog

## Migrations

All migrations consolidated in `migrations/2026-06-03_all.sql`:

1. **Token Tracking** — users columns + token_usage_log table + RLS
2. **Pinned Conversations** — pinned boolean on conversations
3. **user_memory conversation_id** — scoping memories to rooms
4. **Message Status** — status column for background generation
5. **Memory JSON Content** — convert plain text to JSON + unique constraint

Run once in Supabase SQL Editor.

## Deployment

### Vercel
1. Push to GitHub
2. Import in Vercel dashboard
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy

### Cloudflare Tunnel (for 9router)
```bash
cloudflared tunnel --url http://localhost:20128
```

## Troubleshooting

### "Failed to fetch models"
- Check 9router URL and API key in Admin → Connection
- Ensure 9router is running and accessible

### Images not loading
- Check if ImgBB API key is configured
- Per-model image support must be enabled in Admin → Models

### Double bubble during streaming
- Ensure `messages` table has `status` column (run migration)
- Check browser console for SSE connection errors

### Web search not returning results
- DuckDuckGo HTML structure may have changed
- Check `/api/web-search` endpoint directly

## License

MIT

## Credits

- Built with [Next.js](https://nextjs.org/), [shadcn/ui](https://ui.shadcn.com/), [Tailwind CSS](https://tailwindcss.com/)
- AI gateway: [9router](https://github.com/yudhaharsanto)
- Icons: [Lucide](https://lucide.dev/)
