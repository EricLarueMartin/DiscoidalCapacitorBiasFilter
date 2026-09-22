const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const app = fs.readFileSync(path.join(root, 'presentations/web/app.js'), 'utf8');
const stem = process.argv[2] || 'lmfe-head-cable-noise-audit';
const audit = JSON.parse(fs.readFileSync(path.join(root, `simulations/spice/${stem}.json`), 'utf8'));
const rows = [];
for (const entry of audit.cases) {
  if (entry.payload.lmfeSignalStep.error) {
    rows.push({name:entry.name, error:entry.payload.lmfeSignalStep.error});
    continue;
  }
  const p = entry.parameters;
  const ctx = vm.createContext({params:p, spiceLadderCache:{key:entry.name}, fanoNoiseBudgetCache:null,
    DEFAULT_GE_FANO_FACTOR:0.1145, FANO_TARGET_FRACTION:0.1,
    electromagneticCircuitForCurrentDesign:()=>entry.payload.circuit,
    cachedSpiceLadderResultForCurrentDesign:()=>entry.payload, backendSpiceCurve:()=>[]});
  for (const name of ['detectorCapacitancePf','interpolatePositiveLogSample','trapezoidSignalCalibration',
    'trapezoidTransferMagnitude','fanoNoiseBudget']) {
    const start = app.indexOf(`function ${name}(`);
    vm.runInContext(app.slice(start, app.indexOf('\n}',start)+2),ctx);
  }
  const calibration = ctx.trapezoidSignalCalibration(entry.payload.lmfeSignalStep,p);
  const budget = ctx.fanoNoiseBudget(p);
  assert(budget.fullNoiseModel);
  const fsHz = p.noise_sample_rate_msps*1e6;
  const rise = Math.round(p.noise_trap_rise_us*1e-6*fsHz);
  const gap = Math.round(p.noise_trap_flat_us*1e-6*fsHz);
  // Independent direct FIR convolution of a unit-RMS 50 Hz sine at 64 phases.
  let power = 0;
  for(let phase=0;phase<64;phase++) {
    let out = 0;
    for(let i=0;i<rise;i++) {
      const angle = 2*Math.PI*phase/64;
      out += Math.SQRT2*(Math.sin(angle-2*Math.PI*50*i/fsHz)
        - Math.sin(angle-2*Math.PI*50*(i+rise+gap)/fsHz))/rise;
    }
    power += out*out/64;
  }
  const timeDomainTrap = Math.sqrt(power);
  const analyticTrap = ctx.trapezoidTransferMagnitude(50,p);
  const firRelativeError = Math.abs(timeDomainTrap/analyticTrap-1);
  assert(firRelativeError<1e-10);
  const exactSupplyEnergy = p.noise_supply_noise_pp_mv*1e-3/(2*Math.sqrt(2))
    *entry.exact_50hz.lmfeEverythingTransfer.magnitude*timeDomainTrap*calibration.energyEvPerOutputV;
  const interpolationError = Math.abs(budget.supplyMainsEquivalentEnergyEv/exactSupplyEnergy-1);
  assert(interpolationError<0.005);
  rows.push({name:entry.name, length_m:entry.length_m, source_mohm:p.bias_source_resistance_mohm,
    capacitance_pf_per_m:entry.capacitance_pf_per_m, inductance_nh_per_m:entry.inductance_nh_per_m,
    shaped_mv_per_fc:calibration.peakV/calibration.referenceChargeC*1e-12,
    supply50_output_gain:entry.exact_50hz.lmfeEverythingTransfer.magnitude,
    supply50_enc_electrons:exactSupplyEnergy/2.96,
    supply50_fano_fraction:exactSupplyEnergy/budget.fanoSigmaEv,
    supply_bands_enc_electrons:budget.supplyEquivalentEnergyEv/2.96,
    inside_enc_electrons:budget.cryostatEquivalentEnergyEv/2.96,
    fano_enc_electrons:budget.fanoSigmaEv/2.96,
    exact50_vs_interpolated_relative_error:interpolationError,
    direct_fir_vs_formula_relative_error:firRelativeError});
}
const summary={scope:'External bias-path noise; not intrinsic amplifier, detector leakage or resistor noise',rows};
fs.writeFileSync(path.join(root,`simulations/spice/${stem}-summary.json`),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
