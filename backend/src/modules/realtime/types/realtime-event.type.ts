import { TaskPriority, TaskSource, TaskStatus } from '@/generated/prisma/enums';

export type RealtimeTaskEventType = 'task.assigned' | 'task.updated' | 'task.deleted';

export type RealtimeTaskSnapshot = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | null;
  source: TaskSource;
  list: {
    id: string;
    name: string;
  };
  assignee: {
    id: string;
    fullName: string;
  };
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

export type RealtimeConnectedEvent = {
  id: string;
  type: 'connected';
  occurredAt: string;
  userId: string;
};

export type RealtimeServerEvent = RealtimeConnectedEvent | RealtimeTaskEvent;
