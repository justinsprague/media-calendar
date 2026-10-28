# Media Calendar

Shared, no-login media calendar for a small team: content ideas, shoots and launches, with a checklist (including an Owner/GM sign-off step) on every item and in-app alerts for the weekly meeting.

Run locally:

    pip install -r requirements.txt
    uvicorn app:app --host 0.0.0.0 --port 8000

Data is stored in SQLite at `calendar.db` (override with `DB_PATH`). On first start it is seeded with the initial campaign dates.
