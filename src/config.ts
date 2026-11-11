export const PROD = process.env.NODE_ENV === 'production';
export const MCP_TOKEN = process.env.MCP_TOKEN ?? (PROD ? '' : 'dev-token');
export const SESSION_SECRET = process.env.SESSION_SECRET ?? (PROD ? '' : 'dev-session-secret');
if (!MCP_TOKEN) throw new Error('MCP_TOKEN must be set in production.');
if (!SESSION_SECRET) throw new Error('SESSION_SECRET must be set in production.');

import type { Request } from 'express';
export function baseUrlOf(req: Request): string {
  return process.env.PUBLIC_URL ?? `${req.protocol}://${req.get('host')}`;
}
