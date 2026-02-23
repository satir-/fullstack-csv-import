import { promises as fs } from 'node:fs';
import * as path from 'node:path';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const daysArg = args.find((arg) => arg.startsWith('--days='));
const days = daysArg ? Number(daysArg.split('=')[1]) : 7;

if (!Number.isFinite(days) || days <= 0) {
  console.error('Invalid --days value. Use a positive number, e.g. --days=7');
  process.exit(1);
}

const storageRoot = path.join(process.cwd(), 'storage', 'imports');
const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;

let removedFiles = 0;
let removedDirs = 0;

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function cleanupDirectory(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      await cleanupDirectory(entryPath);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const fileStats = await fs.stat(entryPath);
    if (fileStats.mtimeMs >= cutoffMs) {
      continue;
    }

    if (dryRun) {
      console.log(`[dry-run] remove file: ${entryPath}`);
    } else {
      await fs.unlink(entryPath);
    }
    removedFiles += 1;
  }

  const remainingEntries = await fs.readdir(dirPath, { withFileTypes: true });
  if (remainingEntries.length === 0) {
    if (dryRun) {
      console.log(`[dry-run] remove dir: ${dirPath}`);
    } else {
      await fs.rmdir(dirPath);
    }
    removedDirs += 1;
  }
}

async function run() {
  if (!(await pathExists(storageRoot))) {
    console.log(`Storage path not found, nothing to clean: ${storageRoot}`);
    return;
  }

  await cleanupDirectory(storageRoot);

  console.log(
    `Cleanup done (older than ${days} day(s)): removed ${removedFiles} files and ${removedDirs} directories.`,
  );
}

run().catch((error) => {
  console.error('Cleanup failed:', error);
  process.exit(1);
});
