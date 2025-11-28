import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    react: 'src/react/index.tsx',
    'backends/anthropic': 'src/backends/anthropic.ts',
    'backends/openai': 'src/backends/openai.ts',
    'backends/ollama': 'src/backends/ollama.ts',
    'backends/vercel-ai': 'src/backends/vercel-ai.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: ['react', 'react-dom'],
  esbuildOptions(options) {
    options.banner = {
      js: '"use client";',
    };
  },
});
