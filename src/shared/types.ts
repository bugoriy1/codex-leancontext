export type SymbolKind = 'function' | 'class' | 'interface' | 'type' | 'variable' | 'method';

export interface SymbolInfo {
  name: string;
  kind: SymbolKind;
  startLine: number;
  endLine: number;
  exported: boolean;
}

export interface IndexedFile {
  path: string;
  language: string;
  bytes: number;
  hash: string;
  symbols: SymbolInfo[];
  imports: string[];
  exports: string[];
  isTest: boolean;
}

export interface RepositoryIndex {
  root: string;
  generatedAt: string;
  files: IndexedFile[];
}

export interface ContextPlanItem {
  path: string;
  tier: 'metadata' | 'symbol' | 'full';
  score: number;
  reasons: string[];
  symbols?: string[];
}

export interface ContextPlan {
  task: string;
  confidence: number;
  estimatedTokens: number;
  items: ContextPlanItem[];
}

export interface ContextChunk {
  path: string;
  tier: 'metadata' | 'symbol' | 'full';
  symbols: string[];
  imports: string[];
  exports: string[];
  content?: string;
}

export interface ContextBundle {
  chunks: ContextChunk[];
  estimatedTokens: number;
}

export type ExpansionRelation = 'callers' | 'callees' | 'imports' | 'importers' | 'tests' | 'directory' | 'symbol' | 'file';

export interface ExpansionRequest {
  relation: ExpansionRelation;
  path?: string;
  symbol?: string;
}
