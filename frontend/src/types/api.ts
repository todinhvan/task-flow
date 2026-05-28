export type RoleCode = "ADMIN" | "MANAGER" | "EMPLOYEE";
export type UserStatus = "ACTIVE" | "INACTIVE" | "BLOCKED";
export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS" | "HEAD";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TaskSource = "SELF_CREATED" | "MANAGER_ASSIGNED";
export type ListKind = "CUSTOM" | "SYSTEM_ASSIGNED";
export type AttachmentKind = "IMAGE" | "FILE";

export type Role = {
  id: string;
  code: RoleCode;
  name: string;
  permissions?: PermissionAccess[];
};

export type PermissionAccess = {
  id: string;
  code: string;
  name: string;
  module: string;
  method: HttpMethod;
  path: string;
};

export type RoleSummary = Role & {
  description: string | null;
  isActive: boolean;
  userCount: number;
  permissions: PermissionAccess[];
  createdAt: string;
  updatedAt: string;
};

export type PermissionSummary = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  path: string;
  method: HttpMethod;
  module: string;
  createdAt: string;
  updatedAt: string;
  roles: Array<{
    id: string;
    code: RoleCode;
    name: string;
    isActive: boolean;
  }>;
};

export type Profile = {
  id: string | null;
  fullName: string;
  phoneNumber: string | null;
  jobTitle: string | null;
  department: string | null;
  bio: string | null;
  location: string | null;
  dateOfBirth: string | null;
  avatarUrl: string | null;
};

export type SessionUser = {
  id: string;
  email: string;
  status: UserStatus;
  role: Role;
  profile: Profile;
  createdAt?: string;
  updatedAt?: string;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string | null;
  user: SessionUser;
};

export type ApiEnvelope<T> = {
  status: number;
  message: string;
  data: T;
  requestId?: string;
  duration?: string;
};

export type ApiErrorEnvelope = {
  status: number;
  message: string;
  error?: unknown;
  requestId?: string;
  duration?: string;
};

export type UserSummary = SessionUser;

export type EmployeeOption = {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  jobTitle: string | null;
};

export type TaskAttachment = {
  id: string;
  taskId: string;
  uploaderId: string;
  kind: AttachmentKind;
  url: string;
  publicId: string;
  resourceType: string;
  originalName: string;
  mimeType: string;
  bytes: number;
  width: number | null;
  height: number | null;
  createdAt: string;
};

export type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  position: number;
  source: TaskSource;
  listId: string;
  isLockedForAssignee: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  list: {
    id: string;
    name: string;
    slug: string;
  };
  assignee: {
    id: string;
    email: string;
    fullName: string;
    avatarUrl: string | null;
    roleCode: RoleCode;
  };
  creator: {
    id: string;
    fullName: string;
  };
  assignedBy: {
    id: string;
    fullName: string;
  } | null;
  attachments: TaskAttachment[];
};

export type BoardList = {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  description: string | null;
  kind: ListKind;
  isFixed: boolean;
  position: number;
  tasks: Task[];
};

export type AdminDashboard = {
  summary: {
    totalUsers: number;
    activeUsers: number;
    blockedUsers: number;
    totalRoles: number;
    totalPermissions: number;
    totalLists: number;
    totalAttachments: number;
    totalTasks: number;
    managerAssignedTasks: number;
    personalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    overdueTasks: number;
    managers: number;
    employees: number;
  };
  tasksByStatus: Array<{
    status: TaskStatus;
    count: number;
  }>;
  roleDistribution: Array<{
    roleCode: RoleCode;
    count: number;
  }>;
  workload: Array<{
    id: string;
    fullName: string;
    assignedCount: number;
    completedCount: number;
    overdueCount: number;
  }>;
  focusHeatmap: {
    maxCount: number;
    timeSlots: Array<{
      hour: number;
      label: string;
    }>;
    rows: Array<{
      dateKey: string;
      label: string;
      cells: Array<{
        hour: number;
        label: string;
        count: number;
        employeeCount: number;
        employees: string[];
        intensity: number;
      }>;
    }>;
  };
  recentTasks: Array<{
    id: string;
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    source: TaskSource;
    dueDate: string | null;
    list: {
      id: string;
      name: string;
    };
    assignee: {
      id: string;
      fullName: string;
    };
    assignedBy: {
      id: string;
      fullName: string;
    } | null;
    createdAt: string;
  }>;
};

export type RealtimeTaskEventType =
  | "task.assigned"
  | "task.updated"
  | "task.deleted";

export type RealtimeConnectedEvent = {
  id: string;
  type: "connected";
  occurredAt: string;
  userId: string;
};

export type RealtimeTaskEvent = {
  id: string;
  type: RealtimeTaskEventType;
  occurredAt: string;
  userId: string;
  actor: {
    id: string;
    fullName: string;
  };
  task: {
    id: string;
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    dueDate: string | null;
    source: TaskSource;
    listId: string;
    listName: string;
    assigneeId: string;
    assigneeName: string;
  };
};

export type RealtimeServerEvent = RealtimeConnectedEvent | RealtimeTaskEvent;

export type RealtimeNotification = {
  id: string;
  isRead: boolean;
  createdAt: string;
  event: RealtimeTaskEvent;
};
