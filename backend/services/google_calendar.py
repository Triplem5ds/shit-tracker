import os
from typing import Optional
from datetime import datetime, timezone, timedelta

import caldav
from icalendar import Calendar as iCal, Event as iEvent
from dotenv import load_dotenv

load_dotenv()

CALDAV_URL = os.getenv("CALDAV_URL", "")
CALDAV_USERNAME = os.getenv("CALDAV_USERNAME", "")
CALDAV_PASSWORD = os.getenv("CALDAV_PASSWORD", "")
CALDAV_CALENDAR_NAME = os.getenv("CALDAV_CALENDAR_NAME", "")

UID_SUFFIX = "@shit-tracker"


def _get_calendar() -> Optional[caldav.Calendar]:
    if not (CALDAV_URL and CALDAV_USERNAME and CALDAV_PASSWORD):
        return None
    try:
        client = caldav.DAVClient(url=CALDAV_URL, username=CALDAV_USERNAME, password=CALDAV_PASSWORD)
        principal = client.principal()
        calendars = principal.calendars()
        if not calendars:
            return None
        if CALDAV_CALENDAR_NAME:
            for cal in calendars:
                if getattr(cal, "name", None) == CALDAV_CALENDAR_NAME:
                    return cal
        return calendars[0]
    except Exception:
        return None


def is_connected() -> bool:
    return _get_calendar() is not None


def _build_ical(task) -> bytes:
    goal_title = task.goal.title if task.goal else "Unknown Goal"
    cal = iCal()
    cal.add("prodid", "-//Shit Tracker//EN")
    cal.add("version", "2.0")

    event = iEvent()
    event.add("uid", task.id + UID_SUFFIX)
    event.add("summary", f"[{goal_title}] {task.title}")
    event.add("description", (task.description or "") + f"\n\nCriticality: {task.criticality}\nState: {task.state}")

    if task.start_date:
        dt = datetime.combine(task.start_date, datetime.min.time())
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = datetime.now(timezone.utc)
    event.add("dtstart", dt)
    event.add("dtend", dt + timedelta(hours=task.time_needed))
    event.add("dtstamp", datetime.now(timezone.utc))

    cal.add_component(event)
    return cal.to_ical()


def push_task_to_calendar(task, _db=None) -> Optional[str]:
    calendar = _get_calendar()
    if not calendar:
        return None
    uid = task.id + UID_SUFFIX
    ical_data = _build_ical(task)
    try:
        if task.google_calendar_event_id:
            # update existing
            existing = calendar.event_by_uid(uid)
            existing.data = ical_data.decode()
            existing.save()
        else:
            calendar.save_event(ical_data)
        return uid
    except Exception:
        try:
            calendar.save_event(ical_data)
            return uid
        except Exception:
            return None


def delete_calendar_event(event_uid: str):
    calendar = _get_calendar()
    if not calendar:
        return
    try:
        event = calendar.event_by_uid(event_uid)
        event.delete()
    except Exception:
        pass


def fetch_calendar_events(time_min: str, time_max: str) -> list:
    calendar = _get_calendar()
    if not calendar:
        return []
    try:
        start = datetime.fromisoformat(time_min)
        end = datetime.fromisoformat(time_max)
        events = calendar.search(start=start, end=end, event=True, expand=True)
        result = []
        for ev in events:
            try:
                ical = iCal.from_ical(ev.data)
                for component in ical.walk("VEVENT"):
                    uid = str(component.get("uid", ""))
                    # skip events we created (those belong to tasks)
                    if uid.endswith(UID_SUFFIX):
                        continue
                    dtstart = component.get("dtstart").dt
                    dtend = component.get("dtend").dt
                    result.append({
                        "id": uid,
                        "summary": str(component.get("summary", "(no title)")),
                        "description": str(component.get("description", "")),
                        "start": {"dateTime": dtstart.isoformat() if isinstance(dtstart, datetime) else None,
                                  "date": dtstart.isoformat() if not isinstance(dtstart, datetime) else None},
                        "end": {"dateTime": dtend.isoformat() if isinstance(dtend, datetime) else None,
                                "date": dtend.isoformat() if not isinstance(dtend, datetime) else None},
                    })
            except Exception:
                continue
        return result
    except Exception:
        return []
