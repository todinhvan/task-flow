# TaskFlow Frontend

## Công nghệ sử dụng

- React 19
- TypeScript
- Vite 8
- Tailwind CSS 4
- React Router 7
- React Hook Form 7
- Zod 4
- Axios
- dnd-kit
- Recharts

## Routes chính

### Nhóm Admin/Manager

- `/manage/dashboard`
- `/manage/users`
- `/manage/tasks`
- `/manage/roles`
- `/manage/permissions`

### Nhóm Employee

- `/board`
- `/profile`

## Cấu trúc dự án

```text
frontend/
|-- public/                            # static files được serve trực tiếp
|-- src/                               # mã nguồn frontend
|   |-- assets/                        # ảnh và asset nội bộ
|   |   |-- hero.png
|   |   |-- react.svg
|   |   `-- vite.svg
|   |-- components/                    # reusable components
|   |   |-- auth/                      # component liên quan đến xác thực
|   |   |   |-- CaptchaField.tsx
|   |   |   `-- ProtectedRoute.tsx
|   |   |-- layout/                    # layout, topbar, sidebar, account menu
|   |   |   |-- AdminLayout.tsx
|   |   |   |-- AdminSidebar.tsx
|   |   |   |-- AdminTopBar.tsx
|   |   |   |-- AuthLayout.tsx
|   |   |   |-- EmployeeLayout.tsx
|   |   |   |-- EmployeeTopBar.tsx
|   |   |   |-- LanguageSwitcher.tsx
|   |   |   |-- NotificationBell.tsx
|   |   |   |-- NotificationToasts.tsx
|   |   |   |-- ThemeToggle.tsx
|   |   |   `-- UserAccountMenu.tsx
|   |   `-- ui/                        # UI primitives dùng xuyên suốt app
|   |       |-- avatar.tsx
|   |       |-- badge.tsx
|   |       |-- button.tsx
|   |       |-- card.tsx
|   |       |-- checkbox.tsx
|   |       |-- confirm-dialog.tsx
|   |       |-- data-table-pagination.tsx
|   |       |-- dialog.tsx
|   |       |-- dropdown-menu.tsx
|   |       |-- input.tsx
|   |       |-- label.tsx
|   |       |-- pagination.tsx
|   |       |-- select.tsx
|   |       `-- table.tsx
|   |-- context/                       # global state và app providers
|   |   |-- AuthContext.tsx            # session, login, logout
|   |   |-- EmployeeBoardContext.tsx   # state dùng chung cho employee board
|   |   |-- I18nContext.tsx            # đa ngôn ngữ EN / VI
|   |   |-- RealtimeContext.tsx        # kết nối SSE realtime
|   |   `-- ThemeContext.tsx           # dark / light mode
|   |-- lib/                           # helper và cấu hình dùng chung
|   |   |-- api.ts                     # Axios client
|   |   |-- display.ts                 # formatter cho status, priority...
|   |   |-- env.ts                     # parse env frontend
|   |   |-- files.ts                   # validate và resize file
|   |   |-- permissions.ts             # permission codes và helper route
|   |   `-- utils.ts
|   |-- pages/                         # các page theo từng workspace
|   |   |-- admin/                     # dashboard, users, tasks, roles, permissions
|   |   |   |-- DashboardPage.tsx
|   |   |   |-- PermissionsPage.tsx
|   |   |   |-- ProfilePage.tsx
|   |   |   |-- RolesPage.tsx
|   |   |   |-- TaskManagementPage.tsx
|   |   |   |-- UserFormPage.tsx
|   |   |   `-- UserManagementPage.tsx
|   |   |-- auth/                      # login và register
|   |   |   |-- LoginPage.tsx
|   |   |   `-- RegisterPage.tsx
|   |   |-- employee/                  # board và profile của employee
|   |   |   |-- BoardPage.tsx
|   |   |   `-- ProfilePage.tsx
|   |   |-- manager/                   # task control và profile của manager
|   |   |   |-- ProfilePage.tsx
|   |   |   `-- TaskControlPage.tsx
|   |   `-- shared/                    # view dùng chung giữa nhiều role
|   |       `-- ProfileSettingsView.tsx
|   |-- types/
|   |   `-- api.ts                     # typings dữ liệu từ backend
|   |-- App.tsx                        # route tree và protected routes
|   |-- index.css                      # theme tokens và global styles
|   `-- main.tsx                       # bootstrap React app
|-- .env
|-- package.json
|-- tsconfig.json
`-- vite.config.ts
```

## URL local mặc định

- `http://localhost:5173`

## Yêu cầu môi trường

- Node.js `20.x` trở lên
- npm `10.x` trở lên
- backend TaskFlow đang chạy

## Hướng dẫn cài đặt

### 1. Đảm bảo backend đã chạy

- Hướng dẫn backend: [`../backend/README.md`](../backend/README.md)
- Kiểm tra nhanh tại: `http://localhost:4000/docs`

### 2. Cài đặt các dependencies

```bash
cd frontend
npm install
```

### 3. Chạy frontend

```bash
npm run dev
```

Mở trình duyệt tại: `http://localhost:5173`

### Tùy chọn. Tạo `frontend/.env`

Frontend vẫn chạy được ngay cả khi không có `.env`, vì đã có fallback local.

Chỉ cần tạo `frontend/.env` khi:

- backend dùng host hoặc port khác
- cần bật captcha để test

Ví dụ:

```env
VITE_API_URL=http://localhost:4000/api/v1     # base URL cho Axios
VITE_ENABLE_CAPTCHA=false                     # bật / tắt captcha UI
```
