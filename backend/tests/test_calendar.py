from datetime import date, datetime
from unittest.mock import MagicMock
from icalendar import Calendar as iCal

from services.google_calendar import _build_ical


def _task(start_date=None, time_needed=1):
    t = MagicMock()
    t.id = "abc-123"
    t.title = "Test Task"
    t.description = "some desc"
    t.criticality = "medium"
    t.state = "pending"
    t.time_needed = time_needed
    t.start_date = start_date
    t.google_calendar_event_id = None
    t.goal = MagicMock()
    t.goal.title = "Test Goal"
    return t


def test_all_day_event_dates():
    ical_bytes = _build_ical(_task(start_date=date(2026, 5, 28), time_needed=3))
    cal = iCal.from_ical(ical_bytes)
    for component in cal.walk("VEVENT"):
        dtstart = component.get("dtstart").dt
        dtend = component.get("dtend").dt
        # Must be date, not datetime
        assert type(dtstart) is date, f"expected date, got {type(dtstart)}"
        assert type(dtend) is date, f"expected date, got {type(dtend)}"
        assert dtstart == date(2026, 5, 28)
        assert dtend == date(2026, 5, 31)  # exclusive end = start + 3


def test_single_day_event():
    ical_bytes = _build_ical(_task(start_date=date(2026, 6, 1), time_needed=1))
    cal = iCal.from_ical(ical_bytes)
    for component in cal.walk("VEVENT"):
        assert component.get("dtstart").dt == date(2026, 6, 1)
        assert component.get("dtend").dt == date(2026, 6, 2)


def test_fallback_to_today_when_no_start_date():
    today = date.today()
    ical_bytes = _build_ical(_task(start_date=None, time_needed=2))
    cal = iCal.from_ical(ical_bytes)
    for component in cal.walk("VEVENT"):
        dtstart = component.get("dtstart").dt
        assert type(dtstart) is date
        assert dtstart == today


def test_description_contains_time_needed():
    ical_bytes = _build_ical(_task(start_date=date(2026, 5, 28), time_needed=4))
    cal = iCal.from_ical(ical_bytes)
    for component in cal.walk("VEVENT"):
        desc = str(component.get("description"))
        assert "4 day(s)" in desc
