import { defineConfig } from 'vite'
import path from 'path'
import { readFileSync } from 'fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

const pkg = JSON.parse(readFileSync(path.resolve(__dirname, './package.json'), 'utf-8'))

// `--mode singlefile` (npm run build:single) inlines everything into one
// self-contained dist/index.html for offline / email handoff. The default
// build targets GitHub Pages.
export default defineConfig(({ mode }) => {
  const singlefile = mode === 'singlefile'
  return {
    // Relative base so the same build works under a Pages project sub-path
    // (/Marketingtools/), from file://, and at any other path.
    base: './',
    // Expose the package version to the app for the update check.
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      // Single-file/offline builds must not poll for updates: there is no host
      // to reach, and a file:// fetch can hard-fail in strict viewers.
      __UPDATE_CHECK__: JSON.stringify(!singlefile),
    },
    plugins: [
      // The React and Tailwind plugins are both required for Make, even if
      // Tailwind is not being actively used – do not remove them
      react(),
      tailwindcss(),
      ...(singlefile ? [viteSingleFile()] : []),
    ],
    resolve: {
      alias: {
        // Alias @ to the src directory
        '@': path.resolve(__dirname, './src'),
      },
    },

    // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
    assetsInclude: ['**/*.svg', '**/*.csv'],
  }
})
