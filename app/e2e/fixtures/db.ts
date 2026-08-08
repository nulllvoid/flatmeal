import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Thin wrapper around `supabase db query --linked`, the same tool used
// throughout manual testing this session. Requires the Supabase CLI to be
// authenticated against the linked project (already the case in this
// environment — see CLAUDE.md's Supabase section).
//
// Runs synchronously via execFileSync rather than returning a Promise:
// Playwright test hooks (beforeEach etc.) await fine either way, and
// keeping this synchronous avoids interleaving surprises when multiple
// worker processes shell out concurrently.
export function dbQuery(sql: string): unknown {
  const dir = mkdtempSync(join(tmpdir(), 'flatmeal-e2e-'));
  const file = join(dir, 'query.sql');
  writeFileSync(file, sql, 'utf-8');
  try {
    let out: string;
    try {
      // shell: true is required on Windows — npx resolves to a .cmd file,
      // which execFileSync can't spawn directly without going through a shell.
      out = execFileSync('npx', ['supabase', 'db', 'query', '--linked', '--file', file], {
        encoding: 'utf-8',
        cwd: join(__dirname, '..', '..'),
        maxBuffer: 10 * 1024 * 1024,
        shell: true,
      });
    } catch (err) {
      // The CLI exits non-zero on a SQL error (rather than exiting 0 with
      // an error-shaped JSON body), so execFileSync throws before the
      // _tag === 'Error' branch below ever runs. Surface its stdout/stderr
      // — usually the actual Postgres error message — instead of letting
      // Node's bare "Command failed" propagate with no detail.
      const e = err as { stdout?: string; stderr?: string; message?: string };
      throw new Error(`db query failed (sql: ${sql.slice(0, 200)}): ${e.stdout || e.stderr || e.message}`);
    }
    const parsed = JSON.parse(out);
    if (parsed._tag === 'Error') {
      throw new Error(`db query failed: ${JSON.stringify(parsed.error)}`);
    }
    return parsed.rows ?? [];
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
