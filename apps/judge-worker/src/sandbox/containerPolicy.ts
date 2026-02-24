export const CONTAINER_SECURITY_FLAGS = [
  '--network',
  'none',
  '--read-only',
  '--cap-drop=ALL',
  '--security-opt',
  'no-new-privileges',
  '--pids-limit',
  '64',
  '--tmpfs',
  '/tmp:rw,noexec,nosuid,size=64m'
] as const;
