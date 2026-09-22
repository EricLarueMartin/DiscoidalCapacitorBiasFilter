"""Compare circuit performance with exported, reused three-plate FEA classes."""
import json, math, sys
from pathlib import Path
import spice_ladder as spice
from refresh_noise_reference import solve
from build_default_bundles import intrinsic_lumped_transfer_db
cases=json.loads(Path(sys.argv[1]).read_text())
report=[]
for case in cases:
    p=spice.axisymmetric_model.normalize_parameters(case['parameters'])
    n=case['network']
    c=spice.circuit_with_capacitance_network(spice.circuit_estimates(p),p,n)
    deck=spice.netlist_text(c,p,regulator_source=True)
    base='\n'.join(line for line in deck.splitlines() if not line.startswith('.ac ') and line!='.end')+'\n'
    rows=[]
    for f in [10,50,60,100,1000]:
        sample=solve(base+f'.control\nac lin 1 {f} {f}\nwrdata OUTPUT v(det)\nquit\n.endc\n.end\n')[0][1]
        internal=spice.ladder_transfer(c,p,f,'regulator_input_tline')
        assert abs(sample-internal)/max(abs(sample),1e-30)<1e-4,(f,sample,internal)
        rows.append({'frequency_hz':f,'loaded_supply_to_detector_attenuation_db':-20*math.log10(abs(sample)),
            'intrinsic_open_circuit_attenuation_db':-intrinsic_lumped_transfer_db(f,n['maxwell_pf_matrix'],c['stageResistanceOhm'])})
    result={'bias_plates':p['plate_pairs'],'interplate_resistors':p['plate_pairs']-1,'stage_resistance_mohm':p['melf_stage_resistance_mohm'],
        'parameters':p,'reused_capacitance_network':n,'samples':rows,'netlist':deck}
    report.append(result)
    print(json.dumps({k:result[k] for k in ['bias_plates','interplate_resistors','stage_resistance_mohm','samples']}),flush=True)
Path(sys.argv[2]).write_text(json.dumps({'source':'same DP270 three-plate FEA; circuit-only ngspice and independent MNA comparison','cases':report},indent=2))
