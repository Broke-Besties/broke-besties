# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Broke Besties - Debt Tracking App

A monorepo containing a Next.js web dashboard and React Native mobile app for tracking debts and splitting bills with friends. Features an AI agent powered by LangGraph and Google Gemini for natural language debt entry and receipt scanning.

## Monorepo Structure

This is a **simple monorepo** without a formal monorepo tool (no Turborepo, Nx, etc.):
- `apps/web/` - Next.js 16 web application (App Router)
- `apps/mobile/` - React Native (Expo) mobile app
- No shared packages directory - apps are fully isolated
- Each app manages its own dependencies with **pnpm**

## Development Commands

### Initial Setup

```bash
# Web app setup (from apps/web)
cd apps/web
pnpm install

# Initialize and start local Supabase
pnpm supabase init
pnpm supabase start

# Copy sample.env to .env and update with Supabase credentials from the output above:
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY
# Also add your GOOGLE_API_KEY and SEED_USER_EMAIL

# Generate Prisma client and seed database
npx prisma generate
npx prisma db seed

# Start dev server (also starts Supabase if not already running)
pnpm dev
```

```bash
# Mobile app setup (from apps/mobile)
cd apps/mobile
pnpm install
pnpm start
# Scan QR code with Expo Go
```

### Common Commands

**Web App:**
- `pnpm dev` - Start Next.js dev server (also runs `npx supabase start`)
- `pnpm build` - Build for production (runs `prisma generate` first)
- `pnpm lint` - Run ESLint
- `npx prisma migrate dev` - Create and apply new migration
- `npx prisma migrate dev --name <migration-name>` - Create named migration
- `npx prisma db seed` - Seed database with sample data
- `npx prisma studio` - Open Prisma Studio GUI
- `pnpm supabase start` - Start local Supabase (Postgres on :54322, API on :54321)
- `pnpm supabase stop` - Stop local Supabase
- `pnpm supabase db reset` - Reset database (re-runs migrations)

**Mobile App:**
- `pnpm start` - Start Expo dev server
- `pnpm android` - Open in Android emulator
- `pnpm ios` - Open in iOS simulator

## Architecture Overview

### Web App (apps/web)

**Stack:** Next.js 16 + React 19 + Tailwind CSS 4 + Prisma + Supabase + LangGraph + Google Gemini

**Key Directories:**
- `src/app/` - Next.js App Router pages and API routes
- `src/app/api/` - RESTful API endpoints (all protected with Supabase Auth)
- `src/agents/` - LangGraph AI agent implementation
- `src/services/` - Business logic layer (debt, group, friend, etc.)
- `src/policies/` - Authorization policies for fine-grained access control
- `src/lib/` - Utilities (Prisma client, Supabase client factories)
- `src/components/` - React components (including shadcn/ui)
- `prisma/` - Database schema, migrations, and seed script

**Architecture Pattern:**
```
UI → API Routes (/api/*) → Service Layer (*.service.ts) → Policy Layer (*.policy.ts) → Prisma ORM → PostgreSQL
```

All API routes follow this pattern:
1. Extract user from Supabase session
2. Parse and validate request body
3. Call service method with user context
4. Service validates authorization via policy classes
5. Service performs database operations
6. Return JSON response

### Mobile App (apps/mobile)

**Stack:** React Native (Expo) + Expo Router + NativeWind + Supabase

**Key Directories:**
- `app/` - Expo Router file-based navigation
- `app/(tabs)/` - Bottom tab navigator (Dashboard, Groups, Profile)
- `components/` - Reusable components
- `lib/api.ts` - Typed API client for backend communication
- `lib/supabase.ts` - Supabase client for auth
- `hooks/` - Custom React hooks (useAuth, etc.)

**API Client:** The `ApiClient` class in `lib/api.ts` provides typed methods for all backend endpoints. Always use this instead of raw fetch calls.

### Database (Prisma + Supabase)

