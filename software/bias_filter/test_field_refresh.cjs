const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const app=fs.readFileSync(path.join(root,'presentations/web/app.js'),'utf8');
const bundle=JSON.parse(fs.readFileSync(path.join(root,'presentations/web/default-fenicsx-field-dp270.js'),'utf8').replace(/^window\.[A-Z_]+ = /,'').trim().replace(/;$/,''));
const elements=new Map();
const getElementById=id=>{if(!elements.has(id))elements.set(id,{textContent:'',disabled:false});return elements.get(id);};
let panelRefresh=0, submissions=0;
const noop=()=>{};
const ctx=vm.createContext({structuredClone,params:structuredClone(bundle.settings),defaults:bundle.settings,
 document:{getElementById},fanoNoiseBudgetCache:{key:'old'},spiceLadderCache:null,
 circuitEstimates:()=>({geometricShuntCapPf:1,shuntCapPf:1,totalGroundCapPf:7,stageResistanceOhm:1e7,parasiticPf:0.3}),
 cableCapacitancePf:()=>0,detectorCapacitancePf:()=>10,admittanceAtFrequency:()=>({}),rfFrequencyHzFromLogMhz:()=>1e6,
 powerLineFrequencyHz:()=>50,singleStageAttenuationDb:()=>0,highFrequencyCapRatioAttenuationDb:()=>0,
 formatCapacitance:x=>Number(x).toFixed(6),formatExtractedCapacitance:x=>Number(x).toFixed(6),translateText:x=>x,resultSolverLabel:()=> 'FEA',
 formatAttenuationDb:String,formatResistance:String,formatFrequency:String,formatCurrentFromNa:String,formatAdmittance:String,
 drawField:noop,drawPotential:noop,dielectricMarginSummaries:()=>[],rawMaxFieldSummary:()=>'',
 updateFeaResourceReadouts:noop,updateDielectricMarginReadouts:noop,setModelStatus:noop,updateNoiseReadouts:noop,drawSlideGraphics:noop,
 updateSpiceSolverPanel:()=>{panelRefresh++;getElementById('solveSpice').disabled=!ctx.feaCapacitanceNetworkForCurrentDesign();},
 fetch:()=>{submissions++;throw Error('Field completion must not start another simulation');}
});
for(const name of ['clamp','usesDirectStageCapacitance','usesMelfCoreModel','melfEffectiveEpsr','coreCapacitanceEpsr',
 'biasPlateThicknessMm','groundPlateThicknessMm','plateThicknessMm','edgeRadiusMm','backendParameters',
 'removeElectrostaticIndependentParameters','comparableResultParameters','biasPlateCount','averageFinite',
 'maxwellMatrixFromGroundAndMutual','repeatedNetworkForPlateCount','additionalGroundCapacitancePf',
 'normalizedCapacitancePayload','solvedCapacitanceForCurrentDesign','feaCapacitanceForCurrentDesign',
 'feaCapacitanceNetworkForCurrentDesign','circuitWithFeaCapacitances','capacitanceForAdmittance',
 'spiceCircuitParameters','spiceLadderRequestKey','cachedSpiceLadderResultForCurrentDesign',
 'updateCircuitEstimates','refreshSpiceDependentViews','drawSolvedResult']) {
 const start=app.indexOf(`function ${name}(`);assert(start>=0,name);
 vm.runInContext(app.slice(start,app.indexOf('\n}',start)+2),ctx);
}
const original=structuredClone(bundle.result);
original.parameterKey=ctx.comparableResultParameters(ctx.params);
ctx.lastResult=original;
ctx.drawSolvedResult(original);
const oldCg=getElementById('shuntCapacitance').textContent;
const oldPar=getElementById('feaParasiticCapacitance').textContent;
const oldKey=ctx.spiceLadderRequestKey();
ctx.spiceLadderCache={key:oldKey,payload:{samples:[{}]}};
getElementById('solveSpice').disabled=true;
// A later successful field solve with a changed extracted network must replace
// both readouts, invalidate old SPICE, and enable its explicit Run control.
const fresh=structuredClone(original), network=fresh.capacitance.capacitance_network;
network.node_ground_pf=network.node_ground_pf.map(v=>v*1.2);
network.total_ground_pf=network.node_ground_pf.reduce((a,b)=>a+b,0);
network.mutual_pf_matrix=network.mutual_pf_matrix.map(row=>row.map(v=>v*1.4));
network.average_adjacent_mutual_pf*=1.4;
ctx.lastResult=fresh;
ctx.drawSolvedResult(fresh);
assert.notEqual(getElementById('shuntCapacitance').textContent,oldCg);
assert.notEqual(getElementById('feaParasiticCapacitance').textContent,oldPar);
assert.equal(getElementById('shuntCapacitance').textContent,network.node_ground_pf.map(v=>v.toFixed(6)).join(', '));
assert.equal(getElementById('totalGroundCapacitance').textContent,network.total_ground_pf.toFixed(6));
assert.equal(getElementById('feaParasiticCapacitance').textContent,network.mutual_pf_matrix.slice(0,-1).map((row,i)=>row[i+1].toFixed(6)).join(', '));
assert.equal(ctx.cachedSpiceLadderResultForCurrentDesign(),null);
assert.equal(getElementById('solveSpice').disabled,false);
assert.equal(panelRefresh,2);
assert.equal(ctx.fanoNoiseBudgetCache,null);
assert.equal(submissions,0);
console.log('PASS: successive field results refresh Cg/Cpar, invalidate old SPICE, enable its Run control, and submit no simulations.');

