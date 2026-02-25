# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UIGen is an AI-powered React component generator with live preview. Users describe components in natural language, and the AI generates React components in real-time with an interactive preview using a virtual file system.

## Development Commands

### Initial Setup
```bash
npm run setup
```
Installs dependencies, generates Prisma client, and runs database migrations.

### Development
```bash
npm run dev              # Start dev server with Turbopack
npm test                 # Run tests with Vitest
npm run lint             # Run ESLint
npm run db:reset         # Reset database (destructive)
npm run build            # Build for production
```

### Running Tests
```bash
npm test                 # Run all tests in watch mode
npm test -- --run        # Run tests once without watch
npm test -- path/to/test # Run specific test file
```

## Tech Stack

- **Next.js 15** with App Router and React Server Components
- **React 19**
- **TypeScript**
- **Tailwind CSS v4**
- **Prisma** with SQLite (custom output: `src/generated/prisma`)
- **Anthropic Claude AI** (Haiku 4.5) via Vercel AI SDK
- **Vitest** with jsdom for testing
- **Babel Standalone** for browser-side JSX transformation

## Architecture Overview

### Virtual File System

The core feature is a virtual file system that holds generated React components in memory without writing to disk.

**Key Files:**
- `src/lib/file-system.ts` - `VirtualFileSystem` class with file/directory operations
- `src/lib/contexts/file-system-context.tsx` - React context for file system state management

**Important Methods:**
- `createFile(path, content)` - Creates a file with auto-created parent directories
- `updateFile(path, content)` - Updates file content
- `deleteFile(path)` - Deletes file or directory recursively
- `rename(oldPath, newPath)` - Renames/moves files or directories
- `serialize()` / `deserialize()` - Converts file system to/from JSON for persistence

**Path Conventions:**
- All paths start with `/` (e.g., `/App.jsx`, `/components/Button.jsx`)
- Import alias `@/` maps to root directory (e.g., `@/components/Button`)
- Virtual FS operates on root route - no traditional directories like `/usr`

### AI Tools System

The AI manipulates the virtual file system using two tools defined for the Vercel AI SDK:

**Tools:**
1. **`str_replace_editor`** (`src/lib/tools/str-replace.ts`)
   - Commands: `view`, `create`, `str_replace`, `insert`
   - Used by AI to create and modify files

2. **`file_manager`** (`src/lib/tools/file-manager.ts`)
   - Commands: `rename`, `delete`
   - Used by AI to manage file structure

**Tool Integration:**
- Tools are registered in `/api/chat/route.ts`
- Tool calls are processed by `FileSystemContext.handleToolCall()`
- File system state updates trigger UI refresh via `refreshTrigger`

### Chat & AI Generation

