export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  isThinking?: boolean;
}

export interface LeakageCategory {
  category: string;
  estimatedLeakage: number;
  description: string;
  priority: 'High' | 'Medium' | 'Low';
}

export interface Recommendation {
  title: string;
  description: string;
  type: 'AI-Driven' | 'Process' | 'Culture' | 'Software' | 'BIAB';
}

export interface BusinessSnapshot {
  businessType: string;
  annualRevenue: string;
  employeeCount: string;
  customersPerMonth: string;
  avgTransactionValue: string;
  primaryProducts: string;
}

export interface LeadScoringAnalysis {
  currentGap: string;
  recommendedModel: string;
  keySignals: string[];
  potentialConversionIncrease: string;
  implementationStrategy: string;
}

export interface TranscriptItem {
  question: string;
  answer: string;
}

export interface AnalysisResult {
  businessName?: string;
  businessSnapshot?: BusinessSnapshot;
  totalLeakage: number;
  leakageBreakdown: LeakageCategory[];
  topPriorities: string[];
  leadScoringAnalysis?: LeadScoringAnalysis;
  recommendations: {
    leadership: Recommendation[];
    process: Recommendation[];
    marketing: Recommendation[];
    collections: Recommendation[];
  };
  executiveSummary: string;
  transcript?: TranscriptItem[];
}

export enum DiagnosticSection {
  OVERVIEW = 0,
  LEADERSHIP = 1,
  CULTURE = 2,
  PROCESS = 3,
  SALES_MARKETING = 4,
  RETENTION = 5,
  COLLECTIONS = 6,
  COMPLETE = 7
}