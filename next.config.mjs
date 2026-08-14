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
  // pdf-parse / pdfjs worker / 简历字体：确保 serverless 函数能追踪到相关文件
  outputFileTracingIncludes: {
    '/api/parse-document': [
      './node_modules/pdf-parse/dist/**/*',
      './node_modules/pdfjs-dist/legacy/build/**/*',
      './node_modules/@napi-rs/canvas/**/*',
    ],
    '/api/export-pdf': [
      './public/fonts/NotoSansSC-Regular.woff',
      './public/fonts/NotoSansSC-Bold.woff',
    ],
  },
}

export default nextConfig
