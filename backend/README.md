# TaskFlow Backend

## Công nghệ sử dụng

- NestJS 11
- TypeScript
- Prisma 7
- PostgreSQL
- JWT
- Swagger
- Cloudinary
- Sharp

## Endpoints chính

### Nhóm Authentication

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

### Nhóm Dashboard

- `GET /dashboard/admin`

### Nhóm User Management

- `GET /users`
- `GET /users/options/employees`
- `GET /users/:id`
- `POST /users`
- `PATCH /users/:id`
- `DELETE /users/:id`

### Nhóm Role Management

- `GET /roles`
- `GET /roles/:id`
- `POST /roles`
- `PATCH /roles/:id`
- `DELETE /roles/:id`

### Nhóm Permission Management

- `GET /permissions`
- `GET /permissions/:id`
- `POST /permissions`
- `PATCH /permissions/:id`
- `DELETE /permissions/:id`

### Nhóm Profile

- `GET /profiles/me`
- `PATCH /profiles/me`

### Nhóm Kanban Board

- `GET /lists`
- `POST /lists`
- `PATCH /lists/reorder`
- `PATCH /lists/:id`
- `DELETE /lists/:id`

### Nhóm Task Management

- `GET /tasks`
- `GET /tasks/:id`
- `POST /tasks`
- `PATCH /tasks/:id`
- `PATCH /tasks/:id/status`
- `PATCH /tasks/:id/dismiss`
- `PATCH /tasks/:id/move`
- `POST /tasks/:id/attachments`
- `DELETE /tasks/:taskId/attachments/:attachmentId`
- `DELETE /tasks/:id`

### Nhóm Realtime

- `GET /realtime/stream`

## Cấu trúc dự án

```text
backend/
|-- prisma/                            # schema và migration database
|   |-- migrations/                    # lịch sử SQL migration đã commit
|   |   |-- 20260527030602_init_db/
|   |   |-- 20260527110000_feature_kanban_auth/
|   |   |-- 20260528011000_task_status_activity_heatmap/
|   |   |-- 20260528104000_task_assignee_dismiss/
|   |   `-- 20260528213000_seed_users_and_permissions/
|   `-- schema.prisma                  # định nghĩa models, enums, relations
|-- src/                               # mã nguồn backend
|   |-- __mocks__/                     # mock dùng cho test
|   |   `-- uuid.ts
|   |-- generated/
|   |   `-- prisma/                    # Prisma client generate, không chỉnh tay
|   |       |-- models/
|   |       |-- browser.ts
|   |       |-- client.ts
|   |       |-- commonInputTypes.ts
|   |       |-- enums.ts
|   |       `-- models.ts
|   |-- modules/                       # các module nghiệp vụ chính
|   |   |-- auth/                      # đăng ký, đăng nhập, refresh token, logout
|   |   |   |-- controllers/
|   |   |   |-- services/
|   |   |   `-- auth.module.ts
|   |   |-- dashboard/                 # dữ liệu dashboard admin
|   |   |   |-- controllers/
|   |   |   |-- services/
|   |   |   `-- dashboard.module.ts
|   |   |-- list/                      # CRUD và reorder board list
|   |   |   |-- controllers/
|   |   |   |-- dto/
|   |   |   |-- services/
|   |   |   `-- list.module.ts
|   |   |-- permission/                # CRUD permission
|   |   |   |-- controllers/
|   |   |   |-- dto/
|   |   |   |-- services/
|   |   |   `-- permission.module.ts
|   |   |-- profile/                   # hồ sơ người dùng hiện tại
|   |   |   |-- controllers/
|   |   |   |-- dto/
|   |   |   |-- services/
|   |   |   `-- profile.module.ts
|   |   |-- realtime/                  # SSE stream và event realtime
|   |   |   |-- controllers/
|   |   |   |-- services/
|   |   |   |-- types/
|   |   |   `-- realtime.module.ts
|   |   |-- role/                      # CRUD role và mapping permissions
|   |   |   |-- controllers/
|   |   |   |-- dto/
|   |   |   |-- services/
|   |   |   `-- role.module.ts
|   |   |-- task/                      # CRUD task, move, status, attachments
|   |   |   |-- controllers/
|   |   |   |-- dto/
|   |   |   |-- services/
|   |   |   `-- task.module.ts
|   |   `-- user/                      # CRUD user và employee options
|   |       |-- controllers/
|   |       |-- dto/
|   |       |-- repositories/
|   |       |-- services/
|   |       `-- user.module.ts
|   |-- shared/                        # phần dùng chung toàn hệ thống
|   |   |-- configurations/            # parse và validate env
|   |   |-- constants/                 # hằng số dùng chung
|   |   |-- decorators/                # custom decorators
|   |   |-- filters/                   # exception filter
|   |   |-- guards/                    # auth, api-key, throttler guards
|   |   |-- interceptors/              # response interceptor
|   |   |-- interfaces/                # interfaces dùng chung
|   |   |-- middlewares/               # request middleware
|   |   |-- providers/                 # prisma, hashing, token, cloudinary...
|   |   |-- types/                     # shared types
|   |   |-- utils/                     # helper functions
|   |   `-- shared.module.ts
|   |-- app.module.ts                  # root module
|   |-- config.ts                      # load cấu hình từ .env
|   `-- main.ts                        # bootstrap Nest app
|-- .env
|-- package.json
|-- prisma.config.ts
`-- tsconfig.json
```

