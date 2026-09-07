/* Independent check of the Yalman Gaming compatibility engine. */
const E = require("./compatibility.js");

let pass = 0,
  fail = 0;
const failures = [];

function check(name, cond, extra) {
  if (cond) {
    pass++;
  } else {
    fail++;
    failures.push(name + (extra ? "  >> " + extra : ""));
  }
}

/** Minimal BuilderPart with every optional field nulled. */
function part(kind, over) {
  return Object.assign(
    {
      id: kind + "-" + Math.random().toString(36).slice(2, 7),
      slug: kind,
      sku: kind.toUpperCase(),
      name: kind,
      kind,
      brandName: null,
      price: 10000,
      salePrice: null,
      samplePrice: true,
      stock: 5,
      imageUrl: null,
      headline: null,
      socket: null,
      chipset: null,
      tdp: null,
      peakPowerW: null,
      integratedGraphics: false,
      memoryType: null,
      memorySpeed: null,
      memorySlots: null,
      maxMemoryGb: null,
      capacityGb: null,
      moduleCount: null,
      vramGb: null,
      gpuLengthMm: null,
      requiredConnectors: null,
      recommendedPsuW: null,
      storageInterface: null,
      formFactor: null,
      m2Slots: null,
      sataPorts: null,
      wattage: null,
      efficiency: null,
      providedConnectors: null,
      psuFormFactor: null,
      psuLengthMm: null,
      coolerType: null,
      coolerHeightMm: null,
      radiatorSizeMm: null,
      supportedSockets: null,
      coolingCapacityW: null,
      supportedFormFactors: null,
      maxGpuLengthMm: null,
      maxCoolerHeightMm: null,
      maxPsuLengthMm: null,
      radiatorSupport: null,
      caseStyle: null,
      dimensionsMm: null,
      includedFans: null,
      rgb: false,
    },
    over,
  );
}

const has = (r, id) => r.issues.some((i) => i.id === id);
const sev = (r, id) => (r.issues.find((i) => i.id === id) || {}).severity;

/* ---------------------------------------------------------------- */
/* 1. CPU <-> motherboard socket                                     */
/* ---------------------------------------------------------------- */
{
  const r = E.checkCompatibility({
    cpu: [part("cpu", { socket: "AM5", tdp: 120 })],
    motherboard: [part("motherboard", { socket: "LGA1700" })],
  });
  check("socket mismatch -> error", has(r, "cpu-socket") && sev(r, "cpu-socket") === "error");
  check("socket mismatch sets status error", r.status === "error");

  const ok = E.checkCompatibility({
    cpu: [part("cpu", { socket: "AM5", tdp: 120 })],
    motherboard: [part("motherboard", { socket: "AM5" })],
  });
  check("matching socket -> no socket issue", !has(ok, "cpu-socket"));
}

/* Missing data must NOT produce a false incompatibility. */
{
  const r = E.checkCompatibility({
    cpu: [part("cpu", { socket: null, integratedGraphics: true })],
    motherboard: [part("motherboard", { socket: "AM5" })],
  });
  check("null socket -> silent, not a false error", !has(r, "cpu-socket"));
}

/* ---------------------------------------------------------------- */
/* 2. Memory                                                         */
/* ---------------------------------------------------------------- */
{
  const r = E.checkCompatibility({
    motherboard: [part("motherboard", { memoryType: "DDR5", memorySlots: 4, maxMemoryGb: 192 })],
    ram: [part("ram", { memoryType: "DDR4", moduleCount: 2, capacityGb: 32 })],
  });
  check("DDR4 in DDR5 board -> error", sev(r, "ram-type") === "error");
}
{
  const r = E.checkCompatibility({
    motherboard: [part("motherboard", { memoryType: "DDR5", memorySlots: 2, maxMemoryGb: 96 })],
    ram: [part("ram", { memoryType: "DDR5", moduleCount: 4, capacityGb: 64 })],
  });
  check("4 modules in 2 slots -> error", sev(r, "ram-slots") === "error");
}
{
  const r = E.checkCompatibility({
    motherboard: [part("motherboard", { memoryType: "DDR5", memorySlots: 4, maxMemoryGb: 64 })],
    ram: [part("ram", { memoryType: "DDR5", moduleCount: 4, capacityGb: 128 })],
  });
  check("over max capacity -> error", sev(r, "ram-capacity") === "error");
}
{
  const r = E.checkCompatibility({
    motherboard: [part("motherboard", { memoryType: "DDR5", memorySpeed: 5600, memorySlots: 4 })],
    ram: [part("ram", { memoryType: "DDR5", memorySpeed: 6400, moduleCount: 2 })],
  });
  check("faster kit than board -> warning not error", sev(r, "ram-speed") === "warning");
}

