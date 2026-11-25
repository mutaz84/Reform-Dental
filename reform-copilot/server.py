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
import re
from datetime import datetime
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="ReformDental Copilot", version="2026-11-24.1")

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
    """Current state of the dental app sent with each message.

    Sections are free-form dicts built by the app (ContextEngine.buildFullContext).
    Unknown sections are kept too (extra="allow"), so a new section in the app
    reaches the AI without a server change.
    """
    model_config = ConfigDict(extra="allow")

    currentView: Optional[str] = None
    userRole: Optional[str] = None
    userName: Optional[str] = None
    currentDate: Optional[str] = None
    localDateTime: Optional[str] = None
    todayIso: Optional[str] = None
    timeZone: Optional[str] = None

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

SYSTEM_PROMPT = """You are DentaBrain, the AI assistant built into ReformDental, a dental practice management app.

## Today
{current_datetime} (time zone: {time_zone}). Today's date is {today}.

## Current user
- Name: {user_name}
- Role: {user_role}
- Page they are on: {current_view}

## How to answer
- Answer from the practice data below. It is live data from the app, sent with this question.
- Be specific: give numbers, names, dates and statuses. Be concise; use short bullet lists for lists.
- "How many" questions: use the precomputed counts in each section's "summary" first. If you count rows yourself, count carefully and only rows that match.
- Lists are tables: "columns" names the fields and each entry in "rows" is one item in that column order. "total" is how many items exist; if "truncated" is true, only "shown" items are listed, so say the list is partial.
- If something is not in the data, say exactly what is missing and which page in the app shows it. Never invent names, numbers or dates.
- Every page has its own category list (Services, Vendors, Equipment, Supplies, Instruments...). When you mention a category, name the item and the page it comes from, e.g. "Comcast Business Internet is in Internet & Network on the Services page". If the same company appears on two pages, say both.
- Questions such as "who are our cleaning services", "who provides our internet" or "who do we use for X" can mean the Services page (contracts the practice pays for, in servicesData) or the Vendors page (companies, in vendorsData, where "type" is the category). Answer from both, under the headings "On the Services page" and "On the Vendors page", and point out any company that appears on only one page or under a different category on each.
- Check categoriesData before quoting a category. If the item is listed there under itemsWithCategoryNotInList, say plainly that it is saved with a category that is not in that page's category list (likely an old or imported value), show the page's list, and suggest editing the item to pick one. You may point out the closest match, but say it is a suggestion.
- If the user says your answer is wrong, check the data again before replying. If the data supports what you said, keep your answer and explain exactly where it comes from (item, page and field) and what might explain the difference. Only change your answer when the data shows you were wrong. Never swap in a guess just to agree.
- Dates are YYYY-MM-DD. "Overdue" means a due date before today that isn't completed.
- When the user wants to go to a page or do something, use the matching tool.

## What the data means
- equipmentData: every piece of equipment. group "Dental" = Dental Equipment page, "Office" = Office Equipment page.
- serviceTicketsData: service tickets = repair, maintenance and compliance work orders on equipment. Each row names its equipment and equipmentGroup (Dental / Office). Open = not completed or cancelled. The Equipment page card "Open Service Tickets" counts equipment items with an open ticket (summary.equipmentItemsWithOpenTickets), not tickets; when asked about tickets give the ticket count and, if useful, that number too.
- servicesData: the Services page = utilities and contracts (internet, phone, waste, software, banking...), with their own tickets. These are not equipment service tickets. A service's provider is often also listed in vendorsData, where it has a different (vendor) category.
- assignmentsData: the Assignments page = team work such as cleaning, lab work and huddles.
- operationsData: the dashboard's Overdue / Unscheduled / scheduled lists, exactly as the dashboard shows them for dashboardDate. Use it for "what is overdue" and "what is unscheduled".
- suppliesData (Dental + Office supplies) and instrumentsData: stock levels; "stock" is OK, Low or Out of stock.
- categoriesData: each page's own category list, and the items saved with a category that is not in that list.
- staffData, attendanceData, scheduleData: people, who is clocked in, schedules. vendorsData: suppliers and contacts (a vendor's "type" is its category on the Vendors page). requestsData: staff requests. tasksData, proceduresData, clinicsData, roomsData, stickyNotesData, documentsData: as named.

## Creating items
When the user wants to create or add a new instrument, equipment or supply:
- ALWAYS use the show_create_form tool to show an interactive form in the chat; don't ask for details one by one.
- Pre-fill anything the user mentioned (name, category, manufacturer...) in the prefill parameter.
- Example: "add a new dental mirror" -> show_create_form with entity_type="instrument" and prefill={{"instrumentName": "Dental Mirror", "category": "Diagnostic"}}

## Practice data
{context_sections}
"""

