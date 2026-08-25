// Permanently drops the legacy sales CMS + Inventory collections that
// backupLegacyCms.js snapshotted, plus their uploaded files on disk.
//
// Refuses to run unless a backup manifest at least RETENTION_DAYS old exists —
// the retention window is the whole safety net here, since this is
// irreversible once the backup is gone. Pass --force to override (don't).
require('dotenv').config({ quiet: true });
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const env = require('../src/config/env');

const RETENTION_DAYS = 3;
const BACKUP_ROOT = 'C:\\Users\\ashan\\Desktop\\EMS-backups';

// Dead notification types belonging to the removed Task/TaskCycle engine —
// their rows would otherwise render as broken entries in the bell.
const DEAD_NOTIFICATION_TYPES = [
  'task_assigned',
  'step_overdue',
  'cycle_ending_soon',
  'cycle_rollover',
];

function findEligibleBackup() {
  if (!fs.existsSync(BACKUP_ROOT)) return null;

  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const candidates = fs
    .readdirSync(BACKUP_ROOT)
    .filter((name) => name.startsWith('legacy-cms-'))
    .map((name) => {
      const manifestPath = path.join(BACKUP_ROOT, name, 'manifest.json');
      if (!fs.existsSync(manifestPath)) return null;
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        return { name, manifest, createdAt: new Date(manifest.createdAt).getTime() };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .filter((entry) => entry.createdAt <= cutoff)
    .sort((a, b) => b.createdAt - a.createdAt);

  return candidates[0] || null;
}

async function main() {
  const force = process.argv.includes('--force');
  const backup = findEligibleBackup();

  if (!backup && !force) {
    console.error(
      `Refusing to wipe: no legacy-cms backup in ${BACKUP_ROOT} is at least ${RETENTION_DAYS} days old.\n` +
        'Run backupLegacyCms.js first, then re-run this once the retention window has passed.'
    );
    process.exit(1);
  }

  console.log(
    backup
      ? `Using backup: ${backup.name} (taken ${backup.manifest.createdAt})`
      : 'WARNING: --force given, proceeding with no eligible backup.'
  );

  await mongoose.connect(env.mongodbUri);
  const db = mongoose.connection.db;

  const collections = backup
    ? backup.manifest.removedCollections.filter((c) => c.existed).map((c) => c.name)
    : [];

  if (!collections.length && !force) {
    console.log('Nothing to drop — the backup recorded no existing collections.');
    await mongoose.disconnect();
    return;
  }

  console.log('Dropping collections:');
  for (const name of collections) {
    const exists = await db.listCollections({ name }).hasNext();
    if (!exists) {
      console.log(`  ${name}: (already gone)`);
      continue;
    }
    await db.collection(name).drop();
    console.log(`  ${name}: dropped`);
  }

  const notifResult = await db
    .collection('notifications')
    .deleteMany({ type: { $in: DEAD_NOTIFICATION_TYPES } });
  console.log(`Deleted ${notifResult.deletedCount} notification(s) of dead legacy types.`);

  const storageRoot = path.join(__dirname, '..', 'storage');
  for (const dir of ['quotations', 'client-documents']) {
    const full = path.join(storageRoot, dir);
    if (fs.existsSync(full)) {
      fs.rmSync(full, { recursive: true, force: true });
      console.log(`Removed storage directory: ${dir}`);
    }
  }

  console.log('Legacy CMS wipe complete.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
