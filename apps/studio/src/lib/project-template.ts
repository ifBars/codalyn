import type { FileSystemTree } from "@webcontainer/api";

export type FlatFileMap = Record<string, string>;

const scaffold: FileSystemTree = {
  "package.json": {
    file: {
      contents: JSON.stringify(
        {
          name: "codalyn-app",
          private: true,
          version: "0.0.0",
          type: "module",
          scripts: {
            dev: "vite",
            build: "tsc && vite build",
            preview: "vite preview",
          },
          dependencies: {
            react: "^18.3.1",
            "react-dom": "^18.3.1",
          },
          devDependencies: {
            "@types/react": "^18.3.3",
            "@types/react-dom": "^18.3.0",
            "@vitejs/plugin-react": "^4.3.1",
            autoprefixer: "^10.4.19",
            postcss: "^8.4.38",
            tailwindcss: "^3.4.4",
            typescript: "^5.5.3",
            vite: "^5.3.1",
          },
        },
        null,
        2
      ),
    },
  },
  "index.html": {
    file: {
      contents: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Codalyn App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
    },
  },
  "vite.config.ts": {
    file: {
      contents: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  server: {
    port: 5173,
    host: true, // Allow external connections (needed for WebContainer)
    strictPort: false, // Allow port fallback if 5173 is busy
  },
})`,
    },
  },
  "tailwind.config.js": {
    file: {
      contents: `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}`,
    },
  },
  "postcss.config.js": {
    file: {
      contents: `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`,
    },
  },
  "tsconfig.json": {
    file: {
      contents: JSON.stringify(
        {
          compilerOptions: {
            target: "ES2020",
            useDefineForClassFields: true,
            lib: ["ES2020", "DOM", "DOM.Iterable"],
            module: "ESNext",
            skipLibCheck: true,
            moduleResolution: "bundler",
            allowImportingTsExtensions: true,
            resolveJsonModule: true,
            isolatedModules: true,
            noEmit: true,
            jsx: "react-jsx",
            strict: true,
            noUnusedLocals: true,
            noUnusedParameters: true,
            noFallthroughCasesInSwitch: true,
            paths: {
              "@/*": ["./src/*"],
            },
          },
          include: ["src"],
          references: [{ path: "./tsconfig.node.json" }],
        },
        null,
        2
      ),
    },
  },
  "tsconfig.node.json": {
    file: {
      contents: JSON.stringify(
        {
          compilerOptions: {
            composite: true,
            skipLibCheck: true,
            module: "ESNext",
            moduleResolution: "bundler",
            allowSyntheticDefaultImports: true,
          },
          include: ["vite.config.ts"],
        },
        null,
        2
      ),
    },
  },
  src: {
    directory: {
      "main.tsx": {
        file: {
          contents: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`,
        },
      },
      "App.tsx": {
        file: {
          contents: `import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome to Codalyn
        </h1>
        <p className="text-gray-600 mb-6">
          Start building your app by chatting with the AI. Describe what you want, and watch it come to life!
        </p>
        <div className="space-y-4">
          <button
            onClick={() => setCount(count + 1)}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Count: {count}
          </button>
          <p className="text-sm text-gray-500 text-center">
            Click the button to increment the counter
          </p>
        </div>
      </div>
    </div>
  )
}

export default App`,
        },
      },
      "index.css": {
        file: {
          contents: `@tailwind base;
@tailwind components;
@tailwind utilities;`,
        },
      },
    },
  },
};

const flattenTree = (tree: FileSystemTree, prefix = ""): FlatFileMap => {
  const files: FlatFileMap = {};
  for (const [name, entry] of Object.entries(tree)) {
    const path = prefix ? `${prefix}/${name}` : name;
    if ("file" in entry) {
      if ("contents" in entry.file) {
        files[path] = entry.file.contents as string;
      }
    } else if ("directory" in entry) {
      Object.assign(files, flattenTree(entry.directory, path));
    }
  }
  return files;
};

export const projectTemplateTree = scaffold;
export const defaultProjectFileMap = flattenTree(scaffold);
export const templateRootFiles = Object.keys(defaultProjectFileMap).filter(
  (path) => !path.includes("/")
);

