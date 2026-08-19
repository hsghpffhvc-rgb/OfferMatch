const POSTHOG_REMOTE_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'
const POSTHOG_ASSETS_HOST = POSTHOG_REMOTE_HOST.replace(
  '://us.i.',
  '://us-assets.i.',
)

/** @type {import('next').NextConfig} */
const nextConfig = {
  // PostHog API 使用尾斜杠，避免 Next.js 重定向破坏事件上报
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      {
        source: '/ingest/static/:path*',
        destination: `${POSTHOG_ASSETS_HOST}/static/:path*`,
      },
      {
        source: '/ingest/array/:path*',
        destination: `${POSTHOG_ASSETS_HOST}/array/:path*`,
      },
      {
        source: '/ingest/:path*',
        destination: `${POSTHOG_REMOTE_HOST}/:path*`,
      },
    ]
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: [
    'pdf-parse',
    'word-extractor',
    'tesseract.js',
    '@napi-rs/canvas',
    'pdfjs-dist',
    '@react-pdf/renderer',
  ],
  // 降低开发环境的文件监听压力，避免 macOS 上触发 EMFILE
  webpack(config, { dev }) {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ['**/node_modules/**', '**/.next/**', '**/zip/**'],
      }
    }

    return config
  },
  turbopack: {},
  // pdf-parse / pdfjs worker / 简历字体：确保 serverless 函数能追踪到相关文件
  outputFileTracingIncludes: {
    '/api/parse-document': [
      './node_modules/pdf-parse/dist/**/*',
      './node_modules/pdfjs-dist/legacy/build/**/*',
      './node_modules/@napi-rs/canvas/**/*',
    ],
    '/api/export-pdf': [
      './public/fonts/NotoSansSC-Regular.ttf',
      './public/fonts/NotoSansSC-Bold.ttf',
      './public/fonts/NotoSansSC-Regular.woff',
      './public/fonts/NotoSansSC-Bold.woff',
    ],
  },
}

export default nextConfig
