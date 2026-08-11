/* ===================================================================
   energyOptimization.js: the "analyze what you already have" tool.
   Unlike the screening wizard (which picks new equipment for a new
   duty point), this takes a piece of equipment already in service,
   its rated power and estimated efficiency, and estimates the
   savings available from upgrading to a best-in-class unit of the
   same type, using the same candidate libraries as Screening.
=================================================================== */

const OPTIMIZATION_EQUIPMENT = {
  pump: { label: "Pump", candidates: () => PUMP_CANDIDATES, upgradeExample: () => PUMP_CANDIDATES.find((c) => c.id === "B") },
  compressor: { label: "Compressor", candidates: () => COMPRESSOR_CANDIDATES, upgradeExample: () => COMPRESSOR_CANDIDATES.find((c) => c.id === "B") },
  fan: { label: "Fan / Blower", candidates: () => FAN_CANDIDATES, upgradeExample: () => FAN_CANDIDATES.find((c) => c.id === "B") },
};

function bestInClassEfficiency(equipmentType) {
  const cands = OPTIMIZATION_EQUIPMENT[equipmentType].candidates();
  return Math.max(...cands.map((c) => c.peakEfficiency));
}

/**
 * inputs: { equipmentType, currentPowerKW, currentEfficiency (%),
 *           hours, price, emissionsFactor }
 */
function runEnergyOptimization(inputs) {
  const { equipmentType, currentPowerKW, currentEfficiency, hours, price, emissionsFactor } = inputs;

  const currentEnergyKWh = annualEnergyKWh(currentPowerKW, hours);
  const currentCostPerYear = annualCost(currentEnergyKWh, price);

  // useful ("duty") output power is held constant, since that's the
  // actual job the equipment is doing, while efficiency improves
  const dutyPowerKW = currentPowerKW * (currentEfficiency / 100);
  const bestEff = bestInClassEfficiency(equipmentType);
  const optimizedPowerKW = dutyPowerKW / bestEff;
  const optimizedEnergyKWh = annualEnergyKWh(optimizedPowerKW, hours);
  const optimizedCostPerYear = annualCost(optimizedEnergyKWh, price);

  const energySavingsKWh = currentEnergyKWh - optimizedEnergyKWh;
  const costSavingsPerYear = currentCostPerYear - optimizedCostPerYear;
  const energyReductionPct = currentEnergyKWh > 0 ? (energySavingsKWh / currentEnergyKWh) * 100 : 0;

  const upgradeExample = OPTIMIZATION_EQUIPMENT[equipmentType].upgradeExample();
  const upgradeCost = upgradeExample.capitalCost;
  const simplePaybackYears = costSavingsPerYear > 0 ? upgradeCost / costSavingsPerYear : Infinity;

  const co2SavingsPerYear = kWhToMWh(energySavingsKWh) * emissionsFactor;

  return {
    equipmentType,
    currentEfficiency, bestEff,
    dutyPowerKW,
    currentPowerKW, currentEnergyKWh, currentCostPerYear,
    optimizedPowerKW, optimizedEnergyKWh, optimizedCostPerYear,
    energySavingsKWh, costSavingsPerYear, energyReductionPct,
    upgradeExampleName: upgradeExample.name, upgradeCost, simplePaybackYears,
    co2SavingsPerYear,
    worthwhile: energyReductionPct > 3, // a >3% improvement is worth investigating further
  };
}
