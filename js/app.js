/* ===================================================================
   app.js: wires the DOM to state.js / screening.js / report.js /
   energyOptimization.js. Organized top-to-bottom in the order the
   user moves through the tool.
=================================================================== */

const EQUIP_LABELS = { pump: "Pump", compressor: "Compressor", fan: "Fan / Blower", heatExchanger: "Heat Exchanger" };
const EQUIP_ARTICLE = { pump: "a pump", compressor: "a compressor", fan: "a fan/blower", heatExchanger: "a heat exchanger" };

document.addEventListener("DOMContentLoaded", init);

function init() {
  bindNav();
  bindDashboardEntries();
  bindProjectSetupForm();
  bindEquipmentPicker();
  bindDetailForms();
  bindResultsInteractions();
  bindReportButtons();
  bindOptimizePage();

  populateApplicationGrid();
  writeProjectFormFromState();
  showEquipDetailPanel(appState.equipmentType);
  updateEquipTypeLabel();

  if (appState.results) {
    renderResults(appState.results);
  }
}

/* ------------------------------------------------------------------
   Navigation
------------------------------------------------------------------ */
const STEP_ORDER = ["project-setup", "screening", "results", "report"];

function bindNav() {
  document.querySelectorAll("[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => showView(btn.dataset.view));
  });
  document.querySelectorAll("[data-goto]").forEach((btn) => {
    btn.addEventListener("click", () => showView(btn.dataset.goto));
  });
}

function showView(viewId) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  document.getElementById("view-" + viewId).classList.add("active");
  document.querySelectorAll(".navlink").forEach((n) => n.classList.toggle("active", n.dataset.view === viewId));
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  updateStepBar(viewId);

  if (viewId === "screening") updateDutySummary();
  if (viewId === "report") renderReportView();
}

function updateStepBar(viewId) {
  const stepbar = document.getElementById("stepbar");
  const idx = STEP_ORDER.indexOf(viewId);
  stepbar.classList.toggle("hidden", idx === -1);
  if (idx === -1) return;

  stepbar.querySelectorAll(".step").forEach((btn) => {
    const stepIdx = STEP_ORDER.indexOf(btn.dataset.view);
    btn.classList.remove("done", "current");
    if (stepIdx === idx) btn.classList.add("current");
    else if (stepIdx < idx) btn.classList.add("done");
    const needsResults = btn.dataset.view === "results" || btn.dataset.view === "report";
    btn.disabled = needsResults && !appState.results;
  });
}

/* ------------------------------------------------------------------
   Equipment type selection (dashboard + screening picker)
------------------------------------------------------------------ */
function bindDashboardEntries() {
  document.querySelectorAll("[data-equip-entry]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setEquipmentType(btn.dataset.equipEntry);
      showView("project-setup");
    });
  });
}

function bindEquipmentPicker() {
  document.querySelectorAll(".equip-card").forEach((btn) => {
    btn.addEventListener("click", () => setEquipmentType(btn.dataset.equip));
  });

  document.getElementById("btn-run-screening").addEventListener("click", () => {
    readDetailFormIntoState(appState.equipmentType);
    appState.results = runScreening(appState);
    appState.sensitivity = { price: null, flow: null };
    saveState();
    renderResults(appState.results);
    showView("results");
  });
}

function setEquipmentType(type) {
  appState.equipmentType = type;
  saveState();
  updateEquipTypeLabel();
  populateApplicationGrid();
  writeProjectFormFromState();
  showEquipDetailPanel(type);
  writeDetailFormFromState(type);

  document.querySelectorAll(".equip-card").forEach((c) => c.classList.toggle("active-card", c.dataset.equip === type));
  document.querySelectorAll("[data-equip-entry]").forEach((c) => c.classList.toggle("active-card", true)); // all remain active/enabled
}

function showEquipDetailPanel(type) {
  document.querySelectorAll(".equip-detail").forEach((p) => p.classList.toggle("hidden", p.id !== "detail-" + type));
}

function updateEquipTypeLabel() {
  const label = document.getElementById("equip-type-label");
  if (label) label.textContent = EQUIP_ARTICLE[appState.equipmentType];
  const baselineLabel = document.getElementById("baseline-eff-label");
  if (baselineLabel) {
    const isHx = appState.equipmentType === "heatExchanger";
    baselineLabel.closest("label").classList.toggle("hidden", isHx);
    baselineLabel.firstChild.textContent = `Baseline ${EQUIP_LABELS[appState.equipmentType].toLowerCase()} efficiency (%) `;
  }
}

const FLOW_KEY_BY_TYPE = { pump: "flow", compressor: "flow", fan: "flow", heatExchanger: "hotFlow" };

function currentFlow() { return appState.conditions[appState.equipmentType][FLOW_KEY_BY_TYPE[appState.equipmentType]]; }
function setCurrentFlow(v) { appState.conditions[appState.equipmentType][FLOW_KEY_BY_TYPE[appState.equipmentType]] = v; }

