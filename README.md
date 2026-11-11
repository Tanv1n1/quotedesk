# QuoteDesk

Purchase request to winning vendor, driven from Claude through MCP. The app has no AI inside: no AI SDKs, no AI keys, no AI calls. Claude (on the customer's own plan) does the thinking.

## Run locally
    npm install
    # needs Postgres; default is postgres://postgres@localhost:5433/quotedesk, or set DATABASE_URL
    npm run dev          # http://localhost:3000

## Deploy (Railway)
Add a Postgres service, then set these variables on the app service:

| Variable | Value |
|---|---|
| DATABASE_URL | `${{Postgres.DATABASE_URL}}` |
| NODE_ENV | production |
| MCP_TOKEN | a long random string (it is part of the connector link) |
| SESSION_SECRET | a long random string |
| PUBLIC_URL | the app's public https URL, no trailing slash |

Build command `npm run build`, start command `npm start`. Tables and demo data are created on first start.

## Tests
    node scripts/e2e.mjs http://localhost:3000      # both roles, access rules, status rules
    node scripts/mcp-smoke.mjs http://localhost:3000/mcp/dev-token
