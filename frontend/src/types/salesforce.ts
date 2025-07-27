export interface LimitData {
  Max: number;
  Remaining: number;
}

export interface OrgLimits {
  [key: string]: LimitData;
}

export interface LimitCardProps {
  title: string;
  data: LimitData;
  category: 'api' | 'storage' | 'email' | 'other';
}