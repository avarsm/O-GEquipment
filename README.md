# O&G Equipment Screening Tool

A preliminary equipment-selection and lifecycle energy/cost analysis tool for
oil & gas applications. Screens **pumps, compressors, fans/blowers, and heat
exchangers**, and includes a standalone **Energy Optimization** tool for
analyzing equipment already in service.

No build step, no framework, no external services. It's plain HTML/CSS/JS so
it's easy to read, easy to extend, and easy to explain in an interview.

## Running it in VS Code

1. Open the `og-equipment-tool` folder in VS Code (`File > Open Folder…`).
   Make sure you open the folder that directly contains `index.html`,
   not a parent folder, and not the folder before it's been extracted.
2. Install the **Live Server** extension (by Ritwick Dey) from the
   Extensions panel (the four-squares icon in the left sidebar) if you don't
   already have it.
3. Right-click `index.html` in the file explorer and choose
   **"Open with Live Server"**.
4. Your browser opens the tool at `http://127.0.0.1:5500` (or similar) and
   auto-reloads whenever you save a file.

No Live Server extension available? Just navigate to the extracted folder in
Finder/File Explorer and double-click `index.html`, it opens directly in
your default browser, fully functional, you just won't get auto-reload.

No `npm install` is required. There are no external dependencies (no CDN
scripts, no fonts, no chart libraries). The lifecycle cost chart is drawn
with plain Canvas 2D so the project runs identically online or fully offline.

## What the tool covers

| Equipment type | Reached from | What it does |
|---|---|---|
| **Pumps** | Dashboard → Pumping Systems | Centrifugal pump screening from head/flow duty point, pipeline sizing check |
| **Compressors** | Dashboard → Compression Systems | Reciprocating / centrifugal / rotary screw screening from inlet-outlet pressure & gas properties |
| **Fans / Blowers** | Screening page equipment picker | Fan screening from flow & required pressure rise |
| **Heat Exchangers** | Dashboard → Heat Transfer | Shell & tube / plate & frame / air-cooled sizing from a hot/cold stream duty |
| **Energy Optimization** | Dashboard → Energy Optimization | Standalone tool: analyze equipment already in service and estimate upgrade savings |

The equipment-screening workflow is the same shape for all four types:
**Project Setup → Screening → Results → Report.** A step indicator at the
top tracks where you are.

## Project structure

```
og-equipment-tool/
  index.html            All page sections; JS toggles which one is visible.
  css/style.css          Single stylesheet.
  js/
    state.js              App state (keyed per equipment type) + localStorage.
    engineering.js          The equations: hydraulic power, pump power,
                             isentropic compression, fan power, LMTD/area
                             sizing, Reynolds number, Darcy-Weisbach loss,
                             lifecycle cost. Every number in the UI traces
                             back to a function here.
    pumpData.js              Candidate pump library + curve models.
    compressorData.js         Candidate compressor library + gas properties.
    fanData.js                 Candidate fan library + curve models.
    heatExchangerData.js        Candidate heat exchanger library.
    applications.js              One-click application presets across
                                  upstream / midstream / downstream, tagged
                                  by which equipment type they apply to.
    screening.js                  Evaluates + scores candidates for
                                   whichever equipment type is selected.
    energyOptimization.js          Existing-equipment savings analysis.
    charts.js                       Hand-rolled Canvas bar chart.
    report.js                        Printable/downloadable report,
                                      equipment-type aware.
    app.js                           Wires the DOM to everything above.
```

## What's actually being calculated

- **Pumps**: `P_h = ρgQH`, `P_pump = P_h/η`, centrifugal pump/efficiency
  curves fit to each candidate's best-efficiency point, pipe sizing +
  Reynolds number + Darcy-Weisbach friction loss (Swamee-Jain factor).
- **Compressors**: ideal-gas inlet density, isentropic compression work
  `W = ṁ(k/(k-1))(R/M)T₁[(P₂/P₁)^((k-1)/k) − 1]`, divided by isentropic
  efficiency for shaft power.
- **Fans/Blowers**: `P = QΔP/η`, with pressure/efficiency curves fit to
  each candidate's best-efficiency point (same shape as the pump curves,
  using pressure rise in place of head).
- **Heat Exchangers**: energy balance for duty (`Q = ṁCpΔT`), log-mean
  temperature difference for counterflow, area sized from `A = Q/(U·LMTD)`
  for each candidate's typical U-value, with pumping (or fan, for
  air-cooled) power to overcome the exchanger's pressure drop feeding the
  same energy/cost/lifecycle framework as the other equipment types.
- **Lifecycle cost**: simple (undiscounted) `capital cost + annual cost ×
  years` for every equipment type.
- **Environmental impact**: energy savings converted to CO₂ using a
  user-adjustable grid emissions factor.
- **Energy Optimization**: holds the equipment's useful output constant
  and re-solves for power at a best-in-class efficiency, to estimate
  savings and a simple payback period for upgrading.

All of the above is shown, with real numbers substituted in, on the "View
Engineering Calculations" panel for each equipment type, nothing is a
black box.

## Known simplifications (worth mentioning if you present this)

- Equipment curves are parametric models tuned to look like realistic
  behavior, not digitized manufacturer data. This is a preliminary
  screening tool, not a final-selection tool.
- Lifecycle cost is undiscounted (no NPV/discount rate).
- Each equipment type has 3 candidates in its library; adding more is just
  adding entries to the relevant `*Data.js` file.
- Heat exchanger "operating cost" is a simplified proxy (pumping or fan
  power to overcome a typical pressure drop), not a full hydraulic model
  of the exchanger circuit.
