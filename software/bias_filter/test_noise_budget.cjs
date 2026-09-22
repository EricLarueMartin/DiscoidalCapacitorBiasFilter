const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const app = fs.readFileSync(path.join(root, 'presentations/web/app.js'), 'utf8');
const bundle = JSON.parse(fs.readFileSync(path.join(root, 'presentations/web/default-fenicsx-field-23lv.js'), 'utf8')
  .replace(/^window.DISCOIDAL_BUNDLED_DEFAULT_FIELD_RESULT = /, '').trim().replace(/;$/, ''));
const context = vm.createContext({
  params: bundle.settings, spiceLadderCache: {key: 'reference'}, fanoNoiseBudgetCache: null,
  DEFAULT_GE_FANO_FACTOR: 0.1145, FANO_TARGET_FRACTION: 0.1,
  electromagneticCircuitForCurrentDesign: () => bundle.spiceLadder.circuit,
  cachedSpiceLadderResultForCurrentDesign: () => bundle.spiceLadder,
  backendSpiceCurve: () => [],
});
for (const name of ['detectorCapacitancePf', 'interpolatePositiveLogSample', 'trapezoidSignalCalibration',
  'trapezoidTransferMagnitude', 'fanoNoiseBudget']) {
  const start = app.indexOf(`function ${name}(`);
  assert(start >= 0, name);
  const end = app.indexOf('\n}', start) + 2;
  vm.runInContext(app.slice(start, end), context);
}
const p = {...bundle.settings};
const reference = context.fanoNoiseBudget(p);
assert.equal(reference.fullNoiseModel, true);
assert(Number.isFinite(reference.equivalentEnergyEv));
const sources = ['noise_supply_noise_pp_mv', 'noise_lab_broadband_rms_mv', 'noise_mains_rms_mv',
  'noise_cryostat_broadband_rms_mv', 'noise_cryostat_mains_rms_mv'];
const zero = {...p};
sources.forEach(key => { zero[key] = 0; });
assert.equal(context.fanoNoiseBudget(zero).equivalentEnergyEv, 0);
const doubled = {...p};
sources.forEach(key => { doubled[key] *= 2; });
assert(Math.abs(context.fanoNoiseBudget(doubled).equivalentEnergyEv / reference.equivalentEnergyEv - 2) < 1e-12);
const powers = sources.map(key => context.fanoNoiseBudget({...zero, [key]: p[key]}).equivalentEnergyEv ** 2);
assert(Math.abs(Math.sqrt(powers.reduce((a, b) => a + b, 0)) / reference.equivalentEnergyEv - 1) < 1e-12);
assert(reference.supplyEquivalentEnergyEv >= reference.supplyMainsEquivalentEnergyEv);
assert.notEqual(context.fanoNoiseBudget({...p, noise_trap_rise_us: 6}).equivalentEnergyEv, reference.equivalentEnergyEv);
console.log(JSON.stringify({fullNoiseModel: reference.fullNoiseModel,
  supplyMainsEv: reference.supplyMainsEquivalentEnergyEv, supplyScenarioEv: reference.supplyEquivalentEnergyEv,
  outsideEv: Math.hypot(reference.inputBroadbandEquivalentEnergyEv, reference.inputMainsEquivalentEnergyEv),
  insideEv: reference.cryostatEquivalentEnergyEv, totalEv: reference.equivalentEnergyEv,
  fanoEv: reference.fanoSigmaEv, fwhmKev: reference.fanoPlusBiasFwhmKev}, null, 2));
console.log('PASS: source isolation, zero noise, amplitude scaling, power addition, mains inclusion, shaping recalculation');

const bypass = {...p, noise_apply_shaping: false, noise_pz_enabled: true};
assert.equal(context.trapezoidTransferMagnitude(50, bypass), 1);
assert.equal(context.trapezoidSignalCalibration(bundle.spiceLadder.lmfeSignalStep, bypass).peakV,
  context.trapezoidSignalCalibration(bundle.spiceLadder.lmfeSignalStep, {...bypass, noise_pz_enabled: false}).peakV);
assert.notEqual(context.fanoNoiseBudget(bypass).equivalentEnergyEv, reference.equivalentEnergyEv);

// Exact exponential input: decay deconvolution must restore a unit step,
// and the normalized trapezoid must recover unit pulse height.
const shaped = {...p, noise_sample_rate_msps: 1, noise_apply_shaping: true,
  noise_pz_enabled: true, noise_pz_decay_us: 350};
const pulse = {sampleRateHz: 1e6, delayS: 30e-6, referenceChargeC: 1e-15,
  samples: Array.from({length: 1000}, (_, i) => [i*1e-6, i < 30 ? 0 : Math.exp(-(i-30)/350)])};
assert(Math.abs(context.trapezoidSignalCalibration(pulse, shaped).peakV - 1) < 1e-12);

// Independently compose finite taps: box(N)*box(N+flat)*[1,-a]/N.
const n = 10, d = 14, a = Math.exp(-1/350);
const taps = Array(n+d).fill(0);
for (let i=0;i<n;i++) for (let j=0;j<d;j++) {
  taps[i+j] += 1/n;
  taps[i+j+1] -= a/n;
}
for (const f of [0, 50, 1000, 17321]) {
  let re=0, im=0;
  taps.forEach((v,i) => {re += v*Math.cos(2*Math.PI*f*i/1e6); im -= v*Math.sin(2*Math.PI*f*i/1e6);});
  assert(Math.abs(Math.hypot(re,im)-context.trapezoidTransferMagnitude(f,shaped)) < 1e-12);
}
const corrected = context.fanoNoiseBudget({...p, noise_pz_enabled: true, noise_pz_decay_us: 350});
assert(Number.isFinite(corrected.equivalentEnergyEv));
console.log('PASS: joint bypass, exponential recovery, independent PZ+trap FIR frequency response');
console.log({pzSupplyMainsElectrons: corrected.supplyMainsEquivalentEnergyEv/2.96,
  bypassSupplyMainsElectrons: context.fanoNoiseBudget(bypass).supplyMainsEquivalentEnergyEv/2.96});
