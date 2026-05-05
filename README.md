# Stride

Step-tracking mobile app with group challenges and real-time leaderboards. Built with React Native + Expo.

<p align="center">
  <img src="screenshots/home.png" width="200" alt="Home screen" />
  <img src="screenshots/circle.png" width="200" alt="Circle screen" />
  <img src="screenshots/stats.png" width="200" alt="Stats screen" />
</p>

## What it does

- **Background step tracking** via custom native module — runs even when the app is closed
- **Circles** — create or join groups with invite codes, compete with friends
- **Live leaderboards** — see who's leading your circle this week
- **Stats dashboard** — 7/30/90 day history with bar charts and distance trends
- **Weekly winners** — automatic crown assignments and notifications
- **Haptics & polish** — haptic feedback, smooth animations, clean onboarding flow

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | React Native 0.81 + Expo SDK 54 |
| Navigation | Expo Router (file-based) |
| Styling | NativeWind (Tailwind CSS for RN) |
| State | Zustand |
| Backend | Expo API Routes + Neon PostgreSQL |
| ORM | Drizzle ORM |
| Charts | Custom React Native SVG |
| Native Module | Custom `stride-steps` (Kotlin/Java) — background pedometer |

## Getting Started

```bash
# Install
pnpm install

# Start dev server
cd apps/mobile && npx expo start

# Build APK (EAS)
cd apps/mobile && eas build --platform android --profile preview
```

Requirements: Node.js 20+, pnpm, Expo account, EAS CLI (`eas-cli` in devDependencies)

## Architecture

```
apps/mobile/          — React Native app (Expo Router)
  app/
    (tabs)/           — Home, Circle, Stats, Me screens
    (onboarding)/     — Create/join circle, profile setup
    api/              — Backend API routes (Neon PostgreSQL)
  src/
    components/ui/    — ProgressRing, Button, Card, BarChart, Avatar
    lib/              — API client, pedometer, tokens, haptics
    server/db/        — Drizzle schema + queries
    stores/           — Zustand stores (session, onboarding)
  modules/
    stride-steps/     — Custom Expo native module (step sensor)
packages/db/          — Shared DB package
```

## Screenshots

> Add screenshots to `/screenshots/` folder. Use phone screenshots or `npx expo start --web`.

| Screen | File | What to capture |
|--------|------|-----------------|
| Home | `home.png` | Step progress ring + weekly bars + leaderboard |
| Circle | `circle.png` | Group members list with invite code |
| Stats | `stats.png` | 7d/30d bar chart with distance totals |

## License

MIT