# Order the sections so the most-asked-about data comes first; anything else the app
# sends follows. Compact JSON keeps all items within the model's context window.
SECTION_ORDER = [
    ("operationsData", "Dashboard: overdue, unscheduled, scheduled"),
    ("serviceTicketsData", "Equipment service tickets"),
    ("equipmentData", "Equipment (dental and office)"),
    ("suppliesData", "Supplies (dental and office)"),
    ("instrumentsData", "Instruments"),
    ("servicesData", "Services (utilities and contracts)"),
    ("assignmentsData", "Assignments"),
    ("staffData", "Staff"),
    ("attendanceData", "Attendance (clock-ins)"),
    ("scheduleData", "Schedule"),
    ("requestsData", "Staff requests"),
    ("tasksData", "Tasks"),
    ("vendorsData", "Vendors"),
    ("categoriesData", "Category lists per page"),
    ("proceduresData", "Procedures"),
    ("clinicsData", "Clinics"),
    ("roomsData", "Rooms"),
    ("stickyNotesData", "Sticky notes"),
    ("documentsData", "Uploaded documents"),
    ("dashboardSummaryData", "Summary dashboard"),
]
META_FIELDS = {"currentView", "userRole", "userName", "currentDate", "localDateTime", "todayIso", "timeZone"}
SECTION_CHAR_LIMIT = int(os.getenv("DENTABRAIN_SECTION_CHARS", "60000"))
TOTAL_CHAR_LIMIT = int(os.getenv("DENTABRAIN_TOTAL_CHARS", "240000"))

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
                        "enum": ["dashboard", "calendar", "schedule", "duties", "task-hub", "requests",
                                 "projects", "sticky-notes", "equipment", "instruments",
                                 "supplies", "vendors", "procedures", "utilities", "teams"],
                        "description": "The view to navigate to. 'utilities' is the Services page, 'teams' is the Assignments page."
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
            "description": "Open a settings or management window: Manage Users, Roles, Clinics, Rooms, Permissions, Schedule, Tasks, Duties, Master Settings or Calendar Settings.",
            "parameters": {
                "type": "object",
                "properties": {
                    "panel": {
                        "type": "string",
                        "enum": ["manage-users", "manage-roles", "manage-clinics",
                                 "manage-rooms", "manage-schedule", "manage-tasks",
                                 "manage-duties", "manage-permissions", "master-settings",
                                 "calendar-settings"],
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
            "description": "Open the new-task form filled in with these details. The user reviews it and clicks Save; nothing is saved by this call.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Task title"},
                    "description": {"type": "string", "description": "Task description"},
                    "assignee": {"type": "string", "description": "Who to assign it to: their full name as listed in staffData, or 'me' for the signed-in user."},
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
            "description": "Open Team Chat. When the user names a person, pass that person and the direct conversation with them opens.",
            "parameters": {
                "type": "object",
                "properties": {
                    "username": {"type": "string", "description": "The person to chat with: their full name as listed in staffData (e.g. 'Sofia Ramirez'), or their username. Omit to just open Team Chat."},
                    "message": {"type": "string", "description": "Optional message to pre-fill in the chat input"}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "show_create_form",
            "description": "Show an inline creation form inside the chat for adding new instruments, equipment, or supplies. Use this whenever the user wants to create/add a new item instead of asking them to type all the details. You can prefill known fields from the conversation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "entity_type": {
                        "type": "string",
                        "enum": ["instrument", "equipment", "supply"],
                        "description": "The type of entity to create"
                    },
                    "prefill": {
                        "type": "object",
                        "description": "Optional fields to pre-fill in the form based on what the user has already mentioned. Keys should match form field names (e.g., instrumentName, category, manufacturer, equipmentName, equipmentType, supplyName, etc.)",
                        "properties": {
                            "instrumentName": {"type": "string"},
                            "equipmentName": {"type": "string"},
                            "supplyName": {"type": "string"},
                            "category": {"type": "string"},
                            "equipmentType": {"type": "string"},
                            "manufacturer": {"type": "string"},
                            "instrumentType": {"type": "string"},
                            "model": {"type": "string"},
                            "serialNumber": {"type": "string"},
                            "sku": {"type": "string"},
                            "skuNumber": {"type": "string"},
                            "quantityInStock": {"type": "string"},
                            "unit": {"type": "string"},
                            "notes": {"type": "string"}
                        }
                    }
                },
                "required": ["entity_type"]
            }
        }
    }
]

