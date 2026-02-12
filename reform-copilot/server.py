"""
ReformDental Copilot - AI Assistant Backend
============================================
FastAPI server that powers the in-app Copilot AI assistant.
It receives questions + app context from the frontend,
calls OpenAI with function definitions, and returns
responses + actionable commands.
"""

import os
import json
from datetime import datetime
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="ReformDental Copilot", version="1.0.0")

# Allow CORS from the dental app (file:// and localhost)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

# ====================================================
# Request/Response Models
# ====================================================

class AppContext(BaseModel):
    """Current state of the dental app sent with each message."""
    currentView: Optional[str] = None
    userRole: Optional[str] = None
    userName: Optional[str] = None
    currentDate: Optional[str] = None
    # Data summaries (the frontend builds these)
    scheduleData: Optional[dict] = None
    staffData: Optional[dict] = None
    equipmentData: Optional[dict] = None
    instrumentsData: Optional[dict] = None
    suppliesData: Optional[dict] = None
    vendorsData: Optional[dict] = None
    tasksData: Optional[dict] = None
    proceduresData: Optional[dict] = None
    clinicsData: Optional[dict] = None
    roomsData: Optional[dict] = None

class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    message: str
    context: Optional[AppContext] = None
    history: Optional[list[ChatMessage]] = []

class ActionCommand(BaseModel):
    """An action for the frontend to execute."""
    type: str  # navigate, highlight, create, assign, alert, etc.
    target: Optional[str] = None
    data: Optional[dict] = None

class ChatResponse(BaseModel):
    reply: str
    actions: Optional[list[ActionCommand]] = []
    suggestions: Optional[list[str]] = []

# ====================================================
# System Prompt - Defines the Copilot's personality & capabilities
# ====================================================

SYSTEM_PROMPT = """You are ReformDental Copilot, an AI assistant embedded in a dental practice management application called ReformDental.

## Your Role
You help dental office staff with scheduling, inventory, tasks, procedures, and general office management. You are knowledgeable, professional, helpful, and concise.

## Current Date/Time
{current_datetime}

## Current User
- Name: {user_name}
- Role: {user_role}
- Current View: {current_view}

## Capabilities
You can answer questions about AND take actions on:
1. **Scheduling** - View today's schedule, who's working, room availability
2. **Staff** - Employee info, roles, who's on duty
3. **Equipment** - Equipment inventory, status, maintenance needs
4. **Instruments** - Instrument inventory and availability
5. **Supplies** - Supply stock levels, reorder needs
6. **Tasks** - Task assignments, status, workload
7. **Procedures** - Dental procedure info, required instruments/supplies
8. **Vendors** - Vendor contact info, orders
9. **Navigation** - Navigate the user to any page/section in the app
10. **Clinics & Rooms** - Office/clinic info, room assignments

## Response Format Rules
- Be concise and direct. No filler text.
- Use bullet points for lists.
- When you have data, give specific numbers and names.
- If data is not available in the context, say so honestly.
- When suggesting an action, include it in the function call.

## App Data Context
The following data is from the live application:

### Schedule Data
{schedule_data}

### Staff Data
{staff_data}

### Equipment Data
{equipment_data}

### Instruments Data
{instruments_data}

### Supplies Data
{supplies_data}

### Vendors Data
{vendors_data}

### Tasks Data  
{tasks_data}

### Procedures Data
{procedures_data}

### Clinics Data
{clinics_data}

### Rooms Data
{rooms_data}
"""

