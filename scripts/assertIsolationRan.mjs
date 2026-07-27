#!/usr/bin/env node
// CI entry point: fails the build unless the isolation gate ran and passed.
// The decision lives in isolationReport.mjs so it can be unit-tested.
import { readFileSync } from 'node:fs';
import { verdictFor } from './isolationReport.mjs';

let report = null;
try {
  report = JSON.parse(readFileSync(process.argv[2], 'utf8'));
} catch {
  // verdictFor turns a null report into a failure with a clear message.
}

const { ok, message } = verdictFor(report);
if (!ok) {
  console.error(`::error::${message}`);
  process.exit(1);
}
console.log(message);
