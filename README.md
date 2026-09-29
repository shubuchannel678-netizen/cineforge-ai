# CineForge AI — Autonomous, Duration-Aware AI Video Orchestration & Rendering Platform

> **Transform a single idea prompt and target duration (from 30 seconds to 60+ minutes) into a broadcast-ready, fully-rendered MP4 video.**

---

## 🌟 Overview & Mission

Current AI video tools fail because they produce isolated 4-second clips without narrative pacing, audio synchronization, or visual consistency. Creators attempting to create a 35-minute documentary or Minecraft cinematic are forced into an agonizing, fragmented loop of manual prompting across 8 different websites.

**CineForge AI** is a unified, full-stack video-production platform that mathematically decomposes any requested runtime into:
$$\text{Target Duration} \longrightarrow \text{Narrative Acts} \longrightarrow \text{Scenes} \longrightarrow \text{Shots (4–8s each)} \longrightarrow \text{Prompts (with Bible Injections)}$$

### Key Architecture Pillars:
1. **Mathematical Duration-Aware Planner:** Narration word budget calculated strictly at $135\text{--}150\text{ WPM}$ ($2.25\text{--}2.5\text{ words/sec}$) and shots paced at $4.0\text{--}8.0\text{ seconds}$ each.
2. **Character & Style Continuity Bibles:** Persistent database models holding physical traits (hair, wardrobe, build, gear) and visual directives (35mm anamorphic, lighting temperature, negative prompts) injected into every downstream shot.
3. **Hierarchical Job System with Granular Retry:** State-machine job queue (`STORY_ANALYSIS` $\rightarrow$ `SCENE_EXPANSION` $\rightarrow$ `SHOT_IMAGE` $\rightarrow$ `SHOT_VIDEO` $\rightarrow$ `VOICE_TTS` $\rightarrow$ `AUDIO_SFX_MUSIC` $\rightarrow$ `FINAL_RENDER`). **If Shot 18 fails, only Shot 18 is regenerated without restarting the project.**
4. **Official `@google/genai` SDK:** Strictly uses `GoogleGenAI` with `responseMimeType: "application/json"` and `responseSchema` for typed AI orchestration.
5. **Headless FFmpeg Master Renderer:** Assembles video assets, scales resolutions (16:9, 9:16, 1:1), overlays narration, ducks background music by $-14\text{dB}$ during speech, aligns timed subtitles (SRT/VTT), and compiles master H.264/AAC MP4.
6. **Smart Multi-Track Timeline & Studio:** React SPA with interactive zoom (1x–10x), timecode scrubbing, and live playhead synchronization with HTML5 video player.

---

## 🚀 Quickstart Guide

### Prerequisites
- **Node.js**: v20+ LTS (Tested on v24.19.0)
- **Package Manager**: npm

### 1. Install Dependencies
```bash
# In project root
npm run install:all
```

### 2. Configure Environment Variables
Copy template files:
```bash
# Server environment
cp server/.env.example server/.env

# Client environment
cp client/.env.example client/.env
```

Set your Google Gemini API Key in `server/.env`:
```env
GEMINI_API_KEY=AIzaSy...
```
*(Note: If no API key is provided, CineForge automatically operates in deterministic local simulation mode with complete mathematical pacing and full FFmpeg rendering active).*

### 3. Launch CineForge AI (Server + Client)
```bash
# From workspace root, runs both backend and frontend concurrently:
npm run dev
```

- **Frontend Studio UI:** `http://localhost:5173/`
- **Backend API:** `http://localhost:5000/api/v1`
- **System Health:** `http://localhost:5000/health`

### 4. Run End-to-End Validation Suite
```bash
npm run test:e2e --prefix server
```

---

## 📐 Mathematical Duration Partitioning

| Preset | Target Runtime | Script Word Budget | Narrative Structure | Typical Shots |
| :--- | :--- | :--- | :--- | :--- |
| **30s** | 30 seconds | ~70 words | 1 Act, 1–2 Scenes | 5–6 Shots (5.0s avg) |
| **1m** | 60 seconds | ~140 words | 2 Acts, 2–3 Scenes | 10–12 Shots (5.0s avg) |
| **3m** | 180 seconds | ~420 words | 3 Acts, 3–4 Scenes | 28–32 Shots (6.0s avg) |
| **5m** | 300 seconds | ~700 words | 3 Acts, 4–5 Scenes | 45–55 Shots (6.0s avg) |
| **12m** | 720 seconds | ~1,680 words | 4 Acts, 7–8 Scenes | 100–120 Shots (6.5s avg) |
| **35m** | 2,100 seconds | ~4,900 words | 4 Acts, 14–16 Scenes | 280–320 Shots (7.0s avg) |
| **60m** | 3,600 seconds | ~8,400 words | 5 Acts, 20–24 Scenes | 480–550 Shots (7.0s avg) |

