# TaskFlow

TaskFlow là hệ thống quản lý công việc theo vai trò, được xây dựng để tách rõ luồng làm việc giữa `Admin`, `Manager` và `Employee` trong cùng một sản phẩm.

## Mục tiêu sử dụng

TaskFlow hướng đến các nhu cầu chính:

- Quản lý người dùng, vai trò và quyền truy cập
- Giao việc từ manager cho employee
- Theo dõi tiến độ xử lý công việc
- Quản lý board Kanban cá nhân
- Hỗ trợ làm việc với giao diện realtime, đa ngôn ngữ và dark/light mode

## Nhóm người dùng

- `Admin`: quản trị hệ thống, người dùng, roles, permissions và dashboard
- `Manager`: giao task, theo dõi task đã giao và quản lý luồng công việc
- `Employee`: quản lý board cá nhân, cập nhật task được giao và hồ sơ cá nhân

## Công nghệ sử dụng

### Frontend

- React 19
- TypeScript
- Vite
- Tailwind CSS v4
- React Router
- dnd-kit
- Recharts

### Backend

- NestJS 11
- Prisma 7
- PostgreSQL
- JWT Authentication
- Swagger
- Cloudinary

## Cấu trúc repository

```text
task-flow/
|-- backend/
|-- frontend/
```

## Hướng dẫn cài đặt

- [Hướng dẫn cài đặt Backend](./backend/README.md)
- [Hướng dẫn cài đặt Frontend](./frontend/README.md)

## Sử dụng hệ thống

- Admin: admin@taskflow.local - Taskflow@123
- Manager: manager@taskflow.local - Taskflow@123
- Employee: employee@taskflow.local - Taskflow@123
