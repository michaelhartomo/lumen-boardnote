# Lumen Notes — Event Demo Edition (Muse AI Spatial Workspace)

**Lumen Notes (Event Demo Edition)** is a streamlined, single-user infinite spatial canvas and visual workspace powered by **Meta Muse AI** (`muse-wonder-1.0`, `muse-image-1.0`, `muse-voice-transcribe-1.0`) with **Google Gemini 3.8 Flash** fallback and **Google Text-to-Speech**.

All files needed to run the standalone demo application (including the Express + Vite Node server, PostgreSQL auto-migration schema, and React spatial board application) are self-contained inside this `/event` folder.

---

## ✨ Muse AI Model Suite & Voice Pipeline

This demo prioritizes **Meta Muse AI (`muse-wonder-1.0`)** across all board and card actions, with automatic fallback to the latest **Google Gemini (`gemini-3.8-flash`)**:

| Model ID | Role & Capability |
| :--- | :--- |
| **`muse-wonder-1.0`** | **Multimodal Reasoning, Creative Synthesis, Audio Understanding & Coding** — Board spatial Q&A, smart layout organization, checklist subtask breakdown, code snippet generation/refactoring, creative notes/poems/jokes, and structured image prompt improvement. |
| **`muse-voice-transcribe-1.0`** | **Speech to Text** — High-accuracy timestamped audio transcription and 16-language translation for Sound Recorder cards (with Gemini `gemini-3.5-transcribe` / `gemini-3.8-flash` fallback). |
| **`muse-image-1.0`** | **Image Generation & Editing** — Creates new images and performs reference-guided image improvements directly inside Image Carousel cards. |
| **Google Text-to-Speech** | **Sticky Note Create Voice** — Since Muse AI does not include a TTS model, Sticky Note voice synthesis uses **Google Text-to-Speech** (`Kore`, `Aoede`, `Leda`, `Callirrhoe`, `Autonoe`, `Despina`, `Erinome`, `Laomedeia`, `Achernar`, `Sulafat`, `Puck`, `Charon`, `Fenrir`, `Orus`, `Zephyr`, `Iapetus`, `Enceladus`, `Alnilam`, `Algieba`, `Achird`, `Schedar`, `Gacrux`, `Pulcherrima`, `Vindemiatrix`, `en-US-Neural2-F`, `en-US-Neural2-D`) to generate 24 kHz studio WAV audio with optional translation. |

---

## 🧩 Included Card Types (7 Focused Cards)

The Event Demo Edition provides **7 core spatial card types**:

1. **Section Header** (`heading`) — Large typographic banners to organize spatial zones on the canvas.
2. **Sticky Note** (`note`) — Rich-text notes with AI summarization, expansion, rewrite, task extraction, and **Google Text-to-Speech (Create Voice)** with an inline 24 kHz WAV player.
3. **Checklist / Task** (`tasklist`) — Interactive task lists with progress tracking and AI subtask generation.
4. **Image Carousel** (`image`) — Multi-image slider card with **Create Image (`muse-image-1.0`)**, **Use Current Image as Reference** (improves the active image while preserving composition), and **Auto-Improve Prompt with `muse-wonder-1.0`**.
5. **Code Snippet** (`code`) — Syntax-highlighted code editor with AI code generation, refactoring, bug fixing, and inline explanation powered by `muse-wonder-1.0`.
6. **Sound Recorder** (`sound_recorder`) — Live microphone voice recorder & audio uploader with waveform visualization and **`muse-voice-transcribe-1.0`** Speech-to-Text transcription & multi-language translation.
7. **Clock Card** (`clock`) — Live analog/digital world timezone clock widget.

---

## 🎯 Demo Customizations & Streamlined UI

Compared to the full enterprise edition, this Event Demo is tailored for immediate hands-on kiosk or booth sessions:

- **Board List**:
  - Removed AI Model Selector (locked to **Muse AI** by default).
  - Removed Board Templates gallery for instant board creation.
- **Board Left Panel (Dock)**:
  - Only displays the 7 demo cards + Layer Manager toggle + Board Settings toggle.
  - Layer Panel is closed by default when opening a board.
  - Removed Freehand Drawing Mode and Activity Logs button.
- **Board Top Menu (Header)**:
  - Removed User Profile / Account switcher, Template button, Activity button, and Share button (all demo boards default to **Public**).
- **Board Properties Panel**:
  - Removed Board Sharing settings (public by default), AI Model Selector, Clear All Drawing Strokes, and Card Style switcher (permanently set to **Full Style**).
- **Single-User Focus**:
  - Removed multi-user presence/activity telemetry, time-range & Google Calendar integration, seamless card mode, and card password encryption.

---

## 🛠️ Prerequisites

- **Node.js** `>= 20.x`
- **Yarn** `>= 1.22.x`
- **PostgreSQL** `>= 14.x`
- **ffmpeg** *(optional, recommended for 24 kHz studio WAV audio transcoding)*

