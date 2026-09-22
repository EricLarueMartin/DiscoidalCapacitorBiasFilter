// Odd-mode equivalents for a balanced pair; not a common-mode/crosstalk model.
const NOISE_CABLE_PRESETS = {
  legend_hv: {label: "LEGEND HV", r_ohm_m: 0.209, l_nh_m: 228, c_pf_m: 99.1},
  rg58: {label: "RG58", r_ohm_m: 0.03281, l_nh_m: 262.5, c_pf_m: 93.5},
  lmfe: {label: "LEGEND LMFE Signal", r_ohm_m: 3.78, l_nh_m: 241, c_pf_m: 87},
  flex: {label: "LEGEND Flex Signal", r_ohm_m: 1.92, l_nh_m: 307.5309, c_pf_m: 123.01236}
};
const NOISE_CABLE_SECTIONS = {
  source: "Supply to filter", load: "Filter to detector (O6)",
  internal: "Internal signal / feedback (O3/O1)", head: "Output pair to head electronics (O2/O4)"
};

function noiseCableValue(key) {
  let c = params.noise_cables?.[key];
  if (!c) {
    if (key === "internal") c = {...NOISE_CABLE_PRESETS.lmfe, preset: "lmfe", length_m: 1};
    else if (key === "head") c = {...NOISE_CABLE_PRESETS.rg58, preset: "rg58", length_m: 10};
    else {
      const z = Number(params[`${key}_cable_impedance_ohm`]) || 50;
      const v = (Number(params[`${key}_cable_velocity_factor`]) || 0.66) * 299792458;
      c = {preset: "custom", r_ohm_m: 0, l_nh_m: z/v*1e9, c_pf_m: 1/(z*v)*1e12};
    }
  }
  return {...c, length_m: key === "source" || key === "load" ? params[`${key}_cable_length_m`] : c.length_m};
}

function setupNoiseCableEditor() {
  const root = document.getElementById("noiseCableEditor");
  for (const [key, label] of Object.entries(NOISE_CABLE_SECTIONS)) {
    const section = document.createElement("fieldset");
    const legend = document.createElement("legend");
    legend.textContent = label;
    section.append(legend);
    const presetLabel = document.createElement("label");
    presetLabel.textContent = "Cable preset";
    const select = document.createElement("select");
    select.id = `noiseCable_${key}_preset`;
    select.setAttribute("aria-label", `${label} cable preset`);
    for (const [value, name] of [["custom", "Custom / existing"], ...Object.entries(NOISE_CABLE_PRESETS).map(([id,p]) => [id,p.label])]) {
      const option = document.createElement("option"); option.value = value; option.textContent = name; select.append(option);
    }
    presetLabel.append(select); section.append(presetLabel);
    const commit = (c) => {
      params.noise_cables = {...params.noise_cables, [key]: c};
      spiceLadderDisabled = true;
      spiceLadderError = null;
      if (key === "source" || key === "load") {
        params[`${key}_cable_length_m`] = c.length_m;
        params[`${key}_cable_impedance_ohm`] = Math.sqrt(c.l_nh_m/c.c_pf_m*1000);
        params[`${key}_cable_velocity_factor`] = 1/(Math.sqrt(c.l_nh_m*c.c_pf_m*1e-21)*299792458);
      }
      syncControls();
      document.getElementById("noiseCableStatus").textContent = "Cable settings changed. Run SPICE to update noise results; field capacitances are retained.";
    };
    select.addEventListener("change", () => {
      const c = noiseCableValue(key);
      commit({...c, ...NOISE_CABLE_PRESETS[select.value], preset: select.value});
    });
    for (const [field, title, min] of [["length_m", "Length (m)",0], ["r_ohm_m","R (ohm/m)",0], ["l_nh_m","L (nH/m)",0.001], ["c_pf_m","C (pF/m)",0.001]]) {
      const wrapper = document.createElement("label"); wrapper.textContent = title;
      const input = document.createElement("input"); input.type = "number"; input.min = min; input.step = "any";
      input.id = `noiseCable_${key}_${field}`; input.setAttribute("aria-label", `${label} ${title}`);
      input.title = field === "length_m" ? "Physical length of each modeled line. Zero bypasses the line. O1/O3 share these settings; O2/O4 share these settings."
        : "Distributed per-metre parameter, not a lumped total. For the output pair, R is per conductor and L/C are odd-mode half-circuit equivalents: Zdiff = 2 sqrt(L/C). Constant RLC omits skin-effect variation, dielectric loss, common-mode coupling and crosstalk.";
      input.addEventListener("change", () => {
        const value = Number(input.value);
        if (!input.value || !Number.isFinite(value) || value < min) {input.setCustomValidity(`Enter a finite value >= ${min}`); input.reportValidity(); return;}
        input.setCustomValidity(""); commit({...noiseCableValue(key), [field]: value, preset: field === "length_m" ? noiseCableValue(key).preset : "custom"});
      });
      wrapper.append(input); section.append(wrapper);
    }
    const output = document.createElement("output"); output.id = `noiseCable_${key}_summary`; section.append(output);
    root.append(section);
  }
  document.getElementById("noiseCableSolve").addEventListener("click", () => document.getElementById("solveSpice")?.click());
  syncNoiseCableEditor();
}

