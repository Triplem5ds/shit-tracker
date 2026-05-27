import { getGoals, getTasks } from "@/lib/api";
import type { Goal, Task } from "@/lib/types";
import Link from "next/link";
import Badge from "@/components/ui/Badge";
import { Target, CheckSquare, Clock, TrendingUp } from "lucide-react";

async function getDashboardData() {
  const [goals, tasks] = await Promise.all([
    getGoals().catch(() => [] as Goal[]),
    getTasks().catch(() => [] as Task[]),
  ]);
  return { goals, tasks };
}

export default async function DashboardPage() {
  const { goals, tasks } = await getDashboardData();

  const activeGoals = goals.filter((g) => g.state === "active");
  const pendingTasks = tasks.filter((t) => t.state === "pending");
  const doneTasks = tasks.filter((t) => t.state === "done");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdueTasks = tasks.filter((t) => {
    if (!t.start_date || t.state === "done" || t.state === "cancelled") return false;
    const [y, mo, d] = t.start_date.split("-").map(Number);
    const endDay = new Date(y, mo - 1, d + t.time_needed);
    return endDay <= today;
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={<Target size={20} className="text-indigo-500" />} label="Active Goals" value={activeGoals.length} />
        <StatCard icon={<CheckSquare size={20} className="text-yellow-500" />} label="Pending Tasks" value={pendingTasks.length} />
        <StatCard icon={<TrendingUp size={20} className="text-green-500" />} label="Done Tasks" value={doneTasks.length} />
        <StatCard icon={<Clock size={20} className="text-red-500" />} label="Overdue" value={overdueTasks.length} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Goals */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Active Goals</h2>
            <Link href="/goals" className="text-xs text-indigo-600 hover:underline">View all</Link>
          </div>
          {activeGoals.length === 0 ? (
            <p className="text-sm text-gray-400">No active goals yet.</p>
          ) : (
            <ul className="space-y-3">
              {activeGoals.slice(0, 5).map((g) => (
                <li key={g.id}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-gray-800">{g.title}</span>
                    <span className="text-gray-500 text-xs">
                      {g.metric_current} / {g.metric_target} {g.metric_name}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className="bg-indigo-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (g.metric_current / g.metric_target) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Upcoming Tasks */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Upcoming Tasks</h2>
            <Link href="/tasks" className="text-xs text-indigo-600 hover:underline">View all</Link>
          </div>
          {pendingTasks.length === 0 ? (
            <p className="text-sm text-gray-400">No pending tasks.</p>
          ) : (
            <ul className="space-y-2">
              {pendingTasks.slice(0, 6).map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-gray-800 truncate">{t.title}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="criticality" value={t.criticality} />
                    {t.start_date && (
                      <span className="text-xs text-gray-400">
                        {t.start_date}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-3">
      <div className="p-2 bg-gray-50 rounded-lg">{icon}</div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}