/* ---------------------------------------------------------------- */
/* 3. Physical fit                                                   */
/* ---------------------------------------------------------------- */
{
  const r = E.checkCompatibility({
    motherboard: [part("motherboard", { formFactor: "ATX" })],
    case: [part("case", { supportedFormFactors: ["Micro-ATX", "Mini-ITX"] })],
  });
  check("ATX board in mATX case -> error", sev(r, "board-case-fit") === "error");
}
{
  const r = E.checkCompatibility({
    gpu: [part("gpu", { gpuLengthMm: 358, tdp: 320 })],
    case: [part("case", { maxGpuLengthMm: 330 })],
  });
  check("358mm GPU in 330mm case -> error", sev(r, "gpu-length") === "error");
}
{
  const r = E.checkCompatibility({
    gpu: [part("gpu", { gpuLengthMm: 325, tdp: 320 })],
    case: [part("case", { maxGpuLengthMm: 330 })],
  });
  check("5mm clearance -> tight warning", sev(r, "gpu-length-tight") === "warning");
  check("tight clearance is not a blocker", !has(r, "gpu-length"));
}
{
  const r = E.checkCompatibility({
    cooler: [part("cooler", { coolerType: "air", coolerHeightMm: 165 })],
    case: [part("case", { maxCoolerHeightMm: 155 })],
  });
  check("165mm cooler in 155mm case -> error", sev(r, "cooler-height") === "error");
}
{
  const r = E.checkCompatibility({
    cooler: [part("cooler", { coolerType: "aio", radiatorSizeMm: 360 })],
    case: [part("case", { radiatorSupport: { top: 240, front: 280, rear: 120 } })],
  });
  check("360 rad in 280-max case -> error", sev(r, "radiator-fit") === "error");
}
{
  const r = E.checkCompatibility({
    cooler: [part("cooler", { coolerType: "aio", radiatorSizeMm: 240 })],
    case: [part("case", { radiatorSupport: { top: 240, front: 280 } })],
  });
  check("240 rad fits 280 case -> no issue", !has(r, "radiator-fit"));
}

/* Air cooler height must NOT be checked for an AIO. */
{
  const r = E.checkCompatibility({
    cooler: [part("cooler", { coolerType: "aio", coolerHeightMm: 400, radiatorSizeMm: 240 })],
    case: [part("case", { maxCoolerHeightMm: 155, radiatorSupport: { top: 360 } })],
  });
  check("AIO not judged by air-cooler height", !has(r, "cooler-height"));
}

/* ---------------------------------------------------------------- */
/* 4. Cooler <-> CPU                                                 */
/* ---------------------------------------------------------------- */
{
  const r = E.checkCompatibility({
    cpu: [part("cpu", { socket: "AM5", tdp: 120 })],
    cooler: [part("cooler", { supportedSockets: ["LGA1700", "LGA1851"], coolerType: "air" })],
  });
  check("cooler lacking socket -> error", sev(r, "cooler-socket") === "error");
}
{
  const r = E.checkCompatibility({
    cpu: [part("cpu", { socket: "AM5", tdp: 170 })],
    cooler: [part("cooler", { supportedSockets: ["AM5"], coolerType: "air", coolingCapacityW: 120 })],
  });
  check("underpowered cooler -> warning", sev(r, "cooler-capacity") === "warning");
}