/* ------------------------------------------------------------------
   Applications grid
------------------------------------------------------------------ */
function populateApplicationGrid() {
  const grid = document.getElementById("application-grid");
  grid.innerHTML = "";
  const apps = applicationsForType(appState.equipmentType);

  apps.forEach((app) => {
    const btn = document.createElement("button");
    btn.className = "app-card" + (appState.applicationId === app.id ? " selected" : "");
    btn.type = "button";
    btn.innerHTML = `<span class="app-name">${app.name}</span><span class="app-sub">${app.sector}</span>`;
    btn.addEventListener("click", () => selectApplication(app.id));
    grid.appendChild(btn);
  });

  const customBtn = document.createElement("button");
  customBtn.className = "app-card" + (appState.applicationId === null ? " selected" : "");
  customBtn.type = "button";
  customBtn.innerHTML = `<span class="app-name">Custom</span><span class="app-sub">Enter values manually</span>`;
  customBtn.addEventListener("click", () => selectApplication(null));
  grid.appendChild(customBtn);
}

function selectApplication(appId) {
  appState.applicationId = appId;
  const app = getApplicationById(appId);
  if (app) {
    Object.assign(appState.process, app.process);
    Object.assign(appState.conditions[app.equipmentType], app.conditions);
    writeProjectFormFromState();
    writeDetailFormFromState(app.equipmentType);
  }
  saveState();
  populateApplicationGrid();
}

/* ------------------------------------------------------------------
   Project setup form
------------------------------------------------------------------ */
function bindProjectSetupForm() {
  bindField("in-project-name", appState.project, "name", "text");
  bindField("in-location", appState.project, "location", "text");
  bindField("in-op-period", appState.project, "opPeriod", "number");
  bindField("in-currency", appState.project, "currency", "text");
  document.getElementById("in-flow").addEventListener("input", (e) => {
    setCurrentFlow(Number(e.target.value));
    saveState();
  });
  document.getElementById("in-temp").addEventListener("input", (e) => {
    appState.process.temperature = Number(e.target.value);
    if (appState.equipmentType === "compressor") appState.conditions.compressor.t1 = appState.process.temperature;
    saveState();
  });
  bindField("in-hours", appState.process, "hours", "number");
  bindField("in-price", appState.process, "price", "number");

  document.getElementById("in-baseline-eff").addEventListener("input", (e) => {
    const type = appState.equipmentType;
    if (appState.baseline[type].efficiency !== undefined) {
      appState.baseline[type].efficiency = Number(e.target.value);
      saveState();
    }
  });
  document.getElementById("in-emissions").addEventListener("input", (e) => {
    appState.baseline[appState.equipmentType].emissionsFactor = Number(e.target.value);
    saveState();
  });

  document.getElementById("btn-continue-to-screening").addEventListener("click", () => showView("screening"));
}

// Generic "bind an <input>/<select> to a live object field" helper.
// Note: this binds by object reference, which works because
// appState.project / appState.process are stable object references
// for the lifetime of the page (they're never reassigned).
function bindField(elId, obj, key, type, onAfter) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.addEventListener("input", () => {
    obj[key] = type === "number" ? Number(el.value) : el.value;
    if (onAfter) onAfter();
    saveState();
  });
}

