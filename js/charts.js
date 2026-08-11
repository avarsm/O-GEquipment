/* ===================================================================
   charts.js: a small hand-rolled bar chart for the 20-year lifecycle
   cost comparison. Deliberately not using an external charting
   library: this keeps the project dependency-free so it opens and
   runs the same way in VS Code / Live Server with no build step and
   no network requirement.
=================================================================== */

function drawLifecycleChart(canvas, candidates, recommendedId) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const cssWidth = rect.width || canvas.parentElement.getBoundingClientRect().width || 600;
  const cssHeight = 220;

  canvas.width = Math.max(1, Math.round(cssWidth * dpr));
  canvas.height = Math.max(1, Math.round(cssHeight * dpr));
  canvas.style.width = cssWidth + "px";
  canvas.style.height = cssHeight + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const padding = { top: 18, right: 18, bottom: 40, left: 70 };
  const chartW = cssWidth - padding.left - padding.right;
  const chartH = cssHeight - padding.top - padding.bottom;

  const values = candidates.map((c) => c.lcc20);
  const maxVal = Math.max(...values) * 1.12;

  const inkMid = "#445069";
  const line = "#dde2e6";
  const cyan = "#1c7293";
  const amber = "#c97a1a";

  // gridlines + y-axis labels
  ctx.strokeStyle = line;
  ctx.fillStyle = inkMid;
  ctx.font = "11px ui-monospace, Menlo, Consolas, monospace";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  const ySteps = 4;
  for (let i = 0; i <= ySteps; i++) {
    const val = (maxVal / ySteps) * i;
    const y = padding.top + chartH - (chartH * i) / ySteps;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + chartW, y);
    ctx.stroke();
    ctx.fillText(formatMoneyShort(val), padding.left - 10, y);
  }

  // bars
  const n = candidates.length;
  const slot = chartW / n;
  const barWidth = Math.min(70, slot * 0.5);

  candidates.forEach((c, i) => {
    const x = padding.left + slot * i + slot / 2 - barWidth / 2;
    const barH = (c.lcc20 / maxVal) * chartH;
    const y = padding.top + chartH - barH;

    ctx.fillStyle = c.id === recommendedId ? cyan : "#a9b8c6";
    ctx.fillRect(x, y, barWidth, barH);

    if (c.id === recommendedId) {
      ctx.strokeStyle = amber;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, barWidth, barH);
    }

    // value label above bar
    ctx.fillStyle = "#14213d";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.font = "600 11px ui-monospace, Menlo, Consolas, monospace";
    ctx.fillText(formatMoneyShort(c.lcc20), x + barWidth / 2, y - 6);

    // x-axis label
    ctx.fillStyle = inkMid;
    ctx.textBaseline = "top";
    ctx.font = "11px -apple-system, Segoe UI, sans-serif";
    ctx.fillText(c.id, x + barWidth / 2, padding.top + chartH + 8);
  });

  // baseline axis
  ctx.strokeStyle = "#14213d";
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top + chartH);
  ctx.lineTo(padding.left + chartW, padding.top + chartH);
  ctx.stroke();
}

function formatMoneyShort(v) {
  if (Math.abs(v) >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
  if (Math.abs(v) >= 1e3) return "$" + (v / 1e3).toFixed(0) + "k";
  return "$" + v.toFixed(0);
}