## URL local mặc định

- API: `http://localhost:4000/api/v1`
- Swagger: `http://localhost:4000/docs`

## Yêu cầu môi trường

- Node.js `20.x` trở lên
- pnpm `9.x` trở lên
- Docker Desktop để setup Postgres hoặc đã có connectString của Postgres
- Tài khoản Cloudinary miễn phí để lấy các keys

## Hướng dẫn cài đặt

### 1. Khởi động PostgreSQL - Dùng Docker

```bash
docker compose -f docker-compose.provider.yaml up -d
```

### 2. Cài đặt các dependencies

```bash
cd backend
pnpm install
```

Nếu chưa có `pnpm`:

```bash
npm install -g pnpm
```

### 3. Tạo `backend/.env`

```env
NODE_ENV=development
HOST=localhost
PORT=4000
GLOBAL_PREFIX=api/v1
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/taskflow?schema=public
CLIENT_URL=http://localhost:3000
JWT_AT_SECRET=van_268_jwt_access_token_secret
JWT_AT_EXPIRATION_TIME=30m
JWT_RT_SECRET=van_268_jwt_refresh_token_secret
JWT_RT_EXPIRATION_TIME=1d
API_KEY_SECRET=van_268_api_key_secret
SALT_OR_ROUNDS=10

# Lấy thông tin trên tài khoản Cloudinary để truyền các keys tương ứng vào
CLOUDINARY_CLOUD_NAME=replace_with_your_cloud_name
CLOUDINARY_API_KEY=replace_with_your_api_key
CLOUDINARY_API_SECRET=replace_with_your_api_secret

# Tùy chọn: giới hạn upload, có fallback mặc định
AVATAR_MAX_FILE_SIZE_MB=2                      # tối đa avatar upload (MB)
ATTACHMENT_MAX_FILE_SIZE_MB=10                # tối đa attachment upload (MB)

# Tùy chọn: cấu hình bảo mật, phù hợp local dev
SECURITY_ENABLE_CAPTCHA=false                 # bật/tắt captcha
SECURITY_ENABLE_RATE_LIMIT=true               # bật/tắt rate limit
RECAPTCHA_SITE_KEY=replace_me                 # site key captcha phía client
RECAPTCHA_SECRET_KEY=replace_me               # secret key captcha phía server
RECAPTCHA_EXPECTED_HOSTNAME=localhost         # hostname hợp lệ cho captcha

# Tùy chọn: rate limit mặc định
GLOBAL_RATE_LIMIT_TTL_SECONDS=60              # cửa sổ thời gian global
GLOBAL_RATE_LIMIT_MAX=120                     # số request tối đa global
AUTH_RATE_LIMIT_TTL_SECONDS=60                # cửa sổ thời gian cho auth
AUTH_RATE_LIMIT_MAX=5                         # số request tối đa cho auth
UPLOAD_RATE_LIMIT_TTL_SECONDS=60              # cửa sổ thời gian cho upload
UPLOAD_RATE_LIMIT_MAX=10                      # số request tối đa cho upload
```

### 3.1 Hướng dẫn lấy keys từ Cloudinary

1. Đăng nhập vào Cloudinary Console.
2. Tại Home/Dashboard -> Copy 'Cloud name' và Paste vào `CLOUDINARY_CLOUD_NAME`
3. Tại Home/Dashboard -> Click 'Go to API Keys' hoặc vào `Settings` -> `API Keys`
   3.1. Click 'Generate New API Key' để tạo 1 key mới
   3.2. Copy 'API Key' và Paste vào `CLOUDINARY_API_KEY`
   3.3. Copy 'API Secret' và Paste vào `CLOUDINARY_API_SECRET`

Ví dụ:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Lưu ý:

- `CLOUDINARY_CLOUD_NAME` là định danh product environment của bạn.
- `CLOUDINARY_API_KEY` dùng để nhận diện môi trường khi gọi API hoặc SDK.
- `CLOUDINARY_API_SECRET` là khóa nhạy cảm, chỉ dùng ở backend, không đưa lên frontend và không commit vào git.

### 4. Tạo Prisma client

```bash
pnpm prisma generate
```

### 5. Chạy migrations

```bash
pnpm prisma migrate deploy
```

Migration mới nhất sẽ seed:

- `2 admin`
- `2 manager`
- `10 employee`
- permissions theo toàn bộ endpoint hiện có

### 6. Chạy backend

```bash
pnpm start:dev
```

Kiểm tra nhanh:

- API: `http://localhost:4000/api/v1`
- Swagger: `http://localhost:4000/docs`
