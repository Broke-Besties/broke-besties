# 💸 Broke Besties

You know when you agree to split a bill with your friend and then they start saying "I got you next time" and then you never see that money again?

Broke Besties is a mobile app (React Native), and web dashboard (Next.js) with an AI agent that helps you track debts and split bills with your friends.

## Features

- 📸 **Receipt scanning** - Take a pic, AI reads it, debt created
- 🤖 **AI chat** - Just tell it who owes what in plain English
- 👥 **Groups** - For roommates, trips, or that one friend group
- 📱 **Mobile + Web** - Track debts anywhere
- 💰 **Dashboard** - See who owes you (and who you're avoiding)

## Quick Start

```bash
# Install
pnpm install

# Set up environment variables (Supabase + Google API key)
# Copy .env.example to .env in /apps/web and /apps/mobile

# Database
cd apps/web && pnpm prisma db push

# Run web
cd apps/web && pnpm dev

# Run mobile (in another terminal)
cd apps/mobile && pnpm start
```

Scan the QR code with Expo Go and you're good to go.

## Stack

- Next.js + React Native (Expo)
- PostgreSQL (Supabase)
- LangGraph + Google Gemini (AI agent)
- Tailwind CSS

## The Agent

The AI agent can:

- Extract text from receipt photos
- Create debts from natural language ("Sarah owes me $20")
- Answer questions about debts ("What does Mark owe me?")
- Handle multiple people with the same name (because you know 3 Mikes)

No more forms. No more "I don't remember that." Just you, your phone, and the receipts that prove everything.

---

Built by someone tired of being the group ATM 🏧
