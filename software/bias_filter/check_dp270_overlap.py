import json
import axisymmetric_model as model
import full_wave_meep_solver as wave
p=model.load_parameters(model.DEFAULT_PARAMETERS)
p.update(full_wave_tolerance=1e-8,full_wave_max_iterations=30000)
rows=[]
for frequency in (300e6,1e9):
    row=wave.solve_frequency(p,frequency,2)
    rows.append(row)
    print(frequency,row["magnitude_db"],row["convergence"],flush=True)
    (model.ROOT/"simulations/electromagnetic/validation/dp270-wave-tolerance.json").write_text(json.dumps({"parameters":p,"samples":rows},indent=2))
