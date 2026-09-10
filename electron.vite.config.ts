import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const alias = {
  '@shared': resolve(__dirname, 'shared'),
  '@': resolve(__dirname, 'src')
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias },
    build: {
      outDir: 'app-build/main',
      rollupOptions: {
        input: { index: resolve(__dirname, 'electron/main/index.ts') }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias },
    build: {
      outDir: 'app-build/preload',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/preload/index.ts'),
          capture: resolve(__dirname, 'electron/preload/capture.ts')
        }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src'),
    resolve: { alias },
    plugins: [react()],
    build: {
      outDir: 'app-build/renderer',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/index.html'),
          capture: resolve(__dirname, 'src/capture.html')
        }
      }
    }
  }
})