function writeProjectFormFromState() {
  const p = appState.project, proc = appState.process, type = appState.equipmentType;
  setVal("in-project-name", p.name);
  setVal("in-location", p.location);
  setVal("in-op-period", p.opPeriod);
  setVal("in-currency", p.currency);
  setVal("in-flow", currentFlow());
  setVal("in-temp", proc.temperature);
  setVal("in-hours", proc.hours);
  setVal("in-price", proc.price);
  if (appState.baseline[type].efficiency !== undefined) setVal("in-baseline-eff", appState.baseline[type].efficiency);
  setVal("in-emissions", appState.baseline[type].emissionsFactor);
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

/* ------------------------------------------------------------------
   Equipment-specific detail forms (Screening page)
------------------------------------------------------------------ */
const DETAIL_FIELDS = {
  pump: [
    ["pump-flow", "conditions", "flow"], ["pump-head", "conditions", "head"],
    ["pump-density", "conditions", "density"], ["pump-viscosity", "conditions", "viscosity"],
    ["pump-min-eff", "requirements", "minEfficiency"], ["pump-max-power", "requirements", "maxPower"],
    ["pump-life", "requirements", "life"], ["pump-fos", "requirements", "fos"],
  ],
  compressor: [
    ["compressor-flow", "conditions", "flow"], ["compressor-p1", "conditions", "p1"],
    ["compressor-p2", "conditions", "p2"], ["compressor-t1", "conditions", "t1"],
    ["compressor-k", "conditions", "k"], ["compressor-molarmass", "conditions", "molarMass"],
    ["compressor-min-eff", "requirements", "minEfficiency"], ["compressor-max-power", "requirements", "maxPower"],
    ["compressor-life", "requirements", "life"], ["compressor-fos", "requirements", "fos"],
  ],
  fan: [
    ["fan-flow", "conditions", "flow"], ["fan-pressure", "conditions", "pressure"],
    ["fan-density", "conditions", "density"],
    ["fan-min-eff", "requirements", "minEfficiency"], ["fan-max-power", "requirements", "maxPower"],
    ["fan-life", "requirements", "life"], ["fan-fos", "requirements", "fos"],
  ],
  heatExchanger: [
    ["hx-hotflow", "conditions", "hotFlow"], ["hx-hotdensity", "conditions", "hotDensity"],
    ["hx-hotcp", "conditions", "hotCp"], ["hx-hotin", "conditions", "hotIn"], ["hx-hotout", "conditions", "hotOut"],
    ["hx-coldin", "conditions", "coldIn"], ["hx-coldout", "conditions", "coldOut"],
    ["hx-max-area", "requirements", "maxArea"], ["hx-max-dp", "requirements", "maxPressureDrop"],
    ["hx-min-approach", "requirements", "minApproach"], ["hx-life", "requirements", "life"],
  ],
};

function bindDetailForms() {
  Object.keys(DETAIL_FIELDS).forEach((type) => {
    DETAIL_FIELDS[type].forEach(([elId, group, key]) => {
      const el = document.getElementById(elId);
      if (!el) return;
      el.addEventListener("input", () => {
        appState[group][type][key] = Number(el.value);
        saveState();
      });
    });
  });

  const gasSelect = document.getElementById("compressor-gas");
  gasSelect.addEventListener("change", () => {
    appState.conditions.compressor.gas = gasSelect.value;
    const isCustom = gasSelect.value === "custom";
    document.getElementById("compressor-k-label").classList.toggle("hint-inline", false);
    if (!isCustom) {
      const gas = GASES[gasSelect.value];
      appState.conditions.compressor.k = gas.k;
      appState.conditions.compressor.molarMass = gas.molarMass;
      setVal("compressor-k", gas.k);
      setVal("compressor-molarmass", gas.molarMass);
    }
    document.getElementById("compressor-k").disabled = !isCustom;
    document.getElementById("compressor-molarmass").disabled = !isCustom;
    saveState();
  });
}

function writeDetailFormFromState(type) {
  DETAIL_FIELDS[type].forEach(([elId, group, key]) => setVal(elId, appState[group][type][key]));
  if (type === "compressor") {
    setVal("compressor-gas", appState.conditions.compressor.gas);
    const isCustom = appState.conditions.compressor.gas === "custom";
    document.getElementById("compressor-k").disabled = !isCustom;
    document.getElementById("compressor-molarmass").disabled = !isCustom;
  }
}

function readDetailFormIntoState(type) {
  DETAIL_FIELDS[type].forEach(([elId, group, key]) => {
    const el = document.getElementById(elId);
    if (el) appState[group][type][key] = Number(el.value);
  });
}

function updateDutySummary() {
  const p = appState.process;
  const items = [
    ["Equipment type", EQUIP_LABELS[appState.equipmentType]],
    ["Flow", fmt(currentFlow()) + " m3/hr"],
    ["Temperature", p.temperature + " C"],
    ["Operating hours", fmt(p.hours) + " hr/yr"],
    ["Electricity price", "$" + p.price.toFixed(3) + "/kWh"],
  ];
  document.getElementById("duty-summary").innerHTML = items.map(([k, v]) => `
    <div class="summary-item"><span class="k">${k}</span><span class="v">${v}</span></div>
  `).join("");

  document.querySelectorAll(".equip-card").forEach((c) => c.classList.toggle("active-card", c.dataset.equip === appState.equipmentType));
}

/* ------------------------------------------------------------------
   Results
------------------------------------------------------------------ */
function bindResultsInteractions() {
  document.getElementById("btn-toggle-engineering").addEventListener("click", (e) => {
    const detail = document.getElementById("engineering-detail");
    detail.classList.toggle("hidden");
    e.target.textContent = detail.classList.contains("hidden") ? "View Calculations" : "Hide Calculations";
  });

  document.getElementById("sens-price").addEventListener("input", onSensitivityChange);
  document.getElementById("sens-flow").addEventListener("input", onSensitivityChange);
  document.getElementById("btn-reset-sens").addEventListener("click", () => {
    appState.sensitivity = { price: null, flow: null };
    setupSensitivity(appState.results);
    saveState();
  });

  document.getElementById("in-emissions-live").addEventListener("input", (e) => {
    appState.baseline[appState.equipmentType].emissionsFactor = Number(e.target.value);
    setVal("in-emissions", appState.baseline[appState.equipmentType].emissionsFactor);
    saveState();
    renderEnvironmental(appState.results);
  });

  setupQuicknavScrollSpy();
}

function setupQuicknavScrollSpy() {
  const links = Array.from(document.querySelectorAll("#results-quicknav a"));
  if (!links.length || !("IntersectionObserver" in window)) return;
  const sections = links.map((l) => document.querySelector(l.getAttribute("href"))).filter(Boolean);
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const link = links.find((l) => l.getAttribute("href") === "#" + entry.target.id);
      if (!link) return;
      links.forEach((l) => l.classList.remove("active"));
      link.classList.add("active");
    });
  }, { rootMargin: "-160px 0px -70% 0px", threshold: 0 });
  sections.forEach((s) => observer.observe(s));
}

function renderResults(results) {
  if (!results) {
    document.getElementById("results-empty").classList.remove("hidden");
    document.getElementById("results-content").classList.add("hidden");
    return;
  }
  document.getElementById("results-empty").classList.add("hidden");
  document.getElementById("results-content").classList.remove("hidden");

  const rec = getRecommended(results);
  document.getElementById("rec-name").textContent = rec.name + (results.anyQualify ? "" : " (no candidate fully meets requirements)");
  document.getElementById("rec-score").textContent = rec.score;

  renderRecTable(rec, results);
  renderCompareTable(results);
  renderCandidateDetail(rec.id, results);
  renderEnergyEconomics(results, rec);
  renderLifecycle(results);
  renderEnvironmental(results);
  setupSensitivity(results);
  renderEngineeringDetails(results, rec);
}

