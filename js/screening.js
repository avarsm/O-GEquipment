/* ===================================================================
   screening.js: runs every candidate for the selected equipment type
   against the required duty point and requirements, scores them, and
   picks a recommendation. Four engines (pump / compressor / fan /
   heat exchanger) follow the same overall shape so the rest of the
   app (charts, sensitivity, report) can treat results uniformly
   wherever possible.
=================================================================== */

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function round1(v) { return Math.round(v * 10) / 10; }

/* ===================================================================
   PUMP ENGINE
=================================================================== */

const PUMP_WEIGHTS = { efficiency: 40, headMargin: 20, flowMatch: 20, powerCompetitiveness: 20 };

function evaluatePumpCandidate(candidate, conditions, requirements) {
  const range = pumpOperableRange(candidate);
  const meetsFlow = conditions.flow >= range.min && conditions.flow <= range.max;

  const availableHead = pumpHeadAtFlow(candidate, conditions.flow);
  const meetsHead = availableHead >= conditions.head * 0.98;

  const efficiency = pumpEfficiencyAtFlow(candidate, conditions.flow);
  const meetsMinEff = efficiency * 100 >= requirements.minEfficiency;

  const hydraulicKW = hydraulicPowerKW(conditions.density, conditions.flow, conditions.head);
  const powerKW = pumpPowerKW(hydraulicKW, efficiency);
  const meetsMaxPower = powerKW <= requirements.maxPower;

  const energyKWh = annualEnergyKWh(powerKW, conditions.hours);
  const costPerYear = annualCost(energyKWh, conditions.price);
  const lcc20 = lifecycleCost(candidate.capitalCost, costPerYear, requirements.life);
  const qualifies = meetsFlow && meetsHead && meetsMinEff && meetsMaxPower;
  const headMarginPct = ((availableHead - conditions.head) / conditions.head) * 100;

  return {
    id: candidate.id, name: candidate.name, model: candidate.model, capitalCost: candidate.capitalCost,
    flowRequired: conditions.flow, headRequired: conditions.head, availableHead, headMarginPct,
    efficiency, hydraulicKW, powerKW, energyKWh, costPerYear, lcc20,
    meetsFlow, meetsHead, meetsMinEff, meetsMaxPower, qualifies, score: 0,
  };
}

function scorePumpCandidates(evals) {
  const maxPeakEff = Math.max(...PUMP_CANDIDATES.map((c) => c.peakEfficiency));
  const minPower = Math.min(...evals.map((e) => e.powerKW));
  evals.forEach((e) => {
    const effScore = clamp((e.efficiency / maxPeakEff) * PUMP_WEIGHTS.efficiency, 0, PUMP_WEIGHTS.efficiency);
    let headScore = 0;
    if (e.meetsHead) {
      const penalty = Math.max(0, e.headMarginPct - 5) * 0.5;
      headScore = clamp(PUMP_WEIGHTS.headMargin - penalty, 0, PUMP_WEIGHTS.headMargin);
    }
    const cand = PUMP_CANDIDATES.find((c) => c.id === e.id);
    const flowDev = Math.abs(e.flowRequired - cand.bepFlow) / cand.bepFlow;
    const flowScore = clamp(PUMP_WEIGHTS.flowMatch * (1 - flowDev * 1.5), 0, PUMP_WEIGHTS.flowMatch);
    const powerScore = clamp((minPower / e.powerKW) * PUMP_WEIGHTS.powerCompetitiveness, 0, PUMP_WEIGHTS.powerCompetitiveness);

    e.scoreBreakdown = { "Efficiency": round1(effScore), "Head margin": round1(headScore), "Flow match": round1(flowScore), "Power competitiveness": round1(powerScore) };
    e.score = round1(effScore + headScore + flowScore + powerScore);
    if (!e.qualifies) e.score = round1(e.score * 0.5);
  });
  return evals;
}

