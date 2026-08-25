// Snapshots every collection belonging to the legacy sales CMS (the old
// frontendsales app) and the Inventory module, ahead of their removal in the
// Client Management System rebuild. Read-only — deletes nothing. Run
// wipeLegacyCms.js afterwards, once the retention window has passed.
//
// Deliberately reads raw collections via the driver rather than Mongoose
// models: the models are deleted as part of the same rebuild, and this script
// has to keep working after that happens.
require('dotenv').config({ quiet: true });
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const env = require('../src/config/env');

// Mongoose's default pluralised/lowercased collection names for each model
// being removed. Kept as literal strings for the reason above.
const LEGACY_COLLECTIONS = [
  // Sales CRM
  'clients',
  'quotations',
  'quotationtemplates',
  'clientnotes',
  'clientactivitylogs',
  'clientchatmessages',
  'clientdocumentrequests',
  'clientuploadeddocuments',
  'meetings',
  // Content-agency task engine (Task/TaskCycle/Team/StepLibrary)
  'tasks',
  'taskcycles',
  'teams',
  'steplibraries',
  // Inventory
  'inventoryitems',
  'inventorycategories',
  'inventorybookings',
];

// Not removed, but modified by this rebuild (Event.client is repointed from
// Client to TaskClient, and dead notification types are cleaned up), so a
// pre-change snapshot is worth having.
const MODIFIED_COLLECTIONS = ['events', 'notifications'];

// Uploaded files on disk owned by the collections above — backed up by path
// reference only; wipeLegacyCms.js is what actually removes them.
const STORAGE_DIRS = ['quotations', 'client-documents'];

const BACKUP_ROOT = 'C:\\Users\\ashan\\Desktop\\EMS-backups';

async function dumpCollection(db, name, destDir) {
  const exists = await db.listCollections({ name }).hasNext();
  if (!exists) {
    console.log(`  ${name}: (collection does not exist, skipped)`);
    return { name, count: 0, existed: false };
  }

  const docs = await db.collection(name).find({}).toArray();
  fs.writeFileSync(path.join(destDir, `${name}.json`), JSON.stringify(docs, null, 2), 'utf8');
  console.log(`  ${name}: ${docs.length}`);
  return { name, count: docs.length, existed: true };
}

async function main() {
  await mongoose.connect(env.mongodbUri);
  const db = mongoose.connection.db;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const destDir = path.join(BACKUP_ROOT, `legacy-cms-${timestamp}`);
  fs.mkdirSync(destDir, { recursive: true });

  console.log('Backing up legacy CMS collections (to be removed):');
  const removed = [];
  for (const name of LEGACY_COLLECTIONS) {
    removed.push(await dumpCollection(db, name, destDir));
  }

  console.log('Backing up collections being modified (not removed):');
  const modified = [];
  for (const name of MODIFIED_COLLECTIONS) {
    modified.push(await dumpCollection(db, name, destDir));
  }

  const storageRoot = path.join(__dirname, '..', 'storage');
  const storage = STORAGE_DIRS.map((dir) => {
    const full = path.join(storageRoot, dir);
    const present = fs.existsSync(full);
    return { dir, path: full, present, fileCount: present ? fs.readdirSync(full).length : 0 };
  });

  const manifest = {
    createdAt: new Date().toISOString(),
    note:
      'Pre-removal snapshot of the legacy sales CMS + Inventory, taken before the Client Management System rebuild. ' +
      'wipeLegacyCms.js refuses to run until this backup is at least 3 days old.',
    removedCollections: removed,
    modifiedCollections: modified,
    storageDirs: storage,
  };
  fs.writeFileSync(path.join(destDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  console.log('');
  console.log('Storage directories still on disk (removed by wipeLegacyCms.js):');
  storage.forEach((s) => console.log(`  ${s.dir}: ${s.present ? `${s.fileCount} entries` : '(absent)'}`));
  console.log('');
  console.log('Backup written to:', destDir);
  console.log('BACKUP_PATH=' + destDir);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