/* ---------------------------------------------------------------- */
/* 5. Power                                                          */
/* ---------------------------------------------------------------- */
{
  const p = E.estimatePower({
    cpu: [part("cpu", { tdp: 120 })],
    gpu: [part("gpu", { tdp: 320 })],
    motherboard: [part("motherboard", { formFactor: "ATX" })],
    ram: [part("ram", { moduleCount: 2, memoryType: "DDR5" })],
    storage: [part("storage", { storageInterface: "nvme-gen4" })],
    cooler: [part("cooler", { coolerType: "aio" })],
  });
  // 120*1.35=162 + 320*1.1=352 + 55 + 8 + 8 + 18 + 25 base = 628
  check("power estimate in sane range", p.estimatedWatts > 560 && p.estimatedWatts < 700, "got " + p.estimatedWatts);
  check("recommends a real PSU size", [850, 1000].includes(p.recommendedPsuW), "got " + p.recommendedPsuW);
  check("breakdown covers every powered part", p.breakdown.length === 6, "got " + p.breakdown.length);

  const empty = E.estimatePower({});
  check("empty build draws 0W", empty.estimatedWatts === 0);
  check("empty build recommends nothing", empty.recommendedPsuW === 0);
}
{
  const sel = {
    cpu: [part("cpu", { tdp: 170 })],
    gpu: [part("gpu", { tdp: 450 })],
    motherboard: [part("motherboard", { formFactor: "ATX" })],
    psu: [part("psu", { wattage: 550 })],
  };
  const r = E.checkCompatibility(sel);
  check("PSU below draw -> error", sev(r, "psu-undersized") === "error");
}
{
  const sel = {
    cpu: [part("cpu", { tdp: 120 })],
    gpu: [part("gpu", { tdp: 320 })],
    motherboard: [part("motherboard", { formFactor: "ATX" })],
    psu: [part("psu", { wattage: 650 })],
  };
  const r = E.checkCompatibility(sel);
  check("PSU above draw but under recommended -> warning", sev(r, "psu-tight") === "warning");
  check("tight PSU is not a blocker", !has(r, "psu-undersized"));
  check("load percent computed", r.power.loadPercent > 0 && r.power.loadPercent < 100);
}

/* Connectors */
{
  const r = E.checkCompatibility({
    gpu: [part("gpu", { tdp: 300, requiredConnectors: ["8-pin", "8-pin"] })],
    psu: [part("psu", { wattage: 1000, providedConnectors: { pcie8: 1 } })],
  });
  check("too few 8-pin -> error", sev(r, "psu-connector-pcie8") === "error");
}
{
  const r = E.checkCompatibility({
    gpu: [part("gpu", { tdp: 300, requiredConnectors: ["8-pin", "8-pin"] })],
    psu: [part("psu", { wattage: 1000, providedConnectors: { pcie8: 4 } })],
  });
  check("enough 8-pin -> no connector issue", !has(r, "psu-connector-pcie8"));
}
{
  const r = E.checkCompatibility({
    gpu: [part("gpu", { tdp: 450, requiredConnectors: ["12VHPWR"] })],
    psu: [part("psu", { wattage: 1000, providedConnectors: { pcie8: 4 } })],
  });
  check("12VHPWR via adapter -> warning not error", sev(r, "psu-12vhpwr-adapter") === "warning");
}
{
  const r = E.checkCompatibility({
    gpu: [part("gpu", { tdp: 450, requiredConnectors: ["12VHPWR"] })],
    psu: [part("psu", { wattage: 850, providedConnectors: { pcie8: 2 } })],
  });
  check("12VHPWR with only 2x8-pin -> error", sev(r, "psu-connector-12vhpwr") === "error");
}
{
  const r = E.checkCompatibility({
    gpu: [part("gpu", { tdp: 450, requiredConnectors: ["12VHPWR"] })],
    psu: [part("psu", { wattage: 1000, providedConnectors: { "12vhpwr": 1, pcie8: 2 } })],
  });
  check("native 12VHPWR -> clean", !has(r, "psu-12vhpwr-adapter") && !has(r, "psu-connector-12vhpwr"));
}
check("connector aliases normalise", E.normalizeConnector("6+2-pin") === "pcie8" && E.normalizeConnector("16-pin") === "12vhpwr" && E.normalizeConnector("12V-2x6") === "12vhpwr");

/* ---------------------------------------------------------------- */
/* 6. Storage <-> board                                              */
/* ---------------------------------------------------------------- */
{
  const r = E.checkCompatibility({
    motherboard: [part("motherboard", { m2Slots: 2, sataPorts: 4 })],
    storage: [
      part("storage", { storageInterface: "nvme-gen4" }),
      part("storage", { storageInterface: "nvme-gen4" }),
      part("storage", { storageInterface: "nvme-gen5" }),
    ],
  });
  check("3 NVMe in 2 M.2 slots -> error", sev(r, "storage-m2") === "error");
}
{
  const r = E.checkCompatibility({
    motherboard: [part("motherboard", { m2Slots: 4, sataPorts: 1 })],
    storage: [
      part("storage", { storageInterface: "sata" }),
      part("storage", { storageInterface: "hdd" }),
    ],
  });
  check("2 SATA in 1 port -> error", sev(r, "storage-sata") === "error");
}

