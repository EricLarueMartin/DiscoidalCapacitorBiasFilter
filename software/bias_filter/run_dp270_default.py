"""Regenerate DP270 defaults; run on the FEniCSx/ngspice/MEEP host."""
import json
from pathlib import Path
import axisymmetric_model as model
import fenicsx_solver as field
import thermal_fenicsx_solver as thermal
import admittance_fenicsx_solver as eqs
import spice_ladder as spice
import full_wave_meep_solver as wave
from field_backend import result_for_browser
import build_default_bundles as bundles
from argparse import Namespace

ROOT=model.ROOT
p=model.load_parameters(model.DEFAULT_PARAMETERS)
def save(rel, data):
    path=ROOT/rel;path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(data,allow_nan=False)+"\n")
    print("SAVED",rel,flush=True)
    return path

f=field.solve(p)
fp=save("simulations/axisymmetric/outputs/default-dp270-field.json",f)
fb=result_for_browser(f,source="fea-backend-fenicsx",solver="axisymmetric-fenicsx",note="DP270 default regenerated 2026-09-22")
s=spice.simulate(p,fb["capacitance"]["capacitance_network"])
sp=save("simulations/electromagnetic/default-dp270-spice.json",s)
for key,value in s.items():
    if isinstance(value,dict) and value.get("error"): raise RuntimeError((key,value["error"]))
t=thermal.solve(p)
tp=save("simulations/thermal/outputs/default-dp270-thermal-fea.json",t)
bundles.build_thermal_bundle(tp)
for mesh in (.6,.45,.3):
    frequencies=[1,10,50,100,1000,10000,100000,1000000,10000000,100000000] if mesh==.3 else [1000]
    e=eqs.solve_sweep({**p,"admittance_mesh_size_mm":mesh},frequencies)
    rel="simulations/electromagnetic/default-dp270-eqs-sweep.json" if mesh==.3 else f"simulations/electromagnetic/validation/default-dp270-eqs-1khz-0p{int(mesh*100):02}.json"
    save(rel,e)
w=wave.solve_sweep(p)
save("simulations/electromagnetic/latest-dp270-full-wave.json",w)
bundles.build(Namespace(field_job=fp,spice=sp))
print("ALL DEFAULT BUNDLES COMPLETE",flush=True)
