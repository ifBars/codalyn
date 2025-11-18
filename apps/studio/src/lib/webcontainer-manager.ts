"use client";

import { WebContainer } from "@webcontainer/api";

/**
 * WebContainer Manager for running Vite + React + Tailwind projects in-browser
 */
export class WebContainerManager {
  private static instance: WebContainer | null = null;
  private static bootPromise: Promise<WebContainer> | null = null;

  static async getInstance(): Promise<WebContainer> {
    if (this.instance) {
      return this.instance;
    }

    if (this.bootPromise) {
      return this.bootPromise;
    }

    this.bootPromise = WebContainer.boot();
    this.instance = await this.bootPromise;
    return this.instance;
  }

  /**
   * Initialize a new Vite + React + Tailwind project
   */
  static async initProject(): Promise<{
    container: WebContainer;
    url: string;
  }> {
    const container = await this.getInstance();

    // Mount the project files
    await container.mount({
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
  server: {
    port: 5173,
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
    });

    // Install dependencies
    console.log("Installing dependencies...");
    const installProcess = await container.spawn("npm", ["install"]);

    // Wait for install to complete
    const installExitCode = await installProcess.exit;
    if (installExitCode !== 0) {
      throw new Error("Failed to install dependencies");
    }

    console.log("Starting dev server...");

    // Wait for server to be ready (set up listener first)
    const serverReadyPromise = new Promise<string>((resolve) => {
      container.on("server-ready", (port, url) => {
        console.log(`Server ready on port ${port} at ${url}`);
        resolve(url);
      });
    });

    // Start dev server
    const devProcess = await container.spawn("npm", ["run", "dev"]);

    // Log output
    devProcess.output.pipeTo(
      new WritableStream({
        write(data) {
          console.log("[vite]", data);
        },
      })
    );

    // Wait for the server URL
    const url = await serverReadyPromise;

    return { container, url };
  }

  /**
   * Write a file to the container
   */
  static async writeFile(path: string, content: string): Promise<void> {
    const container = await this.getInstance();
    await container.fs.writeFile(path, content);
  }

  /**
   * Read a file from the container
   */
  static async readFile(path: string): Promise<string> {
    const container = await this.getInstance();
    return await container.fs.readFile(path, "utf-8");
  }

  /**
   * List directory contents
   */
  static async readdir(path: string): Promise<string[]> {
    const container = await this.getInstance();
    const entries = await container.fs.readdir(path, { withFileTypes: true });
    return entries.map((e) => e.name);
  }

  /**
   * Remove a file or directory
   */
  static async rm(path: string, options?: { recursive?: boolean }): Promise<void> {
    const container = await this.getInstance();
    if (options?.recursive) {
      await container.fs.rm(path, { recursive: true, force: true });
    } else {
      await container.fs.rm(path);
    }
  }
}
