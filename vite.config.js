import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: './index.html'
      },
      output: {
        manualChunks: {
          // Vendor libraries
          vendor: ['react', 'react-dom', 'react-router-dom'],
          // AWS SDK
          aws: [
            '@aws-sdk/client-cognito-identity-provider',
            '@aws-sdk/client-dynamodb', 
            '@aws-sdk/lib-dynamodb'
          ],
          // UI libraries
          ui: ['framer-motion', 'lucide-react', 'clsx']
        }
      }
    },
    // Optimize chunk size
    chunkSizeWarningLimit: 1000
  },
  // Performance optimizations
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom']
  }
})