**11 Core Models:**
- `User` - User accounts (auto-created via Supabase Auth trigger)
- `Group` - Friend groups for shared expenses
- `GroupMember` - Many-to-many user-group relationship
- `GroupInvite` - Pending group invitations (status: "pending" | "accepted" | "declined")
- `Debt` - Individual debt records (status: "pending" | "paid" | "cancelled")
- `Receipt` - OCR-scanned receipt data with raw text
- `Tab` - Personal IOUs (non-group debts)
- `DebtTransaction` - Transaction requests (type: "drop" | "modify" | "confirm_paid")
- `RecurringPayment` - Recurring debt entries
- `RecurringPaymentBorrower` - Split percentages for recurring payments
- `Friend` - Friend request system (status: "pending" | "accepted" | "declined")

**Important Schema Details:**
- User IDs are CUIDs matching Supabase Auth UIDs
- Groups use integer auto-increment IDs
- Receipts use CUIDs and have many-to-many relationship with Debts
- All foreign key relationships use `onDelete: Cascade` or `onDelete: SetNull`
- Debts can be group-based (groupId set) or personal tabs (groupId null)

**Connection Strategy:**
- Uses `@prisma/adapter-pg` with node-postgres pool
- Single connection pool shared across requests (prevents connection churn)
- Direct database URL (no connection pooling via Supabase)
- Singleton pattern in `src/lib/prisma.ts` to prevent hot-reload issues

**Migration Workflow:**
1. Edit `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name <description>`
3. Prisma generates SQL migration and applies it
4. Update seed script if needed

### AI Agent (LangGraph + Google Gemini)

**Location:** `src/agents/`

**Design Philosophy:** Minimize LLM calls by pre-loading all context before invoking the model.

**Agent Flow:**
```
User Input → prepareContext → mainLLMNode → Response
```

**prepareContext Node** (`graph.ts`):
- Executes receipt OCR if `imageUrl` provided (calls Gemini for OCR)
- Fetches group members list from database
- Returns: `receiptText`, `groupMembers`

**mainLLMNode** (`MainLLMNode.ts`):
- Builds system message with all pre-loaded context
- Invokes Google Gemini 2.5 Flash (zero temperature)
- Expects structured JSON output:
  ```json
  {
    "debtsReady": true,
    "debts": [
      {
        "borrowerName": "John",
        "borrowerId": "user_abc123",
        "amount": 25.50,
        "description": "Pizza and drinks"
      }
    ]
  }
  ```
- Or conversational response if user is asking a question

**Agent State:**
```typescript
{
  messages: BaseMessage[],
  userId: string,
  groupId: number,
  imageUrl?: string,        // Receipt image URL from Supabase Storage
  receiptIds?: string[],    // IDs to link to created debts
  description?: string,     // Optional debt description
  receiptText?: string,     // Extracted by prepareContext
  groupMembers?: string     // Fetched by prepareContext
}
```

**Tools:**
- `ReceiptTool.ts` - Downloads image from Supabase Storage, extracts text via Gemini OCR
- `UserTool.ts` - Fetches group members with names and IDs
- `DebtTools.ts` - Creates and reads debts (not currently used in graph, but available)

**API Endpoint:** `/api/agent` - Accepts POST with `{ groupId, message, imageUrl?, receiptIds? }`

### Authentication & Authorization

**Auth Flow:**
1. Supabase Auth handles user authentication (email/password)
2. Database trigger automatically creates `User` record when auth user is created
3. Session managed via `@supabase/ssr` cookies (web) or AsyncStorage (mobile)

**Authorization Pattern:**
- Policy classes in `src/policies/` provide centralized authorization logic
- Every service method checks permissions via policy methods:
  - `canView(userId, resourceId)` - Check if user can view resource
  - `canUpdate(userId, resourceId)` - Check if user can update resource
  - `canDelete(userId, resourceId)` - Check if user can delete resource
- Policies check group membership, ownership, or friend status
- Services throw errors with descriptive messages if unauthorized

**Example (DebtPolicy):**
- User can view debt if they are lender, borrower, or member of the debt's group
- User can update debt if they are the lender
- User can delete debt if they are the lender

### Service Layer Pattern

**All business logic lives in service classes** (`src/services/*.service.ts`):
- Input validation
- Authorization checks (using policy classes)
- Database operations via Prisma
- Error handling with meaningful messages

