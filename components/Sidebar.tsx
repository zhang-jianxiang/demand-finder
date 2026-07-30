"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const navItems = [
  { href: "/", label: "需求排行榜", icon: "🔥" },
  { href: "/trends", label: "趋势分析", icon: "📈" },
  { href: "/domains", label: "领域分布", icon: "🗂️" },
];

const sourceItems = [
  { label: "知乎", color: "bg-blue-400" },
  { label: "小红书", color: "bg-pink-400" },
  { label: "微博", color: "bg-red-400" },
  { label: "Reddit", color: "bg-orange-400" },
  { label: "HackerNews", color: "bg-amber-400" },
  { label: "X/Twitter", color: "bg-slate-400" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-slate-900 text-white flex flex-col z-50">
      {/* Logo 区域 */}
      <div className="px-6 py-5 border-b border-slate-700">
        <h1 className="text-xl font-bold tracking-tight">
          <span className="text-brand-400">Find</span> Demands
        </h1>
        <p className="text-xs text-slate-400 mt-1">从互联网发现生活与工作需求</p>
      </div>

      {/* 导航 */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-brand-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              )}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* 数据源状态 */}
      <div className="px-4 py-4 border-t border-slate-700">
        <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">数据源</p>
        <div className="space-y-2">
          {sourceItems.map((s) => (
            <div key={s.label} className="flex items-center gap-2 text-sm text-slate-400">
              <span className={clsx("w-2 h-2 rounded-full", s.color)} />
              {s.label}
            </div>
          ))}
        </div>
      </div>

      {/* 底部状态 */}
      <div className="px-4 py-3 border-t border-slate-700">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          {"实时数据"}
        </div>
      </div>
    </aside>
  );
}
