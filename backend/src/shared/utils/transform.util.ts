export function emptyStringToNull(value: unknown) {
  return value === '' ? null : value;
}

export function emptyStringToUndefined(value: unknown) {
  return value === '' ? undefined : value;
}

export function shouldValidateDefined(_object: unknown, value: unknown) {
  return value !== undefined && value !== null;
}
