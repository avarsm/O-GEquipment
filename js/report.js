/* ===================================================================
   report.js: assembles the final one-page engineering summary from
   the current state + results, both as HTML (for the on-screen sheet
   / browser print-to-PDF) and as plain text (for the download
   button). Operating-conditions and recommended-equipment fields are
   equipment-type specific; everything else (energy, environmental,
   lifecycle) is shared.
=================================================================== */

function conditionsRows(results) {
  const c = results.conditions;
  switch (results.equipmentType) {
    case "pump":
      return [
        ["Fluid", fluidLabel(c.fluid)],
        ["Density", c.density + " kg/m3"],
        ["Viscosity", c.viscosity + " cP"],
        ["Flow", fmt(c.flow) + " m3/hr"],
        ["Required head", fmt(c.head) + " m"],
      ];
    case "compressor":
      return [
        ["Gas", GASES[c.gas] ? GASES[c.gas].label : "Custom"],
        ["Inlet flow (actual)", fmt(c.flow) + " m3/hr"],
        ["Inlet pressure", c.p1 + " bar"],
        ["Discharge pressure", c.p2 + " bar"],
        ["Pressure ratio", (c.p2 / c.p1).toFixed(2)],
        ["Inlet temperature", c.t1 + " C"],
      ];
    case "fan":
      return [
        ["Flow", fmt(c.flow) + " m3/hr"],
        ["Required pressure rise", fmt(c.pressure) + " Pa"],
        ["Air density", c.density + " kg/m3"],
      ];
    case "heatExchanger":
      return [
        ["Hot fluid flow", fmt(c.hotFlow) + " m3/hr"],
        ["Hot inlet / outlet temp", `${c.hotIn} C / ${c.hotOut} C`],
        ["Cold inlet / outlet temp", `${c.coldIn} C / ${c.coldOut} C`],
        ["Hot fluid density / Cp", `${c.hotDensity} kg/m3 / ${c.hotCp} kJ/kg.K`],
      ];
    default: return [];
  }
}

function recommendedRows(rec, results) {
  switch (results.equipmentType) {
    case "pump":
      return [
        ["Efficiency", (rec.efficiency * 100).toFixed(1) + "%"],
        ["Shaft power", fmt(rec.powerKW) + " kW"],
        ["Available head at duty flow", fmt(rec.availableHead) + " m"],
      ];
    case "compressor":
      return [
        ["Isentropic efficiency", (rec.efficiency * 100).toFixed(1) + "%"],
        ["Shaft power", fmt(rec.powerKW) + " kW"],
        ["Pressure ratio / max rated", `${rec.pressureRatio.toFixed(2)} / ${rec.maxPressureRatio.toFixed(2)}`],
      ];
    case "fan":
      return [
        ["Efficiency", (rec.efficiency * 100).toFixed(1) + "%"],
        ["Shaft power", fmt(rec.powerKW) + " kW"],
        ["Available pressure at duty flow", fmt(rec.availablePressure) + " Pa"],
      ];
    case "heatExchanger":
      return [
        ["Duty", fmt(rec.duty) + " kW"],
        ["LMTD", rec.lmtd ? rec.lmtd.toFixed(1) + " C" : "infeasible"],
        ["Required area", fmt(rec.area) + " m2"],
        ["Overall U", rec.U + " W/m2.K"],
      ];
    default: return [];
  }
}