function renderRecTable(rec, results) {
  const rows = [
    ["Equipment type", EQUIP_LABELS[results.equipmentType]],
    ["Model", rec.model],
    ...recommendedRows(rec, results),
    ["Annual energy", kWhToGWh(rec.energyKWh).toFixed(2) + " GWh"],
    ["Annual operating cost", "$" + fmt(rec.costPerYear)],
    ["Capital cost", "$" + fmt(rec.capitalCost)],
    ["Meets all requirements", rec.qualifies ? '<span class="pass">Yes</span>' : '<span class="fail">No, see comparison table</span>'],
  ];
  document.getElementById("rec-table").innerHTML = rows.map(([k, v]) => `<tr><th>${k}</th><td class="num">${v}</td></tr>`).join("");
}

const check = (b) => (b ? '<span class="pass">&#10003;</span>' : '<span class="fail">&#10007;</span>');

const COMPARE_ROWS = {
  pump: [
    ["Meets flow", (c) => check(c.meetsFlow)], ["Meets head", (c) => check(c.meetsHead)],
    ["Meets min. efficiency", (c) => check(c.meetsMinEff)], ["Meets max. power", (c) => check(c.meetsMaxPower)],
    ["Efficiency", (c) => (c.efficiency * 100).toFixed(1) + "%"], ["Power", (c) => fmt(c.powerKW) + " kW"],
    ["Annual cost", (c) => "$" + fmt(c.costPerYear)], ["Capital cost", (c) => "$" + fmt(c.capitalCost)],
    ["Lifecycle cost", (c) => "$" + (c.lcc20 / 1e6).toFixed(2) + "M"], ["Score", (c) => `<strong>${c.score}</strong>`],
  ],
  compressor: [
    ["Meets flow", (c) => check(c.meetsFlow)], ["Meets pressure ratio", (c) => check(c.meetsPressureRatio)],
    ["Meets min. efficiency", (c) => check(c.meetsMinEff)], ["Meets max. power", (c) => check(c.meetsMaxPower)],
    ["Efficiency", (c) => (c.efficiency * 100).toFixed(1) + "%"], ["Power", (c) => fmt(c.powerKW) + " kW"],
    ["Annual cost", (c) => "$" + fmt(c.costPerYear)], ["Capital cost", (c) => "$" + fmt(c.capitalCost)],
    ["Lifecycle cost", (c) => "$" + (c.lcc20 / 1e6).toFixed(2) + "M"], ["Score", (c) => `<strong>${c.score}</strong>`],
  ],
  fan: [
    ["Meets flow", (c) => check(c.meetsFlow)], ["Meets pressure rise", (c) => check(c.meetsPressure)],
    ["Meets min. efficiency", (c) => check(c.meetsMinEff)], ["Meets max. power", (c) => check(c.meetsMaxPower)],
    ["Efficiency", (c) => (c.efficiency * 100).toFixed(1) + "%"], ["Power", (c) => fmt(c.powerKW) + " kW"],
    ["Annual cost", (c) => "$" + fmt(c.costPerYear)], ["Capital cost", (c) => "$" + fmt(c.capitalCost)],
    ["Lifecycle cost", (c) => "$" + (c.lcc20 / 1e6).toFixed(2) + "M"], ["Score", (c) => `<strong>${c.score}</strong>`],
  ],
  heatExchanger: [
    ["Meets max. area", (c) => check(c.meetsArea)], ["Meets max. pressure drop", (c) => check(c.meetsPressureDrop)],
    ["Meets min. approach", (c) => check(c.meetsApproach)],
    ["Duty", (c) => fmt(c.duty) + " kW"], ["Area", (c) => (isFinite(c.area) ? fmt(c.area) + " m2" : "infeasible")],
    ["Operating power", (c) => fmt(c.powerKW) + " kW"], ["Annual cost", (c) => "$" + fmt(c.costPerYear)],
    ["Capital cost", (c) => "$" + fmt(c.capitalCost)], ["Lifecycle cost", (c) => "$" + (c.lcc20 / 1e6).toFixed(2) + "M"],
    ["Score", (c) => `<strong>${c.score}</strong>`],
  ],
};

function renderCompareTable(results) {
  const cands = results.candidates;
  const rec = getRecommended(results);
  const rows = COMPARE_ROWS[results.equipmentType];

  let html = "<thead><tr><th class='rowhead'></th>";
  cands.forEach((c) => {
    html += `<th class="${c.id === rec.id ? "best-col" : ""}"><button class="candidate-col-btn" data-cand="${c.id}">${displayName(c)}</button></th>`;
  });
  html += "</tr></thead><tbody>";
  rows.forEach(([label, fn]) => {
    html += `<tr><td class="rowhead">${label}</td>`;
    cands.forEach((c) => { html += `<td class="num ${c.id === rec.id ? "best-col" : ""}">${fn(c)}</td>`; });
    html += "</tr>";
  });
  html += "</tbody>";

  const table = document.getElementById("compare-table");
  table.innerHTML = html;
  table.querySelectorAll(".candidate-col-btn").forEach((btn) => {
    btn.addEventListener("click", () => renderCandidateDetail(btn.dataset.cand, appState.results));
  });
}

