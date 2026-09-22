"""Verify cylindrical weighting and resolve core-gap versus bias-rim field peaks.

Runs field-only cases (no capacitance or SPICE regeneration). JSON output keeps
mesh sizes and local peaks so a change of dominant region is visible.
"""
from __future__ import annotations
import argparse, json, math, time
from pathlib import Path
import axisymmetric_model as model
import fenicsx_solver as solver


def peaks(mesh, potential, modules):
    field = solver._project_field_magnitude(mesh, potential, modules)
    points = field.function_space.tabulate_dof_coordinates()
    values = field.x.array
    regions = {}
    for name, selector in [("all", lambda r: True), ("core_gap", lambda r: r < 3.1),
                           ("bias_outer_rim", lambda r: r > 10)]:
        ids = [i for i, point in enumerate(points) if selector(float(point[0]))]
        i = max(ids, key=lambda i: values[i])
        regions[name] = {"field_v_per_mm": float(values[i]), "r_mm": float(points[i][0]), "z_mm": float(points[i][1])}
    return field, regions


def solve_geometry(p, modules, name, z0, z1, fine=None, refine_peak_field=False):
    original = solver._mesh_sizes
    if fine is not None:
        solver._mesh_sizes = lambda parameters: {**original(parameters), "fine": fine, "coarse": 2 * fine}
    started = time.perf_counter()
    try:
        sizes = solver._build_gmsh_model(p, modules, z_min_mm=z0, z_max_mm=z1, refine_peak_field=refine_peak_field)
        mesh = solver._model_to_mesh(modules)
    finally:
        modules["gmsh"].finalize()
        solver._mesh_sizes = original
    potential = solver._solve_potential(mesh, p, modules)
    field, regions = peaks(mesh, potential, modules)
    ground_centers = [z for kind,z in model.plate_centers(p) if kind == "ground" and z0 <= z <= z1]
    probes = [(p["core_od_mm"] / 2 + 1e-5, z) for z in ground_centers]
    fields = solver._eval_function_at_points(field, mesh, probes, modules)
    potentials = solver._eval_function_at_points(potential, mesh, probes, modules)
    return {"case": name,"fine_mm":sizes["fine"],"coarse_mm":sizes["coarse"],
            "z_extent_mm":[z0,z1],"cells":mesh.topology.index_map(mesh.topology.dim).size_global,
            "regions":regions,"core_surface_probes":[{"r_mm":r,"z_mm":z,"field_v_per_mm":e,"potential_v":v} for (r,z),e,v in zip(probes,fields,potentials)],
            "seconds":time.perf_counter()-started}


def coax_check(p, modules):
    from dolfinx import mesh as dmesh
    np=modules["np"]
    a,b,length=1.1,2.0,2.0
    mesh=dmesh.create_rectangle(modules["MPI"].COMM_WORLD,[np.array([a,0]),np.array([b,length])],[90,40])
    markers=[(6000,lambda x:np.isclose(x[0],a)),(0,lambda x:np.isclose(x[0],b))]
    potential=solver._solve_potential_with_dirichlet_markers(mesh,p,modules,markers)
    radii=[a+0.005,1.3,1.6,b-0.005]
    points=[(r,length/2) for r in radii]
    values=solver._eval_function_at_points(potential,mesh,points,modules)
    field=solver._project_field_magnitude(mesh,potential,modules)
    fields=solver._eval_function_at_points(field,mesh,points,modules)
    rows=[{"r_mm":r,"potential_v":v,"exact_potential_v":6000*math.log(b/r)/math.log(b/a),
           "field_v_per_mm":e,"exact_field_v_per_mm":6000/(r*math.log(b/a))} for r,v,e in zip(radii,values,fields)]
    error=max(abs(row["field_v_per_mm"]/row["exact_field_v_per_mm"]-1) for row in rows)
    return {"case":"coaxial_analytic_check","samples":rows,"max_relative_field_error":error,"passed":error<0.01,
            "exact_core_surface_v_per_mm":6000/(a*math.log(b/a))}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output",type=Path,required=True)
    parser.add_argument("--smooth",action="store_true",help="Use 64 profile segments per quarter-circle for a geometry-convergence check")
    parser.add_argument("--production",action="store_true",help="Check corrected peak-field meshing in end, interior, mirror and full-stack cases")
    args=parser.parse_args()
    if args.smooth:
        original_profiles=model.component_profiles
        model.component_profiles=lambda p,curve_steps=8:original_profiles(p,curve_steps=64)
    p=model.load_parameters(model.DEFAULT_PARAMETERS)
    modules=solver._import_fenicsx_modules()
    report={"profile_steps_per_quarter":64 if args.smooth or args.production else 8,"parameters":p,"axis":"r=0, the core centreline; x[0]=r, x[1]=z","cases":[]}
    def save(row):
        report["cases"].append(row)
        args.output.parent.mkdir(parents=True,exist_ok=True)
        args.output.write_text(json.dumps(report,indent=2,allow_nan=False)+"\n")
        print(json.dumps(row),flush=True)
    save(coax_check(p,modules))
    if args.production:
        for name,z0,z1 in [("end",0,4),("interior",4,7),("mirror_half",0,22),("full_stack",0,44)]:
            save(solve_geometry(p,modules,name,z0,z1,refine_peak_field=True))
        return
    for fine in ([0.04,0.02] if args.smooth else [None,0.08,0.04,0.02]):
        save(solve_geometry(p,modules,"end",0,4,fine))
        save(solve_geometry(p,modules,"interior",4,7,fine))
    save(solve_geometry(p,modules,"full_stack",0,model.stack_length_mm(p),0.08))


if __name__ == "__main__":main()