function buildReportHTML(state) {
  const r = state.results;
  const rec = getRecommended(r);
  const proj = state.project;

  const dateStr = new Date(r.generatedAt).toLocaleDateString(undefined, {
    year: "numeric", month: "long", day: "numeric",
  });

  const co2Year = co2FromMWh(r.savings.energyKWh, currentEmissionsFactor(state));
  const conditionsHtml = conditionsRows(r).map(([k, v]) => `<dt>${k}</dt><dd>${escapeHtml(String(v))}</dd>`).join("");
  const recRowsHtml = recommendedRows(rec, r).map(([k, v]) => `<dt>${k}</dt><dd>${escapeHtml(String(v))}</dd>`).join("");

  return `
    <h1>O&amp;G Equipment Screening Report</h1>
    <p class="report-meta">Generated ${dateStr} &middot; ${equipmentTypeLabel(r.equipmentType)} screening &middot; Preliminary design aid, not a substitute for a full engineering study. Candidate models are industry-representative estimates, not real manufacturer products or pricing.</p>

    <h2>Project</h2>
    <dl>
      <dt>Project name</dt><dd>${escapeHtml(proj.name || "Untitled project")}</dd>
      <dt>Location</dt><dd>${escapeHtml(proj.location || "&ndash;")}</dd>
      <dt>Application</dt><dd>${escapeHtml(applicationLabel(state.applicationId))}</dd>
      <dt>Operating period</dt><dd>${proj.opPeriod} years</dd>
    </dl>

    <h2>Operating Conditions</h2>
    <dl>${conditionsHtml}</dl>

    <h2>Recommended Equipment</h2>
    <dl>
      <dt>Selection</dt><dd>${escapeHtml(rec.name)} (${rec.model})</dd>
      <dt>Technical score</dt><dd>${rec.score} / 100</dd>
      ${recRowsHtml}
      <dt>Capital cost</dt><dd>$${fmt(rec.capitalCost)}</dd>
    </dl>

    <h2>Energy Analysis</h2>
    <dl>
      <dt>${escapeHtml(r.baseline.label)}</dt><dd>${kWhToGWh(r.baseline.energyKWh).toFixed(2)} GWh/yr</dd>
      <dt>Recommended annual energy</dt><dd>${kWhToGWh(rec.energyKWh).toFixed(2)} GWh/yr</dd>
      <dt>Annual energy savings</dt><dd>${kWhToMWh(r.savings.energyKWh).toFixed(0)} MWh (${r.savings.energyReductionPct.toFixed(1)}%)</dd>
      <dt>Baseline operating cost</dt><dd>$${fmt(r.baseline.costPerYear)}/yr</dd>
      <dt>Recommended operating cost</dt><dd>$${fmt(rec.costPerYear)}/yr</dd>
      <dt>Annual cost savings</dt><dd>$${fmt(r.savings.costPerYear)}/yr</dd>
    </dl>

    <h2>Environmental Impact</h2>
    <dl>
      <dt>Emissions factor used</dt><dd>${currentEmissionsFactor(state)} t CO&#8322;/MWh</dd>
      <dt>CO&#8322; reduction / year</dt><dd>${co2Year.toFixed(1)} t/yr</dd>
      <dt>CO&#8322; reduction over ${proj.opPeriod} years</dt><dd>${(co2Year * proj.opPeriod).toFixed(0)} t</dd>
    </dl>

    <h2>Lifecycle Analysis</h2>
    <dl>
      ${r.candidates.map((cand) => `<dt>${escapeHtml(cand.name.replace(/^Candidate \w: /, ""))}</dt><dd>$${(cand.lcc20 / 1e6).toFixed(2)}M${cand.id === rec.id ? " (recommended)" : ""}</dd>`).join("")}
    </dl>

    <div class="report-conclusion">
      <strong>Recommendation:</strong> ${escapeHtml(rec.name)} provides the best preliminary combination of technical
      suitability (${rec.score}/100), efficiency, and lifecycle cost ($${(rec.lcc20 / 1e6).toFixed(2)}M) under the
      specified operating conditions. This is a preliminary screening result based on simplified equipment models,
      so confirm with vendor-certified performance data before final specification.
    </div>
  `;
}

