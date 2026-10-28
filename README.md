# Media Calendar

Shared, no-login media calendar for a small team: content ideas, shoots and launches, with a checklist (including an Owner/GM sign-off step) on every item and in-app alerts for the weekly meeting.

Run locally:

    pip install -r requirements.txt
    uvicorn app:app --host 0.0.0.0 --port 8000

Data is stored in SQLite at `calendar.db` (override with `DB_PATH`). On first start it is seeded with the initial campaign dates.

## Hosting (Fly.io)

Live at https://justin-media-calendar.fly.dev (app `justin-media-calendar`, personal org). The SQLite DB lives on the Fly volume `calendar_data` mounted at `/data` (`DB_PATH=/data/calendar.db`), so data survives restarts and redeploys. Redeploy with:

    flyctl deploy -a justin-media-calendar --remote-only --ha=false
