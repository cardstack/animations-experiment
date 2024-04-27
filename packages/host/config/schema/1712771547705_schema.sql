-- This is auto-generated by packages/realm-server/scripts/convert-to-sqlite.ts
-- Please don't directly modify this file

 CREATE TABLE IF NOT EXISTS boxel_index (
   url TEXT NOT NULL,
   type TEXT NOT NULL,
   realm_version INTEGER NOT NULL,
   realm_url TEXT NOT NULL,
   pristine_doc BLOB,
   search_doc BLOB,
   error_doc BLOB,
   deps BLOB,
   types BLOB,
   embedded_html TEXT,
   isolated_html TEXT,
   indexed_at,
   is_deleted BOOLEAN,
   PRIMARY KEY ( url, realm_version ) 
);

 CREATE TABLE IF NOT EXISTS realm_versions (
   realm_url TEXT NOT NULL,
   current_version INTEGER NOT NULL,
   PRIMARY KEY ( realm_url ) 
);