# ====================================================
# Tools / Function Definitions for OpenAI
# ====================================================

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "navigate_to_view",
            "description": "Navigate the user to a specific view/page in the dental app",
            "parameters": {
                "type": "object",
                "properties": {
                    "view": {
                        "type": "string",
                        "enum": ["calendar", "schedule", "duties", "task-hub", "requests",
                                 "projects", "sticky-notes", "equipment", "instruments",
                                 "supplies", "vendors", "procedures"],
                        "description": "The view to navigate to"
                    }
                },
                "required": ["view"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "open_settings_panel",
            "description": "Open a settings/management panel in the app",
            "parameters": {
                "type": "object",
                "properties": {
                    "panel": {
                        "type": "string",
                        "enum": ["manage-users", "manage-roles", "manage-clinics",
                                 "manage-rooms", "manage-schedule", "manage-tasks",
                                 "manage-duties", "manage-permissions", "master-settings"],
                        "description": "The settings panel to open"
                    }
                },
                "required": ["panel"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_task",
            "description": "Create a new task and optionally assign it to an employee",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Task title"},
                    "description": {"type": "string", "description": "Task description"},
                    "assignee": {"type": "string", "description": "Employee username to assign to"},
                    "priority": {"type": "string", "enum": ["low", "medium", "high", "urgent"]},
                    "dueDate": {"type": "string", "description": "Due date in YYYY-MM-DD format"}
                },
                "required": ["title"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "highlight_item",
            "description": "Highlight or focus attention on a specific item in the current view",
            "parameters": {
                "type": "object",
                "properties": {
                    "itemType": {
                        "type": "string",
                        "enum": ["equipment", "instrument", "supply", "vendor", "task", "user"],
                        "description": "The type of item to highlight"
                    },
                    "itemName": {"type": "string", "description": "Name/identifier of the item"}
                },
                "required": ["itemType", "itemName"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "show_alert",
            "description": "Show a notification/alert to the user in the app",
            "parameters": {
                "type": "object",
                "properties": {
                    "message": {"type": "string", "description": "Alert message to display"},
                    "type": {"type": "string", "enum": ["info", "success", "warning", "error"]}
                },
                "required": ["message", "type"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "generate_report",
            "description": "Generate a summary report for the user",
            "parameters": {
                "type": "object",
                "properties": {
                    "reportType": {
                        "type": "string",
                        "enum": ["daily_schedule", "inventory_summary", "task_summary",
                                 "staff_overview", "low_stock_alert"],
                        "description": "Type of report to generate"
                    }
                },
                "required": ["reportType"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_sticky_note",
            "description": "Create a new sticky note on the sticky notes board",
            "parameters": {
                "type": "object",
                "properties": {
                    "text": {"type": "string", "description": "The text content of the sticky note"},
                    "color": {
                        "type": "string",
                        "enum": ["yellow", "pink", "blue", "green", "purple", "orange"],
                        "description": "Color of the sticky note"
                    }
                },
                "required": ["text"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "open_chat",
            "description": "Open the Team Chat modal, optionally starting a direct message conversation with a specific user",
            "parameters": {
                "type": "object",
                "properties": {
                    "username": {"type": "string", "description": "The username of the person to chat with. If omitted, just opens the chat modal."},
                    "message": {"type": "string", "description": "Optional message to pre-fill in the chat input"}
                },
                "required": []
            }
        }
    }
]

# ====================================================
# Helper: Build system prompt with app context
# ====================================================

def build_system_prompt(context: Optional[AppContext]) -> str:
    """Inject app data into the system prompt."""
    ctx = context or AppContext()

    def fmt(data) -> str:
        if data is None:
            return "No data available"
        if isinstance(data, dict) and not data:
            return "No data available"
        return json.dumps(data, indent=2, default=str)[:3000]  # Truncate to save tokens

    return SYSTEM_PROMPT.format(
        current_datetime=ctx.currentDate or datetime.now().strftime("%Y-%m-%d %H:%M"),
        user_name=ctx.userName or "Unknown",
        user_role=ctx.userRole or "Unknown",
        current_view=ctx.currentView or "Unknown",
        schedule_data=fmt(ctx.scheduleData),
        staff_data=fmt(ctx.staffData),
        equipment_data=fmt(ctx.equipmentData),
        instruments_data=fmt(ctx.instrumentsData),
        supplies_data=fmt(ctx.suppliesData),
        vendors_data=fmt(ctx.vendorsData),
        tasks_data=fmt(ctx.tasksData),
        procedures_data=fmt(ctx.proceduresData),
        clinics_data=fmt(ctx.clinicsData),
        rooms_data=fmt(ctx.roomsData),
    )

# ====================================================
# Main Chat Endpoint
# ====================================================

@app.post("/api/ai/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Process a user message and return AI response + actions."""
    if not os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY") == "sk-your-key-here":
        raise HTTPException(status_code=500, detail="OpenAI API key not configured. Set OPENAI_API_KEY in .env")

    # Build messages array
    messages = [{"role": "system", "content": build_system_prompt(request.context)}]

    # Add conversation history (last 10 messages to stay within token limits)
    if request.history:
        for msg in request.history[-10:]:
            messages.append({"role": msg.role, "content": msg.content})

    # Add current user message
    messages.append({"role": "user", "content": request.message})

    try:
        # Call OpenAI with function calling
        response = client.chat.completions.create(
            model=MODEL,
            messages=messages,
            tools=TOOLS,
            tool_choice="auto",
            temperature=0.3,
            max_tokens=1000,
        )

        choice = response.choices[0]
        actions = []
        suggestions = []

        # Process tool calls (actions the AI wants to execute)
        if choice.message.tool_calls:
            for tool_call in choice.message.tool_calls:
                fn = tool_call.function
                args = json.loads(fn.arguments)
                actions.append(ActionCommand(
                    type=fn.name,
                    data=args
                ))

        # Get the text reply
        reply = choice.message.content or ""

        # If the AI only returned tool calls with no text, generate a follow-up
        if not reply and actions:
            reply = "Done! I've executed that action for you."

        # Generate contextual follow-up suggestions
        suggestions = generate_suggestions(request.message, request.context)

        return ChatResponse(
            reply=reply,
            actions=actions,
            suggestions=suggestions
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI processing error: {str(e)}")


def generate_suggestions(last_message: str, context: Optional[AppContext]) -> list[str]:
    """Generate follow-up suggestion chips based on the conversation."""
    view = context.currentView if context else None

    base_suggestions = {
        "calendar": [
            "Who's working today?",
            "Any scheduling conflicts?",
            "Show me tomorrow's appointments"
        ],
        "equipment": [
            "Any equipment needing maintenance?",
            "Show equipment by status",
            "What's the most used equipment?"
        ],
        "supplies": [
            "What supplies are running low?",
            "Show me reorder list",
            "Total inventory value?"
        ],
        "task-hub": [
            "Any overdue tasks?",
            "Who has the most tasks?",
            "Show unassigned tasks"
        ],
        "instruments": [
            "Any instruments needing sterilization?",
            "Show instrument count by type",
            "What instruments need replacement?"
        ],
    }

    return base_suggestions.get(view, [
        "How many employees are working today?",
        "What supplies are running low?",
        "Show me today's schedule"
    ])


# ====================================================
# Health Check
# ====================================================

@app.get("/api/ai/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "ReformDental Copilot",
        "model": MODEL,
        "api_key_configured": bool(os.getenv("OPENAI_API_KEY") and os.getenv("OPENAI_API_KEY") != "sk-your-key-here")
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8100))
    uvicorn.run(app, host="0.0.0.0", port=port)
