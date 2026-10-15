'use strict';
// Opt-in-only command. Never import this from web PHP/JS runtime.
const { createOllamaAdapter } = require('./ollama-client.cjs');

async function main(argv) {
  if (argv.length !== 3 || argv[0] !== '--allow-local-ollama' || argv[1] !== '--model') {
    process.stderr.write('Not started. Usage: node ollama-demo.cjs --allow-local-ollama --model <installed-local-model>\n');
    process.exitCode = 2;
    return;
  }
  try {
    const client = createOllamaAdapter({ enabled: true, model: argv[2] });
    const result = await client.generate({
      synthetic: true,
      prompt: 'Synthetic development fixture only: list three general checks for generic DTC P0300. Do not claim a diagnosis or use customer data.'
    });
    // Explicitly untrusted model output; JSON encoding prevents terminal-control injection.
    process.stdout.write(JSON.stringify(result) + '\n');
  } catch (error) {
    process.stderr.write('Local Ollama experiment failed: ' + (error.code || 'INVALID_CONFIGURATION') + '\n');
    process.exitCode = 1;
  }
}

main(process.argv.slice(2));
