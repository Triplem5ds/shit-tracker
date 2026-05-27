"use client";
import { useEffect, useState } from "react";
import type { Goal, Task, TaskState, Criticality } from "@/lib/types";
import { getGoals, getTasks, createTask } from "@/lib/api";
import TaskCard from "@/components/tasks/TaskCard";
import TaskForm from "@/components/tasks/TaskForm";
import Modal from "@/components/ui/Modal";
import { Plus } from "lucide-react";

export default function TasksPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [creating, setCreating] = useState(false);
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [critFilter, setCritFilter] = useState<string>("all");
  const [goalFilter, setGoalFilter] = useState<string>("all");

  useEffect(() => {
    Promise.all([getGoals(), getTasks()])
      .then(([g, t]) => { setGoals(g); setTasks(t); })
      .catch(console.error);
  }, []);

  const handleCreate = async (data: Omit<Task, "id" | "google_calendar_event_id" | "created_at" | "updated_at">) => {
    const t = await createTask(data);
    setTasks((prev) => [t, ...prev]);
    setCreating(false);
  };

  const filtered = tasks.filter((t) => {
    if (stateFilter !== "all" && t.state !== stateFilter) return false;
    if (critFilter !== "all" && t.criticality !== critFilter) return false;
    if (goalFilter !== "all" && t.goal_id !== goalFilter) return false;
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
        <button
          onClick={() => setCreating(true)}
          disabled={goals.length === 0}
          title={goals.length === 0 ? "Create a goal first" : undefined}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus size={16} /> New Task
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <FilterGroup
          label="State"
          value={stateFilter}
          options={["all", "pending", "onhold", "cancelled", "done"]}
          onChange={setStateFilter}
        />
        <FilterGroup
          label="Criticality"
          value={critFilter}
          options={["all", "low", "medium", "high", "critical"]}
          onChange={setCritFilter}
        />
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-medium">Goal:</span>
          <select
            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={goalFilter}
            onChange={(e) => setGoalFilter(e.target.value)}
          >
            <option value="all">All</option>
            {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No tasks here.</p>
          {goals.length === 0 && <p className="text-sm mt-1">Create a goal first, then add tasks.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              goals={goals}
              onUpdate={(updated) => setTasks((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))}
              onDelete={(id) => setTasks((prev) => prev.filter((x) => x.id !== id))}
            />
          ))}
        </div>
      )}

      {creating && (
        <Modal title="New Task" onClose={() => setCreating(false)}>
          <TaskForm goals={goals} onSubmit={handleCreate} onCancel={() => setCreating(false)} />
        </Modal>
      )}
    </div>
  );
}

function FilterGroup({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 font-medium">{label}:</span>
      <div className="flex gap-1">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize transition-colors ${
              value === o ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