# ====================================================
# Helper: Build system prompt with app context
# ====================================================

def build_system_prompt(context: Optional[AppContext]) -> str:
    """Inject the app's data into the system prompt."""
    ctx = context or AppContext()
    data = ctx.model_dump(exclude_none=True)

    def compact(value) -> str:
        text = json.dumps(value, separators=(",", ":"), default=str, ensure_ascii=False)
        if len(text) > SECTION_CHAR_LIMIT:
            text = text[:SECTION_CHAR_LIMIT] + " ...[section cut short: too large]"
        return text

    ordered = [(key, title) for key, title in SECTION_ORDER if key in data]
    known = {key for key, _ in SECTION_ORDER}
    ordered += [(key, key) for key in data if key not in known and key not in META_FIELDS]

    parts, used = [], 0
    for key, title in ordered:
        value = data.get(key)
        if value in (None, {}, []):
            continue
        block = f"### {title} ({key})\n{compact(value)}\n"
        if used + len(block) > TOTAL_CHAR_LIMIT:
            parts.append(f"### {title} ({key})\n[not included: the data was too large to send in full]\n")
            continue
        parts.append(block)
        used += len(block)

    return SYSTEM_PROMPT.format(
        current_datetime=ctx.localDateTime or ctx.currentDate or datetime.now().strftime("%Y-%m-%d %H:%M"),
        time_zone=ctx.timeZone or "not given",
        today=ctx.todayIso or (ctx.currentDate or "")[:10] or datetime.now().strftime("%Y-%m-%d"),
        user_name=ctx.userName or "Unknown",
        user_role=ctx.userRole or "Unknown",
        current_view=ctx.currentView or "Unknown",
        context_sections="\n".join(parts) if parts else "No data was sent with this question.",
    )

# ====================================================
# Main Chat Endpoint
# ====================================================

