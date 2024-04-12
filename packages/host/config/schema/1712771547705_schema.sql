-- This is auto-generated from packages/realm-server/scripts/convert-to-sqlite.ts
-- Please don't directly modify this file

 CREATE TABLE IF NOT EXISTS indexed_cards (
    card_url TEXT NOT NULL,
   realm_version INTEGER NOT NULL,
   realm_url TEXT NOT NULL,
   pristine_doc JSON,
   search_doc JSON,
   error_doc JSON,
   deps JSON,
   types JSON,
   embedded_html TEXT,
   isolated_html TEXT,
   indexed_at INTEGER,
   is_deleted BOOLEAN,
   PRIMARY KEY ( card_url, realm_version ) 
);

 CREATE TABLE IF NOT EXISTS realm_versions (
    realm_url TEXT NOT NULL,
   current_version INTEGER NOT NULL,
   PRIMARY KEY ( realm_url ) 
);