/* ---------------------------------------------------------------- */
/* 7. Display output                                                 */
/* ---------------------------------------------------------------- */
{
  const r = E.checkCompatibility({ cpu: [part("cpu", { socket: "AM5", integratedGraphics: false })] });
  check("no GPU + no iGPU -> error", sev(r, "no-display-output") === "error");
}
{
  const r = E.checkCompatibility({ cpu: [part("cpu", { socket: "AM5", integratedGraphics: true })] });
  check("no GPU but iGPU present -> fine", !has(r, "no-display-output"));
}

/* ---------------------------------------------------------------- */
/* 8. Completeness                                                   */
/* ---------------------------------------------------------------- */
{
  const r = E.checkCompatibility({});
  check("empty build lists all required kinds missing", r.missing.length === 8, "missing=" + r.missing.join(","));
  check("empty build is not complete", r.complete === false);
  check("empty build status ok (nothing conflicts yet)", r.status === "ok");
}

/* A full, genuinely valid build must come back clean and complete. */
{
  const good = {
    cpu: [part("cpu", { socket: "AM5", tdp: 120, integratedGraphics: true })],
    motherboard: [part("motherboard", { socket: "AM5", formFactor: "ATX", memoryType: "DDR5", memorySpeed: 6000, memorySlots: 4, maxMemoryGb: 192, m2Slots: 4, sataPorts: 4 })],
    gpu: [part("gpu", { tdp: 300, gpuLengthMm: 304, requiredConnectors: ["8-pin", "8-pin"] })],
    ram: [part("ram", { memoryType: "DDR5", memorySpeed: 6000, moduleCount: 2, capacityGb: 32 })],
    storage: [part("storage", { storageInterface: "nvme-gen4" })],
    cooler: [part("cooler", { coolerType: "aio", radiatorSizeMm: 360, supportedSockets: ["AM5"], coolingCapacityW: 250 })],
    psu: [part("psu", { wattage: 850, providedConnectors: { pcie8: 4 }, psuFormFactor: "ATX", psuLengthMm: 160 })],
    case: [part("case", { supportedFormFactors: ["ATX", "Micro-ATX", "Mini-ITX"], maxGpuLengthMm: 400, maxCoolerHeightMm: 170, maxPsuLengthMm: 200, radiatorSupport: { top: 360, front: 360 }, includedFans: 3, caseStyle: "Mid Tower", dimensionsMm: "230 x 480 x 460" })],
  };
  const r = E.checkCompatibility(good);
  check("valid build -> status ok", r.status === "ok", "issues: " + r.issues.map((i) => i.id + ":" + i.severity).join(", "));
  check("valid build -> complete", r.complete === true, "missing: " + r.missing.join(","));
  check("valid build -> zero issues", r.issues.length === 0, r.issues.map((i) => i.id).join(","));

  /* rankCandidates must exclude a case that cannot fit this GPU. */
  const cases = [
    part("case", { name: "Big", supportedFormFactors: ["ATX"], maxGpuLengthMm: 400, maxCoolerHeightMm: 170, radiatorSupport: { top: 360 }, includedFans: 3 }),
    part("case", { name: "Tiny", supportedFormFactors: ["Mini-ITX"], maxGpuLengthMm: 200, maxCoolerHeightMm: 60, radiatorSupport: { top: 120 }, includedFans: 1 }),
  ];
  const ranked = E.rankCandidates("case", cases, good);
  check("rankCandidates keeps the fitting case", ranked[0].compatible === true);
  check("rankCandidates rejects the too-small case", ranked[1].compatible === false);
  check("rejection explains why", !!ranked[1].blocker && ranked[1].blocker.title.length > 0, ranked[1].blocker && ranked[1].blocker.title);

  /* Totals */
  check("componentsTotal sums parts", E.componentsTotal(good) === 8 * 10000, "got " + E.componentsTotal(good));
  check("hasSamplePricing detects seeded prices", E.hasSamplePricing(good) === true);
}

/* rankCandidates must not be poisoned by a pre-existing unrelated conflict. */
{
  const broken = {
    cpu: [part("cpu", { socket: "AM5", tdp: 120, integratedGraphics: true })],
    motherboard: [part("motherboard", { socket: "LGA1700", formFactor: "ATX" })], // already conflicting
  };
  const gpus = [part("gpu", { name: "A", tdp: 200, gpuLengthMm: 280 })];
  const ranked = E.rankCandidates("gpu", gpus, broken);
  check("existing conflict does not grey out unrelated parts", ranked[0].compatible === true, ranked[0].blocker && ranked[0].blocker.id);
}

