/**
 * Node register hook: strip types + resolve @/ → project root
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import ts from "typescript"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const abs = path.join(root, specifier.slice(2))
    const candidates = [
      abs,
      `${abs}.ts`,
      `${abs}.tsx`,
      `${abs}.js`,
      `${abs}.mjs`,
      path.join(abs, "index.ts"),
      path.join(abs, "index.tsx"),
      path.join(abs, "index.js"),
    ]
    const found = candidates.find((p) => fs.existsSync(p) && fs.statSync(p).isFile())
    if (!found) {
      throw new Error(`Cannot resolve alias ${specifier}`)
    }
    return {
      shortCircuit: true,
      url: pathToFileURL(found).href,
    }
  }

  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    context.parentURL
  ) {
    const parentDir = path.dirname(fileURLToPath(context.parentURL))
    const abs = path.resolve(parentDir, specifier)
    const candidates = [
      abs,
      `${abs}.ts`,
      `${abs}.tsx`,
      `${abs}.js`,
      path.join(abs, "index.ts"),
      path.join(abs, "index.tsx"),
    ]
    const found = candidates.find((p) => fs.existsSync(p) && fs.statSync(p).isFile())
    if (found && (found.endsWith(".ts") || found.endsWith(".tsx"))) {
      return {
        shortCircuit: true,
        url: pathToFileURL(found).href,
      }
    }
  }

  return nextResolve(specifier, context)
}

export async function load(url, context, nextLoad) {
  if (url.endsWith(".ts") || url.endsWith(".tsx")) {
    const source = fs.readFileSync(fileURLToPath(url), "utf8")
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
      },
      fileName: url,
    })
    return {
      format: "module",
      shortCircuit: true,
      source: outputText,
    }
  }
  return nextLoad(url, context)
}