(async()=>{
 let now=0,polls=0;
 ctx.Date={now:()=>now};
 ctx.window={setTimeout:callback=>{now+=61000;callback();},clearTimeout:()=>{}};
 ctx.formatDuration=String;
 ctx.fetchJson=async()=>++polls<3?{status:'running'}:{status:'complete',result:original};
 ctx.backendResultFromPayload=payload=>payload.result;
 for(const constant of ['FIELD_SOLVER_ENDPOINT','FIELD_SOLVER_POLL_MS','FIELD_SOLVER_JOB_TIMEOUT_MS']) {
  const start=app.indexOf(`const ${constant} =`);
  vm.runInContext(app.slice(start,app.indexOf('\n',start)),ctx);
 }
 const start=app.indexOf('async function pollBackendJob(');
 vm.runInContext(app.slice(start,app.indexOf('\n}',start)+2),ctx);
 const late=await ctx.pollBackendJob('slow-fea',0);
 assert.equal(polls,3,'continue waiting beyond the old 120-second cutoff');
 assert.equal(late.capacitance,original.capacitance,'return the actual capacitance extraction');
 let pending,localSolves=0,failure='';
 ctx.window.setTimeout=callback=>{pending=callback();};
 ctx.selectedFieldSolver=()=>({backendSolver:'auto',label:'Backend auto',modelLabel:'Backend auto'});
 ctx.solveFieldWithBackend=async()=>{throw Error('backend FEA failed');};
 ctx.solveField=()=>{localSolves++;return original;};
 ctx.reportSolveFailure=error=>{failure=error.message;};
 const solveStart=app.indexOf('function solveAndDraw(');
 vm.runInContext(app.slice(solveStart,app.indexOf('\n}',solveStart)+2),ctx);
 ctx.solveAndDraw();await pending;
 assert.equal(failure,'backend FEA failed');
 assert.equal(localSolves,0,'backend errors never silently run a different solver');
 assert.equal(ctx.lastResult,null);
 assert.equal(getElementById('solve').disabled,false);
 console.log('PASS: a field job exceeding two minutes returns Cg/Cpar; backend failure is explicit and never runs JS fallback.');
})().catch(error=>{console.error(error);process.exitCode=1;});