function runPumpScreening(state) {
  const conditions = { ...state.conditions.pump, hours: state.process.hours, price: state.process.price };
  const requirements = state.requirements.pump;
  const baseline = state.baseline.pump;

  let evals = PUMP_CANDIDATES.map((c) => evaluatePumpCandidate(c, conditions, requirements));
  evals = scorePumpCandidates(evals);

  const qualifying = evals.filter((e) => e.qualifies);
  const pool = qualifying.length ? qualifying : evals;
  const recommended = pool.reduce((best, e) => (e.score > best.score ? e : best), pool[0]);

  const baseHydraulicKW = hydraulicPowerKW(conditions.density, conditions.flow, conditions.head);
  const basePowerKW = pumpPowerKW(baseHydraulicKW, baseline.efficiency / 100);
  const baseEnergyKWh = annualEnergyKWh(basePowerKW, conditions.hours);
  const baseCostPerYear = annualCost(baseEnergyKWh, conditions.price);

  const pipeline = pipelineCheck(conditions.density, conditions.viscosity, conditions.flow, 1000);

  return finishResults(state, "pump", evals, recommended.id, {
    label: `Existing pump @ ${baseline.efficiency}% efficiency`,
    powerKW: basePowerKW, energyKWh: baseEnergyKWh, costPerYear: baseCostPerYear,
  }, { pipeline }, qualifying.length > 0);
}

/* ===================================================================
   COMPRESSOR ENGINE
=================================================================== */

const COMPRESSOR_WEIGHTS = { efficiency: 40, pressureMargin: 20, flowMatch: 20, powerCompetitiveness: 20 };

function evaluateCompressorCandidate(candidate, conditions, requirements) {
  const range = compressorOperableRange(candidate);
  const meetsFlow = conditions.flow >= range.min && conditions.flow <= range.max;

  const pressureRatio = conditions.p2 / conditions.p1;
  const meetsPressureRatio = pressureRatio <= candidate.maxPressureRatio;

  const efficiency = compressorEfficiencyAtFlow(candidate, conditions.flow);
  const meetsMinEff = efficiency * 100 >= requirements.minEfficiency;

  const isentropicKW = isentropicCompressionPowerKW(conditions.flow, conditions.p1, conditions.p2, conditions.t1, conditions.k, conditions.molarMass);
  const powerKW = isentropicKW / efficiency;
  const meetsMaxPower = powerKW <= requirements.maxPower;

  const energyKWh = annualEnergyKWh(powerKW, conditions.hours);
  const costPerYear = annualCost(energyKWh, conditions.price);
  const lcc20 = lifecycleCost(candidate.capitalCost, costPerYear, requirements.life);
  const qualifies = meetsFlow && meetsPressureRatio && meetsMinEff && meetsMaxPower;
  const pressureMarginPct = ((candidate.maxPressureRatio - pressureRatio) / pressureRatio) * 100;

  return {
    id: candidate.id, name: candidate.name, model: candidate.model, capitalCost: candidate.capitalCost,
    flowRequired: conditions.flow, pressureRatio, maxPressureRatio: candidate.maxPressureRatio, pressureMarginPct,
    efficiency, isentropicKW, powerKW, energyKWh, costPerYear, lcc20,
    meetsFlow, meetsPressureRatio, meetsMinEff, meetsMaxPower, qualifies, score: 0,
  };
}

function scoreCompressorCandidates(evals) {
  const maxPeakEff = Math.max(...COMPRESSOR_CANDIDATES.map((c) => c.peakEfficiency));
  const minPower = Math.min(...evals.map((e) => e.powerKW));
  evals.forEach((e) => {
    const effScore = clamp((e.efficiency / maxPeakEff) * COMPRESSOR_WEIGHTS.efficiency, 0, COMPRESSOR_WEIGHTS.efficiency);
    const pressureScore = e.meetsPressureRatio
      ? clamp(COMPRESSOR_WEIGHTS.pressureMargin * clamp(e.pressureMarginPct / 40, 0, 1), 0, COMPRESSOR_WEIGHTS.pressureMargin)
      : 0;
    const cand = COMPRESSOR_CANDIDATES.find((c) => c.id === e.id);
    const flowDev = Math.abs(e.flowRequired - cand.bepFlow) / cand.bepFlow;
    const flowScore = clamp(COMPRESSOR_WEIGHTS.flowMatch * (1 - flowDev * 1.5), 0, COMPRESSOR_WEIGHTS.flowMatch);
    const powerScore = clamp((minPower / e.powerKW) * COMPRESSOR_WEIGHTS.powerCompetitiveness, 0, COMPRESSOR_WEIGHTS.powerCompetitiveness);

    e.scoreBreakdown = { "Efficiency": round1(effScore), "Pressure ratio margin": round1(pressureScore), "Flow match": round1(flowScore), "Power competitiveness": round1(powerScore) };
    e.score = round1(effScore + pressureScore + flowScore + powerScore);
    if (!e.qualifies) e.score = round1(e.score * 0.5);
  });
  return evals;
}

