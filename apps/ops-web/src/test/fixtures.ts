export function makeApiErrorBody(message: string, code?: string) {
  return code ? { message, code } : { message };
}

export function makeAuthMe(permissions: string[] = []) {
  return { permissions };
}

export function makeBranch(id = 'branch_main') {
  return { id, name: 'Main Branch', slug: 'main' };
}

export function makeSupportKeys(read = 'read-key', write = 'write-key') {
  return { read, write };
}