---

## 🚀 Setup & Installation

### 1. Navigate to the `event` folder & install dependencies with Yarn

```bash
cd event
yarn install
```

### 2. Configure Environment Variables (`.env`)

Copy `.env.example` to `.env` and fill in your database connection string and API keys:

```bash
cp .env.example .env
```

Edit `.env`:

```env
PORT=3000
NODE_ENV=development

# PostgreSQL connection string
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/lumen_event_demo

# Meta Muse AI API Key & Models
MUSE_API_KEY=your_meta_muse_api_key_here
MUSE_API_BASE_URL=https://api.meta.ai/v1
MUSE_MODEL=muse-wonder-1.0
MUSE_IMAGE_MODEL=muse-image-1.0
MUSE_VOICE_TRANSCRIBE_MODEL=muse-voice-transcribe-1.0

# Google Text-to-Speech & Gemini API Key
GEMINI_API_KEY=your_gemini_api_key_here
GOOGLE_TTS_VOICE=Kore
```

### 3. Setup the PostgreSQL Database

Create the PostgreSQL database specified in your `DATABASE_URL`:

```bash
# Using psql CLI:
psql -U postgres -c "CREATE DATABASE lumen_event_demo;"
```

> **Automatic Schema Initialization & Data Guard**: You do **not** need to run manual SQL migration scripts. When `server.ts` starts, it automatically creates and migrates all required tables (`lm_board`, `lm_board_card`, `lm_board_activity`, `lm_card_comment`, `lm_file_storage`, `lm_ai_usage`, `lm_bandwidth_usage`, `lm_user_setting`) with `uuid`, `vendor_code`, `master_code`, `project_code`, and `time_create`/`time_modify`/`time_access` columns. All REST API endpoints, WebSocket channels, and MCP server tools enforce strict access control: **public boards** (`is_public: true`) are accessible to everyone according to their `public_role` (`viewer`, `commenter`, or `editor`), while **private boards** (`is_public: false`) are strictly accessible only to the board owner (`user_account`).

### 4. Start the Application

#### Development Mode (Express + Vite Middleware on Port 3000)

```bash
yarn dev
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser.

#### Production Build & Start

```bash
yarn build
yarn start
```

---

## 📖 How to Use the Demo App

### 1. Creating & Opening a Board
- From the **Workspace Boards** home screen, click **+ New Board** in the top-right corner, enter a title, and click **Create Board**.
- Click any board card to open the infinite spatial canvas.

### 2. Adding the 7 Cards to the Canvas
- Use the **Left Dock** to add cards with a single click or drag-and-drop onto the canvas:
  - **Section Header**, **Sticky Note**, **Checklist / Task**, **Image Carousel**, **Code Snippet**, **Sound Recorder**, and **Clock Card**.
- Drag cards to arrange them spatially, resize them from any corner/edge handle, or connect two cards using their side anchor ports.

### 3. Using Muse AI on Cards
Select any card on the canvas to open the **Card Properties Panel** on the right (or use the inline toolbar on the card):
- **Sticky Note → Google Voice (Text-to-Speech)**:
  - Click **Google Voice** in the note toolbar (or **Text to Voice (Google TTS)** in the right panel).
  - Select a **Google TTS Voice** (`Kore`, `Aoede`, `Leda`, `Puck`, `Charon`, `Fenrir`, `Orus`, `Zephyr`, etc.) and target **Language** (`Auto-Detect` or any of 16 languages to translate & speak).
  - Click **Confirm & Create Voice** to synthesize a 24 kHz WAV player directly inside the note card.
- **Image Carousel → Create & Improve Image (`muse-image-1.0` + `muse-wonder-1.0`)**:
  - Open the card's **AI Actions** tab in the right panel and click **Create Image**.
  - Check **"Auto-improve prompt with Muse Wonder"** to automatically enrich your prompt with lighting, composition, and humane artistic detail before image generation.
  - Check **"Use current image as reference"** to evolve and improve the currently displayed image while preserving its core subject and layout.
- **Sound Recorder → Transcribe & Translate (`muse-voice-transcribe-1.0`)**:
  - Record voice audio directly from your microphone or upload an audio file.
  - Click **Transcribe Audio** to generate a timestamped transcript using `muse-voice-transcribe-1.0`, or select a target language to translate the transcript.
- **Code Snippet → Generate & Refactor (`muse-wonder-1.0`)**:
  - Use **Generate Code**, **Refactor / Optimize**, **Fix Bugs**, or **Explain Code** in the AI Actions tab.

### 4. Using the Muse AI Board Assistant
- Click the **AI Assistant** button in the top-right header to open the board-wide **Muse AI Drawer**.
- Ask questions about your board, brainstorm new card clusters, or ask `muse-wonder-1.0` to organize and summarize your workspace.
