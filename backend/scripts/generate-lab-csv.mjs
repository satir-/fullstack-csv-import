import { createWriteStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const outputDir = path.join(process.cwd(), 'storage', 'lab');

const fixtures = [
  { filename: 'small.csv', rows: 5_000 },
  { filename: 'large.csv', rows: 200_000 },
];

function csvRow(index) {
  const email = `user${index}@example.com`;
  const country = ['PL', 'DE', 'US', 'GB'][index % 4];
  return `${index},"User ${index}",${email},${country},${index % 17},${Date.now()}\n`;
}

async function writeCsv(filePath, rows) {
  await new Promise((resolve, reject) => {
    const stream = createWriteStream(filePath, { encoding: 'utf-8' });
    stream.on('error', reject);
    stream.on('finish', resolve);

    const writeRows = async () => {
      stream.write('id,name,email,country,groupId,ts\n');
      for (let i = 1; i <= rows; i += 1) {
        if (!stream.write(csvRow(i))) {
          await new Promise((drainResolve) => stream.once('drain', drainResolve));
        }
      }
      stream.end();
    };

    writeRows().catch(reject);
  });
}

async function run() {
  await fs.mkdir(outputDir, { recursive: true });

  for (const fixture of fixtures) {
    const filePath = path.join(outputDir, fixture.filename);
    const started = Date.now();
    await writeCsv(filePath, fixture.rows);
    const durationMs = Date.now() - started;
    console.log(
      `Generated ${fixture.filename} (${fixture.rows} rows) in ${durationMs} ms`,
    );
  }
}

run().catch((error) => {
  console.error('Failed to generate lab CSV fixtures:', error);
  process.exit(1);
});
