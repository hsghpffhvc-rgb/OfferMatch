/** @type {import('next').NextConfig} */
const nextConfig = {
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
  // pdf-parse v2 依赖 pdfjs worker 文件
  outputFileTracingIncludes: {
    '/api/parse-document': ['./node_modules/pdf-parse/dist/**/*'],
  },
}

export default nextConfig
