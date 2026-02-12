# ReformDental Copilot - AI Assistant

An AI-powered assistant embedded in the ReformDental management app. Users can ask natural language questions about their dental practice — schedules, inventory, staff, tasks — and the Copilot responds with answers and can take actions in the app.

## Architecture

```
Frontend (HTML/JS)                    Backend (Python/FastAPI)
┌───────────────────┐                ┌──────────────────────┐
│ Copilot UI Panel  │   HTTP POST    │ FastAPI Server       │
│ Context Engine    │ ──────────────→│ /api/ai/chat         │
│ Action Executor   │                │                      │
│                   │ ←──────────────│ OpenAI Function Call  │
│ Execute actions   │   JSON response│ Response + Actions   │
└───────────────────┘                └──────────────────────┘
```

**Context Engine** (client-side JS) collects live data from the app:
- Current user, role, active view
- Schedule/calendar events
- Equipment, instruments, supplies inventory
- Staff/employee info
- Tasks, vendors, procedures, clinics, rooms

**Backend** builds a rich system prompt with this context and sends it to OpenAI with function-calling tools so the AI can also trigger actions (navigate, create tasks, show alerts, etc.).

## Setup

### 1. Install Python Dependencies

```bash
cd reform-copilot
pip install -r requirements.txt
```

### 2. Configure API Key

```bash
# Copy the example env file
copy .env.example .env

# Edit .env and add your OpenAI API key
# Get one at: https://platform.openai.com/api-keys
```

Your `.env` file should look like:
```
OPENAI_API_KEY=sk-proj-your-actual-key-here
OPENAI_MODEL=gpt-4o-mini
```

**Model options:**
| Model | Speed | Cost | Quality |
|-------|-------|------|---------|
| `gpt-4o-mini` | Fast | ~$0.15/1M tokens | Good for most queries |
| `gpt-4o` | Medium | ~$2.50/1M tokens | Best quality |
| `gpt-3.5-turbo` | Fastest | ~$0.50/1M tokens | Basic |

### 3. Start the Copilot Server

```bash
cd reform-copilot
python server.py
```

The server runs at `http://localhost:8100`. You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8100
```

### 4. Open the Dental App

Open the HTML file in your browser. You'll see a **purple sparkle button** (✨) above the blue chat button. Click it or press **Ctrl+Shift+K** to open the Copilot panel.

## Usage

### Ask Questions
- "How many employees are working today?"
- "What supplies are running low?"
- "Show me today's schedule"
- "What instruments do we have?"
- "Who's assigned to sterilization tasks?"
- "Any equipment needing maintenance?"
- "What dental procedures do we have in the database?"

### Command Actions
- "Navigate to the equipment page"
- "Open the manage users settings"
- "Create a task for sterilization"
- "Show me the supplies inventory"

### Keyboard Shortcut
**Ctrl+Shift+K** — Toggle the Copilot panel

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ai/chat` | POST | Send a message and get AI response |
| `/api/ai/health` | GET | Check server status |

### POST /api/ai/chat

**Request:**
```json
{
    "message": "How many employees are working today?",
    "context": {
        "currentView": "calendar",
        "userName": "admin",
        "userRole": "admin",
        "staffData": { ... },
        "scheduleData": { ... }
    },
    "history": []
}
```

**Response:**
```json
{
    "reply": "You have 5 employees scheduled today:\n- Dr. Smith (8am-5pm)\n- Sarah (9am-6pm)\n...",
    "actions": [],
    "suggestions": [
        "Show me tomorrow's schedule",
        "Any scheduling conflicts?",
        "Who has the day off?"
    ]
}
```

## Files

```
reform-copilot/
├── server.py           # FastAPI backend server
├── requirements.txt    # Python dependencies
├── .env.example        # API key template
├── .env                # Your actual API key (create this)
└── README.md           # This file
```

The frontend code (UI, Context Engine, Action Executor) is embedded in the main HTML file.

## Extending

### Add New Data Sources
Edit the `ContextEngine` object in the HTML file to pull from additional localStorage keys.

### Add New Actions
1. Add a tool definition in `server.py` → `TOOLS` array
2. Add a handler in the HTML file → `ActionExecutor.execute()` handlers

### Change the AI Model
Edit `.env` → `OPENAI_MODEL`. You can also switch to Anthropic by modifying `server.py` to use the Anthropic SDK.
