import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: './src/cli.ts',
  outDir: './dist',
  target: 'ES2020',
})
