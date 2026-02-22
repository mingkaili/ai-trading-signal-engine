type SectorDefinition = {
  name: string;
  benchmarkEtf: string;
  symbols: string[];
};

const sectors: SectorDefinition[] = [
  {
    name: 'Semiconductors / AI Hardware',
    benchmarkEtf: 'SMH',
    symbols: [
      'NVDA',
      'AMD',
      'AVGO',
      'ARM',
      'MU',
      'AMAT',
      'LRCX',
      'KLAC',
      'ASML',
      'TSM',
      'ON',
      'MCHP',
      'MPWR',
      'SMCI',
    ],
  },
  {
    name: 'Software Infrastructure / Cloud',
    benchmarkEtf: 'IGV',
    symbols: [
      'MSFT',
      'ORCL',
      'SNOW',
      'MDB',
      'DDOG',
      'NET',
      'TEAM',
      'HUBS',
      'NOW',
      'ADBE',
      'INTU',
      'CRM',
      'U',
      'AI',
    ],
  },
  {
    name: 'Cybersecurity',
    benchmarkEtf: 'CIBR',
    symbols: ['CRWD', 'PANW', 'ZS', 'FTNT', 'S', 'OKTA', 'TENB', 'RPD'],
  },
  {
    name: 'AI / Data Platforms',
    benchmarkEtf: 'IGV',
    symbols: ['PLTR', 'SNOW', 'MDB', 'DDOG', 'AI', 'PATH', 'ESTC'],
  },
  {
    name: 'Internet / Platform Growth',
    benchmarkEtf: 'QQQ',
    symbols: ['AMZN', 'META', 'GOOGL', 'UBER', 'DASH', 'SHOP', 'MELI', 'ABNB', 'ROKU', 'SPOT'],
  },
  {
    name: 'Biotech / High Volatility Growth',
    benchmarkEtf: 'XBI',
    symbols: ['MRNA', 'VRTX', 'REGN', 'CRSP', 'NTLA', 'BEAM', 'RXRX', 'IOVA'],
  },
  {
    name: 'EV / Energy Tech / Robotics',
    benchmarkEtf: 'ARKK',
    symbols: ['TSLA', 'RIVN', 'NIO', 'LI', 'ENPH', 'SEDG', 'QS', 'CHPT'],
  },
];

const macroSymbols = ['SPY', 'QQQ', 'IWM', 'XBI', 'SMH', 'TLT', 'DXY', 'DRIV', 'XLC'];

function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase();
}

export function getUniverseSymbols(): string[] {
  const unique = new Set<string>();
  for (const sector of sectors) {
    unique.add(normalizeSymbol(sector.benchmarkEtf));
    for (const symbol of sector.symbols) {
      unique.add(normalizeSymbol(symbol));
    }
  }
  for (const symbol of macroSymbols) {
    unique.add(normalizeSymbol(symbol));
  }
  return Array.from(unique.values());
}

export function getSectorDefinitions(): SectorDefinition[] {
  return sectors.map((sector) => ({
    name: sector.name,
    benchmarkEtf: normalizeSymbol(sector.benchmarkEtf),
    symbols: sector.symbols.map(normalizeSymbol),
  }));
}

export const __universe_test__ = {
  normalizeSymbol,
  sectors,
  macroSymbols,
};
