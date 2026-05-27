"use client";
import { useEffect, useState } from "react";
import type { Goal } from "@/lib/types";
import { getGoals, createGoal } from "@/lib/api";
import GoalCard from "@/components/goals/GoalCard";
import GoalForm from "@/components/goals/GoalForm";
import Modal from "@/components/ui/Modal";
import { Plus } from "lucide-react";

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    getGoals().then(setGoals).catch(console.error);
  }, []);

  const handleCreate = async (data: Omit<Goal, "id" | "created_at" | "updated_at">) => {
    const g = await createGoal(data);
    setGoals((prev) => [g, ...prev]);
    setCreating(false);
  };

  const filtered = filter === "all" ? goals : goals.filter((g) => g.state === filter);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Goals</h1>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus size={16} /> New Goal
        </button>
      </div>

      <div className="flex gap-2 mb-6">
        {["all", "active", "completed", "paused", "abandoned"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
              filter === s ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No goals yet.</p>
          <p className="text-sm mt-1">Create one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              onUpdate={(updated) => setGoals((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))}
              onDelete={(id) => setGoals((prev) => prev.filter((x) => x.id !== id))}
            />
          ))}
        </div>
      )}

      {creating && (
        <Modal title="New Goal" onClose={() => setCreating(false)}>
          <GoalForm onSubmit={handleCreate} onCancel={() => setCreating(false)} />
        </Modal>
      )}
    </div>
  );
}
