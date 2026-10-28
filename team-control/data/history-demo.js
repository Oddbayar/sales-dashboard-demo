// «Багийн хяналт → Гүйцэтгэл»: fixed SAMPLE data for the months before the fixture's month (the fixture has only 2026-10).
// Not computed from any sales; no plan is derived from sales. The page's ⓘ says these are sample values.
//   money: a full past month the page can select — per rep [actual ₮, plan ₮]; its % = actual ÷ plan (floored to 0.1)
//   pct:   older months for the «Өмнөх 3 сар» line only — per rep achievement %
// A month or rep missing here shows «—» (never 0%).
window.TEAM_CONTROL_HISTORY = {
  sample: true,
  money: {
    '2026-09': {
      'SR-D01': [31136000, 32000000],
      'SR-D02': [32802000, 33000000],
      'SR-D03': [17884000, 17000000],
      'SR-D04': [20400000, 24000000],
      'SR-D05': [21528000, 23000000]
    }
  },
  pct: {
    '2026-06': { 'SR-D01': 91.8, 'SR-D02': 95.0, 'SR-D03': 99.1, 'SR-D04': 72.3, 'SR-D05': 100.4 },
    '2026-07': { 'SR-D01': 94.2, 'SR-D02': 88.6, 'SR-D03': 103.8, 'SR-D04': 76.4, 'SR-D05': 97.1 },
    '2026-08': { 'SR-D01': 101.5, 'SR-D02': 92.1, 'SR-D03': 98.7, 'SR-D04': 81.9, 'SR-D05': 89.3 }
  }
};
