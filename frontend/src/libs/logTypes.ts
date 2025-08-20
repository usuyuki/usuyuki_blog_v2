export const LOG_TYPES = {
  ACCESS: 'access',
  ERROR: 'error', 
  CACHE: 'cache',
  API: 'api',
  COMPONENT: 'component',
  SYSTEM: 'system',
  GENERAL: 'general'
} as const;

export type LogType = typeof LOG_TYPES[keyof typeof LOG_TYPES];