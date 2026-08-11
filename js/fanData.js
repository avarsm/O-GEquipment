/* ===================================================================
   fanData.js: candidate fan/blower library. Same curve-model pattern
   as pumpData.js, using pressure rise (Pa) in place of head (m).
=================================================================== */

const FAN_CANDIDATES = [
  {
    id: "A",
    name: "Candidate A: Standard Centrifugal Fan",
    model: "CF-20",
    bepFlow: 20000,        // m3/hr
    bepPressure: 1200,      // Pa
    peakEfficiency: 0.68,
    minFlowFrac: 0.50,
    maxFlowFrac: 1.30,
    capitalCost: 45000,
  },
  {
    id: "B",
    name: "Candidate B: High-Efficiency Airfoil Fan",
    model: "AF-18",
    bepFlow: 18000,
    bepPressure: 1100,
    peakEfficiency: 0.82,
    minFlowFrac: 0.55,
    maxFlowFrac: 1.30,
    capitalCost: 62000,
  },
  {
    id: "C",
    name: "Candidate C: Economy Axial Fan",
    model: "AX-22",
    bepFlow: 22000,
    bepPressure: 900,
    peakEfficiency: 0.63,
    minFlowFrac: 0.50,
    maxFlowFrac: 1.25,
    capitalCost: 33000,
  },
];

/**
 * Pressure available from the fan curve at a given flow, using the same
 * drooping-parabola shape used for pump head curves.
 */
function fanPressureAtFlow(candidate, flowM3Hr) {
  const P0 = candidate.bepPressure * 1.25; // shutoff pressure
  const k = (P0 - candidate.bepPressure) / Math.pow(candidate.bepFlow, 2);
  return Math.max(P0 - k * Math.pow(flowM3Hr, 2), 0);
}

function fanEfficiencyAtFlow(candidate, flowM3Hr) {
  const ratio = flowM3Hr / candidate.bepFlow;
  const dip = 0.55 * Math.pow(ratio - 1, 2);
  return Math.max(candidate.peakEfficiency * (1 - dip), 0.05);
}

function fanOperableRange(candidate) {
  return { min: candidate.bepFlow * candidate.minFlowFrac, max: candidate.bepFlow * candidate.maxFlowFrac };
}
