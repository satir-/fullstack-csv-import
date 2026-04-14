import { promises as fs } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';

const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
const processTimeoutMs = Number(process.env.LAB_PROCESS_TIMEOUT_MS || 600000);
const labDir = path.join(process.cwd(), 'storage', 'lab');

const testCases = [
  { label: 'sync-small', strategy: 'sync', file: 'small.csv' },
  { label: 'sync-large', strategy: 'sync', file: 'large.csv' },
  { label: 'async-small', strategy: 'async', file: 'small.csv' },
  { label: 'async-large', strategy: 'async', file: 'large.csv' },
];

async function createTask() {
  const response = await fetch(`${apiBaseUrl}/imports/tasks`, { method: 'POST' });
  if (!response.ok) {
    throw new Error(`Task creation failed: HTTP ${response.status}`);
  }
  return response.json();
}

async function uploadFile(taskId, filePath, fileName) {
  const fileBuffer = await fs.readFile(filePath);
  const formData = new FormData();
  formData.append('rawData', new Blob([fileBuffer], { type: 'text/csv' }), fileName);

  const response = await fetch(`${apiBaseUrl}/imports/tasks/${taskId}/file`, {
    method: 'PUT',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Upload failed for task ${taskId}: HTTP ${response.status}`);
  }
}

async function processTask(taskId, strategy) {
  const startedAt = Date.now();
  const processUrl = `${apiBaseUrl}/imports/tasks/${taskId}/process?strategy=${strategy}`;
  const response = await postWithoutFetch(processUrl, processTimeoutMs);
  const durationMs = Date.now() - startedAt;

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(
      `Process failed for task ${taskId} (${strategy}): HTTP ${response.statusCode} ${JSON.stringify(response.payload)}`,
    );
  }

  return {
    durationMs,
    payload: response.payload,
  };
}

async function postWithoutFetch(url, timeoutMs) {
  const parsed = new URL(url);
  const client = parsed.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const req = client.request(
      parsed,
      {
        method: 'POST',
        timeout: timeoutMs,
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          let payload = null;
          try {
            payload = raw ? JSON.parse(raw) : null;
          } catch {
            payload = raw || null;
          }

          resolve({
            statusCode: res.statusCode ?? 0,
            payload,
          });
        });
      },
    );

    req.on('timeout', () => {
      req.destroy(new Error(`Request timeout after ${timeoutMs}ms for ${url}`));
    });
    req.on('error', reject);
    req.end();
  });
}

async function runCase(testCase) {
  const filePath = path.join(labDir, testCase.file);
  const task = await createTask();
  await uploadFile(task.id, filePath, testCase.file);
  const processResult = await processTask(task.id, testCase.strategy);

  return {
    case: testCase.label,
    taskId: task.id,
    strategy: testCase.strategy,
    file: testCase.file,
    durationMs: processResult.durationMs,
    imported: processResult.payload?.imported ?? 'n/a',
    status: processResult.payload?.status ?? 'n/a',
  };
}

async function run() {
  const results = [];
  for (const testCase of testCases) {
    const result = await runCase(testCase);
    results.push(result);
    console.log(
      `[${result.case}] task=${result.taskId} duration=${result.durationMs}ms imported=${result.imported}`,
    );
  }

  console.log('\nSummary');
  console.table(results);
}

run().catch((error) => {
  console.error('Benchmark failed:', error);
  process.exit(1);
});
