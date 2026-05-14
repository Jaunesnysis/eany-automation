import { CONFIG } from './config.js';

async function init(accessToken) {
  const res = await fetch(CONFIG.mcpUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'eany-automation', version: '1.0' },
      },
    }),
  });
  const sessionId = res.headers.get('mcp-session-id');
  if (!sessionId) throw new Error('No MCP session ID returned');
  console.log('✅ MCP session established');
  return sessionId;
}

async function call(accessToken, sessionId, tool, args) {
  const res = await fetch(CONFIG.mcpUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'mcp-session-id': sessionId,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name: tool, arguments: args },
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error('MCP error: ' + JSON.stringify(data.error));
  return JSON.parse(data.result?.content?.[0]?.text);
}

export async function getRfsItems(accessToken, rfsId) {
  const sessionId = await init(accessToken);

  console.log(`📋 Fetching RFS ${rfsId}...`);
  const rfs = await call(accessToken, sessionId, 'oms-get-rfs', { reference_number: rfsId });
  console.log(`   Supplier: ${rfs.supplier.company_title}`);
  console.log(`   Status:   ${rfs.status}`);
  console.log(`   Items:    ${rfs.item_count}`);

  const { items } = await call(accessToken, sessionId, 'oms-get-rfs-items', { reference_number: rfsId });
  return items;
}
