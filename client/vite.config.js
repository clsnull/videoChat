import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    host: '0.0.0.0', // 配置项目可以局域网访问
    cors: true, // 默认启用并允许任何源
  },
})
