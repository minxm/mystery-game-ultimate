/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // 硅基流动 Kolors 图片（S3 临时签名 URL）
      {
        protocol: 'https',
        hostname: 's3.siliconflow.cn',
        pathname: '/**',
      },
      // ui-avatars 占位头像
      {
        protocol: 'https',
        hostname: 'ui-avatars.com',
        pathname: '/**',
      },
      // OpenAI DALL·E（兼容旧配置）
      {
        protocol: 'https',
        hostname: 'oaidalleapiprodscus.blob.core.windows.net',
        pathname: '/**',
      },
      // Supabase Storage（AI 图片 CDN 缓存）
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

module.exports = nextConfig;
