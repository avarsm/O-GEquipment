/* ===================================================================
   state.js: single source of truth for the current project.
   Conditions/requirements/baseline are keyed by equipment type so
   switching equipment types never clobbers another type's inputs.
=================================================================== */

const STORAGE_KEY = "og_screening_tool_state_v2";

const defaultState = {
  project: {
    name: "",
    location: "",
    opPeriod: 20,
    currency: "USD",
  },
  equipmentType: "pump", // 'pump' | 'compressor' | 'fan' | 'heatExchanger'
  applicationId: null,

  // shared, generic process conditions (used as sensible defaults that
  // flow into each equipment type's detailed screening form)
  process: {
    flow: 1000,        // m3/hr
    temperature: 60,    // degC
    hours: 8000,         // hr/yr
    price: 0.08,           // $/kWh
  },

  conditions: {
    pump: { fluid: "crude_oil", density: 850, viscosity: 12, flow: 1000, head: 80 },
    compressor: { gas: "natural_gas", molarMass: 18.8, k: 1.28, flow: 1000, p1: 4, p2: 20, t1: 35 },
    fan: { density: 1.2, flow: 20000, pressure: 1200 },
    heatExchanger: {
      hotFlow: 300, hotDensity: 850, hotCp: 2.0, hotIn: 140, hotOut: 60,
      coldIn: 25, coldOut: 55,
    },
  },

  requirements: {
    pump: { minEfficiency: 75, maxPower: 500, life: 20, fos: 2.0 },
    compressor: { minEfficiency: 70, maxPower: 1500, life: 20, fos: 1.5 },
    fan: { minEfficiency: 65, maxPower: 250, life: 20, fos: 1.5 },
    heatExchanger: { maxArea: 400, maxPressureDrop: 1.0, minApproach: 8, life: 20 },
  },

  baseline: {
    pump: { efficiency: 65, emissionsFactor: 0.40 },
    compressor: { efficiency: 60, emissionsFactor: 0.40 },
    fan: { efficiency: 55, emissionsFactor: 0.40 },
    heatExchanger: { emissionsFactor: 0.40 },
  },

  results: null, // populated after "Run Screening", includes equipmentType it was run for
  sensitivity: { price: null, flow: null },

  energyOpt: {
    equipmentType: "pump",
    currentPowerKW: 250,
    currentEfficiency: 65,
    hours: 8000,
    price: 0.08,
    emissionsFactor: 0.40,
    results: null,
  },
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    const merged = structuredClone(defaultState);
    deepMerge(merged, parsed);
    return merged;
  } catch (e) {
    console.warn("Could not load saved state, starting fresh.", e);
    return structuredClone(defaultState);
  }
}

function deepMerge(target, source) {
  Object.keys(source || {}).forEach((key) => {
    if (
      source[key] && typeof source[key] === "object" && !Array.isArray(source[key]) &&
      target[key] && typeof target[key] === "object"
    ) {
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  });
}

let appState = loadState();

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  } catch (e) {
    console.warn("Could not save state.", e);
  }
}

function resetState() {
  appState = structuredClone(defaultState);
  saveState();
}
