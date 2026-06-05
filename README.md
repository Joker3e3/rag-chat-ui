# rag-chat-ui

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```

## Docker Compose 部署

### 环境变量配置

主要配置前端访问后端服务的地址。

Docker Compose 本地部署时，可在项目根目录创建 `.env`：

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_AGENT_BASE_URL=http://localhost:8001
```

其中：

- `VITE_API_BASE_URL` 指向 Resume RAG Service，默认地址为 `http://localhost:8000`。
- `VITE_AGENT_BASE_URL` 指向 Career Agent API，默认地址为 `http://localhost:8001`。

### 构建与启动

```bash
docker compose up -d --build
```

### 查看服务状态

```bash
docker compose ps
```

### 查看日志

```bash
docker compose logs -f api
docker compose logs -f worker
```

### 初始化数据库

```bash
docker compose exec api uv run python -m database.init_db
```

首次启动执行一次即可。

### 访问地址

Career Agent API：

```text
http://localhost:8001
```

Swagger：

```text
http://localhost:8001/docs
```

### 停止服务

```bash
docker compose down
```

保留数据库数据。

### 删除所有数据

```bash
docker compose down -v
```

会删除 PostgreSQL Volume，需要重新初始化数据库。

### 架构图

```text
Browser
    │
    ▼
Frontend (Vue)
localhost:5173
    │
    ▼
Career Agent API
localhost:8001
    │
    ├── PostgreSQL
    ├── Redis
    └── Celery Worker
            │
            ▼
Resume RAG Service
localhost:8000
```
