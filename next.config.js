/** @type {import('next').NextConfig} */
const nextConfig = {
  // 全栈模式: API Routes 在同域, 无需配置外部 API URL
  // Mock 模式: 未设置 DATABASE_URL 时自动使用 Mock 数据
  experimental: {},
};

module.exports = nextConfig;