function renderCandidateDetail(candId, results) {
  const c = results.candidates.find((x) => x.id === candId);
  const wrap = document.getElementById("candidate-detail");
  const breakdown = Object.entries(c.scoreBreakdown || {}).map(([k, v]) => `${k} ${v}`).join(", ");
  wrap.innerHTML = `
    <div class="candidate-detail-card">
      <h4>${c.name}</h4>
      <p class="hint">Model ${c.model} &middot; Capital cost $${fmt(c.capitalCost)}</p>
      <p class="hint" style="margin-top:10px;">Score breakdown: ${breakdown || "n/a"}.</p>
    </div>
  `;
}

function renderEnergyEconomics(results, rec) {
  document.getElementById("energy-current-label").textContent = results.baseline.label;
  document.getElementById("energy-current").textContent = kWhToGWh(results.baseline.energyKWh).toFixed(2) + " GWh/yr";
  document.getElementById("energy-recommended").textContent = kWhToGWh(rec.energyKWh).toFixed(2) + " GWh/yr";
  document.getElementById("energy-savings").textContent = kWhToMWh(results.savings.energyKWh).toFixed(0) + " MWh";
  document.getElementById("energy-reduction-pct").textContent = results.savings.energyReductionPct.toFixed(1) + "%";
  document.getElementById("cost-current").textContent = "$" + fmt(results.baseline.costPerYear) + "/yr";
  document.getElementById("cost-recommended").textContent = "$" + fmt(rec.costPerYear) + "/yr";
  document.getElementById("cost-savings").textContent = "$" + fmt(results.savings.costPerYear);
}

function renderLifecycle(results) {
  const canvas = document.getElementById("lifecycle-chart");
  requestAnimationFrame(() => drawLifecycleChart(canvas, results.candidates, results.recommendedId));
  document.getElementById("lifecycle-numbers").innerHTML = results.candidates.map((c) => `
    <div class="lc-item">${displayName(c)}: <b>$${(c.lcc20 / 1e6).toFixed(2)}M</b></div>
  `).join("");
  window.addEventListener("resize", debounce(() => {
    if (appState.results) drawLifecycleChart(canvas, appState.results.candidates, appState.results.recommendedId);
  }, 200));
}

function renderEnvironmental(results) {
  const factor = appState.baseline[results.equipmentType].emissionsFactor;
  document.getElementById("in-emissions-live").value = factor;
  document.getElementById("env-energy").textContent = kWhToMWh(results.savings.energyKWh).toFixed(0) + " MWh";
  const co2Year = co2FromMWh(results.savings.energyKWh, factor);
  document.getElementById("env-co2-year").textContent = co2Year.toFixed(1) + " t/yr";
  document.getElementById("env-co2-life").textContent = (co2Year * appState.project.opPeriod).toFixed(0) + " t";
}

/* ---------------- sensitivity ---------------- */
const SENS_FLOW_LABEL = { pump: "Flow rate", compressor: "Inlet flow", fan: "Flow rate", heatExchanger: "Hot fluid flow" };

function setupSensitivity(results) {
  const type = results.equipmentType;
  const baseFlow = type === "heatExchanger" ? results.conditions.hotFlow : results.conditions.flow;
  const priceSlider = document.getElementById("sens-price");
  const flowSlider = document.getElementById("sens-flow");

  flowSlider.min = Math.max(1, Math.round(baseFlow * 0.2));
  flowSlider.max = Math.round(baseFlow * 2);
  flowSlider.step = Math.max(1, Math.round(baseFlow * 0.01));
  document.getElementById("sens-flow-label").firstChild.textContent = SENS_FLOW_LABEL[type] + ": ";

  priceSlider.value = appState.sensitivity.price ?? results.process.price;
  flowSlider.value = appState.sensitivity.flow ?? baseFlow;
  updateSensitivityOutputs();
}

function onSensitivityChange() {
  appState.sensitivity.price = Number(document.getElementById("sens-price").value);
  appState.sensitivity.flow = Number(document.getElementById("sens-flow").value);
  saveState();
  updateSensitivityOutputs();
}

function updateSensitivityOutputs() {
  const price = Number(document.getElementById("sens-price").value);
  const flow = Number(document.getElementById("sens-flow").value);
  document.getElementById("sens-price-val").textContent = "$" + price.toFixed(3);
  document.getElementById("sens-flow-val").textContent = fmt(flow);

  const { powerKW, energyKWh, costPerYear } = computeSensitivity(appState.results, price, flow);
  document.getElementById("sens-power").textContent = fmt(powerKW) + " kW";
  document.getElementById("sens-energy").textContent = kWhToGWh(energyKWh).toFixed(2) + " GWh/yr";
  document.getElementById("sens-cost").textContent = "$" + fmt(costPerYear) + "/yr";
}