function runCompressorScreening(state) {
  const conditions = { ...state.conditions.compressor, hours: state.process.hours, price: state.process.price };
  const requirements = state.requirements.compressor;
  const baseline = state.baseline.compressor;

  let evals = COMPRESSOR_CANDIDATES.map((c) => evaluateCompressorCandidate(c, conditions, requirements));
  evals = scoreCompressorCandidates(evals);

  const qualifying = evals.filter((e) => e.qualifies);
  const pool = qualifying.length ? qualifying : evals;
  const recommended = pool.reduce((best, e) => (e.score > best.score ? e : best), pool[0]);

  const baseIsentropicKW = isentropicCompressionPowerKW(conditions.flow, conditions.p1, conditions.p2, conditions.t1, conditions.k, conditions.molarMass);
  const basePowerKW = baseIsentropicKW / (baseline.efficiency / 100);
  const baseEnergyKWh = annualEnergyKWh(basePowerKW, conditions.hours);
  const baseCostPerYear = annualCost(baseEnergyKWh, conditions.price);

  return finishResults(state, "compressor", evals, recommended.id, {
    label: `Existing compressor @ ${baseline.efficiency}% efficiency`,
    powerKW: basePowerKW, energyKWh: baseEnergyKWh, costPerYear: baseCostPerYear,
  }, {}, qualifying.length > 0);
}

/* ===================================================================
   FAN / BLOWER ENGINE
=================================================================== */

const FAN_WEIGHTS = { efficiency: 40, pressureMargin: 20, flowMatch: 20, powerCompetitiveness: 20 };

function evaluateFanCandidate(candidate, conditions, requirements) {
  const range = fanOperableRange(candidate);
  const meetsFlow = conditions.flow >= range.min && conditions.flow <= range.max;

  const availablePressure = fanPressureAtFlow(candidate, conditions.flow);
  const meetsPressure = availablePressure >= conditions.pressure * 0.98;

  const efficiency = fanEfficiencyAtFlow(candidate, conditions.flow);
  const meetsMinEff = efficiency * 100 >= requirements.minEfficiency;

  const powerKW = fanPowerKW(conditions.flow, conditions.pressure, efficiency);
  const meetsMaxPower = powerKW <= requirements.maxPower;

  const energyKWh = annualEnergyKWh(powerKW, conditions.hours);
  const costPerYear = annualCost(energyKWh, conditions.price);
  const lcc20 = lifecycleCost(candidate.capitalCost, costPerYear, requirements.life);
  const qualifies = meetsFlow && meetsPressure && meetsMinEff && meetsMaxPower;
  const pressureMarginPct = ((availablePressure - conditions.pressure) / conditions.pressure) * 100;

  return {
    id: candidate.id, name: candidate.name, model: candidate.model, capitalCost: candidate.capitalCost,
    flowRequired: conditions.flow, pressureRequired: conditions.pressure, availablePressure, pressureMarginPct,
    efficiency, powerKW, energyKWh, costPerYear, lcc20,
    meetsFlow, meetsPressure, meetsMinEff, meetsMaxPower, qualifies, score: 0,
  };
}

function scoreFanCandidates(evals) {
  const maxPeakEff = Math.max(...FAN_CANDIDATES.map((c) => c.peakEfficiency));
  const minPower = Math.min(...evals.map((e) => e.powerKW));
  evals.forEach((e) => {
    const effScore = clamp((e.efficiency / maxPeakEff) * FAN_WEIGHTS.efficiency, 0, FAN_WEIGHTS.efficiency);
    let pressureScore = 0;
    if (e.meetsPressure) {
      const penalty = Math.max(0, e.pressureMarginPct - 5) * 0.5;
      pressureScore = clamp(FAN_WEIGHTS.pressureMargin - penalty, 0, FAN_WEIGHTS.pressureMargin);
    }
    const cand = FAN_CANDIDATES.find((c) => c.id === e.id);
    const flowDev = Math.abs(e.flowRequired - cand.bepFlow) / cand.bepFlow;
    const flowScore = clamp(FAN_WEIGHTS.flowMatch * (1 - flowDev * 1.5), 0, FAN_WEIGHTS.flowMatch);
    const powerScore = clamp((minPower / e.powerKW) * FAN_WEIGHTS.powerCompetitiveness, 0, FAN_WEIGHTS.powerCompetitiveness);

    e.scoreBreakdown = { "Efficiency": round1(effScore), "Pressure margin": round1(pressureScore), "Flow match": round1(flowScore), "Power competitiveness": round1(powerScore) };
    e.score = round1(effScore + pressureScore + flowScore + powerScore);
    if (!e.qualifies) e.score = round1(e.score * 0.5);
  });
  return evals;
}

