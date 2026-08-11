/* ===================================================================
   heatExchangerData.js: candidate heat exchanger library. Unlike
   pumps/compressors/fans, exchangers are sized rather than picked
   from a curve: each candidate is defined by a typical overall heat
   transfer coefficient (U) and a cost basis, and the required area
   is solved for from the actual process duty (see screening.js).
   The exchanger's operating "energy cost" is the pumping/fan power
   needed to push fluid through it against its typical pressure drop.
   It reuses the same hydraulic/fan power equations as the other
   equipment types so the rest of the app (energy, environmental,
   lifecycle) works unmodified.
=================================================================== */

const HX_CANDIDATES = [
  {
    id: "A",
    name: "Candidate A: Shell & Tube Exchanger",
    model: "ST-Series",
    U: 850,            // W/m2.K, typical liquid-liquid
    costPerM2: 4500,     // $/m2
    baseCost: 35000,      // fixed cost (heads, nozzles, structure)
    pressureDropBar: 0.7,
    usesFan: false,
  },
  {
    id: "B",
    name: "Candidate B: Plate & Frame Exchanger",
    model: "PF-Series",
    U: 3500,
    costPerM2: 6000,
    baseCost: 20000,
    pressureDropBar: 0.5,
    usesFan: false,
  },
  {
    id: "C",
    name: "Candidate C: Air-Cooled Exchanger",
    model: "AC-Series",
    U: 450,
    costPerM2: 3200,
    baseCost: 60000,
    pressureDropBar: 0,
    usesFan: true,
    fanPowerPerM2: 0.05, // kW of fan power per m2 of face area
  },
];
