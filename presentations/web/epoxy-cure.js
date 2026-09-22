/* Manufacturer data checked 2026-09-22. No material properties are inferred from hardness. */
(function (root) {
  "use strict";
  const materials = {
    three_m_dp270: {
      label: "3M DP270", dielectricKvMm: 850 / 25.4,
      cteLow: 80, cteHigh: 180, tg: 49, tgOnset: 43, tensileMpa: null,
      cteText: "80 below Tg / 180 above Tg ppm/C; Tg 43 C onset, 49 C midpoint",
      bondText: "Cu/Cu 11.72-12.07 MPa; etched Al/Al 16.89-17.24 MPa lap shear at 23 C, after 7 days at 23 C",
      note: "The 40 C choice is a user-selected thermal reference, not a datasheet full-cure schedule. No cure duration at 40 C is established here. CTE measured over 5-30 C and 60-125 C; a sharp switch at the 49 C Tg midpoint approximates the unmeasured transition. The 100 C full-cure table entry conflicts with nearby advice to accelerate only up to 93 C; confirm 100 C with 3M.",
      source: "https://multimedia.3m.com/mws/media/1235390O/dp270-technical-data-sheets.pdf",
      sourceLabel: "3M TDS, February 2016, pp. 2, 4, 6",
      defaultCure: "three_m_dp270:40",
      cures: [{id:"three_m_dp270:40",c:40,label:"40 C provisional reference (cure duration unverified)"}, {id:"three_m_dp270:23",c:23,label:"48 h at 23 C"}, {id:"three_m_dp270:50",c:50,label:"4 h at 50 C"}, {id:"three_m_dp270:80",c:80,label:"1 h at 80 C"}, {id:"three_m_dp270:100",c:100,label:"30 min at 100 C (confirm with 3M)"}]
    },
    master_bond_ep30: {
      label: "Master Bond EP30", dielectricKvMm: 440 / 25.4,
      cteLow: null, cteHigh: null, tg: null, tensileMpa: null,
      cteText: "Not found in public base-EP30 manufacturer data",
      bondText: "Al/Al lap shear >20.68 MPa (>3,000 psi); manufacturer release, 2009; confirm current TDS and test conditions",
      note: "CTE, Tg and modulus are missing. No numeric thermal stress is assigned and no EP30-2 or EP30FL properties are substituted. The current product page specifies 2-3 h at 200 F; older selector guides give shorter schedules.",
      source: "https://www.masterbond.com/tds/ep30", sourceLabel:"Master Bond EP30 product data",
      bondSource: "https://www.masterbond.com/newsrelease/ep30",
      defaultCure: "master_bond_ep30:93",
      cures: [{id:"master_bond_ep30:24",c: (75-32)*5/9,label:"24-48 h at 75 F (23.9 C)"}, {id:"master_bond_ep30:93",c:(200-32)*5/9,label:"2-3 h at 200 F (93.3 C)"}]
    },
    mg_832c: {
      label:"MG Chemicals 832C", dielectricKvMm: 483 / 25.4,
      cteLow:150, cteHigh:161, tg:53, tensileMpa:45,
      cteText:"150 below Tg / 161 above Tg ppm/C; Tg 53 C",
      bondText:"17 MPa stainless steel; 18 MPa aluminum, ASTM D1002 lap shear. Bulk tensile: 45 MPa (separate test). Copper/alumina adhesion not published.",
      note:"Room cure is modeled at an assumed 25 C. All oven entries are listed cure alternatives, not a measured ranking of dielectric strength.",
      source:"https://www.mgchemicals.com/downloads/tds/tds-832c-2parts.pdf",sourceLabel:"MG TDS v4.2, 20 February 2026, pp. 1-3",
      defaultCure:"mg_832c:80",
      cures:[{id:"mg_832c:25",c:25,label:"24 h at room temperature (assumed 25 C)"},{id:"mg_832c:65",c:65,label:"1 h at 65 C"},{id:"mg_832c:80",c:80,label:"30 min at 80 C"},{id:"mg_832c:100",c:100,label:"15 min at 100 C"}]
    }
  };
  function schedule(key, p) {
    const m=materials[key];
    return m?.cures.find(c=>c.id===p.epoxy_cure_schedule) || m?.cures.find(c=>c.id===m.defaultCure);
  }
  function strain(key, substrateCte, fromC, toC) {
    const m=materials[key];
    if (!m || !Number.isFinite(m.cteLow)) return NaN;
    const below=Math.max(0, Math.min(fromC,m.tg)-toC);
    const above=Math.max(0,fromC-Math.max(toC,m.tg));
    return Math.abs((m.cteLow-substrateCte)*below+(m.cteHigh-substrateCte)*above)*1e-6;
  }
  function stress(key, substrateCte, fromC, p, restraint=p.thermal_restraint_factor) {
    return restraint*p.thermal_epoxy_modulus_gpa*1000*strain(key,substrateCte,fromC,p.thermal_min_temperature_c)/(1-0.35);
  }
  function estimate(key, substrateCte, radiusMm, label, p, restraint=p.thermal_restraint_factor) {
    const m=materials[key], cure=schedule(key,p), mismatch=strain(key,substrateCte,cure.c,p.thermal_min_temperature_c);
    const s=stress(key,substrateCte,cure.c,p,restraint);
    let crossing=NaN;
    if(Number.isFinite(m.tensileMpa) && restraint>0) {
      let lo=cure.c-1000,hi=cure.c;
      if(stress(key,substrateCte,cure.c,{...p,thermal_min_temperature_c:lo},restraint)>=m.tensileMpa) {
        for(let i=0;i<60;i++){const mid=(lo+hi)/2; if(stress(key,substrateCte,cure.c,{...p,thermal_min_temperature_c:mid},restraint)>m.tensileMpa)lo=mid;else hi=mid;}
        crossing=(lo+hi)/2;
      }
    }
    return {label,deltaCtePpmPerC:Number.isFinite(m.cteLow)?Math.abs(m.cteLow-substrateCte):NaN,mismatchStrain:mismatch,radialMismatchUm:mismatch*radiusMm*1000,stressMpa:s,strengthMargin:Number.isFinite(m.tensileMpa)&&Number.isFinite(s)&&s>0?m.tensileMpa/s:NaN,failureOnsetC:crossing};
  }
  const fmt=x=>Number.isFinite(x)?x.toFixed(2):"Unavailable";
  function render(p, onChange) {
    const host=document.getElementById("epoxyCureDetails"); if(!host)return;
    host.replaceChildren();
    const add=(tag,text,parent=host)=>{const e=document.createElement(tag);e.textContent=text;parent.appendChild(e);return e;};
    add("h3","Epoxy cure and bond data");
    add("p","Cooldown screen: cure temperature is assumed stress-free. E = "+p.thermal_epoxy_modulus_gpa.toFixed(1)+" GPa, Poisson ratio 0.35, restraint k = "+p.thermal_restraint_factor.toFixed(2)+", evaluated at "+p.thermal_min_temperature_c+" C. CTE is integrated across Tg. E remains constant; relaxation and cure shrinkage are omitted.");
    const selected=materials[p.epoxy_material];
    if(selected){
      const label=add("label","Cure schedule for "+selected.label+" ");
      const select=add("select","",label);select.id="epoxyCureSchedule";
      selected.cures.forEach(c=>{const o=add("option",c.label,select);o.value=c.id;});
      select.value=schedule(p.epoxy_material,p).id;
      select.addEventListener("change",()=>onChange(select.value));
    }
    for(const [key,m] of Object.entries(materials)){
      const details=add("details","");details.open=key===p.epoxy_material;
      add("summary",m.label+" - "+fmt(m.dielectricKvMm)+" kV/mm",details);
      add("p","CTE: "+m.cteText,details);
      add("p","Bond data: "+m.bondText,details);
      add("p",m.note,details);
      const a=add("a",m.sourceLabel,details);a.href=m.source;a.target="_blank";a.rel="noopener";
      if(m.bondSource){add("span"," | ",details);const b=add("a","Bond-strength source",details);b.href=m.bondSource;b.target="_blank";b.rel="noopener";}
      const wrap=add("div","",details);wrap.style.overflowX="auto";
      const table=add("table","",wrap);table.style.width="100%";table.style.fontSize="0.85rem";
      const head=add("tr","",table);["Cure","Cu stress (MPa)","Alumina stress (MPa)"].forEach(t=>add("th",t,head));
      for(const c of m.cures){const row=add("tr","",table);[c.label,fmt(stress(key,16.9,c.c,p)),fmt(stress(key,8.2,c.c,p))].forEach(t=>{const cell=add("td",t,row);cell.style.padding="0.35rem";});}
      if(!Number.isFinite(m.cteLow))add("p","Pending CTE: for a constant assumed alpha, sigma = k E (alpha - alpha_substrate) x 10^-6 (T_cure - T) / 0.65. No material-specific result is available.",details);
    }
    add("p","The MELF outer coating and its adhesion are uncharacterized; alumina is only a ceramic-body proxy, not a known exposed bonding surface. Lap-shear strength is not a pull-off or debonding limit for this geometry. These sources do not establish that a hotter cure maximizes dielectric strength. Full cure, void removal and bonded-coupon testing matter. Thermal FEA remains unavailable for these new materials.");
  }
  function draw(canvas,p){
    const ctx=canvas.getContext("2d"),m=materials[p.epoxy_material],c=schedule(p.epoxy_material,p);
    ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle="#fffdf8";ctx.fillRect(0,0,canvas.width,canvas.height);
    const scale=canvas.width/1200;ctx.save();ctx.scale(scale,scale);ctx.fillStyle="#17202a";ctx.font="27px Arial";ctx.fillText(m.label+": cooldown from "+c.c.toFixed(1)+" C",55,50);
    ctx.font="18px Arial";ctx.fillText(c.label+"; E = "+p.thermal_epoxy_modulus_gpa.toFixed(1)+" GPa; k = "+p.thermal_restraint_factor,55,82);
    if(!Number.isFinite(m.cteLow)){ctx.fillText("Base EP30 CTE is missing from public manufacturer data.",55,145);ctx.fillText("Thermal stress is unavailable; no other EP30 variant is substituted.",55,180);ctx.restore();return;}
    const left=90,right=1110,top=125,bottom=470,tmin=-80,tmax=c.c;
    const ymax=Math.ceil(Math.max(10,stress(p.epoxy_material,8.2,c.c,{...p,thermal_min_temperature_c:tmin}))/10)*10;
    const x=t=>left+(right-left)*(t-tmin)/(tmax-tmin),y=s=>bottom-(bottom-top)*s/ymax;
    ctx.strokeStyle="#aaa";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(left,top);ctx.lineTo(left,bottom);ctx.lineTo(right,bottom);ctx.stroke();
    ctx.font="16px Arial";ctx.fillText(ymax+" MPa",left-70,top);ctx.fillText("0",left-22,bottom);ctx.fillText(tmin+" C",left-20,bottom+25);ctx.fillText(tmax.toFixed(1)+" C",right-40,bottom+25);
    [[16.9,"#147d92","Copper"],[8.2,"#b35a21","Alumina"]].forEach(([a,color,label],i)=>{
      ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();for(let j=0;j<=200;j++){const t=tmin+(tmax-tmin)*j/200;const s=stress(p.epoxy_material,a,c.c,{...p,thermal_min_temperature_c:t});if(j===0)ctx.moveTo(x(t),y(s));else ctx.lineTo(x(t),y(s));}ctx.stroke();ctx.fillStyle=color;ctx.fillText(label+": "+fmt(stress(p.epoxy_material,a,c.c,p))+" MPa at "+p.thermal_min_temperature_c+" C",left+400*i,top-15);
    });
    ctx.fillStyle="#555";ctx.fillText("Assumed stress-free cure; piecewise CTE; constant E; no relaxation or shrinkage. Not a debonding prediction.",55,540);
    ctx.fillText("Compare all datasheet cure schedules and bond tests in the Thermal panel.",55,570);ctx.restore();
  }
  const api={materials,schedule,strain,stress,estimate,render,draw};
  if(typeof module!=="undefined" && module.exports)module.exports=api;
  root.EpoxyCure=api;
})(typeof window!=="undefined"?window:globalThis);
