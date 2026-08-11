/* ===================================================================
   engineering.js: the actual equations. Every number shown anywhere
   in the UI should be traceable back to a function in this file.
   Units are called out on every function so nothing is ambiguous.
=================================================================== */

const G = 9.81; // m/s^2

/**
 * Hydraulic power delivered to the fluid.
 * Ph (kW) = rho (kg/m3) * g (m/s2) * Q (m3/s) * H (m) / 1000
 */
function hydraulicPowerKW(densityKgM3, flowM3Hr, headM) {
  const Q_m3s = flowM3Hr / 3600;
  const Ph_W = densityKgM3 * G * Q_m3s * headM;
  return Ph_W / 1000;
}

/**
 * Shaft (pump) power required, given hydraulic power and efficiency.
 * P_pump (kW) = Ph (kW) / eta
 */
function pumpPowerKW(hydraulicKW, efficiencyFraction) {
  if (efficiencyFraction <= 0) return Infinity;
  return hydraulicKW / efficiencyFraction;
}

/**
 * Annual energy consumption.
 * E (kWh/yr) = P (kW) * t (hr/yr)
 */
function annualEnergyKWh(powerKW, hoursPerYear) {
  return powerKW * hoursPerYear;
}

function kWhToGWh(kwh) { return kwh / 1e6; }
function kWhToMWh(kwh) { return kwh / 1e3; }

/**
 * Annual operating (energy) cost.
 * Cost ($/yr) = E (kWh/yr) * price ($/kWh)
 */
function annualCost(energyKWh, pricePerKWh) {
  return energyKWh * pricePerKWh;
}

/**
 * Simple (undiscounted) lifecycle cost.
 * LCC = capital cost + annual operating cost * years
 * This is intentionally simple for a preliminary screening tool;
 * a bankable estimate would discount future cash flows (NPV).
 */
function lifecycleCost(capitalCost, annualOperatingCost, years) {
  return capitalCost + annualOperatingCost * years;
}

/**
 * Pipe inside diameter sized for a target velocity (m/s), used only
 * in the engineering-detail breakdown as a sanity check on the
 * assumed line size.
 * D (m) = sqrt(4Q / (pi * v))
 */
function sizePipeDiameter(flowM3Hr, targetVelocityMs = 2.0) {
  const Q_m3s = flowM3Hr / 3600;
  return Math.sqrt((4 * Q_m3s) / (Math.PI * targetVelocityMs));
}

/**
 * Reynolds number.
 * Re = rho * v * D / mu   (mu in Pa.s, so cP / 1000)
 */
function reynoldsNumber(densityKgM3, velocityMs, diameterM, viscosityCp) {
  const mu = viscosityCp / 1000; // Pa.s
  return (densityKgM3 * velocityMs * diameterM) / mu;
}

/**
 * Darcy friction factor via the Swamee-Jain explicit approximation
 * (valid for turbulent flow, 4000 < Re < 1e8).
 * f = 0.25 / [log10( eps/(3.7D) + 5.74/Re^0.9 )]^2
 */
function darcyFrictionFactor(reynolds, diameterM, roughnessM = 0.000045) {
  if (reynolds < 2300) {
    // laminar
    return 64 / reynolds;
  }
  const term = roughnessM / (3.7 * diameterM) + 5.74 / Math.pow(reynolds, 0.9);
  return 0.25 / Math.pow(Math.log10(term), 2);
}

/**
 * Darcy-Weisbach pressure loss over a pipe length.
 * dP (Pa) = f * (L/D) * (rho * v^2 / 2)
 * Returned in bar and as an equivalent head in metres.
 */
function pipePressureLoss(densityKgM3, velocityMs, diameterM, lengthM, frictionFactor) {
  const dP_Pa = frictionFactor * (lengthM / diameterM) * (densityKgM3 * velocityMs * velocityMs / 2);
  const dP_bar = dP_Pa / 1e5;
  const headLossM = dP_Pa / (densityKgM3 * G);
  return { dP_Pa, dP_bar, headLossM };
}

/**
 * Convenience: full pipeline sanity-check bundle for a given duty
 * point, used in the Engineering Details view.
 */
