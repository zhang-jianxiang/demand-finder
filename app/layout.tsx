import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Find Demands — 需求发现看板",
  description: "从知乎、小红书等平台发现生活与工作需求",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="flex min-h-screen">
          {/* 侧边栏 */}
          <Sidebar />

          {/* 主内容区 */}
          <main className="flex-1 ml-64 p-6 overflow-x-hidden">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
