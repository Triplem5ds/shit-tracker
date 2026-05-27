import type { TaskState, Criticality, GoalState } from "@/lib/types";

const taskStateColors: Record<TaskState, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  onhold: "bg-blue-100 text-blue-800",
  cancelled: "bg-gray-100 text-gray-600",
  done: "bg-green-100 text-green-800",
};

const criticalityColors: Record<Criticality, string> = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-orange-100 text-orange-700",
  high: "bg-red-100 text-red-700",
  critical: "bg-red-600 text-white",
};

const goalStateColors: Record<GoalState, string> = {
  active: "bg-indigo-100 text-indigo-700",
  completed: "bg-green-100 text-green-700",
  abandoned: "bg-gray-100 text-gray-600",
  paused: "bg-yellow-100 text-yellow-700",
};

interface Props {
  variant: "task-state" | "criticality" | "goal-state";
  value: string;
}

export default function Badge({ variant, value }: Props) {
  let color = "";
  if (variant === "task-state") color = taskStateColors[value as TaskState] ?? "bg-gray-100 text-gray-600";
  if (variant === "criticality") color = criticalityColors[value as Criticality] ?? "bg-gray-100 text-gray-600";
  if (variant === "goal-state") color = goalStateColors[value as GoalState] ?? "bg-gray-100 text-gray-600";

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${color}`}>
      {value}
    </span>
  );
}
