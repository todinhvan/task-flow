export const RoleCodeValue = {
  Admin: 'ADMIN',
  Manager: 'MANAGER',
  Employee: 'EMPLOYEE',
} as const;

export type RoleCodeValueType = (typeof RoleCodeValue)[keyof typeof RoleCodeValue];

export const DefaultBoardListSlug = {
  AssignedManager: 'assigned-manager',
  Todo: 'todo',
  InProgress: 'in-progress',
  Done: 'done',
} as const;
