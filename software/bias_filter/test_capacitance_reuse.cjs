const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const app = fs.readFileSync(path.join(root, 'presentations/web/app.js'), 'utf8');
const bundle = JSON.parse(fs.readFileSync(path.join(root,'presentations/web/default-fenicsx-field-dp270.js'),'utf8').replace(/^window\.DISCOIDAL_BUNDLED_DEFAULT_FIELD_RESULT = /,'').trim().replace(/;$/, ''));
const p = {...bundle.settings, plate_pairs: 3};
const network = bundle.result.capacitance.capacitance_network;
const ctx = vm.createContext({structuredClone, params:p, defaults:p, EPSILON_0_F_PER_M:8.8541878128e-12});
const names = ['clamp','averageFinite','maxwellMatrixFromGroundAndMutual','repeatedNetworkForPlateCount',
 'usesDirectStageCapacitance','usesMelfCoreModel','melfEffectiveEpsr','coreCapacitanceEpsr',
 'biasPlateThicknessMm','groundPlateThicknessMm','plateThicknessMm','edgeRadiusMm',
 'backendParameters','removeElectrostaticIndependentParameters','comparableResultParameters',
 'biasPlateCount','geometryCacheKey','spiceCircuitParameters'];
for (const name of names) {
 const start=app.indexOf(`function ${name}(`); assert(start>=0,name);
 const end=app.indexOf('\n}',start)+2;
 vm.runInContext(app.slice(start,end),ctx);
}
const key=ctx.comparableResultParameters(p);
for (const n of [3,4,5,7,8]) {
 const q={...p,plate_pairs:n};
 assert.equal(ctx.comparableResultParameters(q),key);
 if(n!==3) assert.notEqual(ctx.geometryCacheKey(q),ctx.geometryCacheKey(p));
 const a=ctx.repeatedNetworkForPlateCount(network,n,q);
 assert.equal(a.node_ground_pf.length,n);
 assert.equal(a.adjacent_mutual_pf.length,n-1);
 assert.equal(a.electrical_node_ground_pf.length,n+2);
 for(let i=0;i<n;i++) {
   assert.equal(a.node_ground_pf[i],network.node_ground_pf[i===0||i===n-1?0:1]);
   assert(Math.abs(a.maxwell_pf_matrix[i].reduce((x,y)=>x+y,0)-a.node_ground_pf[i])<1e-10);
   for(let j=0;j<n;j++) assert.equal(a.mutual_pf_matrix[i][j],a.mutual_pf_matrix[j][i]);
 }
}
for(const [k,value] of Object.entries({melf_stage_resistance_mohm:20,melf_stage_resistance_log10_ohm:7.3,
 input_series_resistance_mohm:15,output_series_resistance_ohm:100,bias_source_resistance_mohm:.1})) {
 const q={...p,[k]:value};assert.equal(ctx.comparableResultParameters(q),key,k);assert.notEqual(ctx.spiceCircuitParameters(q),ctx.spiceCircuitParameters(p),k);
}
for(const q of [{...p,plate_gap_mm:2},{...p,epoxy_epsr:4},{...p,melf_substrate_epsr:12},{...p,plate_pairs:2},
 {...p,use_repeating_cell_approximation:false,solve_strategy:'mirror_half',plate_pairs:5}]) assert.notEqual(ctx.comparableResultParameters(q),key);
assert.equal(ctx.repeatedNetworkForPlateCount(network,5,{...p,use_repeating_cell_approximation:false}),null);
assert.equal(ctx.repeatedNetworkForPlateCount(network,2,p),null);
const before=JSON.stringify(network);
const sentinel=structuredClone(network);sentinel.electrical_mutual_pf_matrix[0][4]=sentinel.electrical_mutual_pf_matrix[4][0]=123;
const expanded=ctx.repeatedNetworkForPlateCount(sentinel,5,p);
assert.equal(expanded.electrical_mutual_pf_matrix[0][4],0,'opposite terminal must not become a fourth bias plate');
assert.equal(expanded.electrical_mutual_pf_matrix[0][6],0,'old end-to-end coupling must not bridge a longer stack');
assert.equal(JSON.stringify(network),before,'source FEA is immutable');
if(process.argv[2]) {
 const cases=[{...p,plate_pairs:7},{...p,plate_pairs:3},{...p,plate_pairs:5},{...p,plate_pairs:5,melf_stage_resistance_mohm:20,input_series_resistance_mohm:20,melf_stage_resistance_log10_ohm:Math.log10(20e6)}];
 fs.writeFileSync(process.argv[2],JSON.stringify(cases.map(parameters=>({parameters,network:ctx.repeatedNetworkForPlateCount(network,parameters.plate_pairs,parameters)}))));
}
console.log('PASS: reused 3→4/5/7/8 plates, resistor-only cache keys, physical geometry, invalidating geometry changes, terminal indexing, immutable FEA source.');
