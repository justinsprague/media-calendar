import json
import os
import sqlite3
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

BASE = Path(__file__).parent
DB_PATH = os.environ.get("DB_PATH", str(BASE / "calendar.db"))

TEMPLATES = {
    "Launch": ["Brief / concept locked", "Creative produced", "Copy written", "Owner/GM sign-off", "Scheduled / trafficked", "Live"],
    "Shoot": ["Concept + shot list", "Talent / location booked", "Crew + gear confirmed", "Owner/GM sign-off on plan", "Shoot day", "Selects + edit delivered"],
    "Content Idea": ["Idea pitched", "Brief written", "Owner/GM sign-off", "Assigned for production"],
    "Other": ["Plan", "Owner/GM sign-off", "Done"],
}
LEAD_DAYS = {"Launch": 45, "Shoot": 30, "Content Idea": 21, "Other": 14}


def checklist(kind):
    return [{"id": uuid.uuid4().hex[:8], "text": t, "done": False, "gm": "Owner/GM" in t} for t in TEMPLATES[kind]]


SEED = [
    ("Launch March ad", "Launch", "2026-11-01", ""),
    ("Launch New Year's Eve email ad", "Launch", "2026-11-15", "Email"),
    ("Launch March sales ad", "Launch", "2026-12-01", ""),
    ("Film Christmas content", "Shoot", "2026-12-24", ""),
    ("Launch summer ads", "Launch", "2027-01-01", ""),
    ("Film winter ad content", "Shoot", "2027-01-15", ""),
    ("Film couples video", "Shoot", "2027-02-01", ""),
]


def db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, data TEXT NOT NULL)")
    return conn


def seed():
    with db() as conn:
        if conn.execute("SELECT COUNT(*) FROM items").fetchone()[0]:
            return
        for title, kind, date, channel in SEED:
            item = {"id": uuid.uuid4().hex[:10], "title": title, "type": kind, "date": date, "owner": "",
                    "channel": channel, "notes": "", "leadDays": LEAD_DAYS[kind], "checklist": checklist(kind)}
            conn.execute("INSERT INTO items VALUES (?, ?)", (item["id"], json.dumps(item)))


app = FastAPI()
seed()


@app.get("/api/templates")
def templates():
    return {"templates": TEMPLATES, "leadDays": LEAD_DAYS}


@app.get("/api/items")
def list_items():
    with db() as conn:
        return [json.loads(r[0]) for r in conn.execute("SELECT data FROM items")]


@app.post("/api/items")
async def create_item(request: Request):
    item = await request.json()
    item["id"] = uuid.uuid4().hex[:10]
    with db() as conn:
        conn.execute("INSERT INTO items VALUES (?, ?)", (item["id"], json.dumps(item)))
    return item


@app.put("/api/items/{item_id}")
async def update_item(item_id: str, request: Request):
    item = await request.json()
    item["id"] = item_id
    with db() as conn:
        cur = conn.execute("UPDATE items SET data = ? WHERE id = ?", (json.dumps(item), item_id))
        if not cur.rowcount:
            raise HTTPException(404)
    return item


@app.delete("/api/items/{item_id}")
def delete_item(item_id: str):
    with db() as conn:
        conn.execute("DELETE FROM items WHERE id = ?", (item_id,))
    return {"ok": True}


@app.get("/")
def index():
    return FileResponse(BASE / "static" / "index.html")


app.mount("/static", StaticFiles(directory=BASE / "static"), name="static")
