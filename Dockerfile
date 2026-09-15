# ---- 依赖层：优先利用缓存 ----
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# ---- 单测 + 生产构建 ----
FROM deps AS build
COPY . .
RUN npm test && npm run build

# ---- web：仅托管静态产物，纯浏览器内运行 ----
FROM nginx:1.27-alpine AS web
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1

# ---- verify：一次性运行 Vitest + 构建 + Playwright ----
FROM mcr.microsoft.com/playwright:v1.48.2-bookworm AS verify
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi \
  && npx playwright install chromium
COPY . .
# Vitest 搜索/回溯 → tsc/vite 构建 → Playwright 重复行证据与失效交互
CMD ["sh", "-c", "npm test && npm run build && npx playwright test"]
