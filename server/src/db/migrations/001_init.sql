-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Contracts and versions
CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY,
  contract_name TEXT NOT NULL,
  counterparty TEXT,
  contract_type TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contract_versions (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  version_no INT NOT NULL,
  object_key TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  mime TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(contract_id, version_no)
);

-- Precheck tasks
CREATE TABLE IF NOT EXISTS config_snapshots (
  id TEXT PRIMARY KEY,
  ruleset_version TEXT NOT NULL,
  model_config_json JSONB NOT NULL,
  prompt_template_version TEXT NOT NULL,
  kb_collection_versions_json JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS precheck_tasks (
  id TEXT PRIMARY KEY,
  contract_version_id TEXT NOT NULL REFERENCES contract_versions(id),
  status TEXT NOT NULL DEFAULT 'QUEUED',
  progress INT DEFAULT 0,
  current_stage TEXT DEFAULT 'QUEUED',
  config_snapshot_id TEXT NOT NULL REFERENCES config_snapshots(id),
  cancel_requested BOOLEAN DEFAULT FALSE,
  kb_mode TEXT NOT NULL CHECK (kb_mode IN ('STRICT', 'RELAXED')),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_events (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES precheck_tasks(id) ON DELETE CASCADE,
  ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  stage TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('info', 'warning', 'error')),
  message TEXT NOT NULL,
  meta_json JSONB
);

CREATE INDEX idx_task_events_task_id ON task_events(task_id, ts);

-- Task KB snapshots for versioning
CREATE TABLE IF NOT EXISTS task_kb_snapshots (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES precheck_tasks(id) ON DELETE CASCADE,
  collection_id TEXT NOT NULL,
  collection_version INT NOT NULL,
  frozen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(task_id, collection_id)
);

-- Clauses and risks
CREATE TABLE IF NOT EXISTS clauses (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES precheck_tasks(id) ON DELETE CASCADE,
  clause_id TEXT NOT NULL,
  title TEXT,
  text TEXT NOT NULL,
  page_ref TEXT,
  order_no INT NOT NULL,
  UNIQUE(task_id, clause_id)
);

CREATE INDEX idx_clauses_task_id ON clauses(task_id);

CREATE TABLE IF NOT EXISTS risks (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES precheck_tasks(id) ON DELETE CASCADE,
  clause_id TEXT NOT NULL REFERENCES clauses(id),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('HIGH', 'MEDIUM', 'LOW', 'INFO')),
  risk_type TEXT NOT NULL,
  confidence FLOAT NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  summary TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'NEEDS_REVIEW' CHECK (status IN ('NEEDS_REVIEW', 'CONFIRMED', 'DISMISSED')),
  qc_flags_json JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_risks_task_id ON risks(task_id);
CREATE INDEX idx_risks_clause_id ON risks(clause_id);
CREATE INDEX idx_risks_risk_level ON risks(risk_level);

CREATE TABLE IF NOT EXISTS rule_hits (
  id TEXT PRIMARY KEY,
  risk_id TEXT NOT NULL REFERENCES risks(id) ON DELETE CASCADE,
  rule_id TEXT NOT NULL,
  rule_name TEXT NOT NULL,
  matched_text TEXT,
  meta_json JSONB
);

CREATE TABLE IF NOT EXISTS evidences (
  id TEXT PRIMARY KEY,
  risk_id TEXT NOT NULL REFERENCES risks(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('CONTRACT', 'KB')),
  quote_text TEXT NOT NULL,
  start_offset INT,
  end_offset INT,
  page_ref TEXT,
  chunk_id TEXT
);

CREATE INDEX idx_evidences_risk_id ON evidences(risk_id);

-- KB collections, documents, chunks
CREATE TABLE IF NOT EXISTS kb_collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  scope TEXT NOT NULL CHECK (scope IN ('GLOBAL', 'TENANT', 'PROJECT', 'DEPT')),
  version INT NOT NULL DEFAULT 1,
  is_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS kb_documents (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL REFERENCES kb_collections(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  doc_type TEXT NOT NULL,
  object_key TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_kb_documents_collection_id ON kb_documents(collection_id);

CREATE TABLE IF NOT EXISTS kb_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
  chunk_no INT NOT NULL,
  text TEXT NOT NULL,
  meta_json JSONB DEFAULT '{}',
  UNIQUE(document_id, chunk_no)
);

CREATE INDEX idx_kb_chunks_document_id ON kb_chunks(document_id);

CREATE TABLE IF NOT EXISTS kb_embeddings (
  chunk_id TEXT PRIMARY KEY REFERENCES kb_chunks(id) ON DELETE CASCADE,
  embedding vector(1024)
);

CREATE TABLE IF NOT EXISTS kb_citations (
  id TEXT PRIMARY KEY,
  risk_id TEXT NOT NULL REFERENCES risks(id) ON DELETE CASCADE,
  chunk_id TEXT NOT NULL REFERENCES kb_chunks(id),
  score FLOAT NOT NULL,
  quote_text TEXT NOT NULL,
  doc_version INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_kb_citations_risk_id ON kb_citations(risk_id);
CREATE INDEX idx_kb_citations_chunk_id ON kb_citations(chunk_id);

-- Temp table for KB retrieval results
CREATE TABLE IF NOT EXISTS kb_hits_temp (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES precheck_tasks(id) ON DELETE CASCADE,
  clause_id TEXT NOT NULL REFERENCES clauses(id),
  chunk_id TEXT NOT NULL REFERENCES kb_chunks(id),
  score FLOAT NOT NULL,
  quote_text TEXT NOT NULL,
  doc_title TEXT NOT NULL,
  doc_version INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_kb_hits_temp_task_clause ON kb_hits_temp(task_id, clause_id);

-- Review and audit
CREATE TABLE IF NOT EXISTS suggestions (
  id TEXT PRIMARY KEY,
  risk_id TEXT NOT NULL REFERENCES risks(id) ON DELETE CASCADE,
  suggestion_text TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS suggestion_revisions (
  id TEXT PRIMARY KEY,
  suggestion_id TEXT NOT NULL REFERENCES suggestions(id) ON DELETE CASCADE,
  revision_no INT NOT NULL,
  suggestion_text TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(suggestion_id, revision_no)
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES precheck_tasks(id) ON DELETE CASCADE,
  conclusion TEXT NOT NULL CHECK (conclusion IN ('APPROVE', 'MODIFY', 'ESCALATE')),
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES precheck_tasks(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL,
  template_id TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  object_type TEXT NOT NULL,
  object_id TEXT NOT NULL,
  ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  meta_json JSONB DEFAULT '{}'
);

CREATE INDEX idx_audit_logs_object ON audit_logs(object_type, object_id);
