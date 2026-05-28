import { v4 } from 'uuid';

export const generateRequestId = (prefix?: string) => {
  return prefix ? `${prefix}-${v4()}` : v4();
};
