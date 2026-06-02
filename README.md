# 9Chat — AI Chat Assistant

Personal AI chat assistant powered by [9router](https://github.com/nicknameisavailable/9router) gateway. Built with Next.js 15, React 19, shadcn/ui (base-ui), and Tailwind CSS v4.

## Features

### 💬 Chat
- Multi-conversation with streaming responses
- Edit message with branch carousel (ChatGPT-style editing in bottom input)
- Image upload via ImgBB (clipboard paste, drag & drop, file picker)
- Conversation auto-rename from first message
- Per-conversation model memory (remembers last used model)
- Regenerate and retry responses

### 🤖 AI Agents
- Custom system prompts, model, and temperature per agent
- Admin-created (public) and user-created (private) agents
- Agent selection from sidebar

### 🧠 Memory System
- **Global memory** — applies to all conversations (preferences, personal info)
- **Room memory** — scoped to specific conversation (project context)
- Memory dialog for adding/editing memories
- Auto-injected into system prompt for personalized responses

### 📚 Skills & Knowledge
- **Skills** — predefined prompt templates (Code Review, Translator, Summarizer, Code Generator, Creative Writer)
- **Knowledge Sources** — per-user knowledge base, injected into system prompt
- Auto-matching: relevant knowledge injected based on message content

### 👥 Multi-User
- Admin/User separation with SHA-256 password authentication
- Per-user model assignment (admin controls which models each user can access)
- Default model per user
- User isolation — users can only see their own conversations

### 🎨 UI
- Warm stone + indigo accent palette (oklch)
- Linear/Raycast-inspired professional design
- Dark/Light mode with next-themes
- Mobile responsive with hamburger sidebar
- Inter + JetBrains Mono fonts

### ⚙️ Admin Panel (`/admin`)
- **Connection** — 9router URL/API key, ImgBB API key
- **Models** — enable/disable models, set display aliases
- **Users** — create/delete users, assign models, set defaults
- **Agents** — CRUD agents with system prompts
- **Skills** — manage prompt templates
- **Knowledge** — manage knowledge sources
- **Security** — change admin password

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), React 19, TypeScript |
| UI | shadcn/ui (base-ui), Tailwind CSS v4, Lucide icons |
| Database | Supabase (PostgreSQL) or standalone PostgreSQL |
| Auth | SHA-256 password hashing (Web Crypto API) |
| AI Gateway | 9router (OpenAI-compatible API) |
| Image Upload | ImgBB API |
| Deployment | Vercel (frontend) + Cloudflare Tunnel (9router) |

## Database Support

9Chat supports two database modes:

### Mode 1: Supabase (Recommended for quick start)
- Managed PostgreSQL with real-time subscriptions
- Row Level Security (RLS) policies
- Auto-generated REST API
- Free tier: 500MB storage, 50K monthly active users

### Mode 2: Standalone PostgreSQL
- Self-hosted PostgreSQL 14+
- Full control over data
- No vendor lock-in
- Works with any PostgreSQL hosting (Railway, Neon, Supabase hosted, self-hosted)

Switch between modes in `.env.local`:
```env
# Mode 1: Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...

# Mode 2: Standalone PostgreSQL
DATABASE_URL=postgresql://user:password@host:5432/9chat
```

## Quick Start

### Prerequisites
- Node.js 18+ (recommended: 22 via nvm/Herd)
- Supabase account OR PostgreSQL 14+ instance
- 9router gateway running
- ImgBB API key (for image uploads)

### 1. Clone & Install
```bash
git clone <repo-url>
cd ai-chat-assistant
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
# Database — choose ONE:

# Option A: Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Option B: PostgreSQL
DATABASE_URL=postgresql://user:password@localhost:5432/9chat
```

### 3. Setup Database

**For Supabase:**
1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `lib/supabase/schema.sql`
3. Run the SQL