function pipelineCheck(densityKgM3, viscosityCp, flowM3Hr, lengthM = 1000) {
  const D = sizePipeDiameter(flowM3Hr, 2.0);
  const Q_m3s = flowM3Hr / 3600;
  const area = Math.PI * Math.pow(D / 2, 2);
  const velocity = Q_m3s / area;
  const Re = reynoldsNumber(densityKgM3, velocity, D, viscosityCp);
  const f = darcyFrictionFactor(Re, D);
  const loss = pipePressureLoss(densityKgM3, velocity, D, lengthM, f);
  return { diameterM: D, velocityMs: velocity, reynolds: Re, frictionFactor: f, length: lengthM, ...loss };
}

/* ===================================================================
   COMPRESSOR EQUATIONS
=================================================================== */

const R_UNIVERSAL = 8314; // J / (kmol . K)

/**
 * Ideal-gas density at inlet conditions.
 * rho = P*M / (R*T)   (P in Pa, M in kg/kmol, T in K)
 */
function gasDensity(pressureBar, tempC, molarMassKgKmol) {
  const P_Pa = pressureBar * 1e5;
  const T_K = tempC + 273.15;
  return (P_Pa * molarMassKgKmol) / (R_UNIVERSAL * T_K);
}

/**
 * Isentropic compression power (before dividing by isentropic
 * efficiency). Standard preliminary-sizing formula:
 * W (kW) = mdot * (k/(k-1)) * (R/M) * T1 * [(P2/P1)^((k-1)/k) - 1] / 1000
 */
function isentropicCompressionPowerKW(flowM3Hr, p1Bar, p2Bar, t1C, k, molarMassKgKmol) {
  const rho1 = gasDensity(p1Bar, t1C, molarMassKgKmol);
  const Q_m3s = flowM3Hr / 3600;
  const mdot = rho1 * Q_m3s; // kg/s
  const T1_K = t1C + 273.15;
  const rp = p2Bar / p1Bar;
  const Rspecific = R_UNIVERSAL / molarMassKgKmol; // J/(kg.K)
  const workPerKg = (k / (k - 1)) * Rspecific * T1_K * (Math.pow(rp, (k - 1) / k) - 1); // J/kg
  return (mdot * workPerKg) / 1000; // kW
}

/* ===================================================================
   FAN / BLOWER EQUATIONS
=================================================================== */

/**
 * Fan shaft power.
 * P (kW) = Q (m3/s) * dP (Pa) / eta / 1000
 */
function fanPowerKW(flowM3Hr, pressureRisePa, efficiencyFraction) {
  const Q_m3s = flowM3Hr / 3600;
  const powerW = (Q_m3s * pressureRisePa) / Math.max(efficiencyFraction, 0.01);
  return powerW / 1000;
}

/* ===================================================================
   HEAT EXCHANGER EQUATIONS
=================================================================== */

/**
 * Heat duty from the hot (process) side energy balance.
 * Q (kW) = mdot (kg/s) * Cp (kJ/kg.K) * dT (K)
 */
function hxDutyKW(flowM3Hr, densityKgM3, cpKJkgK, deltaTC) {
  const mdot = (flowM3Hr / 3600) * densityKgM3; // kg/s
  return mdot * cpKJkgK * Math.abs(deltaTC);
}

/**
 * Log-mean temperature difference, counter-current flow.
 * Returns null if the temperature approach is thermodynamically
 * infeasible (a hot-end or cold-end crossover).
 */
function lmtdCounterflow(hotIn, hotOut, coldIn, coldOut) {
  const dT1 = hotIn - coldOut;
  const dT2 = hotOut - coldIn;
  if (dT1 <= 0 || dT2 <= 0) return null;
  if (Math.abs(dT1 - dT2) < 1e-6) return dT1;
  return (dT1 - dT2) / Math.log(dT1 / dT2);
}

/**
 * Required heat-transfer area.
 * A (m2) = Q (W) / (U (W/m2.K) * LMTD (K))
 */
function hxArea(dutyKW, U_WM2K, lmtdC) {
  if (!lmtdC || lmtdC <= 0) return Infinity;
  return (dutyKW * 1000) / (U_WM2K * lmtdC);
}