function computeSensitivity(results, price, flow) {
  const type = results.equipmentType;
  const rec = getRecommended(results);
  const c = results.conditions;
  let powerKW;

  if (type === "pump") {
    const candidate = PUMP_CANDIDATES.find((x) => x.id === rec.id);
    const efficiency = pumpEfficiencyAtFlow(candidate, flow);
    const availableHead = pumpHeadAtFlow(candidate, flow);
    const hyd = hydraulicPowerKW(c.density, flow, Math.min(availableHead, c.head));
    powerKW = pumpPowerKW(hyd, efficiency);
  } else if (type === "compressor") {
    const candidate = COMPRESSOR_CANDIDATES.find((x) => x.id === rec.id);
    const efficiency = compressorEfficiencyAtFlow(candidate, flow);
    const isentropicKW = isentropicCompressionPowerKW(flow, c.p1, c.p2, c.t1, c.k, c.molarMass);
    powerKW = isentropicKW / efficiency;
  } else if (type === "fan") {
    const candidate = FAN_CANDIDATES.find((x) => x.id === rec.id);
    const efficiency = fanEfficiencyAtFlow(candidate, flow);
    const available = fanPressureAtFlow(candidate, flow);
    powerKW = fanPowerKW(flow, Math.min(available, c.pressure), efficiency);
  } else if (type === "heatExchanger") {
    const candidateDef = HX_CANDIDATES.find((x) => x.id === rec.id);
    const modConditions = { ...c, hotFlow: flow };
    const evalResult = evaluateHXCandidate(candidateDef, modConditions, results.requirements);
    powerKW = evalResult.powerKW;
  }

  const energyKWh = annualEnergyKWh(powerKW, results.process.hours);
  const costPerYear = annualCost(energyKWh, price);
  return { powerKW, energyKWh, costPerYear };
}

/* ---------------- engineering details ---------------- */
function renderEngineeringDetails(results, rec) {
  const type = results.equipmentType;
  if (type === "pump") return renderPumpEngineering(results, rec);
  if (type === "compressor") return renderCompressorEngineering(results, rec);
  if (type === "fan") return renderFanEngineering(results, rec);
  if (type === "heatExchanger") return renderHXEngineering(results, rec);
}

function renderPumpEngineering(results, rec) {
  const c = results.conditions;
  const p = results.extra.pipeline;
  document.getElementById("engineering-detail").innerHTML = `
    <div class="eq-block"><h4>1. Hydraulic Power</h4>
      <div class="eq-formula">P_h = &rho; &middot; g &middot; Q &middot; H</div>
      <div class="eq-sub">P_h = ${c.density} kg/m&sup3; &times; 9.81 m/s&sup2; &times; ${(c.flow / 3600).toFixed(4)} m&sup3;/s &times; ${fmt(c.head)} m</div>
      <div class="eq-result">P_h = ${fmt(rec.hydraulicKW)} kW</div></div>
    <div class="eq-block"><h4>2. Pump (Shaft) Power</h4>
      <div class="eq-formula">P_pump = P_h / &eta;</div>
      <div class="eq-sub">P_pump = ${fmt(rec.hydraulicKW)} kW / ${(rec.efficiency * 100).toFixed(1)}%</div>
      <div class="eq-result">P_pump = ${fmt(rec.powerKW)} kW</div></div>
    <div class="eq-block"><h4>3. Annual Energy &amp; Cost</h4>
      <div class="eq-formula">E = P &middot; t &nbsp;&nbsp; Cost = E &middot; price</div>
      <div class="eq-sub">E = ${fmt(rec.powerKW)} kW &times; ${fmt(results.process.hours)} hr/yr = ${fmt(rec.energyKWh)} kWh/yr</div>
      <div class="eq-result">Cost = $${fmt(rec.costPerYear)}/yr</div></div>
    <div class="eq-block"><h4>4. Pipeline Sanity Check (assumed 1000 m run, 2 m/s design velocity)</h4>
      <div class="eq-formula">D = sqrt(4Q / (&pi; &middot; v)) &nbsp;&nbsp; Re = &rho;vD/&mu; &nbsp;&nbsp; &Delta;P = f(L/D)(&rho;v&sup2;/2)</div>
      <div class="eq-sub">D &asymp; ${(p.diameterM * 1000).toFixed(0)} mm, Re &asymp; ${p.reynolds.toExponential(2)} (${p.reynolds > 4000 ? "turbulent" : "laminar"})</div>
      <div class="eq-result">Friction loss &asymp; ${p.dP_bar.toFixed(2)} bar over ${p.length} m (${p.headLossM.toFixed(1)} m of head)</div></div>
    <div class="eq-block"><h4>5. Lifecycle Cost</h4>
      <div class="eq-formula">LCC = C_capital + Cost_annual &middot; years</div>
      <div class="eq-result">LCC = $${fmt(rec.capitalCost)} + $${fmt(rec.costPerYear)}/yr &times; ${results.requirements.life} yr = $${(rec.lcc20 / 1e6).toFixed(2)}M</div></div>
  `;
}

