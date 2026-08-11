/* ===================================================================
   applications.js: one-click starting scenarios covering upstream,
   midstream, and downstream O&G operations. Selecting one sets the
   equipment type and pre-fills reasonable process conditions; the
   user can still edit every field afterward.
=================================================================== */

const APPLICATIONS = [
  // ---------------- Upstream ----------------
  {
    id: "artificial_lift",
    name: "Artificial Lift",
    sector: "Upstream",
    equipmentType: "pump",
    process: { flow: 200, temperature: 55, hours: 8400 },
    conditions: { fluid: "crude_oil", density: 880, viscosity: 15, flow: 200, head: 900 },
  },
  {
    id: "produced_water",
    name: "Produced Water",
    sector: "Upstream",
    equipmentType: "pump",
    process: { flow: 700, temperature: 55, hours: 8400 },
    conditions: { fluid: "produced_water", density: 1030, viscosity: 1.3, flow: 700, head: 60 },
  },
  {
    id: "water_injection",
    name: "Water Injection",
    sector: "Upstream",
    equipmentType: "pump",
    process: { flow: 500, temperature: 35, hours: 8000 },
    conditions: { fluid: "injection_water", density: 1020, viscosity: 1.1, flow: 500, head: 150 },
  },
  {
    id: "wellhead_systems",
    name: "Wellhead Systems",
    sector: "Upstream",
    equipmentType: "compressor",
    process: { flow: 600, temperature: 30, hours: 8000 },
    conditions: { gas: "associated_gas", molarMass: 22.5, k: 1.25, flow: 600, p1: 3, p2: 12, t1: 30 },
  },

  // ---------------- Midstream ----------------
  {
    id: "crude_pipeline",
    name: "Crude Pipeline",
    sector: "Midstream",
    equipmentType: "pump",
    process: { flow: 1400, temperature: 30, hours: 8300 },
    conditions: { fluid: "crude_oil", density: 870, viscosity: 20, flow: 1400, head: 110 },
  },
  {
    id: "natural_gas_pipeline",
    name: "Natural Gas Pipeline",
    sector: "Midstream",
    equipmentType: "compressor",
    process: { flow: 1000, temperature: 35, hours: 8400 },
    conditions: { gas: "natural_gas", molarMass: 18.8, k: 1.28, flow: 1000, p1: 4, p2: 20, t1: 35 },
  },
  {
    id: "product_pipeline",
    name: "Product Pipeline",
    sector: "Midstream",
    equipmentType: "pump",
    process: { flow: 900, temperature: 25, hours: 8200 },
    conditions: { fluid: "diesel", density: 830, viscosity: 4, flow: 900, head: 95 },
  },

  // ---------------- Downstream ----------------
  {
    id: "refinery_feed",
    name: "Refinery Feed",
    sector: "Downstream",
    equipmentType: "pump",
    process: { flow: 1100, temperature: 90, hours: 8500 },
    conditions: { fluid: "crude_oil", density: 840, viscosity: 8, flow: 1100, head: 130 },
  },
  {
    id: "cooling_systems",
    name: "Cooling Systems",
    sector: "Downstream",
    equipmentType: "heatExchanger",
    process: { flow: 300, temperature: 140, hours: 8500 },
    conditions: { hotFlow: 300, hotDensity: 800, hotCp: 2.2, hotIn: 140, hotOut: 60, coldIn: 28, coldOut: 45 },
  },
  {
    id: "process_transfer",
    name: "Process Transfer",
    sector: "Downstream",
    equipmentType: "pump",
    process: { flow: 600, temperature: 70, hours: 8000 },
    conditions: { fluid: "custom", density: 780, viscosity: 3, flow: 600, head: 55 },
  },
  {
    id: "heat_recovery",
    name: "Heat Recovery",
    sector: "Downstream",
    equipmentType: "heatExchanger",
    process: { flow: 400, temperature: 220, hours: 8600 },
    conditions: { hotFlow: 400, hotDensity: 750, hotCp: 2.4, hotIn: 220, hotOut: 110, coldIn: 40, coldOut: 130 },
  },
  {
    id: "combustion_air",
    name: "Combustion / Ventilation Air",
    sector: "Downstream",
    equipmentType: "fan",
    process: { flow: 25000, temperature: 30, hours: 8000 },
    conditions: { density: 1.15, flow: 25000, pressure: 1400 },
  },
];

function getApplicationById(id) {
  return APPLICATIONS.find((a) => a.id === id) || null;
}

function applicationsForType(equipmentType) {
  return APPLICATIONS.filter((a) => a.equipmentType === equipmentType);
}
