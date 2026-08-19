/** PostHog 反向代理目标：构建时规范化 env，避免 Vercel 上 destination 非法 */
function resolvePostHogRewriteHosts() {
  const fallback = {
    api: "https://us.i.posthog.com",
    assets: "https://us-assets.i.posthog.com",
  }

  const raw = (process.env.NEXT_PUBLIC_POSTHOG_HOST || "").trim()
  if (!raw) return fallback

  const normalized = /^https?:\/\//i.test(raw)
    ? raw
    : `https://${raw.replace(/^\/+/, "")}`

  try {
    const origin = new URL(normalized).origin
    if (!origin.startsWith("http")) return fallback

    let assets = origin
    if (origin.includes("://us.i.")) {
      assets = origin.replace("://us.i.", "://us-assets.i.")
    } else if (origin.includes("://eu.i.")) {
      assets = origin.replace("://eu.i.", "://eu-assets.i.")
    }

    return { api: origin, assets }
  } catch {
    return fallback
  }
}

const { api: POSTHOG_REMOTE_HOST, assets: POSTHOG_ASSETS_HOST } =
  resolvePostHogRewriteHosts()

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
