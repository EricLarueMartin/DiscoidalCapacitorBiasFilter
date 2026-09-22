"""Field-only 0.2 mm diameter sweep and refinement for the 28 mm shell default."""
import argparse,json
from pathlib import Path
import axisymmetric_model as model
import fenicsx_solver as solver
from validate_axisymmetric_peak import solve_geometry

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--verify',action='store_true')
    parser.add_argument('--outer-boundary',action='store_true')
    parser.add_argument('--ground-id',type=float,default=4.2)
    parser.add_argument('--bias-od',type=float,default=25.8)
    args=parser.parse_args()
    modules=solver._import_fenicsx_modules()
    base=model.load_parameters(model.DEFAULT_PARAMETERS)
    base.update(tube_id_mm=28,ground_plate_od_mm=28,plate_gap_mm=1,bias_plate_thickness_mm=2,ground_plate_thickness_mm=2,core_od_mm=2.2,mesh_edge_radius_ratio=0.05)
    report={'breakdown_v_per_mm':850000/25.4,'target_margin':4,'numerical_guard_fraction':0.03,'cases':[]}
    def run(gid,od,name,z0,z1,fine=None):
        p=model.normalize_parameters({**base,'ground_plate_inner_diameter_mm':gid,'hv_plate_od_mm':od})
        if max(p['core_to_ground_gap_mm'],p['hv_to_tube_gap_mm'],p['plate_gap_mm']) > 2.0:
            raise SystemExit('Stopped: requested gap exceeds the user limit of 2 mm')
        row=solve_geometry(p,modules,name,z0,z1,fine=fine,refine_peak_field=True)
        row.update(ground_id_mm=gid,bias_od_mm=od)
        peak=row['regions']['all']['field_v_per_mm']
        row['margin']=report['breakdown_v_per_mm']/peak
        row['guarded_margin']=row['margin']/1.03
        report['cases'].append(row)
        args.output.parent.mkdir(parents=True,exist_ok=True)
        args.output.write_text(json.dumps(report,indent=2)+'\n')
        print(json.dumps({k:row[k] for k in ['case','ground_id_mm','bias_od_mm','fine_mm','cells','regions','margin','guarded_margin']}),flush=True)
    if args.verify:
        for fine in [0.05,0.025,0.0125]:
            for name,z0,z1 in [('end',0,4),('interior',4,7)]:run(args.ground_id,args.bias_od,name,z0,z1,fine)
        run(args.ground_id,args.bias_od,'mirror_half',0,22)
        run(args.ground_id,args.bias_od,'full_stack',0,44)
        checks={}
        for name in ['end','interior']:
            rows=[row for row in report['cases'] if row['case']==name]
            for region in ['all','core_gap','bias_outer_rim']:
                coarse=rows[0]['regions'][region]['field_v_per_mm']
                fine=rows[-1]['regions'][region]['field_v_per_mm']
                checks[name+'_'+region]=abs(coarse-fine)/fine
        worst=max(row['regions']['all']['field_v_per_mm'] for row in report['cases'])
        report['verification']={
            'relative_field_changes_0_05_to_0_0125':checks,
            'maximum_relative_change':max(checks.values()),
            'mesh_change_below_3_percent':max(checks.values())<0.03,
            'worst_peak_v_per_mm':worst,
            'minimum_margin':report['breakdown_v_per_mm']/worst,
            'minimum_margin_with_3_percent_allowance':report['breakdown_v_per_mm']/worst/1.03,
            'both_radial_gaps_at_most_2_mm':all(max((row['ground_id_mm']-2.2)/2,(28-row['bias_od_mm'])/2)<=2 for row in report['cases'])}
        args.output.write_text(json.dumps(report,indent=2)+'\n')
        print(json.dumps(report['verification']),flush=True)
        if not report['verification']['mesh_change_below_3_percent'] or report['verification']['minimum_margin_with_3_percent_allowance']<=4:
            raise SystemExit('Candidate did not pass mesh/margin acceptance')
    elif args.outer_boundary:
        for od in [25.8,26.0,26.2,26.4,26.6]:run(args.ground_id,od,'end',0,4)
    else:
        for gid in [3.8,4.0,4.2,4.4]:
            for od in [25.0,25.2,25.4,25.6]:run(gid,od,'end',0,4)
if __name__=='__main__':main()
