import { fileURLToPath } from 'node:url';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

/** Pi owns the connection and its session lifetime; registering does not call Jev. */
export default function jev(pi: ExtensionAPI) {
  // Prime 0.9.8 loads the same package but has no MCP registration API.
  // Do not stop its TUI: skills still load, and Jev uses Prime's native mcp add.
  if (typeof pi.registerMcpServer !== 'function') return;
  pi.registerMcpServer('jev', {
    command: 'node',
    args: [fileURLToPath(new URL('../mcp/jev-server.mjs', import.meta.url))],
    // No cwd: Pi's MCP transport uses the session's project, not this package.
    // A Pi launched from Claude must not accidentally select Claude's project.
    env: { CLAUDE_PROJECT_DIR: '' },
    exposure: 'direct',
  });
}