function renderCompressorEngineering(results, rec) {
  const c = results.conditions;
  const rho1 = gasDensity(c.p1, c.t1, c.molarMass);
  document.getElementById("engineering-detail").innerHTML = `
    <div class="eq-block"><h4>1. Inlet Gas Density (ideal gas)</h4>
      <div class="eq-formula">&rho; = P &middot; M / (R &middot; T)</div>
      <div class="eq-sub">&rho; = ${(c.p1 * 1e5).toFixed(0)} Pa &times; ${c.molarMass} kg/kmol / (8314 &times; ${(c.t1 + 273.15).toFixed(1)} K)</div>
      <div class="eq-result">&rho;&#8321; = ${rho1.toFixed(2)} kg/m&sup3;</div></div>
    <div class="eq-block"><h4>2. Isentropic Compression Power</h4>
      <div class="eq-formula">W = m&#775; &middot; (k/(k-1)) &middot; (R/M) &middot; T&#8321; &middot; [(P&#8322;/P&#8321;)^((k-1)/k) &minus; 1]</div>
      <div class="eq-sub">Pressure ratio = ${rec.pressureRatio.toFixed(2)}, k = ${c.k}, isentropic power = ${fmt(rec.isentropicKW)} kW</div>
      <div class="eq-result">Shaft power = ${fmt(rec.isentropicKW)} kW / ${(rec.efficiency * 100).toFixed(1)}% = ${fmt(rec.powerKW)} kW</div></div>
    <div class="eq-block"><h4>3. Annual Energy &amp; Cost</h4>
      <div class="eq-formula">E = P &middot; t &nbsp;&nbsp; Cost = E &middot; price</div>
      <div class="eq-sub">E = ${fmt(rec.powerKW)} kW &times; ${fmt(results.process.hours)} hr/yr = ${fmt(rec.energyKWh)} kWh/yr</div>
      <div class="eq-result">Cost = $${fmt(rec.costPerYear)}/yr</div></div>
    <div class="eq-block"><h4>4. Lifecycle Cost</h4>
      <div class="eq-formula">LCC = C_capital + Cost_annual &middot; years</div>
      <div class="eq-result">LCC = $${fmt(rec.capitalCost)} + $${fmt(rec.costPerYear)}/yr &times; ${results.requirements.life} yr = $${(rec.lcc20 / 1e6).toFixed(2)}M</div></div>
  `;
}

function renderFanEngineering(results, rec) {
  const c = results.conditions;
  document.getElementById("engineering-detail").innerHTML = `
    <div class="eq-block"><h4>1. Fan Shaft Power</h4>
      <div class="eq-formula">P = Q &middot; &Delta;P / &eta;</div>
      <div class="eq-sub">P = ${(c.flow / 3600).toFixed(3)} m&sup3;/s &times; ${fmt(c.pressure)} Pa / ${(rec.efficiency * 100).toFixed(1)}%</div>
      <div class="eq-result">P = ${fmt(rec.powerKW)} kW</div></div>
    <div class="eq-block"><h4>2. Annual Energy &amp; Cost</h4>
      <div class="eq-formula">E = P &middot; t &nbsp;&nbsp; Cost = E &middot; price</div>
      <div class="eq-sub">E = ${fmt(rec.powerKW)} kW &times; ${fmt(results.process.hours)} hr/yr = ${fmt(rec.energyKWh)} kWh/yr</div>
      <div class="eq-result">Cost = $${fmt(rec.costPerYear)}/yr</div></div>
    <div class="eq-block"><h4>3. Lifecycle Cost</h4>
      <div class="eq-formula">LCC = C_capital + Cost_annual &middot; years</div>
      <div class="eq-result">LCC = $${fmt(rec.capitalCost)} + $${fmt(rec.costPerYear)}/yr &times; ${results.requirements.life} yr = $${(rec.lcc20 / 1e6).toFixed(2)}M</div></div>
  `;
}

function renderHXEngineering(results, rec) {
  const c = results.conditions;
  document.getElementById("engineering-detail").innerHTML = `
    <div class="eq-block"><h4>1. Process Duty</h4>
      <div class="eq-formula">Q = m&#775; &middot; Cp &middot; &Delta;T</div>
      <div class="eq-sub">Q = (${fmt(c.hotFlow)} m&sup3;/hr &times; ${c.hotDensity} kg/m&sup3; / 3600) &times; ${c.hotCp} kJ/kg.K &times; ${Math.abs(c.hotIn - c.hotOut)} K</div>
      <div class="eq-result">Q = ${fmt(rec.duty)} kW</div></div>
    <div class="eq-block"><h4>2. Log-Mean Temperature Difference (counterflow)</h4>
      <div class="eq-formula">LMTD = (&Delta;T&#8321; &minus; &Delta;T&#8322;) / ln(&Delta;T&#8321;/&Delta;T&#8322;)</div>
      <div class="eq-sub">&Delta;T&#8321; = ${(c.hotIn - c.coldOut).toFixed(1)} K, &Delta;T&#8322; = ${(c.hotOut - c.coldIn).toFixed(1)} K</div>
      <div class="eq-result">LMTD = ${rec.lmtd ? rec.lmtd.toFixed(1) + " K" : "infeasible (temperature crossover)"}</div></div>
    <div class="eq-block"><h4>3. Required Heat Transfer Area</h4>
      <div class="eq-formula">A = Q / (U &middot; LMTD)</div>
      <div class="eq-sub">A = ${fmt(rec.duty)} kW / (${rec.U} W/m&sup2;.K &times; ${rec.lmtd ? rec.lmtd.toFixed(1) : "-"} K)</div>
      <div class="eq-result">A = ${isFinite(rec.area) ? fmt(rec.area) + " m\u00b2" : "infeasible"}</div></div>
    <div class="eq-block"><h4>4. Auxiliary Operating Power</h4>
      <div class="eq-sub">${HX_CANDIDATES.find((x) => x.id === rec.id).usesFan
        ? `Fan power scaled to face area: ${fmt(rec.area)} m&sup2; &times; ${HX_CANDIDATES.find((x) => x.id === rec.id).fanPowerPerM2} kW/m&sup2;`
        : `Pumping power to overcome ${rec.pressureDropBar} bar exchanger pressure drop`}</div>
      <div class="eq-result">P = ${fmt(rec.powerKW)} kW &nbsp;&rarr;&nbsp; Cost = $${fmt(rec.costPerYear)}/yr</div></div>
    <div class="eq-block"><h4>5. Lifecycle Cost</h4>
      <div class="eq-formula">LCC = C_capital + Cost_annual &middot; years</div>
      <div class="eq-result">LCC = $${fmt(rec.capitalCost)} + $${fmt(rec.costPerYear)}/yr &times; ${results.requirements.life} yr = $${(rec.lcc20 / 1e6).toFixed(2)}M</div></div>
  `;
}

