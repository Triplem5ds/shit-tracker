from fastapi import APIRouter, Query
from services.google_calendar import is_connected, fetch_calendar_events

router = APIRouter(prefix="/api/calendar", tags=["calendar"])


@router.get("/status")
def calendar_status():
    return {"connected": is_connected()}


@router.get("/events")
def calendar_events(time_min: str = Query(...), time_max: str = Query(...)):
    events = fetch_calendar_events(time_min, time_max)
    return {"events": events}
