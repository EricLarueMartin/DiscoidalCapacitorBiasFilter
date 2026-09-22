"""Isolate supply-network changes at 50 Hz for the DP270 FEA circuit."""
import json
import math
from pathlib import Path
import axisymmetric_model as model
import spice_ladder as spice
from refresh_noise_reference import solve
p=model.load_parameters(model.DEFAULT_PARAMETERS)
s=json.loads((model.ROOT/"simulations/electromagnetic/default-dp270-spice.json").read_text())
c=s["circuit"]
rows=[]
for name,r,cap,divider in [("Previous assumption",1,0,0),("40 kohm only",.04,0,300),("CAEN 40 kohm + 1 nF",.04,1,300)]:
    q={**p,"bias_source_resistance_mohm":r,"bias_source_capacitance_nf":cap,"bias_source_divider_mohm":divider}
    row={"name":name,"resistance_ohm":r*1e6,"capacitance_nf":cap,"divider_mohm":divider}
    for kind,node in [("supply_voltage",None),("input_series_voltage","input"),("cryostat_series_voltage","cryostat"),("input_current",None)]:
        deck=spice.lmfe_source_controlled_netlist(c,q,Path("unused"),regulator_source=True,pickup_node=node).split(".control")[0]
        if kind=="input_current":
            deck=deck.replace("V1 gen 0 AC 1","V1 gen 0 AC 0")+"Ipickup 0 src AC 1\n"
        deck+=".control\nac lin 1 50 50\nwrdata OUTPUT v(lmfe_out_p,lmfe_out_n)\nquit\n.endc\n.end\n"
        z=solve(deck)[0][1]
        row[kind]={"magnitude":abs(z),"phase_deg":math.degrees(__import__('cmath').phase(z)),"units":"V/A" if kind=="input_current" else "V/V"}
    rows.append(row)
for row in rows:
    for kind in ("supply_voltage","input_series_voltage","cryostat_series_voltage","input_current"):
        row[kind]["change_db_vs_previous"]=20*math.log10(row[kind]["magnitude"]/rows[0][kind]["magnitude"])
report={"frequency_hz":50,"settings":p,"circuit":c,"rows":rows,"limits":"Upstream CAEN HV filter and feedback impedance unspecified. Series EMF and current pickup are different coupling assumptions, not interchangeable amplitudes."}
(model.ROOT/"simulations/spice/caen-dp270-50hz.json").write_text(json.dumps(report,indent=2)+"\n")
print(json.dumps(rows,indent=2),flush=True)
