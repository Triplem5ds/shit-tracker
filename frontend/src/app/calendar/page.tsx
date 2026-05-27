"use client";
import { useEffect, useState } from "react";
import type { Task, GoogleCalendarEvent } from "@/lib/types";
import { getTasks, getCalendarStatus, getCalendarEvents } from "@/lib/api";
import CalendarView from "@/components/calendar/CalendarView";
import { format, startOfMonth, endOfMonth, addMonths } from "date-fns";
import { CalendarDays, RefreshCw, WifiOff } from "lucide-react";

export default function CalendarPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [calEvents, setCalEvents] = useState<GoogleCalendarEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [t, status] = await Promise.all([
        getTasks().catch(() => [] as Task[]),
        getCalendarStatus().catch(() => ({ connected: false })),
      ]);
      setTasks(t);
      setConnected(status.connected);

      if (status.connected) {
        const now = new Date();
        const min = format(startOfMonth(addMonths(now, -1)), "yyyy-MM-dd'T'HH:mm:ssxxx");
        const max = format(endOfMonth(addMonths(now, 2)), "yyyy-MM-dd'T'HH:mm:ssxxx");
        const { events } = await getCalendarEvents(min, max).catch(() => ({ events: [] }));
        setCalEvents(events);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <RefreshCw size={20} className="animate-spin mr-2" /> Loading…
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="w-3 h-3 rounded-full bg-indigo-500 inline-block" /> Tasks
            {connected && <><span className="w-3 h-3 rounded-full bg-teal-500 inline-block ml-2" /> CalDAV</>}
          </div>
          {connected ? (
            <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
              <CalendarDays size={15} /> CalDAV connected
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-sm text-gray-400">
              <WifiOff size={15} /> CalDAV not configured
            </span>
          )}
        </div>
      </div>

      {!connected && (
        <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          To sync your calendar, add <code className="font-mono bg-amber-100 px-1 rounded">CALDAV_URL</code>,{" "}
          <code className="font-mono bg-amber-100 px-1 rounded">CALDAV_USERNAME</code>, and{" "}
          <code className="font-mono bg-amber-100 px-1 rounded">CALDAV_PASSWORD</code> to{" "}
          <code className="font-mono bg-amber-100 px-1 rounded">backend/.env</code> and restart the backend.
        </div>
      )}

      <CalendarView tasks={tasks} googleEvents={calEvents} />
    </div>
  );
}
