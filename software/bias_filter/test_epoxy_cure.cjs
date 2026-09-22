const assert=require('node:assert/strict');
const cure=require('../../presentations/web/epoxy-cure.js');
const p={thermal_epoxy_modulus_gpa:3,thermal_restraint_factor:1,thermal_min_temperature_c:20};
const near=(a,b)=>assert(Math.abs(a-b)<1e-10, a+' != '+b);
// Independent integral: 29 C below Tg, 31 C above Tg for an 80 -> 20 C cooldown.
near(cure.strain('three_m_dp270',8.2,80,20),((80-8.2)*29+(180-8.2)*31)*1e-6);
near(cure.stress('three_m_dp270',8.2,80,p),34.19076923076923);
near(cure.stress('mg_832c',8.2,80,p),40.63846153846154);
near(cure.strain('three_m_dp270',16.9,23,20),(80-16.9)*3e-6);
near(cure.strain('mg_832c',16.9,80,60),(161-16.9)*20e-6);
near(cure.strain('mg_832c',16.9,80,90),0);
near(cure.stress('mg_832c',8.2,80,{...p,thermal_restraint_factor:0.5}),cure.stress('mg_832c',8.2,80,p)/2);
assert(Number.isNaN(cure.stress('master_bond_ep30',8.2,93.333,p)));
assert(Number.isNaN(cure.estimate('three_m_dp270',8.2,2,'alumina',p).strengthMargin));
const mg=cure.estimate('mg_832c',8.2,2,'alumina',p);near(mg.strengthMargin,45/mg.stressMpa);
near(cure.stress('mg_832c',8.2,80,{...p,thermal_min_temperature_c:mg.failureOnsetC}),45);
assert.equal(cure.schedule('three_m_dp270',{epoxy_cure_schedule:'mg_832c:65'}).c,40);
assert.equal(cure.schedule('three_m_dp270',{epoxy_cure_schedule:'three_m_dp270:50'}).c,50);
console.log('PASS: CTE integration across Tg, above/below Tg, no cooldown, restraint scaling, missing EP30 data, tensile versus bond strength, crossing, and cure selection.');

near(cure.stress('three_m_dp270',16.9,40,p),5.824615384615385);
assert.equal(cure.schedule('three_m_dp270',{}).c,40);
