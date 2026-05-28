import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import {
  RealtimeServerEvent,
  RealtimeTaskEvent,
  RealtimeTaskEventType,
  RealtimeTaskSnapshot,
} from '../types/realtime-event.type';

type RealtimeListener = (event: RealtimeServerEvent) => void;

@Injectable()
export class RealtimeService {
  private readonly listeners = new Map<string, Set<RealtimeListener>>();

  subscribe(userId: string, listener: RealtimeListener) {
    const listeners = this.listeners.get(userId) ?? new Set<RealtimeListener>();
    listeners.add(listener);
    this.listeners.set(userId, listeners);

    return () => {
      const current = this.listeners.get(userId);
      if (!current) {
        return;
      }

      current.delete(listener);
      if (current.size === 0) {
        this.listeners.delete(userId);
      }
    };
  }

  emitConnected(userId: string) {
    return {
      id: uuid(),
      type: 'connected',
      occurredAt: new Date().toISOString(),
      userId,
    } as const;
  }

  emitTaskAssigned(userId: string, task: RealtimeTaskSnapshot, actor: { id: string; fullName: string }) {
    this.emitTaskEvent(userId, 'task.assigned', task, actor);
  }

  emitTaskUpdated(userId: string, task: RealtimeTaskSnapshot, actor: { id: string; fullName: string }) {
    this.emitTaskEvent(userId, 'task.updated', task, actor);
  }

  emitTaskDeleted(userId: string, task: RealtimeTaskSnapshot, actor: { id: string; fullName: string }) {
    this.emitTaskEvent(userId, 'task.deleted', task, actor);
  }

  private emitTaskEvent(
    userId: string,
    type: RealtimeTaskEventType,
    task: RealtimeTaskSnapshot,
    actor: { id: string; fullName: string },
  ) {
    const event: RealtimeTaskEvent = {
      id: uuid(),
      type,
      occurredAt: new Date().toISOString(),
      userId,
      actor,
      task: {
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate ? task.dueDate.toISOString() : null,
        source: task.source,
        listId: task.list.id,
        listName: task.list.name,
        assigneeId: task.assignee.id,
        assigneeName: task.assignee.fullName,
      },
    };

    const listeners = this.listeners.get(userId);
    if (!listeners?.size) {
      return;
    }

    for (const listener of listeners) {
      listener(event);
    }
  }
}
