"use client";
import { useState } from "react";
import type { Goal, Task } from "@/lib/types";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import TaskForm from "./TaskForm";
import { Pencil, Trash2, Clock, Calendar } from "lucide-react";
import { updateTask, deleteTask } from "@/lib/api";

interface Props {
  task: Task;
  goals: Goal[];
  onUpdate: (t: Task) => void;
  onDelete: (id: string) => void;
}

function formatTime(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function formatDateRange(start_date: string | null, time_needed: number): string {
  if (!start_date) return "No schedule";
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  // Parse as local date to avoid timezone shifts
  const [y, mo, d] = start_date.split("-").map(Number);
  const start = new Date(y, mo - 1, d);
  if (time_needed === 1) return fmt(start);
  const end = new Date(y, mo - 1, d + time_needed - 1);  // inclusive last day
  return `${fmt(start)} → ${fmt(end)}`;
}

export default function TaskCard({ task, goals, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false);

  const handleUpdate = async (data: Omit<Task, "id" | "google_calendar_event_id" | "created_at" | "updated_at">) => {
    const updated = await updateTask(task.id, data);
    onUpdate(updated);
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!confirm(`Delete task "${task.title}"?`)) return;
    await deleteTask(task.id);
    onDelete(task.id);
  };

  const goal = goals.find((g) => g.id === task.goal_id);

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 text-sm leading-tight">{task.title}</p>
            {goal && <p className="text-xs text-indigo-500 mt-0.5">↳ {goal.title}</p>}
            {task.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{task.description}</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setEditing(true)} className="p-1 rounded hover:bg-gray-100 text-gray-400">
              <Pencil size={13} />
            </button>
            <button onClick={handleDelete} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 items-center">
          <Badge variant="task-state" value={task.state} />
          <Badge variant="criticality" value={task.criticality} />
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <Calendar size={11} />
            {formatDateRange(task.start_date, task.time_needed)}
          </span>
          {task.time_spent > 0 && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Clock size={11} />
              {formatTime(task.time_spent)}
            </span>
          )}
        </div>
      </div>

      {editing && (
        <Modal title="Edit Task" onClose={() => setEditing(false)}>
          <TaskForm goals={goals} initial={task} onSubmit={handleUpdate} onCancel={() => setEditing(false)} />
        </Modal>
      )}
    </>
  );
}
