const PUMP_CANDIDATES = [
  {
    id: "A",
    name: "Candidate A: Standard Centrifugal Pump",
    model: "SC-1100",
    bepFlow: 1100,      // m3/hr
    bepHead: 85,         // m
    peakEfficiency: 0.81,
    minFlowFrac: 0.55,    // operable range as fraction of BEP flow
    maxFlowFrac: 1.30,
    capitalCost: 180000,  // $
  },
  {
    id: "B",
    name: "Candidate B: High-Efficiency Centrifugal Pump",
    model: "HE-1000",
    bepFlow: 1000,
    bepHead: 80,
    peakEfficiency: 0.86,
    minFlowFrac: 0.55,
    maxFlowFrac: 1.30,
    capitalCost: 210000,
  },
  {
    id: "C",
    name: "Candidate C: Economy Centrifugal Pump",
    model: "EC-950",
    bepFlow: 950,
    bepHead: 72,
    peakEfficiency: 0.79,
    minFlowFrac: 0.55,
    maxFlowFrac: 1.25,
    capitalCost: 150000,
  },
];

/**
 * Head available from the pump curve at a given flow.
 * Uses a typical drooping-parabola centrifugal curve shape:
 * shutoff head ~25% above BEP head, falling to zero at ~2x BEP flow.
 * H(Q) = H0 - k*Q^2, fit so H(bepFlow) = bepHead.
 */
function pumpHeadAtFlow(candidate, flowM3Hr) {
  const H0 = candidate.bepHead * 1.25; // shutoff head
  const k = (H0 - candidate.bepHead) / Math.pow(candidate.bepFlow, 2);
  const H = H0 - k * Math.pow(flowM3Hr, 2);
  return Math.max(H, 0);
}

/**
 * Efficiency at a given flow, modelled as a parabolic falloff from
 * the peak efficiency at BEP. Efficiency drops off faster the
 * further the operating point sits from BEP flow.
 */
function pumpEfficiencyAtFlow(candidate, flowM3Hr) {
  const ratio = flowM3Hr / candidate.bepFlow;
  const dip = 0.55 * Math.pow(ratio - 1, 2); // tuning constant
  const eff = candidate.peakEfficiency * (1 - dip);
  return Math.max(eff, 0.05);
}

function pumpOperableRange(candidate) {
  return {
    min: candidate.bepFlow * candidate.minFlowFrac,
    max: candidate.bepFlow * candidate.maxFlowFrac,
  };
}
