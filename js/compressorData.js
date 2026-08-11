/* ===================================================================
   compressorData.js: candidate compressor library. Mirrors the
   pumpData.js pattern: a best-efficiency point (BEP) plus curve-shape
   parameters, so efficiency and capability respond correctly to
   whatever duty point the user enters instead of being hard-coded.
=================================================================== */

const GASES = {
  natural_gas: { label: "Natural Gas", k: 1.28, molarMass: 18.8 },
  air: { label: "Air", k: 1.40, molarMass: 28.97 },
  associated_gas: { label: "Associated / Wellhead Gas", k: 1.25, molarMass: 22.5 },
  custom: { label: "Custom", k: 1.30, molarMass: 20.0 },
};

const COMPRESSOR_CANDIDATES = [
  {
    id: "A",
    name: "Candidate A: Standard Reciprocating Compressor",
    model: "RC-500",
    bepFlow: 1000,          // m3/hr (actual, inlet conditions)
    maxPressureRatio: 6.0,
    peakEfficiency: 0.75,
    minFlowFrac: 0.50,
    maxFlowFrac: 1.20,
    capitalCost: 260000,
  },
  {
    id: "B",
    name: "Candidate B: High-Efficiency Centrifugal Compressor",
    model: "CC-900",
    bepFlow: 900,
    maxPressureRatio: 3.2,
    peakEfficiency: 0.82,
    minFlowFrac: 0.60,
    maxFlowFrac: 1.30,
    capitalCost: 340000,
  },
  {
    id: "C",
    name: "Candidate C: Economy Rotary Screw Compressor",
    model: "RS-850",
    bepFlow: 850,
    maxPressureRatio: 4.0,
    peakEfficiency: 0.70,
    minFlowFrac: 0.50,
    maxFlowFrac: 1.25,
    capitalCost: 190000,
  },
];

function compressorEfficiencyAtFlow(candidate, flowM3Hr) {
  const ratio = flowM3Hr / candidate.bepFlow;
  const dip = 0.55 * Math.pow(ratio - 1, 2);
  return Math.max(candidate.peakEfficiency * (1 - dip), 0.05);
}

function compressorOperableRange(candidate) {
  return { min: candidate.bepFlow * candidate.minFlowFrac, max: candidate.bepFlow * candidate.maxFlowFrac };
}