function buildReportText(state) {
  const r = state.results;
  const rec = getRecommended(r);
  const proj = state.project;
  const co2Year = co2FromMWh(r.savings.energyKWh, currentEmissionsFactor(state));
  const lines = [];
  lines.push("O&G EQUIPMENT SCREENING REPORT");
  lines.push("Generated " + new Date(r.generatedAt).toLocaleString());
  lines.push(equipmentTypeLabel(r.equipmentType) + " screening");
  lines.push("Candidate models are industry-representative estimates, not real manufacturer products or pricing.");
  lines.push("=".repeat(50));
  lines.push("");
  lines.push("PROJECT");
  lines.push(`  Name: ${proj.name || "Untitled project"}`);
  lines.push(`  Location: ${proj.location || "-"}`);
  lines.push(`  Application: ${applicationLabel(state.applicationId)}`);
  lines.push(`  Operating period: ${proj.opPeriod} years`);
  lines.push("");
  lines.push("OPERATING CONDITIONS");
  conditionsRows(r).forEach(([k, v]) => lines.push(`  ${k}: ${v}`));
  lines.push("");
  lines.push("RECOMMENDED EQUIPMENT");
  lines.push(`  ${rec.name} (${rec.model})`);
  lines.push(`  Technical score: ${rec.score}/100`);
  recommendedRows(rec, r).forEach(([k, v]) => lines.push(`  ${k}: ${v}`));
  lines.push(`  Capital cost: $${fmt(rec.capitalCost)}`);
  lines.push("");
  lines.push("ENERGY ANALYSIS");
  lines.push(`  ${r.baseline.label}: ${kWhToGWh(r.baseline.energyKWh).toFixed(2)} GWh/yr`);
  lines.push(`  Recommended annual energy: ${kWhToGWh(rec.energyKWh).toFixed(2)} GWh/yr`);
  lines.push(`  Annual savings: ${kWhToMWh(r.savings.energyKWh).toFixed(0)} MWh (${r.savings.energyReductionPct.toFixed(1)}%)`);
  lines.push(`  Annual cost savings: $${fmt(r.savings.costPerYear)}`);
  lines.push("");
  lines.push("ENVIRONMENTAL IMPACT");
  lines.push(`  CO2 reduction/year: ${co2Year.toFixed(1)} t`);
  lines.push(`  CO2 reduction over ${proj.opPeriod} yr: ${(co2Year * proj.opPeriod).toFixed(0)} t`);
  lines.push("");
  lines.push("LIFECYCLE COST");
  r.candidates.forEach((cand) => {
    lines.push(`  ${cand.name.replace(/^Candidate \w: /, "")}: $${(cand.lcc20 / 1e6).toFixed(2)}M${cand.id === rec.id ? "  <-- recommended" : ""}`);
  });
  lines.push("");
  lines.push("RECOMMENDATION");
  lines.push(`  ${rec.name} provides the best preliminary combination of technical`);
  lines.push(`  suitability, efficiency, and lifecycle cost under the specified`);
  lines.push(`  operating conditions. Confirm with vendor-certified performance`);
  lines.push(`  data before final specification.`);
  return lines.join("\n");
}

function currentEmissionsFactor(state) {
  return state.baseline[state.results.equipmentType].emissionsFactor;
}

function co2FromMWh(energyKWh, factorTPerMWh) {
  return kWhToMWh(energyKWh) * factorTPerMWh;
}

function equipmentTypeLabel(type) {
  const map = { pump: "Pump", compressor: "Compressor", fan: "Fan / Blower", heatExchanger: "Heat Exchanger" };
  return map[type] || type;
}

function applicationLabel(id) {
  const app = getApplicationById(id);
  return app ? `${app.name} (${app.sector})` : "Custom";
}

function fluidLabel(fluidId) {
  const map = {
    crude_oil: "Crude Oil",
    produced_water: "Produced Water",
    injection_water: "Water Injection (treated)",
    diesel: "Diesel",
    custom: "Custom",
  };
  return map[fluidId] || fluidId;
}

function fmt(v) {
  return Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