**API Route:** `src/app/api/chat/route.ts`
- Uses Vercel AI SDK's `streamText()` for streaming responses
- Reconstructs `VirtualFileSystem` from serialized state on each request
- Saves conversation messages and file system state to database on completion
- Uses prompt caching (Anthropic's `cacheControl: { type: "ephemeral" }`)

**System Prompt:** `src/lib/prompts/generation.tsx`
- Instructs AI to create React components with Tailwind CSS
- Enforces `/App.jsx` as entry point (must export default component)
- Requires `@/` import alias for all local files

**Mock Provider:** `src/lib/provider.ts`
- Falls back to `MockLanguageModel` when `ANTHROPIC_API_KEY` is not set
- Generates static example components (Counter, Form, Card)
- Limited to 4 steps to prevent repetition

### Preview System

**JSX Transformation:** `src/lib/transform/jsx-transformer.ts`
- Transforms JSX/TSX to JavaScript using Babel Standalone in the browser
- Generates ES Module import maps with blob URLs for each file
- Handles `@/` alias resolution and relative imports
- Loads third-party packages from `esm.sh` CDN
- Creates placeholder modules for missing imports
- Collects CSS imports and injects as `<style>` tags
- Displays syntax errors in preview with formatted error messages

**Preview Frame:** `src/components/preview/PreviewFrame.tsx`
- Generates HTML with import maps and renders in iframe
- Loads `/App.jsx` as entry point
- Includes Tailwind CDN and error boundary
- Refreshes when file system changes

### Database Schema

**Models:**
- **User** - Authentication with bcrypt-hashed passwords
- **Project** - Stores project name, messages (JSON), and file system data (JSON)
  - `userId` is optional (supports anonymous users)
  - Messages and data are serialized JSON strings

**Custom Prisma Output:**
- Generated client is in `src/generated/prisma/` (not default `node_modules/.prisma/`)
- Import with: `import { prisma } from '@/lib/prisma'`

### Authentication

**Implementation:** `src/lib/auth.ts`
- JWT-based authentication using `jose` library
- Session stored in HTTP-only cookie named `session`
- No middleware protection on routes - authentication is optional
- Anonymous users can use the app without signing in
- `getSession()` - Server-side session retrieval
- `setSession()` / `clearSession()` - Cookie management

**Anonymous Work Tracking:** `src/lib/anon-work-tracker.ts`
- Tracks anonymous user sessions for potential conversion prompts

### File Structure

```
src/
├── app/
│   ├── [projectId]/page.tsx    # Project-specific page (loads saved projects)
│   ├── page.tsx                # Home page with project list
│   ├── layout.tsx              # Root layout
│   ├── main-content.tsx        # Main app UI (file tree, editor, preview)
│   └── api/chat/route.ts       # Chat API endpoint
├── components/
│   ├── chat/                   # Chat interface components
│   ├── editor/                 # Code editor and file tree
│   ├── preview/                # Preview frame
│   ├── auth/                   # Authentication forms
│   └── ui/                     # shadcn/ui components
├── lib/
│   ├── file-system.ts          # Virtual file system core
│   ├── contexts/               # React contexts
│   ├── tools/                  # AI tools (str_replace, file_manager)
│   ├── transform/              # JSX transformation
│   ├── prompts/                # AI system prompts
│   ├── prisma.ts               # Prisma client singleton
│   ├── auth.ts                 # Authentication utilities
│   └── provider.ts             # LLM provider (real + mock)
├── actions/                    # Server actions for database operations
└── hooks/                      # Custom React hooks
```

## Development Guidelines

### Code Style

- Use comments sparingly. Only comment complex code.

### Adding AI Capabilities

When modifying the AI's behavior:
1. Update system prompt in `src/lib/prompts/generation.tsx`
2. Add or modify tools in `src/lib/tools/`
3. Register tools in `src/app/api/chat/route.ts`
4. Handle tool calls in `FileSystemContext.handleToolCall()`

### Testing

- Tests use Vitest with jsdom environment
- Component tests use `@testing-library/react`
- Test files are colocated in `__tests__/` directories
- Mock React contexts when testing components that use `useFileSystem()` or `useChatContext()`

### Database Changes

1. Modify `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name description` to create migration
3. Run `npx prisma generate` to update client types

### Preview System Constraints

- Entry point must be `/App.jsx` with default export
- All local imports must use `@/` alias
- Third-party packages loaded from esm.sh
- React and react-dom versions are pinned to v19
- CSS files are collected and injected as inline styles
- Syntax errors prevent preview rendering and are displayed in the frame

### Environment Variables

- `ANTHROPIC_API_KEY` - Optional; uses mock provider if not set
- Database URL is hardcoded in `prisma/schema.prisma` as `file:./dev.db`

## Common Tasks

### Adding a New Tool for AI
1. Create tool definition in `src/lib/tools/your-tool.ts` using Zod schema
2. Register in `src/app/api/chat/route.ts` tools object
3. Add handler in `FileSystemContext.handleToolCall()` if it modifies files
4. Update system prompt to describe when to use the tool

### Modifying File System Behavior
- Core logic is in `VirtualFileSystem` class
- Always normalize paths with `normalizePath()`
- Update parent-child relationships when modifying structure
- Trigger UI updates via `FileSystemContext` methods

### Changing AI Model
- Modify `MODEL` constant in `src/lib/provider.ts`
- Consider adjusting `maxTokens` and `maxSteps` in `/api/chat/route.ts`

### Supporting New File Types in Preview
- Update `transformJSX()` to handle the file extension
- Add appropriate Babel plugins/presets
- Update import map generation in `createImportMap()`
