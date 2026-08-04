# @pipeworx/entreprises-fr

French companies MCP — wraps `recherche-entreprises.api.gouv.fr`, the French government's meta-API that merges Sirene + INPI + RGE label + association registry. No auth.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

- `search(query, postal_code?, departement?, ape?, employee_range?, page?, per_page?)` — full-text search with structured filters
- `get_enterprise(siren)` — legal unit + all its establishments by SIREN (9 digits)
- `nearby(latitude, longitude, radius_km?, ape?, page?, per_page?)` — establishments within radius of a point

## Data source

`https://recherche-entreprises.api.gouv.fr/` — open, keyless. Maintained by api.gouv.fr.

Coverage: 26M+ legal units + ~30M establishments. Includes director names, latest financial filings, RGE eco-labels, and EU sanctions list cross-references.

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "entreprises-fr": {
      "url": "https://gateway.pipeworx.io/entreprises-fr/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Entreprises Fr data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
