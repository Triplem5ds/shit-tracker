import type { Goal, Task, GoogleCalendarEvent } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  if (res.status === 204) return undefined as T;
  return res.json();
}

// Goals
export const getGoals = () => request<Goal[]>("/api/goals");
export const getGoal = (id: string) => request<Goal>(`/api/goals/${id}`);
export const createGoal = (data: Omit<Goal, "id" | "created_at" | "updated_at">) =>
  request<Goal>("/api/goals", { method: "POST", body: JSON.stringify(data) });
export const updateGoal = (id: string, data: Partial<Goal>) =>
  request<Goal>(`/api/goals/${id}`, { method: "PATCH", body: JSON.stringify(data) });
export const deleteGoal = (id: string) =>
  request<void>(`/api/goals/${id}`, { method: "DELETE" });

// Tasks
export const getTasks = (params?: { goal_id?: string; state?: string; criticality?: string }) => {
  const q = new URLSearchParams(
    Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v != null) as [string, string][])
  );
  return request<Task[]>(`/api/tasks${q.size ? `?${q}` : ""}`);
};
export const getTask = (id: string) => request<Task>(`/api/tasks/${id}`);
export const createTask = (data: Omit<Task, "id" | "google_calendar_event_id" | "created_at" | "updated_at">) =>
  request<Task>("/api/tasks", { method: "POST", body: JSON.stringify(data) });
export const updateTask = (id: string, data: Partial<Task>) =>
  request<Task>(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(data) });
export const deleteTask = (id: string) =>
  request<void>(`/api/tasks/${id}`, { method: "DELETE" });

// Calendar
export const getCalendarStatus = () => request<{ connected: boolean }>("/api/calendar/status");
export const getCalendarEvents = (timeMin: string, timeMax: string) =>
  request<{ events: GoogleCalendarEvent[] }>(`/api/calendar/events?time_min=${timeMin}&time_max=${timeMax}`);
