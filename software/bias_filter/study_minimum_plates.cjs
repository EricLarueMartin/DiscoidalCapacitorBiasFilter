const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const app=fs.readFileSync(path.join(root,'presentations/web/app.js'),'utf8');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const settings=read('hardware/geometry/default-parameters.json');
const source=read('simulations/axisymmetric/outputs/default-dp270-28mm-field.json').result;
let spice=read('simulations/spice/default-dp270-28mm-spice.json');
const context=vm.createContext({structuredClone,params:settings,spiceLadderCache:{key:'study-7'},fanoNoiseBudgetCache:null,
 DEFAULT_GE_FANO_FACTOR:0.1145,FANO_TARGET_FRACTION:0.1,
 electromagneticCircuitForCurrentDesign:()=>spice.circuit,
 cachedSpiceLadderResultForCurrentDesign:()=>spice});
for(const name of ['averageFinite','maxwellMatrixFromGroundAndMutual','repeatedNetworkForPlateCount',
 'detectorCapacitancePf','interpolatePositiveLogSample','trapezoidSignalCalibration','trapezoidTransferMagnitude',
 'fanoNoiseBudget','powerLineFrequencyHz','attenuationDbFromMagnitude','backendSpiceCurve','backendSpiceMagnitudeFromCurve']) {
 const start=app.indexOf(`function ${name}(`);if(start<0)throw Error(name);
 vm.runInContext(app.slice(start,app.indexOf('\n}',start)+2),context);
}
const study={source_field_plate_count:source.parameters.plate_pairs,capacitance_reuse:'Designer end/interior reconstruction',parameters:settings,cases:[]};
function record(p,file){
 context.params=p;context.spiceLadderCache={key:`study-${p.plate_pairs}`};context.fanoNoiseBudgetCache=null;
 const b=context.fanoNoiseBudget(p);if(!b.fullNoiseModel)throw Error('Complete SPICE noise model required');
 const row={bias_plates:p.plate_pairs,interplate_resistors:p.plate_pairs-1,supply_sigma_ev:b.supplyEquivalentEnergyEv,
 supply_50hz_sigma_ev:b.supplyMainsEquivalentEnergyEv,fano_sigma_ev:b.fanoSigmaEv,limit_sigma_ev:b.fanoSigmaEv*.1,
 fraction_of_fano:b.supplyEquivalentEnergyEv/b.fanoSigmaEv,passes:b.supplyEquivalentEnergyEv<b.fanoSigmaEv*.1,spice_file:file};
 study.cases.push(row);console.log(JSON.stringify(row));return row;
}
async function main(){
 record({...settings,plate_pairs:7},'simulations/spice/default-dp270-28mm-spice.json');
 for(let n=6;n>=3;n--){
  const p={...settings,plate_pairs:n};
  const network=context.repeatedNetworkForPlateCount(source.capacitance.capacitance_network,n,p);
  if(!network)throw Error('Cannot reuse this capacitance network');
  const response=await fetch('http://pi-05-ioc.fel.duke.edu/api/spice-ladder',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({parameters:p,capacitanceNetwork:network}),signal:AbortSignal.timeout(600000)});
  if(!response.ok)throw Error(await response.text());spice=await response.json();
  const file=`simulations/spice/default-dp270-28mm-${n}-plate-spice.json`;
  fs.writeFileSync(path.join(root,file),JSON.stringify(spice));
  if(!record(p,file).passes)break;
 }
 study.minimum_passing_bias_plates=Math.min(...study.cases.filter(r=>r.passes).map(r=>r.bias_plates));
 study.lower_failing_bias_plates=study.cases.filter(r=>!r.passes).map(r=>r.bias_plates);
 fs.writeFileSync(path.join(root,'simulations/spice/28mm-minimum-plates-noise-study.json'),JSON.stringify(study,null,2)+'\n');
 console.log(JSON.stringify({minimum:study.minimum_passing_bias_plates,failed:study.lower_failing_bias_plates}));
}
main().catch(e=>{console.error(e);process.exitCode=1});
