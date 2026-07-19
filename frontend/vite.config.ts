import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Base path matches the GitHub Pages repo subpath (https://<user>.github.io/sRdy/).
// Kept at '/' for local dev so `npm run dev` still serves from the root.
export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  base: command === 'build' ? '/sRdy/' : '/',
}))