**Example Service Method:**
```typescript
async updateDebt(userId: string, debtId: number, data: UpdateDebtDto) {
  // 1. Validate input
  if (!data.amount || data.amount <= 0) {
    throw new Error("Amount must be positive");
  }

  // 2. Check authorization
  const canUpdate = await debtPolicy.canUpdate(userId, debtId);
  if (!canUpdate) {
    throw new Error("Unauthorized to update this debt");
  }

  // 3. Perform database operation
  return await prisma.debt.update({
    where: { id: debtId },
    data: { amount: data.amount, description: data.description },
  });
}
```

**Always call services from API routes, never directly access Prisma in routes.**

## Environment Variables

**Required for Web App:**
```env
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<from supabase start output>"
SUPABASE_SERVICE_ROLE_KEY="<from supabase start output>"
GOOGLE_API_KEY="<your Gemini API key>"
SEED_USER_EMAIL="<your email for seeding>"
```

Copy `apps/web/sample.env` to `apps/web/.env` and fill in the values.

## Key Features & Workflows

### Receipt Scanning Flow
1. User uploads receipt image (mobile or web)
2. Image stored in Supabase Storage (`receipts` bucket)
3. User sends message to AI agent with `imageUrl`
4. Agent downloads image, runs OCR via Gemini
5. Agent extracts items, amounts, and suggests debt splits
6. Frontend creates debts based on agent output
7. Debts linked to Receipt record via many-to-many relationship

### Debt Transaction Flow
Debts can be modified through transaction requests:
1. Borrower/Lender creates `DebtTransaction` (type: "drop" | "modify" | "confirm_paid")
2. Transaction includes `newAmount`, `newDescription`, or `reason`
3. Other party approves/rejects the transaction
4. If approved, debt is updated or marked as paid
5. Transaction record preserved for audit trail

### Recurring Payments
For subscription-style debts (rent, utilities):
1. Create `RecurringPayment` with lender, total amount, interval
2. Add `RecurringPaymentBorrower` records with split percentages
3. System automatically creates debts on schedule (not yet implemented)
4. Each debt references the recurring payment

### Friend Requests
Similar to social networks:
1. User A sends friend request to User B
2. Request stored with status "pending"
3. User B accepts/declines
4. Friends can create groups and debts together
5. Friends can see each other in user search

## Code Style & Patterns

### Import Patterns
- Use absolute imports from `@/` for web app (`@/lib/prisma`, `@/services/debt.service`)
- Import Prisma client from `@/lib/prisma` (singleton pattern)
- Import Supabase clients from `@/lib/supabase` or `@/lib/supabase-client`

### Error Handling
- Services throw errors with descriptive messages
- API routes catch errors and return appropriate HTTP status codes:
  - 400 for validation errors
  - 401 for authentication errors
  - 403 for authorization errors
  - 404 for not found
  - 500 for server errors
- Mobile app displays user-friendly error messages from API

### Type Safety
- Full TypeScript coverage in both apps
- Prisma generates types from schema (import from `@prisma/client`)
- Use Zod for API request validation
- Mobile API client has typed method signatures

### Component Patterns (Web)
- Use shadcn/ui components from `@/components/ui/`
- Tailwind CSS for styling
- Server components by default, add `"use client"` only when needed
- Colocate page-specific components in `app/` directories

### Component Patterns (Mobile)
- Use NativeWind (Tailwind for React Native)
- Expo Router file-based navigation
- Custom UI components in `components/ui/`
- Use `useAuth` hook for authentication state

## Troubleshooting

### "Cannot find module '@prisma/client'"
Run `npx prisma generate` to generate the Prisma client.

### "Connection refused" database errors
Ensure Supabase is running: `pnpm supabase start` (from `apps/web/`)

### "Invalid credentials" auth errors
Check that `.env` has correct Supabase keys from `pnpm supabase start` output.

### Migrations out of sync
Reset database: `pnpm supabase db reset` (warning: deletes all data)

### Mobile app can't connect to API
- Ensure web dev server is running on `localhost:3000`
- Update `API_URL` in `apps/mobile/lib/api.ts` if using different port
- For physical device testing, use your computer's IP address instead of localhost

## Testing

No test suite currently exists. When adding tests:
- Use Jest for unit tests
- Test service methods with mocked Prisma client
- Test policy methods with mocked database queries
- Use React Testing Library for component tests
- Use Detox or Maestro for E2E mobile tests
