const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const app = fs.readFileSync(path.join(root, 'presentations/web/app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'presentations/web/index.html'), 'utf8');
const readBundle = (file) => JSON.parse(fs.readFileSync(path.join(root, 'presentations/web', file), 'utf8').replace(/^window\.[A-Z_]+ = /, '').trim().replace(/;$/, ''));
const field = readBundle('default-fenicsx-field-dp270.js');
const thermal = readBundle('default-thermal-fea.js');
const p = structuredClone(field.settings);
let validField = true, validSpice = true, validThermal = true, validWave = false;
let requests = 0;
const elements = new Map();
function element(id='') {
  return {id, hidden:false, dataset:{}, children:[], textContent:'',
    setAttribute(){}, append(...children){this.children.push(...children);},
    replaceChildren(){this.children=[];}, before(node){elements.set(node.id,node);},
    getContext(){throw Error('A missing-result graphic must not render');}};
}
const context = vm.createContext({structuredClone, params:p, defaults:p, EPSILON_0_F_PER_M:8.8541878128e-12,
  window:{}, document:{getElementById:id=>elements.get(id),createElement:()=>element()},
  currentSolvedResultForSlides:()=>validField?{}:null,
  feaCapacitanceNetworkForCurrentDesign:()=>validField?field.result.capacitance.capacitance_network:null,
  cachedSpiceLadderResultForCurrentDesign:()=>validSpice?field.spiceLadder:null,
  feaCapacitanceForCurrentDesign:()=>null,
  thermalFeaResultForCurrentDesign:()=>validThermal?thermal.result:null,
  fullWaveResultForCurrentDesign:()=>validWave?{samples:[{}]}:null,
  eqsSweepForCurrentDesign:()=>validWave?{samples:[{}]}:null,
  requestSpiceLadderResult:()=>{requests++;},
  spiceLadderRequestKey:()=> 'current',
  spiceLadderDisabled:false,spiceLadderError:null,spiceLadderCache:null,fanoNoiseBudgetCache:null,
  spiceLadderPendingKey:null, refreshSpiceDependentViews(){},updateSpiceSolverPanel(){}
});
function install(name) {
  const start=app.indexOf(`function ${name}(`); assert(start>=0,name);
  const end=app.indexOf('\n}',start)+2;
  vm.runInContext(app.slice(start,end),context);
}
const a=app.indexOf('const SLIDE_SIMULATION_REQUIREMENTS');
const b=app.indexOf('\nfunction eqsResultKey',a);
vm.runInContext(app.slice(a,b)+ '\nthis.requirements=SLIDE_SIMULATION_REQUIREMENTS; this.references=SLIDE_REFERENCE_GRAPHICS; this.analytical=SLIDE_ANALYTICAL_GRAPHICS;',context);
for (const name of ['missingSlideSimulations','simulationGraphicReady','spiceLadderResultForCurrentDesign',
  'lmfeStudyForCurrentDesign','lmfeResistanceStudyForCurrentDesign','runSpiceSimulation',
  'clamp','usesDirectStageCapacitance','usesMelfCoreModel','melfEffectiveEpsr','coreCapacitanceEpsr',
  'biasPlateThicknessMm','groundPlateThicknessMm','plateThicknessMm','edgeRadiusMm','backendParameters',
  'removeElectrostaticIndependentParameters','comparableResultParameters','removeThermalIndependentParameters','thermalFeaKey',
  'spiceCircuitParameters','fullWaveKey','c','cAdd','cSub','cMul','cDiv','cAbs','solveComplexLinear','intrinsicLumpedTransferDb']) install(name);
const ids=[...html.matchAll(/<canvas id="(slide[^"]+)"/g)].map(m=>m[1]);
for(const id of ids) assert(id in context.requirements || id in context.references || context.analytical.includes(id),`Unclassified slide graphic ${id}`);
assert.equal(thermal.settings.plate_pairs,7);
assert.equal(thermal.result.parameters.plate_pairs,7);
assert.equal(context.thermalFeaKey(thermal.settings),context.thermalFeaKey(p),'default thermal result matches');
for(const count of [5,8]) {
  const changed={...p,plate_pairs:count};
  assert.equal(context.comparableResultParameters(p),context.comparableResultParameters(changed));
  assert.notEqual(context.spiceCircuitParameters(p),context.spiceCircuitParameters(changed));
  assert.notEqual(context.thermalFeaKey(p),context.thermalFeaKey(changed));
}
assert.notEqual(context.comparableResultParameters(p),context.comparableResultParameters({...p,plate_gap_mm:2}));
assert.notEqual(context.thermalFeaKey(p),context.thermalFeaKey({...p,epoxy_cure_schedule:'three_m_dp270:80'}));
assert.equal(context.thermalFeaKey(p),context.thermalFeaKey({...p,melf_stage_resistance_mohm:20}));
assert.equal(context.fullWaveKey(p),context.fullWaveKey({...p,noise_trap_rise_us:6,noise_mains_frequency_hz:60}));
assert.deepEqual(JSON.parse(context.fullWaveKey(p)),JSON.parse(context.fullWaveKey({...p,
 full_wave_space_margin_mm:8,full_wave_pml_mm:3,full_wave_max_iterations:10000,
 full_wave_bicgstab_l:10,full_wave_resonance_hints_hz:[]})),'backend RF defaults match omitted Designer settings');
assert.notEqual(context.fullWaveKey(p),context.fullWaveKey({...p,full_wave_pml_mm:4}));
assert.notEqual(context.fullWaveKey(p),context.fullWaveKey({...p,plate_pairs:8}));
assert.notEqual(context.fullWaveKey(p),context.fullWaveKey({...p,full_wave_resolution_per_mm:4}));
assert.notEqual(context.spiceCircuitParameters(p),context.spiceCircuitParameters({...p,noise_sample_rate_msps:125}));
assert.equal(context.spiceCircuitParameters(p),context.spiceCircuitParameters({...p,noise_trap_rise_us:6}));
assert.equal(context.comparableResultParameters(p),context.comparableResultParameters({...p,epoxy_cure_schedule:'three_m_dp270:80'}));
// A plate-count change retains Cg/Cpar but invalidates SPICE and thermal.
validSpice=false;validThermal=false;
assert.deepEqual(Array.from(context.missingSlideSimulations(['capacitance','spice'])),['spice']);
assert.deepEqual(Array.from(context.missingSlideSimulations(['thermal'])),['thermal']);
for(let i=0;i<5;i++) {
 assert.equal(context.spiceLadderResultForCurrentDesign(),null);
 assert.equal(context.lmfeStudyForCurrentDesign(),null);
 assert.equal(context.lmfeResistanceStudyForCurrentDesign(),null);
}
assert.equal(requests,0,'readers never submit SPICE');
context.runSpiceSimulation();assert.equal(requests,1,'explicit Run submits exactly once');
validField=false;
context.runSpiceSimulation();assert.equal(requests,1,'missing FEA blocks a SPICE run');
// Every current-simulation renderer exits through its notice before touching a canvas.
const drawers={slideResultsCanvas:'drawSimulationResultsSlide',slideThermalCanvas:'drawThermalSlide',
 slideThermalFeaModelCanvas:'drawThermalFeaViewer',slideSimulationChainCanvas:'drawSimulationChainSlide',
 slideCapacitanceExtractionCanvas:'drawCapacitanceExtractionOverviewSlide',slideCgPlateCountComparisonCanvas:'drawCgPlateCountComparisonSlide',slideCparExtractionCanvas:'drawCparExtractionSlide',
 slideFeaSanityCanvas:'drawFeaSanitySlide',slideRcCanvas:'drawRcDiagram',slideLoadedLadderCanvas:'drawLoadedLadderSlide',
 slideSpiceLadderCanvas:'drawSpiceLadderSlide',slideDetectorFrontendCanvas:'drawDetectorFrontendModelSlide',
 slideSimplifiedAmplifierCanvas:'drawSimplifiedAmplifierSpiceSlide',slideThreeNoiseSourcesCanvas:'drawThreeNoiseSourcesSlide',
 slideLmfeGateGainCanvas:'drawLmfeSignalCalibrationSlide',slideLmfePickupTransferCanvas:'drawLmfeFrequencyStudySlide',
 slideLmfePickupNoiseCanvas:'drawLmfePickupNoiseSlide',slideLmfeResistanceNoiseCanvas:'drawLmfeResistanceNoiseSlide',
 slideFanoNoiseCanvas:'drawFanoNoiseSlide',slideEqsCanvas:'drawIntrinsicComparisonSlide',
 slideFullWaveCanvas:'drawFullWaveSlide',slideElectromagneticCanvas:'drawElectromagneticSlide'};
for(const [id,name] of Object.entries(drawers)) {
 install(name);const canvas=element(id);elements.set(id,canvas);context[name](canvas);
 assert(canvas.hidden,id);assert(elements.get(`${id}SimulationNotice`).children.length,id);
}
validField=validSpice=validThermal=true;
for(const id of ['slideResultsCanvas','slideThermalCanvas','slideFanoNoiseCanvas']) {
 assert.equal(context.simulationGraphicReady(elements.get(id)),true);
 assert.equal(elements.get(id).hidden,false);
}
assert(!app.includes('function slidePreviewResult('));
assert.equal((app.match(/requestSpiceLadderResult\(key, capacitanceNetwork\)/g)||[]).length,2,'declaration and explicit button path only');
// Independent two-node RC limit for the live EQS comparison post-processing.
const f=50, r=1e7, c=30e-12;
assert(Math.abs(context.intrinsicLumpedTransferDb(f,{maxwell_pf_matrix:[[30,0],[0,30]]},r)-(-10*Math.log10(1+(2*Math.PI*f*r*c)**2)))<1e-10);
console.log(`PASS: ${ids.length} slide graphics classified; ${Object.keys(drawers).length} simulation renderers gated; explicit-only SPICE, cache invalidation, thermal default, and RC limit.`);

// The real seven-plate bundles must load, retain failed diagnostics, and invalidate on edits.
const wave = readBundle('default-full-wave-dp270.js');
assert.equal(wave.result.parameters.plate_pairs,7);
assert.equal(field.result.parameters.plate_pairs,7);
context.document.documentElement={dataset:{}};
context.window.DISCOIDAL_DEFAULT_FULL_WAVE=wave;
context.fullWaveCache=null;
for(const name of ['settingsWithBuiltInFallback','parameterKeyDifference','loadBundledDefaultFullWaveResult','fullWaveResultForCurrentDesign','eqsResultKey','eqsSweepForCurrentDesign']) install(name);
context.electromagneticCircuitForCurrentDesign=()=>field.spiceLadder.circuit;
assert.equal(context.loadBundledDefaultFullWaveResult(),true,context.document.documentElement.dataset.defaultFullWaveMismatch);
assert(context.eqsSweepForCurrentDesign().samples.every(s=>Number.isFinite(s.intrinsicFieldDb)&&Number.isFinite(s.intrinsicSpiceDb)));
for(const changes of [{plate_pairs:5},{plate_gap_mm:1.2},{melf_stage_resistance_mohm:20},{full_wave_resolution_per_mm:3}]) {
 context.params={...p,...changes};
 assert.equal(context.fullWaveResultForCurrentDesign(),null,'changed RF physics requires an explicit new run');
 assert.equal(context.eqsSweepForCurrentDesign(),null);
}
context.params=p;
assert.equal(context.fullWaveResultForCurrentDesign(),wave.result);
assert.equal(requests,1,'bundle reads and edits submit no simulations');
console.log('PASS: actual seven-plate field/RF bundles load, EQS comparison is finite, and edits invalidate without running.');
