-- Disable old runtime bootstrap defaults by replacing them with migration-managed seed data.
-- This migration seeds:
-- 1. Roles
-- 2. Users, profiles, and default board lists
-- 3. Full endpoint permission catalog scanned from controllers
-- 4. Aggregate "manage" permissions used by the frontend
-- 5. Default role-permission mappings

DELETE FROM "users"
WHERE "email" IN (
  'admin@taskflow.local',
  'manager@taskflow.local',
  'employee@taskflow.local'
);

INSERT INTO "roles" (
  "id",
  "code",
  "name",
  "description",
  "isActive",
  "createdAt",
  "updatedAt",
  "deletedAt"
)
VALUES
  ('seed-role-admin', 'ADMIN', 'Administrator', 'Full system access.', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
  ('seed-role-manager', 'MANAGER', 'Manager', 'Can assign and manage employee tasks.', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
  ('seed-role-employee', 'EMPLOYEE', 'Employee', 'Can manage personal tasks and update assigned work.', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL)
ON CONFLICT ("code") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "isActive" = TRUE,
  "deletedAt" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "users" (
  "id",
  "email",
  "password",
  "status",
  "roleId",
  "createdAt",
  "updatedAt",
  "deletedAt"
)
SELECT
  seed."id",
  seed."email",
  '$2b$10$WKx/jx7Wg3lwvjG.U7sL4OLDTujZtOCv6ytK8t15VPzwpdt5XTG6a',
  'ACTIVE'::"UserStatus",
  role_ref."id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  NULL
FROM (
  VALUES
    ('seed-user-admin-01', 'admin@taskflow.local', 'ADMIN'),
    ('seed-user-admin-02', 'nguyen.minh.anh.admin@taskflow.local', 'ADMIN'),
    ('seed-user-admin-03', 'tran.thu.ha.admin@taskflow.local', 'ADMIN'),
    ('seed-user-manager-01', 'manager@taskflow.local', 'MANAGER'),
    ('seed-user-manager-02', 'le.quoc.bao.manager@taskflow.local', 'MANAGER'),
    ('seed-user-manager-03', 'pham.hoang.long.manager@taskflow.local', 'MANAGER'),
    ('seed-user-employee-01', 'employee@taskflow.local', 'EMPLOYEE'),
    ('seed-user-employee-02', 'nguyen.thi.lan@taskflow.local', 'EMPLOYEE'),
    ('seed-user-employee-03', 'tran.minh.khoa@taskflow.local', 'EMPLOYEE'),
    ('seed-user-employee-04', 'le.thao.nguyen@taskflow.local', 'EMPLOYEE'),
    ('seed-user-employee-05', 'pham.duc.anh@taskflow.local', 'EMPLOYEE'),
    ('seed-user-employee-06', 'vo.nhat.huy@taskflow.local', 'EMPLOYEE'),
    ('seed-user-employee-07', 'dang.gia.han@taskflow.local', 'EMPLOYEE'),
    ('seed-user-employee-08', 'bui.khanh.linh@taskflow.local', 'EMPLOYEE'),
    ('seed-user-employee-09', 'hoang.tuan.kiet@taskflow.local', 'EMPLOYEE'),
    ('seed-user-employee-10', 'nguyen.phuong.uyen@taskflow.local', 'EMPLOYEE')
) AS seed("id", "email", "roleCode")
JOIN "roles" role_ref
  ON role_ref."code" = seed."roleCode"::"RoleCode"
ON CONFLICT ("email") DO UPDATE
SET
  "password" = EXCLUDED."password",
  "status" = EXCLUDED."status",
  "roleId" = EXCLUDED."roleId",
  "deletedAt" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "user_profiles" (
  "id",
  "userId",
  "fullName",
  "phoneNumber",
  "jobTitle",
  "department",
  "bio",
  "location",
  "dateOfBirth",
  "createdAt",
  "updatedAt"
)
SELECT
  seed."profileId",
  user_ref."id",
  seed."fullName",
  seed."phoneNumber",
  seed."jobTitle",
  seed."department",
  seed."bio",
  seed."location",
  seed."dateOfBirth"::timestamp,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  VALUES
    ('seed-profile-admin-01', 'nguyen.minh.anh.admin@taskflow.local', 'Nguyễn Minh Anh', '0901000001', 'Quản trị hệ thống', 'Ban điều hành', 'Phụ trách vận hành tổng thể hệ thống TaskFlow.', 'Hà Nội', '1990-03-12'),
    ('seed-profile-admin-02', 'tran.thu.ha.admin@taskflow.local', 'Trần Thu Hà', '0901000002', 'Giám đốc vận hành', 'Ban điều hành', 'Theo dõi chất lượng vận hành và bảo mật nội bộ.', 'TP. Hồ Chí Minh', '1991-08-21'),
    ('seed-profile-manager-01', 'le.quoc.bao.manager@taskflow.local', 'Lê Quốc Bảo', '0902000001', 'Quản lý dự án', 'PMO', 'Điều phối backlog và phân công công việc cho đội nhóm.', 'Đà Nẵng', '1992-01-15'),
    ('seed-profile-manager-02', 'pham.hoang.long.manager@taskflow.local', 'Phạm Hoàng Long', '0902000002', 'Trưởng nhóm vận hành', 'Operations', 'Giám sát tiến độ và hỗ trợ xử lý vướng mắc công việc.', 'Cần Thơ', '1993-11-04'),
    ('seed-profile-employee-01', 'nguyen.thi.lan@taskflow.local', 'Nguyễn Thị Lan', '0903000001', 'Nhân viên kinh doanh', 'Sales', 'Phụ trách theo dõi khách hàng khu vực miền Bắc.', 'Hà Nội', '1997-05-14'),
    ('seed-profile-employee-02', 'tran.minh.khoa@taskflow.local', 'Trần Minh Khoa', '0903000002', 'Nhân viên sản phẩm', 'Product', 'Hỗ trợ đặc tả tính năng và kiểm thử nghiệp vụ.', 'TP. Hồ Chí Minh', '1996-09-30'),
    ('seed-profile-employee-03', 'le.thao.nguyen@taskflow.local', 'Lê Thảo Nguyên', '0903000003', 'Nhân viên marketing', 'Marketing', 'Theo dõi campaign và nội dung truyền thông.', 'Huế', '1998-02-08'),
    ('seed-profile-employee-04', 'pham.duc.anh@taskflow.local', 'Phạm Đức Anh', '0903000004', 'Nhân viên kỹ thuật', 'Engineering', 'Hỗ trợ triển khai và xử lý lỗi nội bộ.', 'Hải Phòng', '1995-12-19'),
    ('seed-profile-employee-05', 'vo.nhat.huy@taskflow.local', 'Võ Nhật Huy', '0903000005', 'Nhân viên hỗ trợ khách hàng', 'Support', 'Xử lý ticket và phản hồi khách hàng.', 'Đà Nẵng', '1998-06-03'),
    ('seed-profile-employee-06', 'dang.gia.han@taskflow.local', 'Đặng Gia Hân', '0903000006', 'Nhân viên nhân sự', 'HR', 'Quản lý hồ sơ nhân sự và lịch onboarding.', 'Bình Dương', '1999-04-27'),
    ('seed-profile-employee-07', 'bui.khanh.linh@taskflow.local', 'Bùi Khánh Linh', '0903000007', 'Nhân viên tài chính', 'Finance', 'Theo dõi chi phí dự án và đối soát nội bộ.', 'Nha Trang', '1997-10-11'),
    ('seed-profile-employee-08', 'hoang.tuan.kiet@taskflow.local', 'Hoàng Tuấn Kiệt', '0903000008', 'Nhân viên QA', 'Quality Assurance', 'Kiểm tra regression và theo dõi lỗi phát hành.', 'Vũng Tàu', '1996-07-22'),
    ('seed-profile-employee-09', 'nguyen.phuong.uyen@taskflow.local', 'Nguyễn Phương Uyên', '0903000009', 'Nhân viên vận hành', 'Operations', 'Theo dõi checklist vận hành hằng ngày.', 'Cần Thơ', '1998-01-09'),
    ('seed-profile-employee-10', 'truong.hai.nam@taskflow.local', 'Trương Hải Nam', '0903000010', 'Nhân viên phân tích dữ liệu', 'Analytics', 'Tổng hợp báo cáo và phân tích số liệu kinh doanh.', 'Quảng Ninh', '1995-03-17')
) AS seed("profileId", "email", "fullName", "phoneNumber", "jobTitle", "department", "bio", "location", "dateOfBirth")
JOIN "users" user_ref
  ON user_ref."email" = seed."email"
ON CONFLICT ("userId") DO UPDATE
SET
  "fullName" = EXCLUDED."fullName",
  "phoneNumber" = EXCLUDED."phoneNumber",
  "jobTitle" = EXCLUDED."jobTitle",
  "department" = EXCLUDED."department",
  "bio" = EXCLUDED."bio",
  "location" = EXCLUDED."location",
  "dateOfBirth" = EXCLUDED."dateOfBirth",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "board_lists" (
  "id",
  "ownerId",
  "name",
  "slug",
  "description",
  "color",
  "position",
  "kind",
  "isFixed",
  "createdAt",
  "updatedAt",
  "deletedAt"
)
SELECT
  seed_user."userId" || '-list-' || seed_list."slug",
  user_ref."id",
  seed_list."name",
  seed_list."slug",
  NULL,
  seed_list."color",
  seed_list."position",
  seed_list."kind"::"ListKind",
  seed_list."isFixed",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  NULL
FROM (
  VALUES
    ('seed-user-admin-01', 'nguyen.minh.anh.admin@taskflow.local'),
    ('seed-user-admin-02', 'tran.thu.ha.admin@taskflow.local'),
    ('seed-user-manager-01', 'le.quoc.bao.manager@taskflow.local'),
    ('seed-user-manager-02', 'pham.hoang.long.manager@taskflow.local'),
    ('seed-user-employee-01', 'nguyen.thi.lan@taskflow.local'),
    ('seed-user-employee-02', 'tran.minh.khoa@taskflow.local'),
    ('seed-user-employee-03', 'le.thao.nguyen@taskflow.local'),
    ('seed-user-employee-04', 'pham.duc.anh@taskflow.local'),
    ('seed-user-employee-05', 'vo.nhat.huy@taskflow.local'),
    ('seed-user-employee-06', 'dang.gia.han@taskflow.local'),
    ('seed-user-employee-07', 'bui.khanh.linh@taskflow.local'),
    ('seed-user-employee-08', 'hoang.tuan.kiet@taskflow.local'),
    ('seed-user-employee-09', 'nguyen.phuong.uyen@taskflow.local'),
    ('seed-user-employee-10', 'truong.hai.nam@taskflow.local')
) AS seed_user("userId", "email")
JOIN "users" user_ref
  ON user_ref."email" = seed_user."email"
CROSS JOIN (
  VALUES
    ('Assigned by Manager', 'assigned-manager', 0, 'SYSTEM_ASSIGNED', TRUE, '#00b4d8'),
    ('To Do', 'todo', 1, 'CUSTOM', FALSE, '#94a3b8'),
    ('In Progress', 'in-progress', 2, 'CUSTOM', FALSE, '#0ea5e9'),
    ('Done', 'done', 3, 'CUSTOM', FALSE, '#22c55e')
) AS seed_list("name", "slug", "position", "kind", "isFixed", "color")
ON CONFLICT ("ownerId", "slug") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "color" = EXCLUDED."color",
  "position" = EXCLUDED."position",
  "kind" = EXCLUDED."kind",
  "isFixed" = EXCLUDED."isFixed",
  "deletedAt" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "permissions" (
  "id",
  "code",
  "name",
  "description",
  "path",
  "method",
  "module",
  "createdAt",
  "updatedAt",
  "deletedAt"
)
VALUES
  ('perm-auth-register', 'auth:register', 'Register account', 'Create a new employee account through self-registration.', '/auth/register', 'POST', 'Authentication', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
  ('perm-auth-login', 'auth:login', 'Login', 'Sign in with email and password.', '/auth/login', 'POST', 'Authentication', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
  ('perm-auth-refresh', 'auth:refresh', 'Refresh session', 'Refresh the current authentication tokens.', '/auth/refresh', 'POST', 'Authentication', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
  ('perm-auth-logout', 'auth:logout', 'Logout', 'Terminate the current session.', '/auth/logout', 'POST', 'Authentication', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
  ('perm-auth-me', 'auth:me', 'View current session', 'Read the authenticated user session payload.', '/auth/me', 'GET', 'Authentication', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),

  ('perm-dashboard-read', 'dashboard:read', 'View Admin Dashboard', 'Access system-wide dashboard analytics.', '/dashboard/admin', 'GET', 'Dashboard', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),

  ('perm-user-list', 'user:list', 'List users', 'View the full user directory.', '/users', 'GET', 'User Management', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
  ('perm-user-employee-options', 'user:employee-options', 'List employee options', 'Load employee options for assignee selectors.', '/users/options/employees', 'GET', 'User Management', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
  ('perm-user-read', 'user:read', 'View user detail', 'Read a specific user record.', '/users/:id', 'GET', 'User Management', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
  ('perm-user-create', 'user:create', 'Create user', 'Create a new user account.', '/users', 'POST', 'User Management', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
  ('perm-user-update', 'user:update', 'Update user', 'Update an existing user account.', '/users/:id', 'PATCH', 'User Management', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
  ('perm-user-delete', 'user:delete', 'Delete user', 'Delete an existing user account.', '/users/:id', 'DELETE', 'User Management', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
  ('perm-user-manage', 'user:manage', 'Manage Users', 'Open the user management workspace with add, edit, and delete capabilities.', '/users', 'GET', 'User Management', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),

  ('perm-role-list', 'role:list', 'List roles', 'View the role catalog.', '/roles', 'GET', 'Access Control', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
  ('perm-role-read', 'role:read', 'View role detail', 'Read a specific role definition.', '/roles/:id', 'GET', 'Access Control', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
  ('perm-role-create', 'role:create', 'Create role', 'Create a new role definition.', '/roles', 'POST', 'Access Control', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
  ('perm-role-update', 'role:update', 'Update role', 'Update an existing role definition.', '/roles/:id', 'PATCH', 'Access Control', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
  ('perm-role-delete', 'role:delete', 'Delete role', 'Delete an existing role definition.', '/roles/:id', 'DELETE', 'Access Control', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
  ('perm-role-manage', 'role:manage', 'Manage Roles', 'Open the role management workspace with add, edit, and delete capabilities.', '/roles', 'PATCH', 'Access Control', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),

  ('perm-permission-list', 'permission:list', 'List permissions', 'View the permission catalog.', '/permissions', 'GET', 'Access Control', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
  ('perm-permission-read', 'permission:read', 'View permission detail', 'Read a specific permission definition.', '/permissions/:id', 'GET', 'Access Control', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
  ('perm-permission-create', 'permission:create', 'Create permission', 'Create a new permission definition.', '/permissions', 'POST', 'Access Control', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
  ('perm-permission-update', 'permission:update', 'Update permission', 'Update an existing permission definition.', '/permissions/:id', 'PATCH', 'Access Control', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
  ('perm-permission-delete', 'permission:delete', 'Delete permission', 'Delete an existing permission definition.', '/permissions/:id', 'DELETE', 'Access Control', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
  ('perm-permission-manage', 'permission:manage', 'Manage Permissions', 'Open the permission management workspace with add, edit, and delete capabilities.', '/permissions', 'PATCH', 'Access Control', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),

  ('perm-task-list', 'task:list', 'List tasks', 'View task collections.', '/tasks', 'GET', 'Task Management', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
  ('perm-task-read', 'task:read', 'View task detail', 'Read a specific task.', '/tasks/:id', 'GET', 'Task Management', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
  ('perm-task-create', 'task:create', 'Create task', 'Create a new task.', '/tasks', 'POST', 'Task Management', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
  ('perm-task-update', 'task:update', 'Update task', 'Update task metadata.', '/tasks/:id', 'PATCH', 'Task Management', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
  ('perm-task-status', 'task:status', 'Update task status', 'Change the status of an assigned or personal task.', '/tasks/:id/status', 'PATCH', 'Task Management', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
  ('perm-task-dismiss', 'task:dismiss', 'Dismiss completed assigned task', 'Hide a completed manager-assigned task from the employee board.', '/tasks/:id/dismiss', 'PATCH', 'Task Management', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
  ('perm-task-move', 'task:move', 'Move task', 'Move a task between board lists.', '/tasks/:id/move', 'PATCH', 'Task Management', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
  ('perm-task-attachment-create', 'task:attachment:create', 'Add task attachment', 'Upload attachments to a task.', '/tasks/:id/attachments', 'POST', 'Task Management', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
  ('perm-task-attachment-delete', 'task:attachment:delete', 'Delete task attachment', 'Remove an attachment from a task.', '/tasks/:taskId/attachments/:attachmentId', 'DELETE', 'Task Management', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
  ('perm-task-delete', 'task:delete', 'Delete task', 'Delete an existing task.', '/tasks/:id', 'DELETE', 'Task Management', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
  ('perm-task-assign', 'task:assign', 'Assign Employee Tasks', 'Open the task management workspace with add, edit, and delete capabilities for assigned work.', '/tasks', 'POST', 'Task Management', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),

  ('perm-list-list', 'list:list', 'List board lists', 'View board lists for the current workspace.', '/lists', 'GET', 'Kanban Board', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
  ('perm-list-create', 'list:create', 'Create list', 'Create a new board list.', '/lists', 'POST', 'Kanban Board', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
  ('perm-list-reorder', 'list:reorder', 'Reorder lists', 'Update the ordering of board lists.', '/lists/reorder', 'PATCH', 'Kanban Board', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
  ('perm-list-update', 'list:update', 'Update list', 'Update an existing board list.', '/lists/:id', 'PATCH', 'Kanban Board', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
  ('perm-list-delete', 'list:delete', 'Delete list', 'Delete an existing board list.', '/lists/:id', 'DELETE', 'Kanban Board', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
  ('perm-list-manage', 'list:manage', 'Manage Lists', 'Open the board workspace with create, edit, delete, and reorder capabilities.', '/lists', 'POST', 'Kanban Board', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),

  ('perm-profile-read', 'profile:read', 'View profile', 'Read the current user profile.', '/profiles/me', 'GET', 'Profile', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
  ('perm-profile-update', 'profile:update', 'Update profile', 'Update the current user profile.', '/profiles/me', 'PATCH', 'Profile', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
  ('perm-profile-manage', 'profile:manage', 'Manage Profile', 'Open profile settings with edit capability.', '/profiles/me', 'PATCH', 'Profile', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),

  ('perm-realtime-stream', 'realtime:stream', 'Stream realtime events', 'Connect to the server-sent events realtime stream.', '/realtime/stream', 'GET', 'Realtime', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL)
ON CONFLICT ("code") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "path" = EXCLUDED."path",
  "method" = EXCLUDED."method",
  "module" = EXCLUDED."module",
  "deletedAt" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP;

DELETE FROM "_PermissionToRole"
WHERE "B" IN (
  SELECT "id"
  FROM "roles"
  WHERE "code" IN ('ADMIN', 'MANAGER', 'EMPLOYEE')
);

INSERT INTO "_PermissionToRole" ("A", "B")
SELECT permission_ref."id", role_ref."id"
FROM "permissions" permission_ref
CROSS JOIN "roles" role_ref
WHERE role_ref."code" = 'ADMIN'
  AND permission_ref."deletedAt" IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO "_PermissionToRole" ("A", "B")
SELECT permission_ref."id", role_ref."id"
FROM "permissions" permission_ref
JOIN "roles" role_ref
  ON role_ref."code" = 'MANAGER'
WHERE permission_ref."code" IN (
  'auth:logout',
  'auth:me',
  'realtime:stream',
  'profile:read',
  'profile:update',
  'profile:manage',
  'user:employee-options',
  'task:list',
  'task:read',
  'task:create',
  'task:update',
  'task:status',
  'task:attachment:create',
  'task:attachment:delete',
  'task:delete',
  'task:assign'
)
ON CONFLICT DO NOTHING;

INSERT INTO "_PermissionToRole" ("A", "B")
SELECT permission_ref."id", role_ref."id"
FROM "permissions" permission_ref
JOIN "roles" role_ref
  ON role_ref."code" = 'EMPLOYEE'
WHERE permission_ref."code" IN (
  'auth:logout',
  'auth:me',
  'realtime:stream',
  'profile:read',
  'profile:update',
  'profile:manage',
  'list:list',
  'list:create',
  'list:reorder',
  'list:update',
  'list:delete',
  'list:manage',
  'task:list',
  'task:read',
  'task:create',
  'task:update',
  'task:status',
  'task:dismiss',
  'task:move',
  'task:attachment:create',
  'task:attachment:delete',
  'task:delete'
)
ON CONFLICT DO NOTHING;