/* ------------------------------------------------------------------
   Report
------------------------------------------------------------------ */
function bindReportButtons() {
  document.getElementById("btn-print-report").addEventListener("click", () => window.print());
  document.getElementById("btn-download-report").addEventListener("click", () => {
    if (!appState.results) return;
    const text = buildReportText(appState);
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (appState.project.name || "og-screening-report").replace(/\s+/g, "_") + ".txt";
    a.click();
    URL.revokeObjectURL(url);
  });
}

function renderReportView() {
  if (!appState.results) {
    document.getElementById("report-empty").classList.remove("hidden");
    document.getElementById("report-content").classList.add("hidden");
    return;
  }
  document.getElementById("report-empty").classList.add("hidden");
  document.getElementById("report-content").classList.remove("hidden");
  document.getElementById("report-sheet").innerHTML = buildReportHTML(appState);
}

/* ------------------------------------------------------------------
   Energy Optimization
------------------------------------------------------------------ */
function bindOptimizePage() {
  const o = appState.energyOpt;
  setVal("opt-equip-type", o.equipmentType);
  setVal("opt-power", o.currentPowerKW);
  setVal("opt-eff", o.currentEfficiency);
  setVal("opt-hours", o.hours);
  setVal("opt-price", o.price);
  setVal("opt-emissions", o.emissionsFactor);

  ["opt-equip-type", "opt-power", "opt-eff", "opt-hours", "opt-price", "opt-emissions"].forEach((id) => {
    document.getElementById(id).addEventListener("input", () => {
      appState.energyOpt.equipmentType = document.getElementById("opt-equip-type").value;
      appState.energyOpt.currentPowerKW = Number(document.getElementById("opt-power").value);
      appState.energyOpt.currentEfficiency = Number(document.getElementById("opt-eff").value);
      appState.energyOpt.hours = Number(document.getElementById("opt-hours").value);
      appState.energyOpt.price = Number(document.getElementById("opt-price").value);
      appState.energyOpt.emissionsFactor = Number(document.getElementById("opt-emissions").value);
      saveState();
    });
  });

  document.getElementById("btn-run-optimization").addEventListener("click", () => {
    const o = appState.energyOpt;
    const results = runEnergyOptimization({
      equipmentType: o.equipmentType, currentPowerKW: o.currentPowerKW, currentEfficiency: o.currentEfficiency,
      hours: o.hours, price: o.price, emissionsFactor: o.emissionsFactor,
    });
    appState.energyOpt.results = results;
    saveState();
    renderOptimizationResults(results);
  });

  if (o.results) renderOptimizationResults(o.results);
}

function renderOptimizationResults(r) {
  document.getElementById("opt-results").classList.remove("hidden");
  document.getElementById("opt-verdict").textContent = r.worthwhile
    ? `Upgrading this ${EQUIP_LABELS[r.equipmentType].toLowerCase()} looks worthwhile`
    : `This ${EQUIP_LABELS[r.equipmentType].toLowerCase()} is already reasonably efficient`;
  document.getElementById("opt-reduction-pct").textContent = r.energyReductionPct.toFixed(1) + "%";

  document.getElementById("opt-current-eff").textContent = r.currentEfficiency.toFixed(1) + "%";
  document.getElementById("opt-best-eff").textContent = (r.bestEff * 100).toFixed(1) + "%";
  document.getElementById("opt-current-energy").textContent = kWhToGWh(r.currentEnergyKWh).toFixed(2) + " GWh/yr ($" + fmt(r.currentCostPerYear) + ")";
  document.getElementById("opt-optimized-energy").textContent = kWhToGWh(r.optimizedEnergyKWh).toFixed(2) + " GWh/yr ($" + fmt(r.optimizedCostPerYear) + ")";
  document.getElementById("opt-cost-savings").textContent = "$" + fmt(r.costSavingsPerYear);
  document.getElementById("opt-co2-savings").textContent = r.co2SavingsPerYear.toFixed(1) + " t";

  const rows = [
    ["Estimated upgrade example", r.upgradeExampleName],
    ["Estimated upgrade capital cost", "$" + fmt(r.upgradeCost)],
    ["Annual cost savings", "$" + fmt(r.costSavingsPerYear)],
    ["Simple payback period", isFinite(r.simplePaybackYears) ? r.simplePaybackYears.toFixed(1) + " years" : "n/a (no cost savings)"],
  ];
  document.getElementById("opt-investment-table").innerHTML = rows.map(([k, v]) => `<tr><th>${k}</th><td class="num">${v}</td></tr>`).join("");
}

/* ------------------------------------------------------------------
   Small helpers
------------------------------------------------------------------ */
function fmt(v) { return Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 }); }

function displayName(c) { return c.name.replace(/^Candidate \w: /, ""); }

function debounce(fn, wait) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}
