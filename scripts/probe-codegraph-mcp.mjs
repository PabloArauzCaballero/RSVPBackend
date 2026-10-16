import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const root = process.cwd();
const config = JSON.parse(readFileSync(join(root, '.mcp.json'), 'utf8')).mcpServers.codegraph;
const expectedVersion = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).devDependencies['@colbymchenry/codegraph'];

await new Promise((resolve, reject) => {
  const child = spawn(config.command, config.args, {
    cwd: root,
    env: { ...process.env, ...config.env },
    windowsHide: true,
  });
  let output = '';
  let errorOutput = '';
  let settled = false;
  const finish = (error) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    child.kill();
    if (error) reject(error);
    else resolve();
  };
  const timeout = setTimeout(() => finish(new Error(`CodeGraph MCP no respondió: ${errorOutput.slice(0, 500)}`)), 15_000);
  child.stdout.on('data', (data) => {
    output += data.toString();
    const lines = output.split('\n');
    output = lines.pop() ?? '';
    for (const line of lines) {
      let message;
      try { message = JSON.parse(line); } catch { continue; }
      if (message.id !== 1) continue;
      if (message.result?.serverInfo?.name !== 'codegraph' || message.result.serverInfo.version !== expectedVersion) {
        finish(new Error(`Respuesta MCP inesperada: ${line}`));
      } else {
        console.log(`CodeGraph MCP ${message.result.serverInfo.version}: initialize OK.`);
        finish();
      }
    }
  });
  child.stderr.on('data', (data) => { errorOutput += data.toString(); });
  child.on('error', finish);
  child.on('exit', (code) => {
    if (!settled) finish(new Error(`CodeGraph MCP terminó antes de responder (${code}): ${errorOutput.slice(0, 500)}`));
  });
  child.stdin.write(JSON.stringify({
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'rsvp-probe', version: '1.0.0' } },
  }) + '\n');
});
