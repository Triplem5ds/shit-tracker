export type GoalState = "active" | "completed" | "abandoned" | "paused";
export type TaskState = "pending" | "onhold" | "cancelled" | "done";
export type Criticality = "low" | "medium" | "high" | "critical";

export interface Goal {
  id: string;
  title: string;
  description: string | null;
  metric_name: string;
  metric_target: number;
  metric_current: number;
  state: GoalState;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  goal_id: string;
  title: string;
  description: string | null;
  start_date: string | null;   // ISO date YYYY-MM-DD
  time_needed: number;
  time_spent: number;
  criticality: Criticality;
  state: TaskState;
  google_calendar_event_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
}
