"use client";
import { useState } from "react";
import type { Goal } from "@/lib/types";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import GoalForm from "./GoalForm";
import { Pencil, Trash2 } from "lucide-react";
import { updateGoal, deleteGoal } from "@/lib/api";

interface Props {
  goal: Goal;
  onUpdate: (g: Goal) => void;
  onDelete: (id: string) => void;
}

export default function GoalCard({ goal, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const progress = Math.min(100, (goal.metric_current / goal.metric_target) * 100);

  const handleUpdate = async (data: Omit<Goal, "id" | "created_at" | "updated_at">) => {
    const updated = await updateGoal(goal.id, data);
    onUpdate(updated);
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!confirm(`Delete goal "${goal.title}"?`)) return;
    await deleteGoal(goal.id);
    onDelete(goal.id);
  };

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-gray-900">{goal.title}</h3>
            {goal.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{goal.description}</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Badge variant="goal-state" value={goal.state} />
            <button onClick={() => setEditing(true)} className="p-1 rounded hover:bg-gray-100 text-gray-400">
              <Pencil size={14} />
            </button>
            <button onClick={handleDelete} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Progress</span>
            <span>{goal.metric_current} / {goal.metric_target} {goal.metric_name}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-indigo-500 h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-right text-xs text-gray-400 mt-0.5">{progress.toFixed(0)}%</p>
        </div>
      </div>

      {editing && (
        <Modal title="Edit Goal" onClose={() => setEditing(false)}>
          <GoalForm initial={goal} onSubmit={handleUpdate} onCancel={() => setEditing(false)} />
        </Modal>
      )}
    </>
  );
}
