/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: [
    "pdf-parse",
    "word-extractor",
    "tesseract.js",
    "@napi-rs/canvas",
    "pdfjs-dist",
    "@react-pdf/renderer",
  ],
  // 降低开发环境的文件监听压力，避免 macOS 上触发 EMFILE
  webpack(config, { dev }) {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ["**/node_modules/**", "**/.next/**", "**/zip/**"],
      }
    }

    return config
  },
  turbopack: {},
  // pdf-parse / pdfjs-dist 会动态 import worker；Serverless 默认追踪不到
  outputFileTracingIncludes: {
    "/api/parse-document": [
      "./node_modules/pdf-parse/dist/**/*",
      "./node_modules/pdfjs-dist/legacy/build/**/*",
      "./node_modules/pdfjs-dist/build/**/*",
    ],
  },
}

export default nextConfig
