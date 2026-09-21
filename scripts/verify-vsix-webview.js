#!/usr/bin/env node
/**
 * Verify packaged VSIX contains a rebuilt webview with executor UI markers.
 * Usage: node scripts/verify-vsix-webview.js [path/to/package.vsix]
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const inputPath = path.resolve(rootDir, process.argv[2] ?? 'openspec-workflow-0.2.2.vsix');

const REQUIRED_MARKERS = [
  'openspec-webview-executor-ui-v1',
  'buildExecutorLaunchPresentation',
  'executorLaunchPresentation',
  'data-executor-ui-ready',
  'executorUiLaunchConfig',
];

function fail(message) {
  console.error(`verify-vsix-webview: FAIL — ${message}`);
  process.exit(1);
}

if (!fs.existsSync(inputPath)) {
  fail(`Input not found: ${inputPath}`);
}

let contents;
let label = path.basename(inputPath);
if (inputPath.endsWith('.js')) {
  contents = fs.readFileSync(inputPath, 'utf8');
} else {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'openspec-vsix-'));
  try {
    execSync(`unzip -q -o ${JSON.stringify(inputPath)} -d ${JSON.stringify(tmpDir)}`, { stdio: 'pipe' });
    const webviewJs = path.join(tmpDir, 'extension', 'dist', 'webview', 'index.js');
    if (!fs.existsSync(webviewJs)) {
      fail('extension/dist/webview/index.js missing in VSIX');
    }
    contents = fs.readFileSync(webviewJs, 'utf8');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

try {
  const hits = Object.fromEntries(REQUIRED_MARKERS.map((marker) => [
    marker,
    (contents.match(new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length,
  ]));

  console.log('verify-vsix-webview: marker hits in webview/index.js');
  for (const [marker, count] of Object.entries(hits)) {
    console.log(`  ${marker}: ${count}`);
    if (count === 0) {
      fail(`missing required marker "${marker}" — webview bundle may be stale`);
    }
  }

  console.log(`verify-vsix-webview: PASS (${label})`);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