function runFanScreening(state) {
  const conditions = { ...state.conditions.fan, hours: state.process.hours, price: state.process.price };
  const requirements = state.requirements.fan;
  const baseline = state.baseline.fan;

  let evals = FAN_CANDIDATES.map((c) => evaluateFanCandidate(c, conditions, requirements));
  evals = scoreFanCandidates(evals);

  const qualifying = evals.filter((e) => e.qualifies);
  const pool = qualifying.length ? qualifying : evals;
  const recommended = pool.reduce((best, e) => (e.score > best.score ? e : best), pool[0]);

  const basePowerKW = fanPowerKW(conditions.flow, conditions.pressure, baseline.efficiency / 100);
  const baseEnergyKWh = annualEnergyKWh(basePowerKW, conditions.hours);
  const baseCostPerYear = annualCost(baseEnergyKWh, conditions.price);

  return finishResults(state, "fan", evals, recommended.id, {
    label: `Existing fan @ ${baseline.efficiency}% efficiency`,
    powerKW: basePowerKW, energyKWh: baseEnergyKWh, costPerYear: baseCostPerYear,
  }, {}, qualifying.length > 0);
}

/* ===================================================================
   HEAT EXCHANGER ENGINE
   No curve/BEP concept. Each candidate is sized directly from the
   process duty. Scoring rewards a compact, low-operating-cost,
   low-capital-cost design.
=================================================================== */

const HX_WEIGHTS = { compactness: 30, energy: 30, cost: 40 };

function evaluateHXCandidate(candidate, conditions, requirements) {
  const duty = hxDutyKW(conditions.hotFlow, conditions.hotDensity, conditions.hotCp, conditions.hotIn - conditions.hotOut);
  const lmtd = lmtdCounterflow(conditions.hotIn, conditions.hotOut, conditions.coldIn, conditions.coldOut);
  const area = hxArea(duty, candidate.U, lmtd);
  const capitalCost = candidate.baseCost + area * candidate.costPerM2;

  // operating power: either pumping power to overcome the exchanger's
  // pressure drop, or (for air-cooled) fan power scaled to face area
  let powerKW;
  if (candidate.usesFan) {
    powerKW = area * candidate.fanPowerPerM2;
  } else {
    const headEquivM = (candidate.pressureDropBar * 1e5) / (conditions.hotDensity * G);
    powerKW = hydraulicPowerKW(conditions.hotDensity, conditions.hotFlow, headEquivM); // treat as pumping power directly (eta~1 lumped into pressure drop assumption)
  }

  const energyKWh = annualEnergyKWh(powerKW, requirements.hours || 8000);
  const costPerYear = annualCost(energyKWh, requirements.price || 0.08);
  const lcc20 = lifecycleCost(capitalCost, costPerYear, requirements.life);

  const approachTemp = Math.min(conditions.hotOut - conditions.coldIn, conditions.hotIn - conditions.coldOut);
  const meetsApproach = lmtd !== null && approachTemp >= requirements.minApproach;
  const meetsArea = area <= requirements.maxArea;
  const meetsPressureDrop = candidate.pressureDropBar <= requirements.maxPressureDrop;
  const qualifies = meetsApproach && meetsArea && meetsPressureDrop;

  return {
    id: candidate.id, name: candidate.name, model: candidate.model, capitalCost,
    duty, lmtd, area, U: candidate.U, pressureDropBar: candidate.pressureDropBar,
    powerKW, energyKWh, costPerYear, lcc20, approachTemp,
    meetsArea, meetsPressureDrop, meetsApproach, qualifies, score: 0,
  };
}

