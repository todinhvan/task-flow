type Translate = (key: string, params?: Record<string, string | number>) => string;

export function formatUserStatus(status: string, t: Translate) {
  switch (status) {
    case "ACTIVE":
      return t("status.active");
    case "INACTIVE":
      return t("status.inactive");
    case "BLOCKED":
      return t("status.blocked");
    case "IN_PROGRESS":
      return t("status.inProgress");
    case "DONE":
      return t("status.done");
    case "TODO":
      return t("status.todo");
    default:
      return status.replaceAll("_", " ");
  }
}

export function formatTaskPriority(priority: string, t: Translate) {
  switch (priority) {
    case "LOW":
      return t("priority.low");
    case "MEDIUM":
      return t("priority.medium");
    case "HIGH":
      return t("priority.high");
    case "URGENT":
      return t("priority.urgent");
    default:
      return priority;
  }
}