def describe_actions(actions):
    """Short reply for when the AI only called tools."""
    first = actions[0]
    data = first.data or {}
    if first.type == "open_chat":
        who = str(data.get("username") or "").strip()
        return f"Opening your chat with {who}." if who else "Opening Team Chat."
    if first.type == "navigate_to_view":
        view = str(data.get("view") or data.get("viewName") or "").strip()
        return f"Opening {view}." if view else "Opening that page."
    if first.type == "create_sticky_note":
        return "Adding your sticky note."
    if first.type == "create_task":
        return "I've opened the task form with those details. Check it and click Save."
    if first.type == "open_settings_panel":
        panel = str(data.get("panel") or "").strip()
        label = panel.replace("-", " ").title() if panel else "that window"
        return f"Opening {label}."
    return "Done."


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
            temperature=0.2,
            max_tokens=1500,
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
            reply = describe_actions(actions)

        # Generate contextual follow-up suggestions
        suggestions = generate_suggestions(request.message, request.context)

        return ChatResponse(
            reply=reply,
            actions=actions,
            suggestions=suggestions
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI processing error: {str(e)}")


# Follow-up chips. Every chip is a question DentaBrain can answer from the data it is sent.
SUGGESTION_TOPICS = [
    (("ticket", "repair", "broken", "maintenance", "work order"),
     ["Which service tickets are overdue?", "Who is working on open tickets?", "Which equipment has open tickets?"]),
    (("pto", "time off", "vacation", "leave", "day off"),
     ["How many PTO requests are pending?", "Who has approved time off coming up?", "Who is absent today?"]),
    (("clock", "attendance", "late", "break", "lunch", "absent", "working today", "on shift"),
     ["Is anyone on lunch or break?", "Who was late today?", "Is anyone scheduled but not clocked in?"]),
    (("schedule", "shift", "scheduled"),
     ["Who is scheduled today?", "Is anyone scheduled but not clocked in?", "Who has time off coming up?"]),
    (("overdue", "unscheduled", "dashboard", "first today", "priority", "priorities"),
     ["What should I take care of first today?", "Which overdue items have no one assigned?", "How many items are unscheduled?"]),
    (("instrument",),
     ["Are any instruments out of stock?", "How many instruments do we have by category?", "Add an instrument"]),
    (("supply", "supplies", "glove", "stock", "reorder", "expire"),
     ["Are any supplies out of stock?", "What supplies expire in the next 60 days?", "What supplies are running low?"]),
    (("equipment", "x-ray", "xray", "scanner", "autoclave", "compressor", "warranty"),
     ["Which equipment isn't operational?", "What equipment is due for service this month?", "Which warranties expire in the next 90 days?"]),
    (("vendor", "supplier", "laboratory", "lab "),
     ["Which vendors are favorites?", "How many dental laboratories do we use?", "Which vendors have open service tickets?"]),
    (("service", "utilit", "internet", "phone", "contract", "monthly cost", "bill", "security", "cleaning", "trash"),
     ["What is our total monthly cost for services?", "Which service contracts end in the next 60 days?", "Are there open utility tickets?"]),
    (("assignment", "huddle", "team"),
     ["Which assignments are overdue?", "Are there assignments with no members?", "List our assignments and who leads each one"]),
    (("task",),
     ["What tasks are assigned to me?", "What tasks are pending?", "Create a task"]),
    (("employee", "staff", "birthday", "hired", "hire date", "oldest", "longest", "role", "job title"),
     ["Whose birthday is this month?", "Who has worked here the longest?", "How many employees do we have, by role?"]),
    (("room",),
     ["How many rooms do we have?", "Open Manage Rooms", "Where is the X-ray unit located?"]),
    (("category", "categories"),
     ["Which services have a category that isn't in the list?", "What categories do we use for supplies?", "What categories do we use for services?"]),
]

SUGGESTIONS_BY_VIEW = {
    "dashboard": ["What's overdue right now?", "What should I take care of first today?", "Who is clocked in right now?"],
    "attendance": ["Who is clocked in right now?", "Who was late today?", "How many PTO requests are pending?"],
    "calendar": ["Who is scheduled today?", "What's due next week?", "Who has time off coming up?"],
    "schedule": ["Who is scheduled today?", "Is anyone scheduled but not clocked in?", "Who has time off coming up?"],
    "equipment": ["Which equipment isn't operational?", "What equipment is due for service this month?", "Which service tickets are overdue?"],
    "instruments": ["Are any instruments out of stock?", "How many instruments do we have by category?", "Add an instrument"],
    "supplies": ["What supplies are running low?", "Are any supplies out of stock?", "What supplies expire in the next 60 days?"],
    "vendors": ["Which vendors are favorites?", "How many vendors do we have?", "Which vendors have open service tickets?"],
    "utilities": ["What is our total monthly cost for services?", "Which service contracts end in the next 60 days?", "Are there open utility tickets?"],
    "teams": ["Which assignments are overdue?", "Are there assignments with no members?", "List our assignments and who leads each one"],
    "task-hub": ["What tasks are assigned to me?", "What tasks are pending?", "Create a task"],
    "requests": ["How many open requests are there, by type?", "How many PTO requests are pending?", "Who has approved time off coming up?"],
    "sticky-notes": ["What sticky notes do I have?", "Add a sticky note", "What's overdue right now?"],
    "procedures": ["Tell me about our root canal procedure", "What procedures do we have?", "What's overdue right now?"],
}

DEFAULT_SUGGESTIONS = ["What's overdue right now?", "Who is clocked in right now?", "What supplies are running low?"]


def _same_question(a: str, b: str) -> bool:
    norm = lambda s: re.sub(r"[^a-z0-9 ]+", "", s.lower()).strip()
    return norm(a) == norm(b)


def generate_suggestions(last_message: str, context: Optional[AppContext]) -> list[str]:
    """Follow-up chips: the topic of the last question first, then the page the user is on."""
    text = f" {(last_message or '').lower()} "
    best, best_hits = None, 0
    for keywords, chips in SUGGESTION_TOPICS:
        hits = sum(1 for k in keywords if k in text)
        if hits > best_hits:
            best, best_hits = chips, hits
    view = (context.currentView if context else None) or ""
    picks = list(best or [])
    for chip in SUGGESTIONS_BY_VIEW.get(view, []) + DEFAULT_SUGGESTIONS:
        if len(picks) >= 3:
            break
        if chip not in picks:
            picks.append(chip)
    # don't suggest the question that was just asked
    picks = [c for c in picks if not _same_question(c, last_message or "")]
    for chip in DEFAULT_SUGGESTIONS:
        if len(picks) >= 3:
            break
        if chip not in picks and not _same_question(chip, last_message or ""):
            picks.append(chip)
    return picks[:3]


# ====================================================
# Health Check
# ====================================================

@app.get("/api/ai/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "ReformDental Copilot",
        "version": "2026-11-25.1",
        "model": MODEL,
        "api_key_configured": bool(os.getenv("OPENAI_API_KEY") and os.getenv("OPENAI_API_KEY") != "sk-your-key-here")
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8100))
    uvicorn.run(app, host="0.0.0.0", port=port)