function scoreHXCandidates(evals) {
  const feasible = evals.filter((e) => e.lmtd !== null);
  if (!feasible.length) { evals.forEach((e) => (e.score = 0)); return evals; }
  const minArea = Math.max(Math.min(...feasible.map((e) => e.area)), 1e-6);
  const minPower = Math.max(Math.min(...feasible.map((e) => e.powerKW || 0)), 1e-6);
  const minCost = Math.max(Math.min(...feasible.map((e) => e.lcc20)), 1e-6);

  evals.forEach((e) => {
    if (e.lmtd === null) { e.score = 0; e.scoreBreakdown = { "Infeasible": "hot/cold streams cross" }; return; }
    const compactScore = clamp((minArea / Math.max(e.area, 1e-6)) * HX_WEIGHTS.compactness, 0, HX_WEIGHTS.compactness);
    const energyScore = clamp((minPower / Math.max(e.powerKW, 1e-6)) * HX_WEIGHTS.energy, 0, HX_WEIGHTS.energy);
    const costScore = clamp((minCost / Math.max(e.lcc20, 1e-6)) * HX_WEIGHTS.cost, 0, HX_WEIGHTS.cost);
    e.scoreBreakdown = { "Compactness": round1(compactScore), "Operating energy": round1(energyScore), "Lifecycle cost": round1(costScore) };
    e.score = round1(compactScore + energyScore + costScore);
    if (!e.qualifies) e.score = round1(e.score * 0.5);
  });
  return evals;
}

function runHXScreening(state) {
  const conditions = state.conditions.heatExchanger;
  const requirements = { ...state.requirements.heatExchanger, hours: state.process.hours, price: state.process.price };
  const baselineEmissions = state.baseline.heatExchanger.emissionsFactor;

  let evals = HX_CANDIDATES.map((c) => evaluateHXCandidate(c, conditions, requirements));
  evals = scoreHXCandidates(evals);

  const feasible = evals.filter((e) => e.lmtd !== null);
  const qualifying = evals.filter((e) => e.qualifies);
  const pool = qualifying.length ? qualifying : (feasible.length ? feasible : evals);
  const recommended = pool.reduce((best, e) => (e.score > best.score ? e : best), pool[0]);

  // "baseline" for a sizing tool = the least efficient qualifying (or feasible) design,
  // representing what you'd get by not screening properly
  const comparisonPool = feasible.length ? feasible : evals;
  const worst = comparisonPool.reduce((w, e) => (e.energyKWh > w.energyKWh ? e : w), comparisonPool[0]);

  return finishResults(state, "heatExchanger", evals, recommended.id, {
    label: `Unoptimized selection (${worst.name.replace(/^Candidate \w: /, "")})`,
    powerKW: worst.powerKW, energyKWh: worst.energyKWh, costPerYear: worst.costPerYear,
  }, {}, qualifying.length > 0);
}

/* ===================================================================
   SHARED FINISH / DISPATCH
=================================================================== */

function finishResults(state, equipmentType, candidates, recommendedId, baseline, extra, anyQualify) {
  const recommended = candidates.find((c) => c.id === recommendedId);
  const energySavingsKWh = baseline.energyKWh - recommended.energyKWh;
  const costSavingsPerYear = baseline.costPerYear - recommended.costPerYear;
  const energyReductionPct = baseline.energyKWh > 0 ? (energySavingsKWh / baseline.energyKWh) * 100 : 0;

  return {
    generatedAt: new Date().toISOString(),
    equipmentType,
    conditions: { ...state.conditions[equipmentType] },
    requirements: { ...state.requirements[equipmentType] },
    process: { ...state.process },
    candidates,
    recommendedId,
    baseline,
    savings: { energyKWh: energySavingsKWh, costPerYear: costSavingsPerYear, energyReductionPct },
    extra,
    anyQualify,
  };
}

function runScreening(state) {
  switch (state.equipmentType) {
    case "compressor": return runCompressorScreening(state);
    case "fan": return runFanScreening(state);
    case "heatExchanger": return runHXScreening(state);
    case "pump":
    default: return runPumpScreening(state);
  }
}

function getRecommended(results) {
  return results.candidates.find((c) => c.id === results.recommendedId);
}
