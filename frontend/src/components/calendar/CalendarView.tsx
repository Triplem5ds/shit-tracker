"use client";
import { useMemo } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import type { Task, GoogleCalendarEvent } from "@/lib/types";

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: { "en-US": enUS },
});

interface CalEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: { type: "task" | "google"; data: Task | GoogleCalendarEvent };
}

interface Props {
  tasks: Task[];
  googleEvents: GoogleCalendarEvent[];
}

function toDate(s: string | undefined, fallback: Date): Date {
  if (!s) return fallback;
  return new Date(s);
}

export default function CalendarView({ tasks, googleEvents }: Props) {
  const events: CalEvent[] = useMemo(() => {
    const taskEvents: CalEvent[] = tasks
      .filter((t) => t.start_date)
      .map((t) => {
        const [y, mo, d] = t.start_date!.split("-").map(Number);
        const start = new Date(y, mo - 1, d);
        const end = new Date(y, mo - 1, d + t.time_needed);
        return {
          id: t.id,
          title: t.title,
          start,
          end,
          resource: { type: "task" as const, data: t },
        };
      });

    const gEvents: CalEvent[] = googleEvents.map((e) => {
      const start = toDate(e.start.dateTime ?? e.start.date, new Date());
      const end = toDate(e.end.dateTime ?? e.end.date, new Date(start.getTime() + 3600000));
      return {
        id: e.id,
        title: e.summary ?? "(no title)",
        start,
        end,
        resource: { type: "google" as const, data: e },
      };
    });

    return [...taskEvents, ...gEvents];
  }, [tasks, googleEvents]);

  const eventPropGetter = (event: CalEvent) => {
    if (event.resource.type === "google") {
      return { style: { backgroundColor: "#4285F4", borderColor: "#3367D6" } };
    }
    const task = event.resource.data as Task;
    const colors: Record<string, string> = {
      critical: "#DC2626",
      high: "#EA580C",
      medium: "#7C3AED",
      low: "#059669",
    };
    const bg = colors[task.criticality] ?? "#6366F1";
    return { style: { backgroundColor: bg, borderColor: bg } };
  };

  return (
    <div className="h-[calc(100vh-180px)] bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        eventPropGetter={eventPropGetter}
        views={["month", "week", "day", "agenda"]}
        defaultView="month"
        popup
      />
    </div>
  );
}
