export function canManageEvent(creatorId?: string, userId?: string, role?: string) {
  return role === 'admin' || (!!creatorId && !!userId && creatorId === userId);
}