/* ---------------------------------------------------------------- */
/* 9. Candidate blocking must not fault a slot the user has not filled */
/* ---------------------------------------------------------------- */
{
  // A CPU with no integrated graphics raises "no display output" until a GPU
  // is chosen. At the CPU step that is not this CPU's fault, so it must stay
  // selectable — otherwise every F-suffix part looks broken on a fresh build.
  const cpus = [
    part("cpu", { name: "no-igpu", socket: "AM5", tdp: 105, integratedGraphics: false }),
    part("cpu", { name: "igpu", socket: "AM5", tdp: 65, integratedGraphics: true }),
  ];
  const ranked = E.rankCandidates("cpu", cpus, {});
  check("CPU without iGPU stays selectable before a GPU is picked", ranked[0].compatible === true, ranked[0].blocker && ranked[0].blocker.id);
  check("CPU with iGPU selectable", ranked[1].compatible === true);

  // But the build as a whole is still reported as broken, so checkout is gated.
  const r = E.checkCompatibility({ cpu: [cpus[0]] });
  check("...while the build itself still reports no display output", sev(r, "no-display-output") === "error");
}
{
  // The guard must not soften a conflict where BOTH parts are actually chosen.
  const sel = { gpu: [part("gpu", { gpuLengthMm: 358, tdp: 320 })] };
  const cases = [part("case", { name: "small", supportedFormFactors: ["ATX"], maxGpuLengthMm: 300, includedFans: 2 })];
  const ranked = E.rankCandidates("case", cases, sel);
  check("case still blocked when the GPU it conflicts with is selected", ranked[0].compatible === false);
}
{
  // Motherboard step with a CPU already chosen: wrong-socket boards must block.
  const sel = { cpu: [part("cpu", { socket: "AM5", tdp: 120, integratedGraphics: true })] };
  const boards = [
    part("motherboard", { name: "am5", socket: "AM5", formFactor: "ATX" }),
    part("motherboard", { name: "intel", socket: "LGA1700", formFactor: "ATX" }),
  ];
  const ranked = E.rankCandidates("motherboard", boards, sel);
  check("matching-socket board selectable", ranked[0].compatible === true);
  check("wrong-socket board blocked", ranked[1].compatible === false);
  check("wrong-socket blocker names the reason", !!ranked[1].blocker && ranked[1].blocker.id === "cpu-socket");
}

/* ---------------------------------------------------------------- */
/* 10. Sustained CPU power vs published TDP                          */
/* ---------------------------------------------------------------- */
{
  // Intel publishes base power. A 125W-rated Core Ultra 9 sustains ~250W, so a
  // 220W air cooler is NOT adequate — judging it against 125W silently passed
  // hardware that throttles.
  const intel = part("cpu", { name: "Core Ultra 9 285K", socket: "LGA1851", tdp: 125, peakPowerW: 250, integratedGraphics: true });
  const air220 = part("cooler", { name: "AG400", coolerType: "air", coolingCapacityW: 220, supportedSockets: ["LGA1851"] });
  const r = E.checkCompatibility({ cpu: [intel], cooler: [air220] });
  check("220W cooler warned against a 250W-sustained CPU", sev(r, "cooler-capacity") === "warning");
  check("cpuSustainedWatts prefers peakPowerW", E.cpuSustainedWatts(intel) === 250, "got " + E.cpuSustainedWatts(intel));

  // The same cooler IS adequate for a genuine 162W part.
  const amd = part("cpu", { name: "9800X3D", socket: "AM5", tdp: 120, peakPowerW: 162, integratedGraphics: true });
  const r2 = E.checkCompatibility({ cpu: [amd], cooler: [part("cooler", { coolerType: "air", coolingCapacityW: 220, supportedSockets: ["AM5"] })] });
  check("220W cooler fine for a 162W-sustained CPU", !has(r2, "cooler-capacity"));

  // Falls back to the multiplier when a row has no sustained figure.
  const legacy = part("cpu", { tdp: 120, integratedGraphics: true });
  check("falls back to tdp x1.35 when peakPowerW is absent", E.cpuSustainedWatts(legacy) === 162, "got " + E.cpuSustainedWatts(legacy));

  // Power estimate must use the sustained figure, not the published TDP.
  const p1 = E.estimatePower({ cpu: [intel] });
  check("power estimate uses sustained CPU watts", p1.breakdown[0].watts === 250, "got " + p1.breakdown[0].watts);
}

/* ---------------------------------------------------------------- */
console.log("");
console.log("  compatibility engine: " + pass + " passed, " + fail + " failed");
if (failures.length) {
  console.log("");
  failures.forEach((f) => console.log("   FAIL  " + f));
}
process.exit(fail ? 1 : 0);