function syncNoiseCableEditor() {
  if (!document.getElementById("noiseCable_head_preset")) return;
  for (const key of Object.keys(NOISE_CABLE_SECTIONS)) {
    const c = noiseCableValue(key);
    for (const field of ["preset","length_m","r_ohm_m","l_nh_m","c_pf_m"]) {
      const input = document.getElementById(`noiseCable_${key}_${field}`);
      if (document.activeElement !== input) input.value = typeof c[field] === "number" ? Number(c[field].toPrecision(8)) : c[field] ?? "custom";
    }
    const z = Math.sqrt(c.l_nh_m/c.c_pf_m*1000);
    document.getElementById(`noiseCable_${key}_summary`).textContent = `${z.toFixed(1)} ohm${key === "head" ? ` odd-mode; ${(2*z).toFixed(1)} ohm differential` : " nominal"}; ${(c.c_pf_m*c.length_m).toFixed(1)} pF per line; ${(c.r_ohm_m*c.length_m).toFixed(2)} ohm per line`;
  }
  drawNoiseCableSchematic();
  const solve = document.getElementById("solveSpice");
  if (solve) {
    document.getElementById("noiseCableSolve").disabled = solve.disabled;
    document.getElementById("noiseCableSolve").textContent = solve.textContent;
    document.getElementById("noiseCableStatus").textContent = document.getElementById("spiceSolveStatus").textContent;
  }
}

function drawNoiseCableSchematic() {
  const canvas = document.getElementById("noiseSchematicCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0,0,1100,430); ctx.fillStyle="#fff"; ctx.fillRect(0,0,1100,430);
  const box = (x,y,w,title,detail,color) => {
    ctx.fillStyle=color; ctx.fillRect(x,y,w,72); ctx.strokeStyle="#45565c"; ctx.strokeRect(x,y,w,72);
    ctx.fillStyle="#17202a"; ctx.font="bold 17px Arial"; ctx.textAlign="center"; ctx.fillText(title,x+w/2,y+27);
    ctx.font="14px Arial"; ctx.fillText(detail,x+w/2,y+52);
  };
  const cableText = key => `${noiseCableValue(key).length_m} m; ${Math.sqrt(noiseCableValue(key).l_nh_m/noiseCableValue(key).c_pf_m*1000).toFixed(1)} ohm`;
  box(25,50,180,"HV regulator",`${params.bias_source_resistance_mohm*1000} kohm / ${params.bias_source_capacitance_nf} nF`,"#eee2cf");
  box(235,50,180,"Input cable",cableText("source"),"#d5e8e9");
  box(445,50,180,"Bias filter",`${params.plate_pairs} bias plates`,"#dfe7d4");
  box(655,50,180,"HV cable O6",cableText("load"),"#d5e8e9");
  box(865,50,210,"Detector C19",`${params.detector_capacitance_pf} pF to J2 gate`,"#eee2cf");
  for (const x of [205,415,625,835]) drawArrow(ctx,x,86,x+30,86,"#45565c");
  box(25,255,215,"J2 input","0.35 pF || 1 Gohm feedback","#eee2cf");
  box(275,255,230,"Internal signal O3",cableText("internal"),"#d5e8e9");
  box(540,255,220,"BF862 + amplifiers","Feedback before O2/O4","#dfe7d4");
  box(795,255,280,"Output pair O2 / O4",`${noiseCableValue("head").length_m} m each to R30 = 100 ohm`,"#d5e8e9");
  for (const [a,b] of [[240,275],[505,540],[760,795]]) drawArrow(ctx,a,291,b,291,"#45565c");
  ctx.strokeStyle="#7354a3"; ctx.beginPath();ctx.moveTo(650,327);ctx.lineTo(650,353);ctx.lineTo(130,353);ctx.stroke();
  drawArrow(ctx,130,353,130,327,"#7354a3");
  ctx.fillStyle="#7354a3";ctx.font="14px Arial";ctx.textAlign="center";
  ctx.fillText(`O1 feedback: ${noiseCableValue("internal").length_m} m`,390,347);
  ctx.strokeStyle="#45565c"; ctx.beginPath(); ctx.moveTo(970,122);ctx.lineTo(970,180);ctx.lineTo(130,180);ctx.lineTo(130,255);ctx.stroke();
  ctx.fillStyle="#9a3535";ctx.font="15px Arial";ctx.textAlign="left";
  ctx.fillText("Supply noise",30,35);ctx.fillText("Input pickup",295,145);ctx.fillText("Cryostat pickup",680,145);
  ctx.fillStyle="#45565c";ctx.fillText("Signal calibration: known charge into J2 gate. Noise and signal measured differentially across R30.",25,375);
  ctx.fillText("Output pair: odd-mode equivalent only; common-mode conversion and neighboring-pair crosstalk are not modeled.",25,403);
}
