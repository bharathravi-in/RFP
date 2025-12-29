import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    optimizeDeps: {
        include: ['socket.io-client'],
    },
    ssr: {
        noExternal: ['socket.io-client'],
    },
    server: {
        host: '0.0.0.0',
        port: 5173,
        proxy: {
            '/api': {
                // Docker: use 'http://autorespond-backend:5000'; Local dev: use 'http://localhost:5001'
                target: 'http://autorespond-backend:5000',
                changeOrigin: true,
            },
        },
    },
})

