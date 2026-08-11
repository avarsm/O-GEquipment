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
