import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  server: {
    // The shared tech-icon module lives with the other backend static assets
    // (it is also loaded by the Thymeleaf recruiter / admin pages), so the
    // React bundle imports it from ../backend.
    fs: {
      allow: [".."],
    },
    // Proxy all /api/* requests to the Spring Boot backend during development.
    // This avoids CORS issues since the browser sees everything on the same origin.
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
      // Thymeleaf-served candidate pages (resume templates, dashboards)
      '/candidate': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
      // "/recruiter" and "/admin" proxy the backend's Thymeleaf pages
      // (/recruiter, /recruiter/**, /admin, /admin/**). A plain prefix key also
      // matches the SPA routes /recruiter-login, /recruiter-register,
      // /recruiter-forgot-password and /admin-page, which then hit the backend
      // and render blank in dev, so these keys are anchored regexes that
      // reject any path where a hyphen follows the prefix.
      '^/recruiter(?!-)': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
      '/client-admin': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
      '^/admin(?!-)': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
      '/css': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
      '/js': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
      '/images': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
      '/static': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
      '/auth/logout': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
