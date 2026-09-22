const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname,'../..');
const app = fs.readFileSync(path.join(root,'presentations/web/app.js'),'utf8');
const ctx = vm.createContext({});
for (const name of ['trapezoidSignalCalibration','trapezoidTransferMagnitude']) {
  const start=app.indexOf(`function ${name}(`);
  vm.runInContext(app.slice(start,app.indexOf('\n}',start)+2),ctx);
}
const rows = JSON.parse(fs.readFileSync(path.join(root,'simulations/spice/supply-50hz-breakdown.json'))).map(entry => {
  const p={...entry.parameters,noise_apply_shaping:true,noise_pz_enabled:false};
  const v=entry.voltages_per_source_volt;
  const cal=ctx.trapezoidSignalCalibration(entry.signal,p);
  const raw=ctx.trapezoidSignalCalibration(entry.signal,{...p,noise_apply_shaping:false});
  const trap=ctx.trapezoidTransferMagnitude(50,p);
  const sourceRms=.005/Math.SQRT2;
  const c=entry.cdet_pf*1e-12;
  const adcRms=sourceRms*v.R30.magnitude;
  const electrons=adcRms*trap*cal.chargePerOutputVoltC/1.602176634e-19;
  const db=x=>-20*Math.log10(x);
  return {cdetPf:entry.cdet_pf,sourceRms,unfilteredElectronsRms:sourceRms*c/1.602176634e-19,
    supplyDb:db(v.filter_input.magnitude),filterDb:db(v.detector_voltage.magnitude/v.filter_input.magnitude),
    preampChargeResponseDb:db(v.R30.magnitude*raw.chargePerOutputVoltC/(v.detector_voltage.magnitude*c)),
    trapDb:db(trap),chargeCalibrationDb:db(cal.chargePerOutputVoltC/raw.chargePerOutputVoltC),
    shapedReferencedPreampDb:db(v.R30.magnitude*cal.chargePerOutputVoltC/(v.detector_voltage.magnitude*c)),
    trapMagnitude:trap,rawMvPerFc:raw.peakV*1e-12/raw.referenceChargeC,
    shapedMvPerFc:cal.peakV*1e-12/cal.referenceChargeC,detectorRms:sourceRms*v.detector_voltage.magnitude,
    adcRms,shapedRms:adcRms*trap,electrons,totalDb:db(electrons/(sourceRms*c/1.602176634e-19))};
});
fs.writeFileSync(path.join(root,'simulations/spice/supply-50hz-breakdown-summary.json'),JSON.stringify(rows,null,2)+'\n');
console.log(JSON.stringify(rows,null,2));
