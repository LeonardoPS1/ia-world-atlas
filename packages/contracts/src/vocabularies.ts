export const PROJECT_TYPES = [
  'PROJECT',
  'NEWS',
  'LAUNCH',
  'COMPANY',
  'GOVERNMENT',
  'UNIVERSITY',
  'RESEARCH',
  'INFRASTRUCTURE',
  'ROBOTICS',
  'POLICY',
  'INVESTMENT',
  'EDUCATION',
  'APPLICATION',
  'IMPACT',
  'SIGNAL',
  'POSSIBILITY',
] as const;

export const PROJECT_STATUSES = [
  'IDEA',
  'RESEARCH',
  'ANNOUNCED',
  'FUNDED',
  'PILOT',
  'BUILDING',
  'DEPLOYING',
  'ACTIVE',
  'SCALING',
  'COMPLETED',
  'PAUSED',
  'CANCELLED',
] as const;

export const EVIDENCE_LEVELS = [
  'VERIFIED',
  'REPORTED',
  'ANNOUNCED',
  'ANALYSIS',
  'SIGNAL',
  'POSSIBILITY',
] as const;

export const LOCATION_LEVELS = [
  'WORLD',
  'CONTINENT',
  'COUNTRY',
  'REGION',
  'CITY',
  'LOCAL_AREA',
] as const;

export const SOURCE_TYPES = [
  'GOVERNMENT',
  'UNIVERSITY',
  'ORGANIZATION',
  'COMPANY',
  'PAPER',
  'MEDIA',
  'OTHER',
] as const;

export const CONFIDENCE_LEVELS = ['HIGH', 'MEDIUM', 'LOW'] as const;

export const RELATION_TYPES = [
  'PARTNERSHIP',
  'FUNDING',
  'RESEARCH',
  'INFRASTRUCTURE',
  'GOVERNMENT',
  'SUPPLIER',
  'UNIVERSITY',
  'DEPLOYMENT',
  'LOCATION',
  'POLICY',
  'TECHNOLOGY',
  'INVESTMENT',
] as const;

export const IMPACT_CATEGORIES = [
  'ECONOMIC',
  'SOCIAL',
  'EDUCATIONAL',
  'HEALTH',
  'ENVIRONMENTAL',
  'INFRASTRUCTURE',
  'REGULATORY',
  'OTHER',
] as const;

export const RELATION_DIRECTIONS = ['OUTGOING', 'INCOMING'] as const;
export const TIMELINE_SORTS = ['publishedAt', 'name'] as const;
