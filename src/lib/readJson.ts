export async function boundedJson(req: Request, maxBytes = 24000) {
  if (!req.headers.get('content-type')?.includes('application/json')) throw Object.assign(new Error('JSON required'), { status: 415 });
  const reader = req.body?.getReader();
  if (!reader) throw Object.assign(new Error('Missing body'), { status: 400 });
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.length;
    if (size > maxBytes) { await reader.cancel(); throw Object.assign(new Error('Request too large'), { status: 413 }); }
    chunks.push(value);
  }
  const result = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(result)); }
  catch { throw Object.assign(new Error('Invalid JSON'), { status: 400 }); }
}
