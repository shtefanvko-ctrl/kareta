'use strict';
// Fixture demonstration only: no LLM invocation and no real vehicle or customer data.
const { createWorkspace } = require('./workspace.cjs');

const diagnostic = createWorkspace('diagnostic');
const verifier = createWorkspace('verifier');
try {
  diagnostic.setTask({ operation: 'explain_dtc', code: 'P0300', synthetic: true });
  verifier.setTask({ operation: 'verify_fixture', expected: 'P0300', synthetic: true });

  // Placeholder results are explicitly identified as fixtures, not AI responses.
  diagnostic.setResult({ status: 'fixture_only', code: diagnostic.getTask().code });
  verifier.setResult({
    status: 'fixture_only',
    matches: diagnostic.getResult().code === verifier.getTask().expected
  });

  process.stdout.write(JSON.stringify({
    mode: 'fixture_only',
    diagnostic: diagnostic.getResult(),
    verifier: verifier.getResult()
  }, null, 2) + '\n');
} finally {
  diagnostic.close();
  verifier.close();
}
