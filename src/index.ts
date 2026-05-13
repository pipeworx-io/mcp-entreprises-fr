interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * French Companies MCP — recherche-entreprises.api.gouv.fr
 *
 * The French government's keyless meta-API. It merges Sirene (INSEE),
 * INPI legal filings, RGE eco-labels, and the association registry into
 * one search index, so a single query returns names, addresses, directors,
 * financials, sector codes, and labels.
 *
 * Auth: none.
 * Docs: https://recherche-entreprises.api.gouv.fr/documentation
 */


const BASE = 'https://recherche-entreprises.api.gouv.fr';

const tools: McpToolExport['tools'] = [
  {
    name: 'search',
    description:
      'Full-text search across French legal units. Matches name, sigle, director names, addresses. Returns SIREN, denomination, establishments, sector code (APE/NAF), and basic financials.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Free-text — name / director / address' },
        postal_code: { type: 'string', description: 'Filter to a 5-digit French postal code' },
        departement: { type: 'string', description: 'Filter to a French département (e.g. "75" Paris, "13" Bouches-du-Rhône)' },
        ape: { type: 'string', description: 'APE/NAF activity code (e.g. "6201Z" software dev)' },
        employee_range: {
          type: 'string',
          description: 'Employee count band: NN | 00 | 01 | 02 | 03 | 11 | 12 | 21 | 22 | 31 | 32 | 41 | 42 | 51 | 52 | 53 (Sirene tranche codes)',
        },
        only_active: { type: 'boolean', description: 'Restrict to currently active units (default true)' },
        per_page: { type: 'number', description: 'Page size, 1-25 (default 10)' },
        page: { type: 'number', description: '1-based page (default 1)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_enterprise',
    description: 'Fetch a single legal unit with all its establishments by SIREN (9 digits).',
    inputSchema: {
      type: 'object',
      properties: {
        siren: { type: 'string', description: '9-digit SIREN identifier' },
      },
      required: ['siren'],
    },
  },
  {
    name: 'nearby',
    description: 'List establishments within a radius of a geo coordinate. Useful for "all businesses near …".',
    inputSchema: {
      type: 'object',
      properties: {
        latitude: { type: 'number', description: 'Latitude (WGS84)' },
        longitude: { type: 'number', description: 'Longitude (WGS84)' },
        radius_km: { type: 'number', description: 'Search radius in km, 0.05-50 (default 1)' },
        ape: { type: 'string', description: 'Filter to a specific APE/NAF code' },
        per_page: { type: 'number', description: 'Page size, 1-25 (default 10)' },
        page: { type: 'number', description: '1-based page (default 1)' },
      },
      required: ['latitude', 'longitude'],
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'search':
      return search(args);
    case 'get_enterprise':
      return getEnterprise(reqStr(args, 'siren', '"552032534"'));
    case 'nearby':
      return nearby(args);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function search(args: Record<string, unknown>) {
  const params = new URLSearchParams({
    q: String(args.query),
    page: String(Math.max(1, (args.page as number) ?? 1)),
    per_page: String(Math.min(25, Math.max(1, (args.per_page as number) ?? 10))),
  });
  if (args.postal_code) params.set('code_postal', String(args.postal_code));
  if (args.departement) params.set('departement', String(args.departement));
  if (args.ape) params.set('activite_principale', String(args.ape));
  if (args.employee_range) params.set('tranche_effectif_salarie', String(args.employee_range));
  if (args.only_active !== false) params.set('etat_administratif', 'A');
  return entreprisesFetch('/search', params);
}

async function getEnterprise(siren: string) {
  if (!/^\d{9}$/.test(siren)) {
    throw new Error('SIREN must be 9 digits.');
  }
  const params = new URLSearchParams({ q: siren, per_page: '1' });
  return entreprisesFetch('/search', params);
}

async function nearby(args: Record<string, unknown>) {
  const lat = reqNum(args, 'latitude', '48.8566');
  const lon = reqNum(args, 'longitude', '2.3522');
  const params = new URLSearchParams({
    lat: String(lat),
    long: String(lon),
    radius: String(Math.min(50, Math.max(0.05, (args.radius_km as number) ?? 1))),
    page: String(Math.max(1, (args.page as number) ?? 1)),
    per_page: String(Math.min(25, Math.max(1, (args.per_page as number) ?? 10))),
  });
  if (args.ape) params.set('activite_principale', String(args.ape));
  return entreprisesFetch('/near_point', params);
}

async function entreprisesFetch(path: string, params: URLSearchParams) {
  const url = `${BASE}${path}${params.toString() ? `?${params}` : ''}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (res.status === 404) throw new Error(`entreprises-fr: not found`);
  if (res.status === 429) throw new Error('entreprises-fr: rate-limit (HTTP 429)');
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`entreprises-fr error: ${res.status} ${t.slice(0, 200)}`);
  }
  return res.json();
}

function reqStr(args: Record<string, unknown>, key: string, example: string): string {
  const v = args[key];
  if (typeof v !== 'string' || !v.trim()) {
    throw new Error(`Required argument "${key}" is missing. Pass a string like ${example}.`);
  }
  return v;
}
function reqNum(args: Record<string, unknown>, key: string, example: string): number {
  const v = args[key];
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error(`Required argument "${key}" must be a number. Example: ${example}.`);
  }
  return v;
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
