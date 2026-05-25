# 🎵 Applify

A beautiful YouTube Music Player webapp with **iOS 26 Liquid Glass** design. Stream any YouTube audio directly in Safari — no app needed. Built on top of [ytify](https://github.com/n-ce/ytify)’s core engine.

## Features

- **iOS Liquid Glass UI** — frosted glass cards, dynamic blurred backgrounds, spring animations
- **Background playback** — Media Session API + Service Worker keeps audio going when screen is off
- **YouTube search** — powered by ytify’s API worker
- **YouTube URL** — paste any YT link or video ID to play instantly
- **Queue** — full queue management with shuffle & loop
- **Likes** — saved locally
- **PWA** — installs to Home Screen via Safari Share → Add to Home Screen
- **Swipe to dismiss** — swipe down on the player to close

## Deploy to Vercel (5 min)

1. **Push to GitHub:**
   
   ```bash
   git init
   git add .
   git commit -m "Initial Applify"
   gh repo create applify --public --push --source=.
   ```
1. **Deploy on Vercel:**
- Go to [vercel.com](https://vercel.com) → New Project
- Import your GitHub repo
- Framework: **Other** (static site)
- Root directory: `/` (default)
- Hit Deploy ✓
1. **Install as iOS PWA:**
- Open your Vercel URL in **Safari**
- Tap **Share** (box with arrow icon)
- Tap **Add to Home Screen**
- Name it “Applify” → Add

That’s it! Background play works automatically via the Web Audio + MediaSession API.

## How background play works

- Uses the native `<audio>` element with `MediaSession` API
- iOS Safari supports background audio for PWAs installed to Home Screen
- Service Worker keeps the app shell cached for instant loads
- Lock screen controls (play/pause/skip/seek) work via MediaSession

## Audio Sources

Applify uses public Invidious instances to fetch YouTube audio streams:

- `yt.omada.cafe`
- `lekker.gay`
- `iv.melmac.space`
- `invidious.jing.rocks`

If one fails, it automatically falls back to the next. No YouTube API key needed.

## Architecture

```
index.html  — Complete single-file webapp (HTML + CSS + JS)
manifest.json — PWA manifest
sw.js       — Service Worker (caching + background keepalive)
vercel.json — Vercel routing config
```

Built with vanilla JS, zero dependencies, zero build step.
