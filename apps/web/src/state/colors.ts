import type {
  EvidenceIntent,
  EvidenceLevel,
  LocationLevel,
  ProjectStatus,
  ProjectType,
} from '../data/types.ts';

export const STATUS_COLORS: Readonly<Record<ProjectStatus, string>> = {
  IDEA: '#5a6577',
  RESEARCH: '#4f6a86',
  ANNOUNCED: '#4b8cff',
  FUNDED: '#70c8e8',
  PILOT: '#e5a84b',
  BUILDING: '#c8963d',
  DEPLOYING: '#3d7ae8',
  ACTIVE: '#70d6b2',
  SCALING: '#8fd65a',
  COMPLETED: '#a9d66f',
  PAUSED: '#d4943a',
  CANCELLED: '#e47c71',
};

export const EVIDENCE_COLORS: Readonly<Record<EvidenceLevel, string>> = {
  VERIFIED: '#70d6b2',
  REPORTED: '#4b8cff',
  ANNOUNCED: '#5a6577',
  ANALYSIS: '#8a6a4a',
  SIGNAL: '#e47c71',
  POSSIBILITY: '#6b4a7a',
};

/** Declared intent per evidence level. Never derived from the wording of a name. */
export const EVIDENCE_INTENTS: Readonly<Record<EvidenceLevel, EvidenceIntent>> = {
  VERIFIED: 'OBSERVED',
  REPORTED: 'OBSERVED',
  ANNOUNCED: 'EXPECTED',
  ANALYSIS: 'UNCONFIRMED',
  SIGNAL: 'UNCONFIRMED',
  POSSIBILITY: 'UNCONFIRMED',
};

export const TYPE_COLORS: Readonly<Record<ProjectType, string>> = {
  PROJECT: '#4b8cff',
  NEWS: '#9aa3b2',
  LAUNCH: '#70c8e8',
  COMPANY: '#b59aff',
  GOVERNMENT: '#8567ff',
  UNIVERSITY: '#e5a84b',
  RESEARCH: '#70d6b2',
  INFRASTRUCTURE: '#a9d66f',
  ROBOTICS: '#4f6a86',
  POLICY: '#e47c71',
  INVESTMENT: '#5a6577',
  EDUCATION: '#b59aff',
  APPLICATION: '#70c8e8',
  IMPACT: '#a9d66f',
  SIGNAL: '#4f6a86',
  POSSIBILITY: '#4a4f5b',
};

const TYPE_LABELS: Readonly<Record<ProjectType, string>> = {
  PROJECT: 'Proyecto',
  NEWS: 'Noticia',
  LAUNCH: 'Lanzamiento',
  COMPANY: 'Empresa',
  GOVERNMENT: 'Gobierno',
  UNIVERSITY: 'Universidad',
  RESEARCH: 'Investigación',
  INFRASTRUCTURE: 'Infraestructura',
  ROBOTICS: 'Robótica',
  POLICY: 'Política',
  INVESTMENT: 'Inversión',
  EDUCATION: 'Educación',
  APPLICATION: 'Aplicación',
  IMPACT: 'Impacto',
  SIGNAL: 'Señal',
  POSSIBILITY: 'Posibilidad',
};

const STATUS_LABELS: Readonly<Record<ProjectStatus, string>> = {
  IDEA: 'Idea',
  RESEARCH: 'Investigación',
  ANNOUNCED: 'Anunciado',
  FUNDED: 'Financiado',
  PILOT: 'Piloto',
  BUILDING: 'En construcción',
  DEPLOYING: 'En despliegue',
  ACTIVE: 'Activo',
  SCALING: 'Escalando',
  COMPLETED: 'Completado',
  PAUSED: 'Pausado',
  CANCELLED: 'Cancelado',
};

const EVIDENCE_LABELS: Readonly<Record<EvidenceLevel, string>> = {
  VERIFIED: 'Verificado',
  REPORTED: 'Reportado',
  ANNOUNCED: 'Anunciado',
  ANALYSIS: 'Análisis',
  SIGNAL: 'Señal',
  POSSIBILITY: 'Posibilidad',
};

const LEVEL_LABELS: Readonly<Record<LocationLevel, string>> = {
  WORLD: 'Mundo',
  CONTINENT: 'Continente',
  COUNTRY: 'País',
  REGION: 'Región',
  CITY: 'Ciudad',
  LOCAL_AREA: 'Área local',
};

export function statusColor(status: ProjectStatus): string {
  return STATUS_COLORS[status];
}

export function evidenceColor(level: EvidenceLevel): string {
  return EVIDENCE_COLORS[level];
}

export function evidenceIntent(level: EvidenceLevel): EvidenceIntent {
  return EVIDENCE_INTENTS[level];
}

export function typeColor(type: ProjectType): string {
  return TYPE_COLORS[type];
}

export function typeLabel(type: ProjectType): string {
  return TYPE_LABELS[type];
}

export function statusLabel(status: ProjectStatus): string {
  return STATUS_LABELS[status];
}

export function evidenceLabel(level: EvidenceLevel): string {
  return EVIDENCE_LABELS[level];
}

export function levelLabel(level: LocationLevel): string {
  return LEVEL_LABELS[level];
}