---

## 🗄️ Database Schema & RLS Migrations

The production PostgreSQL migration file is located at:
[`supabase/migrations/20250101000000_cineforge_init.sql`](file:///c:/Users/shubh/create%20video/supabase/migrations/20250101000000_cineforge_init.sql)

### 9 Core Tables:
1. `profiles` — User profile metadata linked to Supabase Auth.
2. `projects` — Top-level production manifest (duration, status, progress, aspect ratio).
3. `character_bibles` — Physical traits (hair, wardrobe, build, equipment) and reference imagery.
4. `style_bibles` — Universal camera lenses, lighting setups, color palette, and negative prompts.
5. `scenes` — Narrative acts, scene order, environmental context, and narration script.
6. `shots` — Individual 4–8s visual prompts with camera motion instructions (`DOLLY_FORWARD`, `PAN_LEFT`, `ZOOM_IN`, etc.).
7. `audio_tracks` — Synthesized voiceover, background music, and SFX with ducking flags.
8. `subtitle_tracks` — SRT, VTT, and word-level JSON timed cues.
9. `generation_jobs` — Hierarchical background worker queue with state-machine retry tracking.

---

## 🔌 Backend API Endpoints (`/api/v1`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/projects` | Creates project, calculates duration math, enqueues `STORY_ANALYSIS`. |
| `GET` | `/projects` | Lists user's production projects sorted by date. |
| `GET` | `/projects/:id` | Returns complete project tree (scenes, shots, bibles, audio). |
| `DELETE`| `/projects/:id` | Deletes project and clears asset storage. |
| `POST` | `/projects/:id/plan` | Invokes Gemini to re-plan scene breakdown. |
| `POST` | `/projects/:id/generate` | Kicks off autonomous worker pipeline. |
| `GET` | `/projects/:id/progress`| Returns real-time telemetry, stage completion, and active jobs. |
| `GET` | `/projects/:id/jobs` | Lists all background worker tasks with error logs. |
| `POST` | `/projects/:id/shots/:shotId/retry` | **Granular Shot Retry:** Resets only this shot to PENDING. |
| `PUT` | `/projects/:id/shots/:shotId` | Modifies shot visual prompt or motion instruction before retry. |
| `GET` | `/projects/:id/bibles` | Fetches project character bibles and style bible. |
| `PUT` | `/projects/:id/bibles/character/:charId` | Updates character continuity attributes. |
| `PUT` | `/projects/:id/bibles/style` | Updates global cinematography rules. |
| `POST` | `/projects/:id/render` | Enqueues headless FFmpeg master video assembly. |
| `GET` | `/projects/:id/export` | Returns final MP4 download URL, SRT, and VTT subtitles. |

---

## 🎥 FFmpeg Master Assembly Pipeline

The render engine ([`server/src/services/render/ffmpegPipeline.ts`](file:///c:/Users/shubh/create%20video/server/src/services/render/ffmpegPipeline.ts)):
1. **Aspect Ratio Normalization:** Scales each shot to uniform dimensions (`1920x1080` for 16:9, `720x1280` for 9:16, `1080x1080` for 1:1) at 30fps.
2. **Concat Demuxer:** High-speed stream concatenation across verified shot clips.
3. **Harmonic Audio Ducking:** Mixes voiceover dialogue with background music applying a $-14\text{dB}$ sidechain/amix volume reduction during speech segments.
4. **Timed Subtitles:** Embeds aligned SRT/VTT captions.
5. **Container Assembly:** Encodes final master H.264/AAC MP4 with `+faststart` for streaming preview and instant download.

---

## 💻 Tech Stack Summary

- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, Lucide React, Radix UI Primitives, TanStack Query, Zustand.
- **Backend:** Node.js (v20+ LTS), Express.js, `@google/genai`, `@supabase/supabase-js`, `fluent-ffmpeg`, `zod`, `uuid`.
- **Database:** Supabase PostgreSQL with Row-Level Security (RLS) + Local ACID-compliant repository fallback.
- **Binary Tooling:** Bundled cross-platform FFmpeg / FFprobe binaries for instant out-of-the-box execution.
