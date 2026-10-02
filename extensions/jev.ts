import { fileURLToPath } from 'node:url';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

/** Pi owns the connection and its session lifetime; registering does not call Jev. */
export default function jev(pi: ExtensionAPI) {
  if (typeof pi.registerMcpServer !== 'function') {
    throw new Error('shady2k-skills: automatic Jev registration requires Pi with registerMcpServer '
      + '(verified with @earendil-works/pi-coding-agent 1.0.0). Skills still work. '
      + 'Upgrade Pi or configure the bundled mcp/jev-server.mjs in your harness manually; see docs/pi.md.');
  }
  pi.registerMcpServer('jev', {
    command: 'node',
    args: [fileURLToPath(new URL('../mcp/jev-server.mjs', import.meta.url))],
    // No cwd: Pi's MCP transport uses the session's project, not this package.
    // A Pi launched from Claude must not accidentally select Claude's project.
    env: { CLAUDE_PROJECT_DIR: '' },
    exposure: 'direct',
  });
}
