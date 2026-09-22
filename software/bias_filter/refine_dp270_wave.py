import json
import math
from argparse import Namespace
import axisymmetric_model as model
import full_wave_meep_solver as wave
import build_default_bundles as bundles
r=model.ROOT
p=model.load_parameters(model.DEFAULT_PARAMETERS)
path=r/"simulations/electromagnetic/latest-dp270-full-wave.json"
w=json.loads(path.read_text())
(r/"simulations/electromagnetic/validation/dp270-wave-original-tolerance.json").write_text(json.dumps(w))
check=json.loads((r/"simulations/electromagnetic/validation/dp270-wave-tolerance.json").read_text())
rows=list(check["samples"])
for f in (3e9,10e9,30e9):
    row=wave.solve_frequency(p,f,2,save_field=f==30e9)
    rows.append(row)
    print(f,row["magnitude_db"],row["convergence"],flush=True)
w["samples"]=rows
w["parameters"]=p
w["all_frequency_points_converged"]=all(row["convergence"]["converged"] for row in rows)
overlap=w["overlap_validation"]
by={row["frequency_hz"]:row for row in rows}
eqs={row["frequency_hz"]:row for row in w["eqs_samples"]}
overlap["normalization_offset_db"]=eqs[300e6]["magnitude_db"]-by[300e6]["magnitude_db"]
overlap["handoff_residual_db"]=by[1e9]["magnitude_db"]+overlap["normalization_offset_db"]-eqs[1e9]["magnitude_db"]
overlap["validated"]=abs(overlap["handoff_residual_db"])<=overlap["tolerance_db"]
w["numerical_accuracy_note"]="Default rerun at residual tolerance 1e-8. Convergence does not establish EQS/MEEP port equivalence; failed overlap remains diagnostic only."
path.write_text(json.dumps(w,allow_nan=False))
bundles.build(Namespace(field_job=r/"simulations/axisymmetric/outputs/default-dp270-field.json",spice=r/"simulations/electromagnetic/default-dp270-spice.json"))
print("REFINED BUNDLES COMPLETE",overlap,flush=True)