**For PostgreSQL:**
```bash
# Create database
createdb 9chat

# Run schema
psql -d 9chat -f lib/supabase/schema.sql
```

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
ai-chat-assistant/
├── app/
│   ├── admin/page.tsx          # Admin panel (7 tabs)
│   ├── api/
│   │   ├── chat/route.ts       # Streaming chat API
│   │   ├── models/route.ts     # Fetch models from 9router
│   │   └── upload/route.ts     # Image upload to ImgBB
│   ├── globals.css             # Tailwind + theme variables
│   ├── layout.tsx              # Root layout with providers
│   └── page.tsx                # Main page (login or chat)
├── components/
│   ├── chat/
│   │   ├── chat-area.tsx       # Main chat view (messages + input)
│   │   ├── chat-input.tsx      # Input with edit mode, image upload
│   │   ├── chat-message.tsx    # Message bubble rendering
│   │   ├── memory-dialog.tsx   # Memory add/edit dialog
│   │   ├── message-branch-selector.tsx  # Edit branch carousel
│   │   ├── model-selector.tsx  # Model picker popover
│   │   ├── skill-selector.tsx  # Skill picker
│   │   └── knowledge-selector.tsx  # Knowledge picker
│   ├── providers/
│   │   ├── auth-provider.tsx   # Authentication context
│   │   ├── chat-provider.tsx   # Chat state + CRUD (Supabase)
│   │   ├── settings-provider.tsx # App settings from Supabase
│   │   └── theme-provider.tsx  # Dark/Light theme
│   ├── settings/
│   │   └── settings-dialog.tsx # 9router config dialog
│   ├── sidebar/
│   │   ├── conversation-sidebar.tsx  # Main sidebar
│   │   └── project-list.tsx   # Folder/project list
│   └── ui/                    # shadcn/ui components (20+)
├── lib/
│   ├── supabase/
│   │   ├── client.ts           # Supabase client (env vars)
│   │   ├── server.ts           # Server-side Supabase client
│   │   ├── schema.sql          # Full database schema
│   │   ├── migration-*.sql     # Migration scripts
│   │   └── types.ts            # Database types
│   ├── types.ts                # App types
│   └── utils.ts                # Utility functions
├── .env.local                  # Environment variables
└── package.json
```

## Key Configuration

### 9router Gateway
The AI backend. Configure in Admin → Connection:
- **URL**: `http://your-server:port`
- **API Key**: Your 9router API key

### Model Management
- Fetch models from 9router in Admin → Connection → Test
- Enable/disable specific models in Admin → Models
- Set display aliases (e.g., `gpt-4o` → "GPT-4o")
- Assign allowed models per user

### Image Upload (ImgBB)
1. Get API key from https://api.imgbb.com/
2. Enter in Admin → Connection → ImgBB API Key
3. Images are uploaded to ImgBB with `i.ibb.co.com` URL (bypasses Indonesian DNS block)

## Database Schema

| Table | Purpose |
|-------|---------|
| `app_settings` | Key-value config store (admin password, 9router, models) |
| `users` | User accounts with roles and model assignments |
| `projects` | Chat folders/projects |
| `agents` | AI agent configurations |
| `conversations` | Chat sessions |
| `messages` | Chat messages with edit branching |
| `skills` | Prompt templates |
| `knowledge_sources` | Knowledge base per user |
| `user_memory` | Cross-conversation memory (global + per-room) |
| `agent_skills` | Junction: agent ↔ skill |
| `agent_knowledge` | Junction: agent ↔ knowledge |
| `uploaded_images` | Image upload records |

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
Use the tunnel URL in 9Chat admin settings.

## Migration Guide

### From Supabase to PostgreSQL
1. Export data from Supabase (Dashboard → Database → Backups)
2. Import to your PostgreSQL instance
3. Change `.env.local`:
   ```env
   # Remove these:
   # NEXT_PUBLIC_SUPABASE_URL=...
   # NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   
   # Add this:
   DATABASE_URL=postgresql://user:password@host:5432/9chat
   ```
4. Restart the app

### Schema Updates
When pulling new versions:
1. Check `lib/supabase/migration-*.sql` for new migrations
2. Run applicable migrations in your database
3. For fresh installs, use `lib/supabase/schema.sql`

## Troubleshooting

### "Failed to fetch models"
- Check 9router URL and API key in Admin → Connection
- Ensure 9router is running and accessible

### Images not loading
- Check if ImgBB API key is configured
- Indonesian users: images use `i.ibb.co.com` to bypass DNS block

### Build errors
```bash
rm -rf .next
npm run build
```

### Database connection issues
- Supabase: Check URL and anon key in `.env.local`
- PostgreSQL: Check `DATABASE_URL` format and network access

## License

MIT

## Credits

- Built with [Next.js](https://nextjs.org/), [shadcn/ui](https://ui.shadcn.com/), [Tailwind CSS](https://tailwindcss.com/)
- AI gateway: [9router](https://github.com/nicknameisavailable/9router)
- Icons: [Lucide](https://lucide.dev/)
