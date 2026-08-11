const GE_FANO_MEASUREMENTS = Object.freeze([
  { value: 0.129, sigma: 0.003, source: "Bilger 1967" },
  { value: 0.112, sigma: 0.001, source: "Croft and Bond 1991" },
  { value: 0.123, sigma: 0.003, source: "Priharti et al. 2015" }
]);
const DEFAULT_GE_FANO_FACTOR = GE_FANO_MEASUREMENTS.reduce(
  (sum, measurement) => sum + measurement.value / measurement.sigma ** 2,
  0
) / GE_FANO_MEASUREMENTS.reduce(
  (sum, measurement) => sum + 1 / measurement.sigma ** 2,
  0
);
const FANO_TARGET_FRACTION = 0.1;

const defaults = {
  units: "mm",
  bias_voltage_v: 6000,
  core_volume_resistivity_log10_ohm_cm: 8,
  use_direct_stage_circuit: true,
  use_direct_stage_capacitance: false,
  melf_stage_resistance_mohm: 12,
  melf_stage_resistance_log10_ohm: Math.log10(12e6),
  melf_stage_parasitic_pf: 0.3,
  melf_substrate_epsr: 9.8,
  melf_metal_fill_factor: 0.5,
  ferrite_conductor_fill_factor: 0,
  input_series_resistance_mohm: 12,
  output_series_resistance_ohm: 50,
  input_series_matches_stage: true,
  output_series_matches_stage: false,
  load_current_na: 1,
  load_cable_length_m: 10,
  load_cable_impedance_ohm: 50,
  load_cable_velocity_factor: 0.66,
  detector_capacitance_pf: 10,
  additional_ground_capacitance_pf: 0,
  noise_sample_rate_msps: 62.5,
  noise_waveform_samples: 8192,
  noise_trap_rise_us: 10,
  noise_trap_flat_us: 4,
  noise_supply_noise_pp_mv: 10,
  noise_lab_broadband_rms_mv: 10,
  noise_mains_rms_mv: 10,
  noise_mains_frequency_hz: 50,
  noise_fano_factor: DEFAULT_GE_FANO_FACTOR,
  core_resistance_gohm: 0.03600005,
  core_od_mm: 2.2,
  use_package_core_od: true,
  core_material: "mmb0207_melf",
  ferrite_epsr: 6,
  core_to_ground_gap_mm: 1.45,
  hv_to_tube_gap_mm: 2.25,
  hv_plate_od_mm: 21.5,
  ground_plate_inner_diameter_mm: 5.1,
  washer_id_mm: 6.6,
  washer_od_mm: 20,
  washer_id_mode: "ground_flat_id",
  washer_od_mode: "bias_flat_od",
  ground_plate_od_mm: 26,
  tube_id_mm: 26,
  plate_gap_mm: 1.5,
  plate_thickness_mm: 1.5,
  bias_plate_thickness_mm: 1.5,
  ground_plate_thickness_mm: 1.5,
  ground_matches_bias_thickness: true,
  edge_diameter_percent: 100,
  washer_material: "alumina",
  washer_epsr: 10,
  epoxy_material: "stycast_2850ft_23lv",
  epoxy_epsr: 5.36,
  plate_material: "copper",
  plate_conductivity_log10_s_per_m: Math.log10(5.8e7),
  plate_relative_permeability: 1,
  tube_material: "copper",
  tube_conductivity_log10_s_per_m: Math.log10(5.8e7),
  tube_relative_permeability: 1,
  rf_compare_frequency_log10_mhz: 0,
  plate_pairs: 3,
  include_ground_tube: true,
  field_solver: "backend_auto",
  mesh_edge_radius_ratio: 0.2,
  tube_wall_thickness_mm: 1,
  domain_margin_mm: 4,
  // Browser fallback solver controls. These match the finite-difference
  // backend defaults so a static local page gives the same screening result
  // when the Python service is unavailable.
  grid_r_count: 90,
  grid_z_count: 150,
  solver_iterations: 700,
  solver_tolerance_v: 0.01,
  solve_strategy: "end_repeat_approx",
  use_repeating_cell_approximation: true,
  thermal_min_temperature_c: 20,
  thermal_epoxy_modulus_gpa: 3,
  thermal_restraint_factor: 1,
  thermal_mesh_size_mm: 0.3,
  full_wave_resolution_per_mm: 2,
  full_wave_timeout_hours: 2,
  full_wave_verify_resonances: false,
  full_wave_eqs_frequencies_hz: [50, 1e3, 1e6, 31.25e6, 100e6, 300e6, 1e9],
  full_wave_frequencies_hz: [300e6, 1e9, 3e9, 10e9, 30e9]
};

const FIELD_SOLVER_ENDPOINT = "/api/field-solve";
const GEOMETRY_ENDPOINT = "/api/geometry";
const SPICE_LADDER_ENDPOINT = "/api/spice-ladder";
const THERMAL_SOLVER_ENDPOINT = "/api/thermal-solve";
const FULL_WAVE_SOLVER_ENDPOINT = "/api/full-wave-solve";
const FIELD_SOLVER_CONNECT_TIMEOUT_MS = 1800;
const GEOMETRY_CONNECT_TIMEOUT_MS = 900;
const SPICE_CONNECT_TIMEOUT_MS = 1800;
const FIELD_SOLVER_POLL_MS = 850;
const FIELD_SOLVER_JOB_TIMEOUT_MS = 120000;
const THERMAL_SOLVER_TIMEOUT_MS = 15 * 60 * 1000;
const FULL_WAVE_SOLVER_POLL_MS = 2000;
const FULL_WAVE_CONNECT_TIMEOUT_MS = 5000;
const FULL_WAVE_JOB_STORAGE_KEY = "discoidal-full-wave-job";
const FIELD_ADAPTIVE_PROBE_SWEEPS = 90;
const FIELD_ADAPTIVE_MAX_POINTS = 18;
const FIELD_ADAPTIVE_THRESHOLD_FRACTION = 0.45;
const SUPPORTED_PEAK_PERCENTILE = 0.75;
const SUPPORTED_PEAK_OUTLIER_RATIO = 1.35;
const MIN_RADIAL_OVERLAP_MM = 1;
const MIN_HV_PLATE_OD_MM = 12;
const MIN_WASHER_RADIAL_WIDTH_MM = 0.1;
const SPEED_OF_LIGHT_M_PER_S = 299792458;
const ATTENUATION_PLOT_FMIN_HZ = 1;
const ATTENUATION_PLOT_FMAX_HZ = 100e6;
const CUSTOM_SPACING_RANGE_MM = { min: 0.4, max: 4 };
const BREAKDOWN_DESIGN_FACTOR_MAX = 10;
const CPAR_STRATEGY_VALIDATION = [
  { plates: 2, analyticPf: 0.2676433348, fullPf: 0.1279692178, mirrorPf: 0.1279692178, repeatPf: 0.1279692178 },
  { plates: 3, analyticPf: 0.2676433348, fullPf: 0.1279341975, mirrorPf: 0.1279341975, repeatPf: 0.1279341975 },
  { plates: 4, analyticPf: 0.2676433348, fullPf: 0.1281302137, mirrorPf: 0.1281302137, repeatPf: 0.1281302137 },
  { plates: 5, analyticPf: 0.2676433348, fullPf: 0.1279066732, mirrorPf: 0.1279066732, repeatPf: 0.1279066732 }
];
const CPAR_LIMIT_VALIDATION = [
  { outerMm: 24, groundIdMm: 20, biasOdMm: 22, analyticPf: 2.1016723270, feaPf: 1.5140708258, ratio: 0.7204124099 },
  { outerMm: 40, groundIdMm: 36, biasOdMm: 38, analyticPf: 6.8094183393, feaPf: 5.7162819844, ratio: 0.8394669999 },
  { outerMm: 80, groundIdMm: 76, biasOdMm: 78, analyticPf: 30.3481484013, feaPf: 27.9935540119, ratio: 0.9224139029 },
  { outerMm: 120, groundIdMm: 116, biasOdMm: 118, analyticPf: 70.7002570788, feaPf: 67.0846945309, ratio: 0.9488606874 }
];
const CG_STRATEGY_VALIDATION = [
  { plates: 1, analyticPf: 33.0494154803, fullPf: 39.9156046841, mirrorPf: 39.9156046841, repeatPf: 39.9156046841, maxNodeDeltaPct: 0 },
  { plates: 2, analyticPf: 33.0494154803, fullPf: 39.8276173351, mirrorPf: 39.8276173351, repeatPf: 39.8276173351, maxNodeDeltaPct: 0.0372065119 },
  { plates: 3, analyticPf: 33.0494154803, fullPf: 39.8296672643, mirrorPf: 39.8296672643, repeatPf: 39.8296672643, maxNodeDeltaPct: 0.0153645457 },
  { plates: 4, analyticPf: 33.0494154803, fullPf: 39.8007064658, mirrorPf: 39.8007064658, repeatPf: 39.8007064658, maxNodeDeltaPct: 0.0658242371 },
  { plates: 5, analyticPf: 33.0494154803, fullPf: 39.7979382457, mirrorPf: 39.7979382457, repeatPf: 39.7979382457, maxNodeDeltaPct: 0.0460191695 }
];
const CG_LIMIT_VALIDATION = [
  { biasOdMm: 12, tubeOdMm: 16, groundIdMm: 2.2, analyticPf: 4.3870308153, feaPf: 6.3551096887, ratio: 1.4486129586 },
  { biasOdMm: 24, tubeOdMm: 28, groundIdMm: 2.2, analyticPf: 18.0058674940, feaPf: 21.6955829932, ratio: 1.2049173971 },
  { biasOdMm: 40, tubeOdMm: 44, groundIdMm: 2.2, analyticPf: 50.2875544360, feaPf: 56.2685955392, ratio: 1.1189368059 },
  { biasOdMm: 80, tubeOdMm: 84, groundIdMm: 2.2, analyticPf: 201.6079619769, feaPf: 213.3139122880, ratio: 1.0580629366 },
  { biasOdMm: 120, tubeOdMm: 124, groundIdMm: 2.2, analyticPf: 453.8086412118, feaPf: 471.2384835606, ratio: 1.0384079120 }
];
const WASHER_ID_MODES = new Set(["ground_id", "ground_flat_id", "custom"]);
const WASHER_OD_MODES = new Set(["bias_od", "bias_flat_od", "custom"]);
const fieldSolverOptions = {
  browser_js: {
    label: "Browser JS adaptive",
    modelLabel: "Browser adaptive FD",
    backendSolver: null
  },
  backend_auto: {
    label: "Backend auto",
    modelLabel: "Backend auto",
    backendSolver: "auto"
  },
  backend_fd: {
    label: "Backend adaptive FD",
    modelLabel: "Backend adaptive FD",
    backendSolver: "fd"
  },
  backend_fenicsx: {
    label: "FEniCSx required",
    modelLabel: "FEniCSx",
    backendSolver: "fenicsx"
  }
};

const PARAMETER_TOOLTIPS = Object.freeze({
  bias_voltage_v:
    "DC voltage applied to the bias plates and resistive core relative to the grounded plates and tube, in volts. The electrostatic field solve uses this as the conductor-potential difference, so electric field scales linearly with it for fixed geometry. It also sets the load resistance inferred from Rload = Vbias / Iload and affects dielectric-spacing guidance; attenuation ratios of an otherwise linear RC network do not depend on its absolute value.",
  core_volume_resistivity_log10_ohm_cm:
    "Base-10 logarithm of the resistive core's bulk volume resistivity in ohm-cm. When stage resistance is calculated, the model uses Rstage = rho L/A, where L is the bias-to-bias resistive length through one ground-plate section and A is the circular core area. This is a bulk-material approximation: contact resistance, anisotropy, voltage coefficient, temperature dependence, and ferrite microstructure are not included.",
  melf_stage_resistance_mohm:
    "Electrical resistance of one bias-to-bias stage, entered directly in megaohms. It replaces the bulk-resistivity R = rho L/A calculation when Enter stage R is checked, and it is used by the analytical ladder and SPICE backend. This is the resistance between adjacent bias nodes, not the total series resistance of the complete filter.",
  input_series_resistance_mohm:
    "Series resistance between the ideal bias source and the first bias plate, in megaohms. It is an additional ladder element and is not one of the internal bias-to-bias stage resistors. A value of zero makes the first plate an ideally driven node; a nonzero value adds low-pass action and source isolation.",
  input_series_matches_stage:
    "When checked, the input end follows the stage definition. If Direct stage R is enabled, it uses another resistor of exactly that entered value. If resistance is derived from a bulk core material, the input uses the same material conductivity and core area but its shorter end length, Lend = ground-plate thickness + one dielectric gap; its resistance therefore differs from the interior stage value. Uncheck this to enter an independent input resistance.",
  output_series_resistance_ohm:
    "Series resistance between the final bias plate and the cable or detector load, entered in ohms rather than megaohms. The normal default is 50 ohms. Zero connects the external load directly to the final filter node; large values can substantially change the loaded transfer function, so confirm the displayed unit when entering a value.",
  output_series_matches_stage:
    "When checked, the output end follows the stage definition. A directly entered stage resistance is reused exactly as a discrete resistor. A bulk material instead keeps the same conductivity and core area while using the shorter output-end length, Lend = ground-plate thickness + one dielectric gap. Uncheck this for an independent output resistance such as 50 ohms.",
  load_current_na:
    "Assumed detector DC current draw at the selected bias voltage, in nanoamps. The small-signal circuit model converts it to a parallel load conductance Gload = Iload/Vbias, equivalent to Rload = Vbias/Iload. A value of zero represents infinite DC load resistance; it does not remove the selected cable or detector capacitance.",
  load_cable_length_m:
    "Length of coaxial cable connected between the filter and detector, in metres. The analytical loaded-ladder estimate converts it to lumped capacitance using C = length/(Z0 vf c); the ngspice backend can represent the cable as a transmission-line load. Set it to zero to remove cable loading while retaining detector capacitance and load conductance.",
  load_cable_impedance_ohm:
    "Nominal characteristic impedance Z0 of the load coax, in ohms. Together with cable length and velocity factor it determines the cable capacitance per unit length in the analytical model, and it parameterizes the transmission line in the SPICE model. It is not a resistor placed directly from the filter output to ground.",
  load_cable_velocity_factor:
    "Propagation velocity in the coax divided by the speed of light. The analytical model uses it with Z0 to infer cable capacitance, C = length/(Z0 vf c), while the SPICE transmission line uses it to determine propagation delay. Use the cable manufacturer's value when available; 0.66 is typical of solid-polyethylene coax.",
  detector_capacitance_pf:
    "Detector and immediate input capacitance connected from the far end of the cable to ground, in picofarads. It is added to the lumped cable capacitance in the analytical loaded ladder and is a separate termination capacitor in the SPICE model. This is external load capacitance, not the filter's stage-to-ground capacitance.",
  additional_ground_capacitance_pf:
    "Optional circuit-only capacitance for a matched set of discrete high-voltage capacitors, in picofarads per bias node. The same value is connected from every bias plate to ground, preserving symmetry when at least two bias nodes are modeled. It is placed in parallel with geometry-derived Cg in the analytical ladder and SPICE model, while the electrostatic FEA geometry, FEA Cg, and every bias-to-bias Cpar remain unchanged and separately reported. Use zero for the baseline design. A one-node result is sensitivity-only, not the intended physical construction. The ideal model omits package voids, placement coupling, lead inductance, voltage coefficient, dielectric loss, leakage, and voltage rating.",
  core_material:
    "Selects the resistive-core or resistor-package preset. A preset can initialize bulk resistivity, core relative permittivity, MELF package diameter, direct stage resistance, parasitic-capacitance model, and minimum package length. These are modeling defaults rather than guaranteed lot properties; selecting Custom leaves the electrical quantities available for independent entry.",
  use_direct_stage_circuit:
    "Choose how stage resistance is obtained. Checked uses the entered Direct stage R exactly in the circuit and SPICE models. For distributed-field modeling, the package is represented by an effective bulk conductivity sigma_eff = Lstage/(Rstage Acore), so the modeled core section has the entered end-to-end resistance without resolving its film or winding. Unchecked uses the selected material resistivity directly with the core diameter and axial section length. Resistance and capacitance modes remain independently selectable.",
  use_direct_stage_capacitance:
    "Choose how the resistor/core contribution to adjacent-stage parasitic capacitance is obtained. Checked interprets the entered Cpar as the resistor package alone before installation. The circuit model adds the separate epoxy path around it, while field models assign the core an effective permittivity eps_eff = Cpar Lstage/(epsilon0 Acore) that reproduces the entered package capacitance; surrounding epoxy remains a separate dielectric region. Unchecked calculates the core contribution from the selected material or MELF effective permittivity. Do not include external epoxy coupling in the entered value or it will be counted twice.",
  washer_material:
    "Selects the dielectric between bias and ground plate faces. Epoxy (same as potting fill) removes the separate solid-washer material: the entire gap becomes continuous selected potting epoxy, its permittivity and provisional dielectric strength stay linked to the Epoxy material control, and thermal FEA assigns the former washer volume epoxy properties. Other presets retain a distinct flat annular washer. High-k candidates are sensitivity studies only; actual materials must be checked for loss, voltage coefficient, microphonics, porosity, surface finish, and partial-discharge behavior.",
  epoxy_material:
    "Selects the potting material filling regions not occupied by washer, core, or conductor. The preset initializes relative permittivity and provisional dielectric-strength guidance and supplies the epoxy-comparison slide. Geometry-based thermal FEA presets are available for MG Chemicals 9510 and Stycast 2850FT/CAT 23LV; the user-entered epoxy modulus remains an engineering assumption because neither cited data sheet publishes Young's modulus.",
  plate_material:
    "Material assigned to the bias and ground plates. The selection initializes conductivity and relative permeability for RF skin-depth diagnostics; electrostatic FEA treats all plates as ideal equipotential conductors regardless of conductivity. Thermal FEA uses the selected material's elastic modulus, Poisson ratio, and CTE. Annealed copper also selects the documented 69 MPa ideal J2 elastic-perfectly-plastic sensitivity by default. Grade 2 titanium and Mo-Cu values are engineering presets; the Mo-Cu Poisson ratio is assumed because it is absent from the cited supplier sheet.",
  tube_material:
    "Material assigned to the surrounding grounded tube. The selection initializes conductivity and relative permeability for RF skin-depth diagnostics; electrostatic FEA treats the tube as an ideal grounded conductor. Thermal FEA assigns this region independently from the plates; annealed copper selects the documented 69 MPa ideal J2 elastic-perfectly-plastic sensitivity by default. The model still assumes a perfect bond and does not infer interface strength from the selected metal name.",
  ferrite_epsr:
    "Relative permittivity assigned to the resistive core material. It controls the calculated core contribution to adjacent-stage Cpar and is used when the capacitance-matrix FEA treats each inter-plate core segment as dielectric. It does not make the core an equipotential conductor in that capacitance solve, and it is not magnetic permeability.",
  ferrite_conductor_fill_factor:
    "Fraction of each ferrite bias-to-bias path idealized as conductive interleave discs rather than resistive ferrite. In calculated mode, the remaining resistive length and Rstage are multiplied by 1 - fill, while effective core permittivity and core Cpar are divided by 1 - fill. This one-dimensional trade study omits disc-edge fringing, local field enhancement, contact resistance, and nonuniform current flow; direct R or direct Cpar overrides take precedence for their respective quantities.",
  melf_stage_parasitic_pf:
    "Entered parasitic capacitance of the resistor package or core between two adjacent bias nodes, in picofarads. It is used only when Enter resistor Cpar is checked. The analytical model adds epoxy coupling around the package separately, so including that same external epoxy path in this value would double count it.",
  melf_substrate_epsr:
    "Relative permittivity of the MELF resistor's ceramic substrate, normally alumina-like. When package Cpar is calculated, this is converted to an effective core permittivity using eps_eff = eps_substrate/(1 - film fill). It is a simplified capacitance model and does not resolve the proprietary spiral film or laser trim.",
  melf_metal_fill_factor:
    "Dimensionless effective metal-film coverage used to represent how the MELF's conductive spiral increases capacitive coupling through its ceramic body. The model uses eps_eff = eps_substrate/(1 - fill), so values near one produce very large Cpar and should not be interpreted as a measured geometric volume fraction. It affects calculated capacitance, not the directly entered resistor value.",
  washer_epsr:
    "Relative dielectric permittivity of the washer material. The analytical gap capacitance is proportional to this value, and the electrostatic FEA assigns it to the flat annular washer regions. When the washer material is Epoxy (same as potting fill), this value is locked to Epoxy epsr and no distinct washer material boundary remains. It is assumed real, linear, isotropic, and frequency independent; dielectric loss, voltage dependence, temperature dependence, and manufacturing porosity are not included.",
  epoxy_epsr:
    "Relative dielectric permittivity of the potting compound. It controls electric-field energy and capacitance in every region outside the flat washer, including the rounded plate-edge pockets and the annulus around the core. The model currently treats it as a real, linear constant and does not include dielectric loss, cure-state variation, voids, or field-dependent behavior.",
  rf_compare_frequency_log10_mhz:
    "Frequency used for the single-number RF admittance and conductor skin-depth comparison. The slider is logarithmic and displayed as a frequency; it does not change the 1 Hz to 100 MHz sweep range of the attenuation plots. This setting affects diagnostic calculations, not the DC electrostatic field solution.",
  plate_conductivity_log10_s_per_m:
    "Base-10 logarithm of plate electrical conductivity in siemens per metre. It is initialized by the selected plate material and used with frequency and relative permeability to calculate skin depth. The electrostatic and present RC models treat the plates as ideal equipotential conductors, so this value does not add plate resistance to the ladder.",
  plate_relative_permeability:
    "Relative magnetic permeability of the plate material used in the RF skin-depth calculation. It is approximately one for copper, aluminium, brass, and austenitic stainless steel but can be larger for magnetic alloys. It does not affect the electrostatic FEA or dielectric capacitance.",
  tube_conductivity_log10_s_per_m:
    "Base-10 logarithm of grounded-tube conductivity in siemens per metre. Together with tube relative permeability and RF comparison frequency it determines the displayed skin depth. The present electrostatic model still treats the tube as an ideal zero-volt boundary and does not calculate distributed shielding resistance.",
  tube_relative_permeability:
    "Relative magnetic permeability of the grounded tube used for the RF skin-depth diagnostic. This is a magnetic material property, distinct from dielectric relative permittivity. It does not change the electrostatic field solve, and the value for stainless steel depends strongly on alloy and processing.",
  core_od_mm:
    "Outside diameter of the central resistive core or resistor body, in millimetres. It sets bulk-resistance cross-sectional area, core dielectric area for Cpar, and radial clearance to the ground-plate opening. In the model, full-diameter bias plates cross the centre and divide the core into dielectric/resistive segments; enable Use package diameter to lock this value to a known MELF package.",
  use_package_core_od:
    "When checked, a core material with a known package diameter sets Core OD automatically, currently 1.4 mm for MELF 0204 and 2.2 mm for MELF 0207. Ferrite and custom materials remain manually adjustable because no single package diameter is implied. Uncheck this to study a nonstandard resistor body or measured part diameter.",
  tube_id_mm:
    "Inside diameter of the surrounding grounded cylindrical tube, in millimetres. It sets the outer radial electrostatic boundary and, with bias-plate OD, determines the epoxy-filled bias-to-tube gap. Geometry normalization also requires room for the plates, washer overlap, and provisional dielectric spacing, so incompatible dimensions can force related values to change.",
  plate_gap_mm:
    "Axial thickness of each flat dielectric washer and the face-to-face separation between an adjacent bias plate and ground plate, in millimetres. It directly controls washer capacitance approximately as 1/d, contributes twice to each bias-to-bias stage length, and affects electric field, total stack length, resistance, and MELF package-length checks.",
  washer_id_mm:
    "Inside diameter of the flat annular washer, in millimetres. The washer exists only outside this radius; the inner pocket is epoxy. Analytical washer capacitance uses the larger of washer ID and ground-plate ID as its inner overlap boundary. The selected Washer ID relation may use this value to derive either the rounded ground edge or the start of its flat face.",
  washer_id_mode:
    "Defines how washer ID is related to the ground plate's rounded inner edge. Ground ID = washer ID aligns the washer with the smallest plate opening. Ground flat ID = washer ID places the washer edge where the rounded corner ends, leaving the rounded-edge pocket as epoxy. Custom makes washer ID and ground-plate ID independent, with capacitance based only on their actual overlap.",
  washer_od_mm:
    "Outside diameter of the flat annular washer, in millimetres. Material outside this radius is epoxy. Analytical washer capacitance uses the smaller of washer OD and bias-plate OD as its outer overlap boundary. The selected Washer OD relation can align this edge either with the full rounded plate OD or with the start of the plate's flat face.",
  washer_od_mode:
    "Defines how washer OD is related to the bias plate's rounded outer edge. Bias OD = washer OD aligns both full diameters. Bias flat OD = washer OD ends the washer where the rounded corner begins, leaving the curved-edge pocket as epoxy. Custom allows independent dimensions and uses only the true washer/electrode overlap in the analytical capacitance.",
  hv_plate_od_mm:
    "Outside diameter of each solid bias plate, in millimetres. The plate extends to the axis with no central hole. Its OD controls washer overlap, radial epoxy clearance to the grounded tube, field concentration at the rounded outer edge, and plate area. It is derived from Washer OD unless the washer relation is Custom.",
  ground_plate_inner_diameter_mm:
    "Inside diameter of each annular ground plate, in millimetres. It sets the radial core-to-ground clearance and strongly shields adjacent-stage electric flux, which can make FEA Cpar lower than the simple axial parallel-plate estimate. It is derived from Washer ID unless the washer relation is Custom.",
  bias_plate_thickness_mm:
    "Axial thickness of each solid bias plate, in millimetres. It sets the maximum available outer-edge radius, contributes to stack length, and affects the MELF package-length constraint. It does not contribute to the resistive length between bias nodes because the core section passing through the bias plate is treated as shorted to that node.",
  ground_plate_thickness_mm:
    "Axial thickness of each annular ground plate, in millimetres. It contributes directly to the bias-to-bias resistive path length and stack length and sets the maximum available inner-edge radius. This control is disabled when Ground thickness = bias thickness is checked.",
  ground_matches_bias_thickness:
    "When checked, every ground plate is assigned the same thickness as the bias plates and the separate ground-thickness input is disabled. Uncheck it to model different stock or machining thicknesses. The chosen thicknesses participate in geometry, resistance, edge radius, stack length, and package-length constraints.",
  edge_diameter_percent:
    "Rounded plate-edge diameter as a percentage of that plate's thickness. At 100%, radius equals half the plate thickness and the edge is fully semicircular; at 0%, the edge is square. Bias plates are rounded at their outer edge and ground plates at their inner edge. Smaller radii generally raise local electric field and also request a finer FEA mesh.",
  plate_pairs:
    "Number of bias plates in the alternating filter stack. The geometry contains one more ground plate than bias plates, so this is not labeled as a pair count. Increasing it adds bias nodes, ground shunt capacitors, internal resistive sections, physical length, and SPICE ladder order. The FEA can either solve the exact mirror half-stack or reconstruct repeated interior cells, depending on the solver option.",
  include_ground_tube:
    "Include the surrounding cylindrical conductor as a grounded physical tube in the CAD and electrostatic model. It provides radial shielding and a bias-to-tube field boundary. Turning it off is useful for sensitivity studies but no longer represents the intended enclosed filter and changes the meaning of the outer-domain boundary.",
  field_solver:
    "Selects the electrostatic solution method. Backend auto prefers the conforming Gmsh/FEniCSx finite-element solve and falls back to the Python adaptive finite-difference worker; FEniCSx required reports failure instead of falling back; Backend adaptive FD forces the Python approximation; Browser JS runs the reduced local screening solver. Capacitance and peak-field fidelity depend on the selected backend and mesh.",
  mesh_edge_radius_ratio:
    "Target fine-element size near rounded conductor edges divided by the local edge radius. For example, 0.2 requests elements about one fifth of the radius and 0.1 requests about one tenth. The backend also caps size using the smallest dielectric gap. Lower values generally improve spatial resolution but increase mesh size, memory use, and solve time; convergence should be checked rather than trusting one setting.",
  use_repeating_cell_approximation:
    "Use only for the reflection-symmetric all-bias excitation. FEA solves one physical end region and one representative interior half-cell, then reconstructs the field and total capacitance. The fast SPICE network allocates that total to end/interior nodes and uses an analytical adjacent-Cpar screen; those entries are not Maxwell row sums or differential FEA capacitances. Unchecked mode uses full-stack basis fields for node-resolved Maxwell extraction, reusing only exact reflected partner excitations.",
  thermal_min_temperature_c:
    "Temperature at which thermal-mismatch stress is evaluated, in degrees Celsius. The stress-free reference follows the epoxy preset: 70 C for the heat-cured MG 9510 screen and 25 C for room-temperature-cured Stycast 2850FT/CAT 23LV. The setting does not model a thermal transient, cure shrinkage, interface separation, or time-dependent stress relaxation.",
  thermal_epoxy_modulus_gpa:
    "Assumed Young's modulus E of the cured epoxy, in gigapascals. The cited MG 9510 and Stycast 2850FT/CAT 23LV data sheets do not publish this value, so 2 to 4 GPa is retained as a sensitivity range rather than measured truth. Stress scales directly with E in the closed-form calculation, and this value is also assigned to epoxy in thermal FEA; Shore hardness is not an interchangeable modulus measurement.",
  noise_sample_rate_msps:
    "ADC sampling frequency used to construct the discrete trapezoidal-filter response and Nyquist integration limit. LEGEND FlashCam germanium waveforms are publicly documented with a 62.5 MHz sampling frequency.",
  noise_waveform_samples:
    "Samples retained in each waveform. A published LEGEND full-chain test used 8192 samples, or 131.072 microseconds at a 62.5 MHz sampling frequency; this is a documented operating value, not a verified firmware maximum. The stationary filter-noise calculation uses this value to check that the selected trapezoid fits in the record.",
  noise_trap_rise_us:
    "Rise/fall averaging time of the normalized symmetric trapezoidal energy filter. The provisional 10 microsecond value matches the public LEGEND e_10410 reference estimator. Production values may be optimized per detector and should replace this assumption when available.",
  noise_trap_flat_us:
    "Delay between the trapezoid's averaging windows. The provisional 4 microsecond value matches the public LEGEND e_10410 reference estimator and provides room for detector charge-collection time.",
  noise_supply_noise_pp_mv:
    "Bias-supply noise and ripple specification in millivolts peak-to-peak. Because a peak-to-peak limit does not define a spectrum, the calculation converts it to sine-equivalent RMS and places it at the frequency with the largest complete filter-plus-trapezoid response over the stated 5 Hz to Nyquist band. This is a conservative spectral-placement bound, not a measured PSD.",
  noise_lab_broadband_rms_mv:
    "Provisional total RMS laboratory pickup referred to the bias-filter input and distributed as white voltage-noise power from 1 Hz to Nyquist. Replace it with an integrated measured input-referred PSD; pickup entering downstream of the filter is not attenuated by this model.",
  noise_mains_rms_mv:
    "RMS coherent power-line component referred to the bias-filter input. It is propagated through both the loaded RC ladder and the trapezoidal energy estimator. This placeholder must be replaced by a measured 50/60 Hz spectral-line amplitude at the relevant coupling point.",
  noise_mains_frequency_hz:
    "Power-line frequency for the coherent pickup calculation. The Gran Sasso laboratory uses 50 Hz; use 60 Hz for measurements made on North American mains.",
  noise_fano_factor:
    "Fano factor F used to calculate the irreducible electron-hole-pair fluctuation in germanium at the 2039 keV Ge-76 endpoint: sigma_E = sqrt(F w E), with w = 2.96 eV per pair. The 0.1145 default is the inverse-variance weighted mean of three retained cryogenic gamma-ray measurements with quoted uncertainties: Bilger 1967 (0.129 +/- 0.003), Croft and Bond 1991 (0.112 +/- 0.001), and Priharti et al. 2015 (0.123 +/- 0.003). Lalovic et al. 1971 (0.058 +/- 0.011) is excluded as a discrepant low result. The retained measurements still have excess scatter and were mostly made near 77 K rather than directly at 2039 keV and liquid-argon temperature, so use the slider for sensitivity studies; the small formal weighted-mean error would understate the systematic uncertainty.",
  thermal_restraint_factor:
    "Dimensionless fraction k of the radial and circumferential (hoop) epoxy/substrate differential thermal strains prevented in the closed-form plane-stress estimate. The approximation assumes sigma_rr = sigma_theta_theta and sigma_zz = sigma_rz = 0. Axisymmetric FEA still includes radial, axial, hoop, and r-z shear stress. k is not a spring constant, prescribed surface motion, cure-shrinkage fraction, or FEA input, and k = 1 is not a bound on local FEA stress.",
  thermal_mesh_size_mm:
    "Target Gmsh element size for the axisymmetric thermoelastic FEniCSx model, in millimetres. Smaller values increase resolution around material corners and interfaces but increase cells, memory, and solve time. Compare stable statistics such as epoxy tensile-stress P99 across mesh sizes; the raw maximum at a sharp material corner can remain mesh sensitive.",
  full_wave_resolution_per_mm:
    "Fine-grid cells per millimetre in the axisymmetric MEEP branch of the full-field sweep. With resonance verification enabled, requested MEEP points first run at half this resolution, never below 1 cell/mm; seven points around each candidate then run at this selected resolution. Each core section uses sigma = L/(R A). Repeat the verification at a higher resolution before treating a peak quantitatively; axisymmetry omits leads, the MELF spiral, and non-axisymmetric modes.",
  full_wave_eqs_frequencies:
    "Comma-separated frequencies for the FEniCSx electroquasistatic branch, which supplies the low-frequency Maxwell limit. Suffixes Hz, kHz, MHz, and GHz are accepted. Include 50 or 60 Hz when checking power-line behavior. Include at least two frequencies also present in the MEEP list: the lower shared point anchors the present port normalization and the upper shared point independently tests agreement of slope before handoff.",
  full_wave_frequencies:
    "Comma-separated frequencies for the cylindrical m = 0 MEEP sweep. These are the coarse-search points when resonance verification is enabled and the final points when it is disabled. Include at least two points shared with the EQS list, plus frequencies below and above every suspected mode. A peak is not bracketed unless lower-transmission solved points exist on both sides; suffixes Hz, kHz, MHz, and GHz are accepted.",
  full_wave_verify_resonances:
    "Run the entered MEEP frequencies at a coarse grid, identify local transmission maxima, and add candidate frequencies predicted by the low-loss coupled-stage model. When zeta is below 1/sqrt(2), the matched RLC driven-response peak is shifted to fpeak = f0 sqrt(1 - 2 zeta^2); a more strongly damped mode has no RLC amplitude peak to add. Seven logarithmically spaced points spanning plus or minus 0.18 decade around each distinct candidate are then solved at the selected fine resolution. A resonance is reported as verified only if the largest fine response has lower solved points on both sides; this brackets a mode but does not replace a separate mesh-convergence run.",
  full_wave_timeout_hours:
    "Maximum wall-clock time for the queued MEEP/EQS subprocess, in hours. The backend accepts up to 168 hours. Closing or refreshing the browser does not cancel the job; this browser stores its job ID and reconnects when the page is opened again. A timeout terminates the solver cleanly and records resource use and the failure reason."
});

function setupParameterTooltips() {
  refreshParameterTooltips();

  document.querySelectorAll(".control-panel input[id], .control-panel select[id]").forEach((control) => {
    if (control.id === "settingsFile" || control.type === "file") return;
    if (!PARAMETER_TOOLTIPS[control.id]) {
      console.warn(`Missing parameter tooltip for #${control.id}`);
    }
  });
}

let installationDefaults = structuredClone(defaults);
let installationDefaultControlRanges = {};
let installationDefaultSource = "built-in defaults";
let installationDefaultLoadError = null;
let params = structuredClone(installationDefaults);
let lastResult = null;
let slideResultCache = null;
let backendGeometryCache = null;
let backendGeometryRequestId = 0;
let backendGeometryPendingKey = null;
let backendGeometryDisabled = false;
let spiceLadderCache = null;
let spiceLadderRequestId = 0;
let spiceLadderPendingKey = null;
let spiceLadderDisabled = false;
let fanoNoiseBudgetCache = null;
let thermalFeaCache = null;
let thermalFeaPending = false;
let thermalFeaError = null;
let fullWaveCache = null;
let fullWavePending = false;
let fullWaveError = null;
let fullWaveStartedAtMs = null;
let fullWaveStatusTimer = null;
let fullWaveJobId = null;
let fullWaveJobState = null;
let artifactManifestLoaded = false;
const customControlRanges = {};
const defaultControlRanges = {};
const defaultCadView = {
  yaw: -0.52,
  pitch: -0.86,
  zoom: 1,
  panX: 0,
  panY: 0,
  cutaway: true,
  filled: false,
  fillOpacity: 1
};

let cadView = structuredClone(defaultCadView);

const THEME_STORAGE_KEY = "discoidal-capacitor-bias-filter-theme";
const LEGACY_THEME_STORAGE_KEY = "shv-bias-filter-theme";
const LANGUAGE_STORAGE_KEY = "discoidal-capacitor-bias-filter-language";
const SUPPORTED_LANGUAGES = new Set(["en", "fr", "de"]);

const LOCALE_LANGUAGES = ["en", "fr", "de"];
const LOCALE_VERSION = "2026-08-11-main-models-13";
const TRANSLATIONS = Object.fromEntries(
  LOCALE_LANGUAGES.map((language) => [language, {}])
);
const EXTENDED_I18N = {};

async function loadLocaleCatalogs() {
  await Promise.all(LOCALE_LANGUAGES.map(async (language) => {
    try {
      const response = await fetch(
        `locales/${encodeURIComponent(language)}.json?v=${LOCALE_VERSION}`
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const catalog = await response.json();
      EXTENDED_I18N[language] = catalog;
      TRANSLATIONS[language] ||= {};
      Object.assign(
        TRANSLATIONS[language],
        catalog.text || {},
        catalog.canvas || {},
        catalog.slides || {}
      );
    } catch (error) {
      console.warn(`Could not load locale "${language}"; using English source text.`, error);
    }
  }));
}

let currentLanguage = "en";
let localizationRuntimeReady = false;
const i18nTextRecords = [];
const i18nSlideBlockRecords = [];
const i18nContentBlockRecords = [];
const i18nAttributeRecords = [];

function translateText(source, language = currentLanguage) {
  return TRANSLATIONS[language]?.[source] || source;
}

function translateTemplate(source, values = {}, language = currentLanguage) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    translateText(source, language)
  );
}

function registerTranslatableText() {
  const knownSources = new Set(
    Object.values(TRANSLATIONS).flatMap((dictionary) => Object.keys(dictionary))
  );
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement?.closest("#slides, [data-i18n-rich]")) continue;
    const value = node.nodeValue || "";
    const match = value.match(/^(\s*)(.*?)(\s*)$/s);
    const source = match?.[2] || "";
    if (!knownSources.has(source)) continue;
    i18nTextRecords.push({
      node,
      source,
      prefix: match[1],
      suffix: match[3]
    });
  }
}

function registerContentBlocks() {
  document.querySelectorAll(
    ".metric-strip > div > span, .viewer-panel > figcaption, .figure-head > figcaption, .solver-explainer > strong, .solver-explainer > p, .solver-explainer > ol > li"
  ).forEach((element) => {
    element.dataset.i18nRich = "true";
    i18nContentBlockRecords.push({
      element,
      source: element.textContent.trim().replace(/\s+/g, " "),
      sourceHtml: element.innerHTML
    });
  });
}

function registerSlideBlocks() {
  document.querySelectorAll(
    "#slides .slide h2, #slides .slide h3, #slides .slide p, #slides .slide li, #slides .slide figcaption, #slides .slide th, #slides .slide td, #slides .slide dt"
  ).forEach((element) => {
    const source = element.textContent.trim().replace(/\s+/g, " ");
    element.dataset.i18nSource = source;
    i18nSlideBlockRecords.push({
      element,
      source,
      sourceHtml: element.innerHTML
    });
  });
}

function registerTranslatableAttributes() {
  const knownSources = new Set(
    Object.values(TRANSLATIONS).flatMap((dictionary) => Object.keys(dictionary))
  );
  document.querySelectorAll("[title], [aria-label]").forEach((element) => {
    for (const attribute of ["title", "aria-label"]) {
      const source = element.getAttribute(attribute);
      if (!source || !knownSources.has(source)) continue;
      i18nAttributeRecords.push({ element, attribute, source });
    }
  });
}

function translateCanvasText(value, language = currentLanguage) {
  const source = String(value);
  const exact = translateText(source, language);
  if (exact !== source) return exact;
  const replacements = EXTENDED_I18N[language]?.canvasReplacements || [];
  return replacements.reduce(
    (translated, [from, to]) => translated.split(from).join(to),
    source
  );
}

function installCanvasLocalization() {
  const prototype = window.CanvasRenderingContext2D?.prototype;
  if (!prototype || prototype.__dcbfLocalized) return;
  const originalFillText = prototype.fillText;
  const originalStrokeText = prototype.strokeText;
  const originalMeasureText = prototype.measureText;
  prototype.fillText = function localizedFillText(text, ...args) {
    return originalFillText.call(this, translateCanvasText(text), ...args);
  };
  prototype.strokeText = function localizedStrokeText(text, ...args) {
    return originalStrokeText.call(this, translateCanvasText(text), ...args);
  };
  prototype.measureText = function localizedMeasureText(text) {
    return originalMeasureText.call(this, translateCanvasText(text));
  };
  Object.defineProperty(prototype, "__dcbfLocalized", { value: true });
}

function translatedParameterTooltip(id) {
  return EXTENDED_I18N[currentLanguage]?.tooltips?.[id]
    || PARAMETER_TOOLTIPS[id];
}

const EXACT_VALUE_HELP =
  "Enter an exact value. Engineering prefixes T, G, M, k, m, u/µ, n, p, and f are supported.";
const RANGE_EDITOR_HELP = "Right-click to edit slider minimum and maximum values.";

function refreshParameterTooltips() {
  for (const id of Object.keys(PARAMETER_TOOLTIPS)) {
    const control = document.getElementById(id);
    if (!control) continue;
    const description = translatedParameterTooltip(id);
    const manual = document.getElementById(`${id}_manual`);
    control.title = manual
      ? `${description} ${translateText(RANGE_EDITOR_HELP)}`
      : description;
    if (manual) {
      manual.title = `${description} ${translateText(EXACT_VALUE_HELP)}`;
    }
    const label = control.closest("label");
    if (label) label.title = description;
  }
}

function refreshDynamicLanguageLabels() {
  const fieldButton = document.getElementById("solve");
  if (fieldButton && !fieldButton.disabled) {
    fieldButton.textContent = translateText("Solve field");
  }
  const thermalButton = document.getElementById("solveThermalFea");
  if (thermalButton && !thermalButton.disabled) {
    thermalButton.textContent = translateText("Solve thermal FEA");
  }
  const fullWaveButton = document.getElementById("solveFullWave");
  if (fullWaveButton && !fullWaveButton.disabled) {
    fullWaveButton.textContent = translateText("Solve full-wave EM");
  }
  const cutawayButton = document.getElementById("cadCutaway");
  if (cutawayButton) {
    cutawayButton.textContent = translateText(cadView.cutaway ? "Cutaway" : "Full");
  }
  const fillButton = document.getElementById("cadFill");
  if (fillButton) {
    fillButton.textContent = translateText(cadView.filled ? "Filled" : "Surface");
  }
  document.querySelectorAll(".artifact-file a[download]").forEach((link) => {
    link.textContent = translateText("Download");
  });
  populateEpoxyChoiceTable();
  if (localizationRuntimeReady) {
    syncControls();
    if (lastResult) {
      updateFeaResourceReadouts("fieldFea", lastResult);
    }
    if (!lastResult) {
      document.getElementById("maxField").textContent = translateText("Not solved");
      document.getElementById("rawMaxField").textContent = translateText("raw point not solved");
      updateFeaResourceReadouts("fieldFea", null);
      setModelStatus("JS screening");
    }
  }
}

function setLanguage(language, persist = false) {
  currentLanguage = SUPPORTED_LANGUAGES.has(language) ? language : "en";
  document.documentElement.dataset.language = currentLanguage;
  document.documentElement.lang = currentLanguage;
  i18nTextRecords.forEach((record) => {
    record.node.nodeValue =
      `${record.prefix}${translateText(record.source)}${record.suffix}`;
  });
  i18nSlideBlockRecords.forEach((record) => {
    record.element.innerHTML =
      EXTENDED_I18N[currentLanguage]?.slides?.[record.source]
      || record.sourceHtml;
  });
  i18nContentBlockRecords.forEach((record) => {
    record.element.innerHTML =
      EXTENDED_I18N[currentLanguage]?.content?.[record.source]
      || record.sourceHtml;
  });
  i18nAttributeRecords.forEach((record) => {
    record.element.setAttribute(record.attribute, translateText(record.source));
  });
  refreshParameterTooltips();

  const selector = document.getElementById("languageSelect");
  if (selector) {
    selector.value = currentLanguage;
    selector.setAttribute("aria-label", translateText("Language"));
    selector.title = translateText("Language");
  }
  document.title = translateText("Discoidal Capacitor Bias Filter");
  setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  refreshSlideTocLanguage();
  refreshDynamicLanguageLabels();

  if (document.getElementById("slides")?.classList.contains("deck-ready")) {
    showSlide(currentSlideIndex);
  }
  requestAnimationFrame(updateSlideDeckHeight);

  if (persist) {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLanguage);
    } catch {
      // The selected language still applies for this page.
    }
  }
}

function setupLanguageSelector() {
  registerContentBlocks();
  registerTranslatableText();
  registerSlideBlocks();
  registerTranslatableAttributes();
  installCanvasLocalization();
  let initialLanguage = "en";
  try {
    initialLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY) || "en";
  } catch {
    // English remains the default when storage is unavailable.
  }
  setLanguage(initialLanguage);
  document.getElementById("languageSelect")?.addEventListener("change", (event) => {
    setLanguage(event.target.value, true);
  });
}

function setTheme(theme, persist = false) {
  const resolvedTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = resolvedTheme;
  const toggle = document.getElementById("themeToggle");
  if (toggle) {
    const dark = resolvedTheme === "dark";
    toggle.setAttribute("aria-pressed", dark ? "true" : "false");
    toggle.setAttribute(
      "aria-label",
      translateText(dark ? "Switch to light mode" : "Switch to dark mode")
    );
    toggle.querySelector(".theme-icon").textContent = dark ? "☀" : "☾";
    toggle.querySelector(".theme-label").textContent =
      translateText(dark ? "Light mode" : "Dark mode");
  }
  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, resolvedTheme);
    } catch {
      // The theme still applies for this page when storage is unavailable.
    }
  }
}

function setupThemeToggle() {
  const initialTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  setTheme(initialTheme);
  try {
    if (!localStorage.getItem(THEME_STORAGE_KEY) && localStorage.getItem(LEGACY_THEME_STORAGE_KEY)) {
      localStorage.setItem(THEME_STORAGE_KEY, localStorage.getItem(LEGACY_THEME_STORAGE_KEY));
    }
  } catch {
    // Theme migration is optional when storage is unavailable.
  }
  document.getElementById("themeToggle")?.addEventListener("click", () => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark", true);
  });
}

const ids = [
  "bias_voltage_v",
  "core_volume_resistivity_log10_ohm_cm",
  "melf_stage_resistance_mohm",
  "melf_stage_parasitic_pf",
  "melf_substrate_epsr",
  "melf_metal_fill_factor",
  "ferrite_conductor_fill_factor",
  "input_series_resistance_mohm",
  "output_series_resistance_ohm",
  "load_current_na",
  "load_cable_length_m",
  "load_cable_impedance_ohm",
  "load_cable_velocity_factor",
  "detector_capacitance_pf",
  "additional_ground_capacitance_pf",
  "noise_sample_rate_msps",
  "noise_waveform_samples",
  "noise_trap_rise_us",
  "noise_trap_flat_us",
  "noise_supply_noise_pp_mv",
  "noise_lab_broadband_rms_mv",
  "noise_mains_rms_mv",
  "noise_mains_frequency_hz",
  "noise_fano_factor",
  "ferrite_epsr",
  "washer_epsr",
  "epoxy_epsr",
  "rf_compare_frequency_log10_mhz",
  "plate_conductivity_log10_s_per_m",
  "plate_relative_permeability",
  "tube_conductivity_log10_s_per_m",
  "tube_relative_permeability",
  "core_od_mm",
  "hv_plate_od_mm",
  "ground_plate_inner_diameter_mm",
  "tube_id_mm",
  "washer_id_mm",
  "washer_od_mm",
  "plate_gap_mm",
  "bias_plate_thickness_mm",
  "ground_plate_thickness_mm",
  "edge_diameter_percent",
  "mesh_edge_radius_ratio",
  "plate_pairs",
  "thermal_min_temperature_c",
  "thermal_epoxy_modulus_gpa",
  "thermal_restraint_factor",
  "thermal_mesh_size_mm",
  "full_wave_resolution_per_mm",
  "full_wave_timeout_hours"
];

const units = {
  bias_voltage_v: " V",
  core_volume_resistivity_log10_ohm_cm: "",
  melf_stage_resistance_mohm: " MΩ",
  melf_stage_parasitic_pf: " pF",
  melf_substrate_epsr: "",
  melf_metal_fill_factor: "",
  ferrite_conductor_fill_factor: "",
  load_current_na: " nA",
  load_cable_length_m: " m",
  load_cable_impedance_ohm: " Ω",
  load_cable_velocity_factor: "",
  detector_capacitance_pf: " pF",
  additional_ground_capacitance_pf: " pF",
  noise_sample_rate_msps: " MHz",
  noise_waveform_samples: " samples",
  noise_trap_rise_us: " &micro;s",
  noise_trap_flat_us: " &micro;s",
  noise_supply_noise_pp_mv: " mV p-p",
  noise_lab_broadband_rms_mv: " mV rms",
  noise_mains_rms_mv: " mV rms",
  noise_mains_frequency_hz: " Hz",
  noise_fano_factor: "",
  ferrite_epsr: "",
  washer_epsr: "",
  epoxy_epsr: "",
  rf_compare_frequency_log10_mhz: "",
  plate_conductivity_log10_s_per_m: "",
  plate_relative_permeability: "",
  tube_conductivity_log10_s_per_m: "",
  tube_relative_permeability: "",
  core_od_mm: " mm",
  hv_plate_od_mm: " mm",
  washer_id_mm: " mm",
  washer_od_mm: " mm",
  ground_plate_inner_diameter_mm: " mm",
  tube_id_mm: " mm",
  core_to_ground_gap_mm: " mm",
  hv_to_tube_gap_mm: " mm",
  plate_gap_mm: " mm",
  plate_thickness_mm: " mm",
  bias_plate_thickness_mm: " mm",
  ground_plate_thickness_mm: " mm",
  edge_diameter_percent: "%",
  mesh_edge_radius_ratio: "",
  plate_pairs: "",
  thermal_min_temperature_c: " &deg;C",
  thermal_epoxy_modulus_gpa: " GPa",
  thermal_restraint_factor: "",
  thermal_mesh_size_mm: " mm",
  full_wave_resolution_per_mm: " cells/mm"
  ,
  full_wave_timeout_hours: " h"
};

const EPSILON_0_F_PER_M = 8.8541878128e-12;
const MU_0_H_PER_M = 4 * Math.PI * 1e-7;
const FR4_WASHER_EPSR = 4.4;
const DEFAULT_EPOXY_BREAKDOWN_KV_PER_MM = 15;
const DEFAULT_MELF0207_STAGE_RESISTANCE_OHM = 12e6;
const coreMaterialPresets = {
  type61: { label: "Fair-Rite 61 NiZn", epsr: 12, resistivityLog10: 8, componentName: "Type 61 core" },
  nizn: { label: "NiZn ferrite", epsr: 15, resistivityLog10: 8, componentName: "NiZn ferrite core" },
  mmb0204_melf: {
    label: "MELF 0204 10M",
    epsr: 6,
    melfSubstrateEpsr: 9.8,
    melfMetalFillFactor: 0.45,
    resistivityLog10: Math.log10(633000),
    coreOdMm: 1.4,
    minPairLengthMm: 3.6,
    stageResistanceOhm: 10e6,
    stageParasiticPf: 0.2,
    defaultDirectStageResistance: true,
    defaultDirectStageCapacitance: false,
    componentName: "0204 MELF core"
  },
  mmb0207_melf: {
    label: "MELF 0207 12M",
    epsr: 6,
    melfSubstrateEpsr: 9.8,
    melfMetalFillFactor: 0.5,
    resistivityLog10: Math.log10(633000),
    coreOdMm: 2.2,
    minPairLengthMm: 5.8,
    stageResistanceOhm: DEFAULT_MELF0207_STAGE_RESISTANCE_OHM,
    stageParasiticPf: 0.3,
    defaultDirectStageResistance: true,
    defaultDirectStageCapacitance: false,
    componentName: "0207 MELF core"
  },
  epoxy_chain: {
    label: "MELF chain in 9510",
    epsr: 3.4,
    resistivityLog10: 8.1,
    stageResistanceOhm: 240e6,
    stageParasiticPf: 0.5,
    defaultDirectStageResistance: true,
    defaultDirectStageCapacitance: true,
    componentName: "MELF/epoxy core"
  },
  conductive_epoxy: { label: "Conductive epoxy", epsr: 4, resistivityLog10: -3, componentName: "Conductive epoxy core" }
};
const washerMaterialPresets = {
  epoxy: { label: "Epoxy (same as potting fill)", epsr: 3.7, breakdownKvPerMm: null, componentName: "Continuous epoxy fill", linkedToEpoxy: true },
  fr4: { label: "FR4/G10", epsr: FR4_WASHER_EPSR, breakdownKvPerMm: 20, componentName: "FR4/G10 washer" },
  macor: { label: "Macor", epsr: 6, breakdownKvPerMm: 40, componentName: "Macor washer" },
  alumina: { label: "Alumina", epsr: 10, breakdownKvPerMm: 13, componentName: "Alumina washer" },
  rutile_tio2: { label: "Rutile TiO₂", epsr: 100, breakdownKvPerMm: null, componentName: "Rutile TiO₂ washer" },
  strontium_titanate: { label: "Strontium titanate SrTiO₃", epsr: 300, breakdownKvPerMm: null, componentName: "SrTiO₃ washer" },
  zirconia: { label: "Zirconia/ZTA", epsr: 25, breakdownKvPerMm: 10, componentName: "Zirconia/ZTA washer" },
  high_k: { label: "High-K screen only", epsr: 100, breakdownKvPerMm: null, componentName: "High-K screening washer" }
};
const epoxyMaterialPresets = {
  mg_9510: {
    label: "MG 9510", epsr: 3.7, breakdownKvPerMm: 15.75, componentName: "MG 9510 epoxy fill",
    workingTime: "Unlimited", viscosity: "4,800 cP", hardness: "D84", tg: "70 C", resistivity: "2.6e13 ohm-cm",
    decisionNote: "One-part baseline; rigid, 80 C minimum cure",
    thermalCtePpmPerC: 74, stressFreeTemperatureC: 70, tensileStrengthMpa: 20
  },
  stycast_2850ft_23lv: {
    label: "Stycast 2850FT + CAT 23LV", epsr: 5.36, breakdownKvPerMm: 14.8,
    componentName: "Stycast 2850FT/CAT 23LV epoxy fill",
    workingTime: "1 h", viscosity: "5,600 cP", hardness: "D92", tg: "40 C (RT cure)",
    resistivity: "1e15 ohm-cm",
    decisionNote: "Reference: long-pot-life room cure; vacuum-degas and provide flow paths",
    thermalCtePpmPerC: 39.4, stressFreeTemperatureC: 25, tensileStrengthMpa: 20
  },
  mg_832fx: {
    label: "MG 832FX", epsr: 3.1, breakdownKvPerMm: 12.99, componentName: "MG 832FX epoxy fill",
    workingTime: "2 h", viscosity: "700 cP", hardness: "A88", tg: "8.8 C", resistivity: "5.8e12 ohm-cm",
    decisionNote: "Best-flowing balanced flexible option"
  },
  mg_832fxt: {
    label: "MG 832FXT", epsr: 3.1, breakdownKvPerMm: 13.78, componentName: "MG 832FXT epoxy fill",
    workingTime: "170 min", viscosity: "1,920 cP", hardness: "A80", tg: "20 C", resistivity: "1.5e13 ohm-cm",
    decisionNote: "Flexible; available in 25 mL trial size", epsrEstimated: true
  },
  mg_832fxc: {
    label: "MG 832FXC", epsr: 3.1, breakdownKvPerMm: 18.58, componentName: "MG 832FXC epoxy fill",
    workingTime: "170 min", viscosity: "410 cP", hardness: "A60", tg: "12 C", resistivity: "1.0e13 ohm-cm",
    decisionNote: "Clear, soft, and easiest to degas", epsrEstimated: true
  },
  epoxies_etc_20_3241: {
    label: "20-3241", epsr: 4.7, breakdownKvPerMm: 22.05, componentName: "20-3241 epoxy fill",
    workingTime: "30-45 min", viscosity: "1,000 cP", hardness: "A75", tg: "Not published", resistivity: "5e15 ohm-cm",
    decisionNote: "Strong electrical data; short pot life, bulk pack"
  },
  generic_potting: { label: "Generic potting epoxy", epsr: 3.2, breakdownKvPerMm: DEFAULT_EPOXY_BREAKDOWN_KV_PER_MM, componentName: "Generic epoxy fill" },
  low_k_epoxy: { label: "Low-k epoxy", epsr: 2.8, breakdownKvPerMm: DEFAULT_EPOXY_BREAKDOWN_KV_PER_MM, componentName: "Low-k epoxy fill" }
};
const conductorMaterialPresets = {
  copper: { label: "Copper", conductivity: 5.8e7, mur: 1, ctePpmPerC: 16.9 },
  annealed_copper: { label: "Annealed copper", conductivity: 5.8e7, mur: 1, ctePpmPerC: 16.9 },
  aluminum: { label: "1050-O aluminum", conductivity: 1 / 28e-9, mur: 1, ctePpmPerC: 23.55 },
  brass: { label: "Brass", conductivity: 1.6e7, mur: 1, ctePpmPerC: 20.5 },
  stainless_316: { label: "316 stainless", conductivity: 1.35e6, mur: 1.02, ctePpmPerC: 16.0 },
  titanium_grade_2: { label: "Grade 2 titanium", conductivity: 2.2e6, mur: 1.00005, ctePpmPerC: 8.6 },
  mocu_65_35: { label: "Mo65Cu35", conductivity: 27e6, mur: 1, ctePpmPerC: 8.6 },
  mocu_70_30: { label: "Mo70Cu30", conductivity: 26e6, mur: 1, ctePpmPerC: 8.2 },
  mocu_80_20: { label: "Mo80Cu20", conductivity: 20e6, mur: 1, ctePpmPerC: 6.3 }
};

const PROTOTYPE_GEOMETRY = {
  washer_id_mm: 6.6,
  washer_od_mm: 20,
  washer_id_mode: "ground_flat_id",
  washer_od_mode: "bias_flat_od",
  washer_material: "alumina",
  washer_epsr: 10,
  plate_gap_mm: 1.5,
  bias_plate_thickness_mm: 1.5,
  ground_plate_thickness_mm: 1.5,
  ground_matches_bias_thickness: true,
  hv_plate_od_mm: 21.5,
  ground_plate_inner_diameter_mm: 5.1,
  tube_id_mm: 26,
  edge_radius_mm: 0.75,
  plate_pairs: 3,
  bias_voltage_v: 6000,
  load_current_na: 1,
  load_cable_length_m: 10,
  load_cable_impedance_ohm: 50,
  load_cable_velocity_factor: 0.66,
  detector_capacitance_pf: 10,
  input_series_matches_stage: true,
  output_series_matches_stage: false,
  output_series_resistance_ohm: 50,
  epoxy_material: "stycast_2850ft_23lv",
  epoxy_epsr: 5.36
};

function prototypeSimulationCases() {
  const shared = { ...defaults, ...PROTOTYPE_GEOMETRY };
  const melf = {
    ...shared,
    core_material: "mmb0207_melf",
    core_od_mm: 2.2,
    use_package_core_od: true,
    use_direct_stage_circuit: true,
    use_direct_stage_capacitance: false,
    melf_stage_resistance_mohm: 12,
    melf_substrate_epsr: 9.8,
    melf_metal_fill_factor: 0.5
  };
  const ferrite = {
    ...shared,
    core_material: "type61",
    core_od_mm: 2,
    use_package_core_od: false,
    use_direct_stage_circuit: false,
    use_direct_stage_capacitance: false,
    ferrite_epsr: 12,
    core_volume_resistivity_log10_ohm_cm: 8
  };
  return [
    { key: "melf", label: "MELF 0207", color: "#b73e3e", params: melf, circuit: circuitEstimates(melf) },
    { key: "ferrite", label: "Type 61, 2.0 mm", color: "#1f6f78", params: ferrite, circuit: circuitEstimates(ferrite) }
  ];
}

const THERMAL_SCREEN = {
  stressFreeTemperatureC: 70,
  epoxyCtePpmPerC: 74,
  epoxyTensileStrengthMpa: 20,
  epoxyPoissonRatio: 0.35,
  epoxyServiceMinimumC: -65,
  aluminaCtePpmPerC: 8.2
};

function thermalScreenFor(p = params) {
  const material = epoxyMaterialPresets[p.epoxy_material] || {};
  return {
    ...THERMAL_SCREEN,
    stressFreeTemperatureC: material.stressFreeTemperatureC ?? THERMAL_SCREEN.stressFreeTemperatureC,
    epoxyCtePpmPerC: material.thermalCtePpmPerC ?? THERMAL_SCREEN.epoxyCtePpmPerC,
    epoxyTensileStrengthMpa: material.tensileStrengthMpa ?? THERMAL_SCREEN.epoxyTensileStrengthMpa
  };
}

const THERMAL_ALUMINA_INSERT_STUDY = [
  { label: "Bulk epoxy", bondlineMm: null, epoxyFraction: 0.5157, principalP99: 31.93, axialP99: 29.53, shearP99: 12.46, meshMm: 0.10 },
  { label: "0.50 mm", bondlineMm: 0.50, epoxyFraction: 0.3119, principalP99: 34.62, axialP99: 32.76, shearP99: 7.16, meshMm: 0.10 },
  { label: "0.30 mm", bondlineMm: 0.30, epoxyFraction: 0.2026, principalP99: 34.18, axialP99: 33.52, shearP99: 5.81, meshMm: 0.10 },
  { label: "0.20 mm", bondlineMm: 0.20, epoxyFraction: 0.1415, principalP99: 34.42, axialP99: 33.91, shearP99: 6.83, meshMm: 0.10 },
  { label: "0.10 mm", bondlineMm: 0.10, epoxyFraction: 0.0734, principalP99: 37.99, axialP99: 36.60, shearP99: 10.45, meshMm: 0.05 }
];

const THERMAL_CONDUCTOR_STUDY = [
  { key: "copper", label: "Cu", cte: 16.9, conductivity: 1.000, bulkPrincipal: 31.93, bulkShear: 12.46, fittedPrincipal: 34.18, fittedShear: 5.81 },
  { key: "annealed_copper", label: "Annealed Cu", cte: 16.9, conductivity: 1.000, bulkPrincipal: 31.80, bulkShear: 12.50, fittedPrincipal: 34.18, fittedShear: 6.15 },
  { key: "aluminum", label: "Al 1050-O", cte: 23.55, conductivity: 0.616, bulkPrincipal: 31.14, bulkShear: 12.21, fittedPrincipal: 34.38, fittedShear: 7.41 },
  { key: "titanium_grade_2", label: "Ti Gr 2", cte: 8.6, conductivity: 0.038, bulkPrincipal: 32.54, bulkShear: 12.97, fittedPrincipal: 35.09, fittedShear: 5.51 },
  { key: "mocu_65_35", label: "Mo65Cu35", cte: 8.6, conductivity: 0.466, bulkPrincipal: 33.66, bulkShear: 13.25, fittedPrincipal: 35.64, fittedShear: 5.36 },
  { key: "mocu_70_30", label: "Mo70Cu30", cte: 8.2, conductivity: 0.448, bulkPrincipal: 33.83, bulkShear: 13.30, fittedPrincipal: 35.82, fittedShear: 5.44 },
  { key: "mocu_80_20", label: "Mo80Cu20", cte: 6.3, conductivity: 0.345, bulkPrincipal: 34.27, bulkShear: 13.46, fittedPrincipal: 36.06, fittedShear: 5.72 }
];

const THERMAL_CONDUCTOR_ENCLOSURE_SENSITIVITY = {
  aluminum: { bulkPrincipal: 31.01, bulkShear: 12.19, fittedPrincipal: 34.30, fittedShear: 8.27 },
  titanium_grade_2: { bulkPrincipal: 32.69, bulkShear: 13.01, fittedPrincipal: 35.30, fittedShear: 5.14 },
  mocu_70_30: { bulkPrincipal: 33.91, bulkShear: 13.27, fittedPrincipal: 35.63, fittedShear: 5.05 }
};

const THERMAL_ANNEALED_COPPER_SENSITIVITY = {
  bulk: { principalChangePct: -0.41, shearChangePct: 0.35 },
  fitted: { principalChangePct: -0.003, shearChangePct: 5.87 }
};

function thermalInterfaceEstimate(label, substrateCtePpmPerC, radiusMm, p, restraint = null) {
  const screen = thermalScreenFor(p);
  const effectiveRestraint = restraint ?? p.thermal_restraint_factor;
  const temperatureDropC = Math.max(0, screen.stressFreeTemperatureC - p.thermal_min_temperature_c);
  const deltaCtePpmPerC = Math.abs(screen.epoxyCtePpmPerC - substrateCtePpmPerC);
  const mismatchStrain = deltaCtePpmPerC * 1e-6 * temperatureDropC;
  const stressMpa = effectiveRestraint
    * p.thermal_epoxy_modulus_gpa * 1000
    * mismatchStrain / (1 - screen.epoxyPoissonRatio);
  const onsetDropC = screen.epoxyTensileStrengthMpa
    * (1 - screen.epoxyPoissonRatio)
    / (Math.max(1e-9, effectiveRestraint) * p.thermal_epoxy_modulus_gpa * 1000 * deltaCtePpmPerC * 1e-6);
  return {
    label,
    deltaCtePpmPerC,
    mismatchStrain,
    radialMismatchUm: mismatchStrain * radiusMm * 1000,
    stressMpa,
    strengthMargin: stressMpa > 0 ? screen.epoxyTensileStrengthMpa / stressMpa : Number.POSITIVE_INFINITY,
    failureOnsetC: screen.stressFreeTemperatureC - onsetDropC
  };
}

function thermalStressEstimate(p = params, restraint = null) {
  const plate = conductorMaterialPresets[p.plate_material];
  const tube = conductorMaterialPresets[p.tube_material];
  const interfaces = [];
  if (!washerUsesEpoxy(p)) {
    interfaces.push(thermalInterfaceEstimate("Epoxy to alumina washer", THERMAL_SCREEN.aluminaCtePpmPerC, p.washer_od_mm / 2, p, restraint));
  }
  const coreCtePpmPerC = usesMelfCoreModel(p) ? THERMAL_SCREEN.aluminaCtePpmPerC : 10.0;
  const coreLabel = usesMelfCoreModel(p) ? "alumina MELF core" : "ferrite core";
  interfaces.push(thermalInterfaceEstimate(`Epoxy to ${coreLabel}`, coreCtePpmPerC, p.core_od_mm / 2, p, restraint));
  if (Number.isFinite(plate?.ctePpmPerC)) {
    interfaces.push(thermalInterfaceEstimate(`Epoxy to ${plate.label} plate`, plate.ctePpmPerC, p.hv_plate_od_mm / 2, p, restraint));
  }
  if (Number.isFinite(tube?.ctePpmPerC)) {
    interfaces.push(thermalInterfaceEstimate(`Epoxy to ${tube.label} tube`, tube.ctePpmPerC, p.tube_id_mm / 2, p, restraint));
  }
  return interfaces.sort((a, b) => b.stressMpa - a.stressMpa)[0];
}

function formatTemperatureC(value) {
  if (!Number.isFinite(value)) return "--";
  const rounded = Math.abs(value) < 0.05 ? 0 : value;
  return `${rounded.toLocaleString(undefined, { maximumFractionDigits: 1 })} &deg;C`;
}

function updateThermalReadouts() {
  const estimate = thermalStressEstimate(params);
  const halfRestraint = thermalStressEstimate(params, 0.5);
  document.getElementById("thermalControllingInterface").textContent = translateText(estimate.label);
  document.getElementById("thermalDeltaCte").textContent = `${estimate.deltaCtePpmPerC.toFixed(1)} ppm/°C`;
  document.getElementById("thermalRadialMismatch").textContent = `${estimate.radialMismatchUm.toFixed(1)} µm`;
  document.getElementById("thermalStress").textContent = `${estimate.stressMpa.toFixed(1)} MPa`;
  document.getElementById("thermalStrengthMargin").textContent = Number.isFinite(estimate.strengthMargin) ? `${estimate.strengthMargin.toFixed(2)}×` : "--";
  document.getElementById("thermalFailureOnset").innerHTML = formatTemperatureC(estimate.failureOnsetC);
  document.getElementById("thermalHalfRestraintOnset").innerHTML = formatTemperatureC(halfRestraint.failureOnsetC);
  const status = document.getElementById("thermalStatus");
  if (!["mg_9510", "stycast_2850ft_23lv"].includes(params.epoxy_material)) {
    status.classList.remove("risk", "pass");
    status.textContent = translateText("The electrical preset is active, but this material does not yet have a thermal FEA preset.");
    updateThermalFeaReadouts();
    return;
  }
  const atRisk = estimate.strengthMargin < 1;
  status.classList.toggle("risk", atRisk);
  status.classList.toggle("pass", !atRisk);
  status.textContent = atRisk
    ? translateTemplate("Estimated stress exceeds the 20 MPa cured tensile strength at {temperature} °C.", {
        temperature: params.thermal_min_temperature_c.toFixed(0)
      })
    : translateTemplate("Estimated strength margin remains above 1 at {temperature} °C; bonded-coupon qualification is still required.", {
        temperature: params.thermal_min_temperature_c.toFixed(0)
      });
  updateThermalFeaReadouts();
}

function thermalFeaKey(p = params) {
  const simulationParameters = backendParameters(p);
  delete simulationParameters.additional_ground_capacitance_pf;
  return JSON.stringify(simulationParameters);
}

function thermalFeaResultForCurrentDesign() {
  if (!thermalFeaCache || thermalFeaCache.key !== thermalFeaKey(params)) return null;
  return thermalFeaCache.result;
}

function formatResourceBytes(value) {
  if (!Number.isFinite(value)) return "--";
  const units = ["B", "KiB", "MiB", "GiB"];
  let scaled = Math.max(0, value);
  let unitIndex = 0;
  while (scaled >= 1024 && unitIndex < units.length - 1) {
    scaled /= 1024;
    unitIndex += 1;
  }
  const decimals = unitIndex >= 2 ? 2 : unitIndex === 1 ? 1 : 0;
  return `${scaled.toFixed(decimals)} ${units[unitIndex]}`;
}

function updateFeaResourceReadouts(prefix, result) {
  const usage = result?.resource_usage;
  document.getElementById(`${prefix}PeakRss`).textContent = usage
    ? formatResourceBytes(usage.peak_process_tree_rss_bytes)
    : translateText("Not solved");
  document.getElementById(`${prefix}PeakSystemMemory`).textContent = formatResourceBytes(usage?.peak_system_memory_used_bytes);
  document.getElementById(`${prefix}LowestAvailableMemory`).textContent = formatResourceBytes(usage?.lowest_system_available_memory_bytes);
  document.getElementById(`${prefix}MaximumSwap`).textContent = formatResourceBytes(usage?.maximum_system_swap_used_bytes);
  const log = document.getElementById(`${prefix}ResourceLog`);
  log.textContent = result?.resource_log
    ? translateTemplate("Recorded on the server in {path}.", { path: result.resource_log })
    : prefix === "fullWave"
      ? translateText("Full-wave resource use is recorded with each solve.")
      : translateText("FEniCSx resource use is recorded with each solve.");
  if (prefix === "fieldFea") {
    const network = result?.capacitance?.capacitance_network;
    const used = Number(network?.energy_solve_count);
    const unreduced = Number(network?.energy_solve_count_without_symmetry);
    document.getElementById("fieldFeaCapacitanceSolves").textContent = Number.isFinite(used)
      ? `${used}${Number.isFinite(unreduced) ? ` ${translateText("of")} ${unreduced}` : ""}`
      : "--";
  }
}

function updateThermalFeaReadouts() {
  const result = thermalFeaResultForCurrentDesign();
  const p99 = result?.epoxy_principal_tensile_stress_mpa?.p99;
  const rawPeak = result?.epoxy_principal_tensile_stress_mpa?.raw_max;
  const baseline = thermalStressEstimate(params).stressMpa;
  const status = document.getElementById("thermalFeaStatus");
  document.getElementById("thermalFeaP99").textContent = Number.isFinite(p99)
    ? `${p99.toFixed(2)} MPa`
    : translateText("Not solved");
  document.getElementById("thermalFeaRawPeak").textContent = Number.isFinite(rawPeak) ? `${rawPeak.toFixed(2)} MPa` : "--";
  document.getElementById("thermalFeaRatio").textContent = Number.isFinite(p99) && baseline > 0 ? `${(p99 / baseline).toFixed(2)}x` : "--";
  document.getElementById("thermalFeaMesh").textContent = result?.mesh?.cells
    ? translateTemplate("{count} cells at {size} mm", {
        count: result.mesh.cells.toLocaleString(),
        size: result.mesh.target_size_mm.toFixed(2)
      })
    : "--";
  updateFeaResourceReadouts("thermalFea", result);
  drawThermalFeaViewer();
  status.classList.remove("risk", "pass");
  if (thermalFeaPending) {
    status.textContent = translateText("Thermal FEA is running on the backend.");
    return;
  }
  if (thermalFeaError) {
    status.classList.add("risk");
    status.textContent = translateTemplate("Thermal FEA failed: {error}", { error: thermalFeaError });
    return;
  }
  if (result) {
    const overStrength = p99 >= thermalScreenFor(params).epoxyTensileStrengthMpa;
    status.classList.add(overStrength ? "risk" : "pass");
    status.textContent = overStrength
      ? translateText("FEA epoxy P99 exceeds the published cured tensile strength; the raw corner peak is diagnostic only.")
      : translateText("FEA epoxy P99 remains below the published cured tensile strength; perfect bonding and linear elasticity are assumed.");
    return;
  }
  status.textContent = thermalFeaCache
    ? translateText("Inputs changed since the thermal FEA solve; rerun for this design.")
    : translateText("Run the thermal FEA for a geometry-based comparison.");
}

function thermalStressColor(value, scaleMax) {
  const t = scaleMax > 0 ? Math.max(0, Math.min(1, value / scaleMax)) : 0;
  const stops = [
    [217, 228, 226],
    [31, 111, 120],
    [214, 183, 93],
    [183, 62, 62]
  ];
  const scaled = t * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.floor(scaled));
  const fraction = scaled - index;
  const rgb = stops[index].map((component, channel) =>
    Math.round(component + (stops[index + 1][channel] - component) * fraction)
  );
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

function drawThermalStressScale(ctx, x, y, width, height, scaleMax) {
  const gradient = ctx.createLinearGradient(x, y + height, x, y);
  for (let index = 0; index <= 12; index += 1) {
    const fraction = index / 12;
    gradient.addColorStop(fraction, thermalStressColor(fraction * scaleMax, scaleMax));
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = "#c9c1b0";
  ctx.strokeRect(x, y, width, height);
  ctx.fillStyle = "#5b6670";
  ctx.font = "12px Arial";
  ctx.fillText(`${scaleMax.toFixed(1)} MPa P99`, x + width + 8, y + 5);
  ctx.fillText(`${(scaleMax / 2).toFixed(1)}`, x + width + 8, y + height / 2 + 4);
  ctx.fillText("0", x + width + 8, y + height);
}

function drawThermalRawPeakMarker(ctx, m, location, fullLength) {
  if (!Number.isFinite(location?.r) || !Number.isFinite(location?.z)) return;
  const locations = [location.z];
  const mirrored = fullLength - location.z;
  if (Math.abs(mirrored - location.z) > 1e-6) locations.push(mirrored);
  for (const z of locations) {
    const x = m.x(z);
    const y = m.y(location.r);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.strokeStyle = "#17202a";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, 2 * Math.PI);
    ctx.stroke();
  }
}

function drawThermalFeaViewer(canvas = document.getElementById("thermalFeaCanvas")) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const result = thermalFeaResultForCurrentDesign();
  const field = result?.epoxy_principal_tensile_field;
  const points = field?.points;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (!result || !Array.isArray(points) || !points.length) {
    ctx.fillStyle = "#5b6670";
    ctx.font = "16px Arial";
    const message = thermalFeaPending
      ? "Thermal FEA is running on the backend."
      : thermalFeaError
        ? `Thermal FEA failed: ${thermalFeaError}`
        : "Run Solve thermal FEA in the Thermal settings to update this view.";
    drawWrappedLines(ctx, [message], 32, 48, 23, "#5b6670", "16px Arial", canvas.width - 64);
    return;
  }

  const m = canvasMetrics(canvas, params, { reservedLeftPx: 185 });
  const drawOrder = ["epoxy", "washer", "ferrite", "ground", "hv"];
  const components = componentProfiles(params);
  for (const material of drawOrder) {
    for (const component of components) {
      if (component.material !== material) continue;
      ctx.save();
      ctx.globalAlpha = material === "epoxy" ? 0.08 : Math.min(0.42, component.alpha ?? 1);
      ctx.fillStyle = component.color;
      drawRzProfileFill(ctx, m, component.profile);
      ctx.restore();
    }
  }

  const fullLength = geometryBounds(params).length;
  const scaleMax = Number(field.display_scale_max_mpa)
    || Number(result.epoxy_principal_tensile_stress_mpa?.p99)
    || 1;
  const pointRadius = Math.max(1.2, Math.min(4.5, Number(result.mesh?.target_size_mm || 0.3) * m.sx * 0.62));
  for (const point of points) {
    const r = Number(point[0]);
    const z = Number(point[1]);
    const stress = Number(point[2]);
    if (!Number.isFinite(r) || !Number.isFinite(z) || !Number.isFinite(stress)) continue;
    ctx.fillStyle = thermalStressColor(stress, scaleMax);
    const displayZ = [z];
    const mirroredZ = fullLength - z;
    if (Math.abs(mirroredZ - z) > 1e-6) displayZ.push(mirroredZ);
    for (const zPosition of displayZ) {
      ctx.beginPath();
      ctx.arc(m.x(zPosition), m.y(r), pointRadius, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  drawComponentOutlines(ctx, m, components);
  drawThermalRawPeakMarker(
    ctx,
    m,
    result.epoxy_principal_tensile_stress_mpa?.raw_max_location_mm,
    fullLength
  );
  drawAxes(ctx, canvas, m);

  const p99 = result.epoxy_principal_tensile_stress_mpa?.p99;
  const raw = result.epoxy_principal_tensile_stress_mpa?.raw_max;
  ctx.fillStyle = "#17202a";
  ctx.font = "17px Arial";
  ctx.fillText("Epoxy tensile stress", 22, 48);
  ctx.fillStyle = "#5b6670";
  ctx.font = "13px Arial";
  ctx.fillText("maximum principal", 22, 68);
  ctx.fillStyle = "#17202a";
  ctx.font = "22px Arial";
  ctx.fillText(`${p99.toFixed(2)} MPa`, 22, 104);
  ctx.fillStyle = "#5b6670";
  ctx.font = "12px Arial";
  ctx.fillText("P99 comparison value", 22, 122);
  ctx.fillStyle = "#17202a";
  ctx.font = "18px Arial";
  ctx.fillText(`${raw.toFixed(2)} MPa raw`, 22, 152);
  ctx.fillStyle = "#5b6670";
  ctx.font = "12px Arial";
  ctx.fillText("ring marker; mesh-sensitive", 22, 170);
  drawThermalStressScale(ctx, 24, 198, 18, 142, scaleMax);
  ctx.fillStyle = "#5b6670";
  ctx.font = "12px Arial";
  ctx.fillText(`${result.evaluation_temperature_c.toFixed(0)} C evaluation`, 22, 374);
  ctx.fillText(`${result.mesh.cells.toLocaleString()} cells`, 22, 393);
  ctx.fillText(`target ${result.mesh.target_size_mm.toFixed(2)} mm`, 22, 412);
}

async function solveThermalFea() {
  const button = document.getElementById("solveThermalFea");
  if (!["mg_9510", "stycast_2850ft_23lv"].includes(params.epoxy_material)) {
    thermalFeaCache = null;
    thermalFeaError = "This epoxy does not yet have a thermal FEA preset. Qualify and add its modulus, CTE, stress-free temperature, and strength data before solving.";
    updateThermalFeaReadouts();
    drawSlideGraphics();
    return;
  }
  const key = thermalFeaKey(params);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), THERMAL_SOLVER_TIMEOUT_MS);
  thermalFeaPending = true;
  thermalFeaError = null;
  button.disabled = true;
  button.textContent = translateText("Solving thermal FEA...");
  updateThermalFeaReadouts();
  try {
    const payload = await fetchJson(THERMAL_SOLVER_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parameters: backendParameters(params) }),
      signal: controller.signal
    });
    if (payload.status === "failed" || payload.error) {
      throw new Error(payload.error || "Thermal FEA failed.");
    }
    thermalFeaCache = { key, result: payload };
  } catch (error) {
    thermalFeaCache = null;
    thermalFeaError = error.message;
  } finally {
    window.clearTimeout(timeout);
    thermalFeaPending = false;
    button.disabled = false;
    button.textContent = translateText("Solve thermal FEA");
    updateThermalFeaReadouts();
    drawSlideGraphics();
  }
}

function fullWaveKey(p = params) {
  const simulationParameters = backendParameters(p);
  delete simulationParameters.additional_ground_capacitance_pf;
  return JSON.stringify(simulationParameters);
}

function fullWaveResultForCurrentDesign() {
  if (!fullWaveCache || fullWaveCache.key !== fullWaveKey(params)) return null;
  return fullWaveCache.result;
}

function loadBundledDefaultFullWaveResult() {
  const bundle = window.DISCOIDAL_DEFAULT_FULL_WAVE;
  if (!bundle?.settings || !bundle?.result) return false;
  const bundledParameters = settingsWithBuiltInFallback(bundle.settings);
  if (!bundledDefaultParametersMatch(
    bundledParameters,
    params,
    "defaultFullWaveMismatch",
    ["noise_", "thermal_", "full_wave_"]
  )) return false;
  fullWaveCache = { key: fullWaveKey(params), result: bundle.result };
  return true;
}

function fullWavePointReferenceSeconds(frequencyHz) {
  const reference = [
    [1e9, 43.5],
    [3e9, 34.8],
    [10e9, 295.2],
    [30e9, 91.2]
  ];
  if (frequencyHz <= reference[0][0]) {
    return reference[0][1] * Math.max(1, (reference[0][0] / frequencyHz) ** 0.55);
  }
  if (frequencyHz >= reference.at(-1)[0]) return reference.at(-1)[1] * (frequencyHz / reference.at(-1)[0]) ** 0.25;
  const upperIndex = reference.findIndex(([frequency]) => frequency >= frequencyHz);
  const [f0, t0] = reference[upperIndex - 1];
  const [f1, t1] = reference[upperIndex];
  const fraction = Math.log(frequencyHz / f0) / Math.log(f1 / f0);
  return Math.exp(Math.log(t0) + fraction * Math.log(t1 / t0));
}

function fullWaveRuntimeEstimate(p = params) {
  const lengthScale = Math.max(0.25, stackLength(p) / 31.5) ** 1.35;
  const resolutionScale = Math.max(0.25, Number(p.full_wave_resolution_per_mm) / 2) ** 2.2;
  const frequencySeconds = (p.full_wave_frequencies_hz || [])
    .reduce((sum, frequency) => sum + fullWavePointReferenceSeconds(frequency), 0);
  const eqsSeconds = 9 * Math.max(1, (p.full_wave_eqs_frequencies_hz || []).length);
  const coarseResolution = Math.max(1, Number(p.full_wave_resolution_per_mm) * 0.5);
  const coarseScale = Math.max(0.25, coarseResolution / 2) ** 2.2;
  const meanPointSeconds = frequencySeconds / Math.max(1, (p.full_wave_frequencies_hz || []).length);
  const meepSeconds = p.full_wave_verify_resonances
    ? frequencySeconds * coarseScale + 7 * meanPointSeconds * resolutionScale
    : frequencySeconds * resolutionScale;
  const nominalSeconds = (meepSeconds + eqsSeconds) * lengthScale;
  return {
    nominalSeconds,
    lowSeconds: nominalSeconds * 0.6,
    highSeconds: nominalSeconds * 3,
    basis: "five plates, 31.5 mm, 2 cells/mm on the project Pi"
  };
}

function updateFullWaveReadouts() {
  const result = fullWaveResultForCurrentDesign();
  const status = document.getElementById("fullWaveStatus");
  updateFeaResourceReadouts("fullWave", result);
  document.getElementById("fullWaveFrequencyCount").textContent = Array.isArray(result?.samples)
    ? (result.resonance_verification?.enabled
        ? `${result.coarse_samples?.length || 0} ${translateText("coarse")} + ${result.refined_samples?.length || 0} ${translateText("fine")} + ${result.eqs_samples?.length || 0} EQS`
        : `${result.samples.length} MEEP + ${result.eqs_samples?.length || 0} EQS`)
    : `${params.full_wave_frequencies_hz.length} MEEP + ${params.full_wave_eqs_frequencies_hz.length} EQS`;
  const estimate = fullWaveRuntimeEstimate(params);
  document.getElementById("fullWaveTimeEstimate").textContent =
    `${formatDuration(estimate.lowSeconds)}-${formatDuration(estimate.highSeconds)}`;
  document.getElementById("fullWaveTimeoutReadout").textContent =
    formatDuration(params.full_wave_timeout_hours * 3600);
  const measuredSeconds = Number(result?.resource_usage?.duration_seconds ?? result?.elapsed_seconds);
  const runningSeconds = fullWaveStartedAtMs === null ? Number.NaN : (Date.now() - fullWaveStartedAtMs) / 1000;
  document.getElementById("fullWaveActualTime").textContent = fullWavePending && Number.isFinite(runningSeconds)
    ? `${formatDuration(runningSeconds)} ${translateText("elapsed")}`
    : (Number.isFinite(measuredSeconds) ? formatDuration(measuredSeconds) : translateText("Not solved"));
  status.classList.remove("risk", "pass");
  if (fullWavePending) {
    const elapsedSeconds = fullWaveStartedAtMs === null
      ? 0
      : Math.max(0, Math.floor((Date.now() - fullWaveStartedAtMs) / 1000));
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    const jobText = fullWaveJobId ? ` Job ${fullWaveJobId.slice(0, 8)} is ${fullWaveJobState || "running"}.` : "";
    status.textContent = translateTemplate("Full-wave Maxwell solve is running on the Pi: {time} elapsed.{job}", {
      time: `${minutes}:${String(seconds).padStart(2, "0")}`,
      job: jobText
    });
  } else if (fullWaveError) {
    status.classList.add("risk");
    status.textContent = translateTemplate("Full-wave solve failed: {error}", { error: fullWaveError });
  } else if (result) {
    const converged = result.all_frequency_points_converged === true;
    const verification = result.resonance_verification;
    const verifiedCount = verification?.verified_resonances?.length || 0;
    status.classList.add(converged ? "pass" : "risk");
    status.textContent = converged
      ? (verification?.enabled
          ? translateTemplate("Coarse sweep completed at {coarse} cells/mm and fine brackets at {fine} cells/mm; {count} {resonances} bracketed.", {
              coarse: result.coarse_resolution_per_mm.toFixed(1),
              fine: result.resolution_per_mm.toFixed(1),
              count: verifiedCount,
              resonances: translateText(verifiedCount === 1 ? "resonance" : "resonances")
            })
          : translateTemplate("Axisymmetric full-wave result converged at {resolution} cells/mm; enable resonance verification or repeat at another resolution before using resonances quantitatively.", {
              resolution: result.resolution_per_mm.toFixed(1)
            }))
      : translateText("One or more full-wave frequency points did not meet the requested residual; inspect or rerun before using this curve.");
  } else if (fullWaveCache) {
    status.textContent = translateText("Inputs changed since the full-wave solve; rerun for this design.");
  } else {
    status.textContent = translateText("Run the full-wave solve to include magnetic induction and fields escaping into free space.");
  }
}

function saveFullWaveJob(job) {
  try {
    if (job) localStorage.setItem(FULL_WAVE_JOB_STORAGE_KEY, JSON.stringify(job));
    else localStorage.removeItem(FULL_WAVE_JOB_STORAGE_KEY);
  } catch {
    // The backend job still runs when browser storage is unavailable.
  }
}

async function pollFullWaveJob(jobId, key) {
  const encodedJob = encodeURIComponent(jobId);
  let connectionFailures = 0;
  while (true) {
    await new Promise((resolve) => window.setTimeout(resolve, FULL_WAVE_SOLVER_POLL_MS));
    let payload;
    try {
      payload = await fetchJson(`${FULL_WAVE_SOLVER_ENDPOINT}/${encodedJob}`);
      connectionFailures = 0;
    } catch (error) {
      connectionFailures += 1;
      fullWaveJobState = `reconnecting (${connectionFailures})`;
      updateFullWaveReadouts();
      if (connectionFailures < 30) continue;
      throw error;
    }
    fullWaveJobState = payload.status || "running";
    updateFullWaveReadouts();
    if (payload.status === "failed" || payload.error) {
      throw new Error(payload.error || "Full-wave solve failed.");
    }
    if (payload.status === "complete" || payload.result) {
      return { key, result: payload.result || payload };
    }
  }
}

async function runFullWaveJob(jobId, key, startedAtMs = Date.now()) {
  const button = document.getElementById("solveFullWave");
  fullWavePending = true;
  fullWaveError = null;
  fullWaveJobId = jobId;
  fullWaveJobState = "queued";
  fullWaveStartedAtMs = startedAtMs;
  window.clearInterval(fullWaveStatusTimer);
  fullWaveStatusTimer = window.setInterval(updateFullWaveReadouts, 1000);
  button.disabled = true;
  button.textContent = translateText("Solving full-wave EM...");
  updateFullWaveReadouts();
  try {
    fullWaveCache = await pollFullWaveJob(jobId, key);
    saveFullWaveJob(null);
  } catch (error) {
    fullWaveError = error.message;
    saveFullWaveJob(null);
  } finally {
    window.clearInterval(fullWaveStatusTimer);
    fullWaveStatusTimer = null;
    fullWaveStartedAtMs = null;
    fullWavePending = false;
    fullWaveJobId = null;
    fullWaveJobState = null;
    button.disabled = false;
    button.textContent = translateText("Solve full-wave EM");
    updateFullWaveReadouts();
    drawSlideGraphics();
  }
}

async function solveFullWave() {
  const key = fullWaveKey(params);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), FULL_WAVE_CONNECT_TIMEOUT_MS);
  try {
    const solveParameters = backendParameters(params);
    solveParameters.full_wave_resonance_hints_hz = params.full_wave_verify_resonances
      ? fullWaveResonanceHints()
      : [];
    const payload = await fetchJson(FULL_WAVE_SOLVER_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId(), parameters: solveParameters }),
      signal: controller.signal
    });
    if (payload.status === "failed" || payload.error) {
      throw new Error(payload.error || "Full-wave solve failed.");
    }
    if (!payload.job_id) throw new Error("Full-wave backend did not return a job ID.");
    const startedAtMs = Date.now();
    saveFullWaveJob({ jobId: payload.job_id, key, startedAtMs });
    await runFullWaveJob(payload.job_id, key, startedAtMs);
  } catch (error) {
    fullWaveError = error.message;
    updateFullWaveReadouts();
  } finally {
    window.clearTimeout(timeout);
  }
}

function resumeStoredFullWaveJob() {
  try {
    const saved = JSON.parse(localStorage.getItem(FULL_WAVE_JOB_STORAGE_KEY) || "null");
    if (saved?.jobId && saved?.key) runFullWaveJob(saved.jobId, saved.key, saved.startedAtMs || Date.now());
  } catch {
    saveFullWaveJob(null);
  }
}
const hvSpacingControlIds = [
  "plate_gap_mm"
];

function isDynamicallyConstrainedControl(id) {
  return hvSpacingControlIds.includes(id)
    || id === "hv_plate_od_mm"
    || id === "washer_id_mm"
    || id === "washer_od_mm";
}

function corePresetForElectrical(epsr, resistivityLog10) {
  const match = Object.entries(coreMaterialPresets)
    .find(([, preset]) => Math.abs(preset.epsr - epsr) < 0.05 && Math.abs(preset.resistivityLog10 - resistivityLog10) < 0.05);
  return match ? match[0] : "custom";
}

function usesDirectStageCircuit(p) {
  return Boolean(p.use_direct_stage_circuit);
}

function usesDirectStageCapacitance(p) {
  return Boolean(p.use_direct_stage_capacitance);
}

function usesMelfCoreModel(p) {
  return String(p.core_material || "").startsWith("mmb020");
}

function supportsFerriteConductorFill(p) {
  return !usesMelfCoreModel(p) && !["epoxy_chain", "conductive_epoxy"].includes(String(p.core_material || ""));
}

function ferriteResistiveLengthFraction(p) {
  if (!supportsFerriteConductorFill(p)) return 1;
  const fillFactor = clamp(Number(p.ferrite_conductor_fill_factor) || 0, 0, 0.95);
  return Math.max(0.05, 1 - fillFactor);
}

function packageCoreOdMm(p) {
  const diameter = coreMaterialPresets[p.core_material]?.coreOdMm;
  return Number.isFinite(diameter) ? diameter : null;
}

function melfEffectiveEpsr(p) {
  const substrate = clamp(Number(p.melf_substrate_epsr) || 9.8, 1, 1000);
  const fillFactor = clamp(Number(p.melf_metal_fill_factor) || 0, 0, 0.95);
  return substrate / Math.max(0.05, 1 - fillFactor);
}

function coreCapacitanceEpsr(p) {
  if (usesDirectStageCapacitance(p)) {
    const areaMm2 = Math.PI * (p.core_od_mm / 2) ** 2;
    const lengthMm = stageCoreLengthMm(p);
    const epsilon0PfPerMm = EPSILON_0_F_PER_M * 1e9;
    if (!(areaMm2 > 0) || !(lengthMm > 0)) return 1;
    return Math.max(1e-6, directStageParasiticPf(p) * lengthMm / (epsilon0PfPerMm * areaMm2));
  }
  return usesMelfCoreModel(p)
    ? melfEffectiveEpsr(p)
    : p.ferrite_epsr / ferriteResistiveLengthFraction(p);
}

function applyDirectStageDefaultsForMaterial(p) {
  const preset = coreMaterialPresets[p.core_material];
  if (!preset) return;
  if (Number.isFinite(preset.stageResistanceOhm)) {
    p.melf_stage_resistance_mohm = preset.stageResistanceOhm / 1e6;
    p.melf_stage_resistance_log10_ohm = Math.log10(preset.stageResistanceOhm);
  }
  if (Number.isFinite(preset.stageParasiticPf)) {
    p.melf_stage_parasitic_pf = preset.stageParasiticPf;
  }
  if (Number.isFinite(preset.melfSubstrateEpsr)) {
    p.melf_substrate_epsr = preset.melfSubstrateEpsr;
  }
  if (Number.isFinite(preset.melfMetalFillFactor)) {
    p.melf_metal_fill_factor = preset.melfMetalFillFactor;
  }
}

function washerPresetForEpsr(epsr) {
  const match = Object.entries(washerMaterialPresets)
    .find(([, preset]) => !preset.linkedToEpoxy && Math.abs(preset.epsr - epsr) < 0.05);
  return match ? match[0] : "custom";
}

function epoxyPresetForEpsr(epsr) {
  const match = Object.entries(epoxyMaterialPresets)
    .find(([, preset]) => Math.abs(preset.epsr - epsr) < 0.05);
  return match ? match[0] : "custom";
}

function conductorPresetForElectrical(conductivityLog10, mur) {
  const match = Object.entries(conductorMaterialPresets)
    .find(([, preset]) => Math.abs(Math.log10(preset.conductivity) - conductivityLog10) < 0.035 && Math.abs(preset.mur - mur) < 0.05);
  return match ? match[0] : "custom";
}

function coreComponentName(p) {
  return coreMaterialPresets[p.core_material]?.componentName || "Custom core";
}

function washerUsesEpoxy(p) {
  return p.washer_material === "epoxy";
}

function washerBreakdownKvPerMm(p) {
  return washerUsesEpoxy(p)
    ? epoxyMaterialPresets[p.epoxy_material]?.breakdownKvPerMm ?? null
    : washerMaterialPresets[p.washer_material]?.breakdownKvPerMm ?? null;
}

function washerComponentName(p) {
  if (washerUsesEpoxy(p)) return `${epoxyComponentName(p)} (continuous gap fill)`;
  return washerMaterialPresets[p.washer_material]?.componentName || "Custom washer";
}

function epoxyComponentName(p) {
  return epoxyMaterialPresets[p.epoxy_material]?.componentName || "Custom epoxy fill";
}

function plateConductorName(p) {
  return conductorMaterialPresets[p.plate_material]?.label || "Custom conductor";
}

function tubeConductorName(p) {
  return conductorMaterialPresets[p.tube_material]?.label || "Custom conductor";
}

function washerGapIntervals(p) {
  const plates = plateCenters(p);
  const intervals = [];
  for (let index = 0; index < plates.length - 1; index += 1) {
    const [leftKind, leftZ] = plates[index];
    const [rightKind, rightZ] = plates[index + 1];
    if (leftKind === rightKind) continue;
    const z0 = leftZ + plateThicknessMm(p, leftKind) / 2;
    const z1 = rightZ - plateThicknessMm(p, rightKind) / 2;
    if (z1 > z0) intervals.push([z0, z1]);
  }
  return intervals;
}

function washerRadialBounds(p) {
  const tubeInner = p.tube_id_mm / 2;
  const inner = p.washer_id_mm / 2;
  const outer = p.washer_od_mm / 2;
  const clampedInner = clamp(inner, 0, Math.max(0, tubeInner));
  const clampedOuter = clamp(outer, 0, Math.max(0, tubeInner));
  return {
    inner: clampedInner,
    outer: clampedOuter,
    hasWasher: clampedOuter > clampedInner
  };
}

function isInWasherGap(p, zStack) {
  return washerGapIntervals(p).some(([z0, z1]) => zStack >= z0 && zStack <= z1);
}

function materialRegion(p, r, zStack = null) {
  if (washerUsesEpoxy(p)) return "epoxy";
  const washerBounds = washerRadialBounds(p);
  if (
    washerBounds.hasWasher
    && r >= washerBounds.inner
    && r <= washerBounds.outer
    && zStack !== null
    && isInWasherGap(p, zStack)
  ) return "washer";
  return "epoxy";
}

function dielectricDefinitions(p) {
  return [
    {
      key: "washer",
      shortLabel: "Washer",
      label: washerComponentName(p),
      breakdownKvPerMm: washerBreakdownKvPerMm(p)
    },
    {
      key: "epoxy",
      shortLabel: "Epoxy",
      label: epoxyComponentName(p),
      breakdownKvPerMm: epoxyMaterialPresets[p.epoxy_material]?.breakdownKvPerMm ?? null
    }
  ];
}

function stackLength(p) {
  const nGround = p.plate_pairs + 1;
  const nHv = p.plate_pairs;
  return nGround * groundPlateThicknessMm(p) + nHv * biasPlateThicknessMm(p) + (nGround + nHv - 1) * p.plate_gap_mm;
}

function plateCenters(p) {
  const centers = [];
  let lastThickness = groundPlateThicknessMm(p);
  let z = lastThickness / 2;
  centers.push(["ground", z]);
  for (let i = 0; i < p.plate_pairs; i += 1) {
    z += lastThickness / 2 + p.plate_gap_mm + biasPlateThicknessMm(p) / 2;
    centers.push(["hv", z]);
    lastThickness = biasPlateThicknessMm(p);
    z += lastThickness / 2 + p.plate_gap_mm + groundPlateThicknessMm(p) / 2;
    centers.push(["ground", z]);
    lastThickness = groundPlateThicknessMm(p);
  }
  return centers;
}

function coreSegmentIntervals(p) {
  const intervals = [];
  const length = stackLength(p);
  let cursor = 0;
  for (const [kind, zc] of plateCenters(p)) {
    if (kind !== "hv") continue;
    const half = biasPlateThicknessMm(p) / 2;
    const z0 = Math.max(0, zc - half);
    const z1 = Math.min(length, zc + half);
    if (z0 > cursor) intervals.push([cursor, z0]);
    cursor = Math.max(cursor, z1);
  }
  if (cursor < length) intervals.push([cursor, length]);
  return intervals;
}

function biasPlateThicknessMm(p) {
  return Number.isFinite(p.bias_plate_thickness_mm)
    ? p.bias_plate_thickness_mm
    : Number.isFinite(p.plate_thickness_mm)
      ? p.plate_thickness_mm
      : defaults.bias_plate_thickness_mm;
}

function groundPlateThicknessMm(p) {
  if (p.ground_matches_bias_thickness) return biasPlateThicknessMm(p);
  return Number.isFinite(p.ground_plate_thickness_mm)
    ? p.ground_plate_thickness_mm
    : Number.isFinite(p.plate_thickness_mm)
      ? p.plate_thickness_mm
      : defaults.ground_plate_thickness_mm;
}

function plateThicknessMm(p, kind) {
  return kind === "hv" ? biasPlateThicknessMm(p) : groundPlateThicknessMm(p);
}

function edgeRadiusMm(p, kind = null) {
  const rawPercent = Number.isFinite(p.edge_diameter_percent)
    ? p.edge_diameter_percent
    : defaults.edge_diameter_percent;
  const percent = Math.max(0, Math.min(100, rawPercent));
  if (kind) return (plateThicknessMm(p, kind) * percent) / 200;
  return Math.min(edgeRadiusMm(p, "hv"), edgeRadiusMm(p, "ground"));
}

function melfMinPairLengthMm(p) {
  const minPairLength = coreMaterialPresets[p.core_material]?.minPairLengthMm;
  return Number.isFinite(minPairLength) ? minPairLength : null;
}

function platePairAxialLengthMm(p) {
  return biasPlateThicknessMm(p) + groundPlateThicknessMm(p) + 2 * p.plate_gap_mm;
}

function minimumMelfPlateGapMm(p) {
  const minLength = melfMinPairLengthMm(p);
  if (!Number.isFinite(minLength)) return 0;
  return Math.max(0, (minLength - biasPlateThicknessMm(p) - groundPlateThicknessMm(p)) / 2);
}

function setModelStatus(text) {
  document.getElementById("modelStatus").textContent = translateText(text);
}

function clientId() {
  const key = "discoidal_capacitor_bias_filter_client_id";
  const legacyKey = "shv_bias_filter_client_id";
  try {
    let value = window.localStorage.getItem(key) || window.localStorage.getItem(legacyKey);
    if (!value) {
      value = window.crypto?.randomUUID?.() || `client-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem(key, value);
    }
    return value;
  } catch {
    return "browser";
  }
}

function backendParameters(p) {
  const backendParams = structuredClone(p);
  backendParams.plate_thickness_mm = biasPlateThicknessMm(p);
  backendParams.bias_plate_thickness_mm = biasPlateThicknessMm(p);
  backendParams.ground_plate_thickness_mm = groundPlateThicknessMm(p);
  backendParams.edge_radius_mm = edgeRadiusMm(p);
  backendParams.bias_edge_radius_mm = edgeRadiusMm(p, "hv");
  backendParams.ground_edge_radius_mm = edgeRadiusMm(p, "ground");
  delete backendParams.field_solver;
  return backendParams;
}

function comparableResultParameters(p) {
  const simulationParameters = backendParameters(p);
  delete simulationParameters.additional_ground_capacitance_pf;
  return JSON.stringify(simulationParameters);
}

function selectedFieldSolver() {
  return fieldSolverOptions[params.field_solver] || fieldSolverOptions.backend_auto;
}

function backendSolverForRequest() {
  return selectedFieldSolver().backendSolver;
}

function clamp(value, min, max = Number.POSITIVE_INFINITY) {
  return Math.max(min, Math.min(max, value));
}

function numericAttribute(input, name, fallback) {
  const value = Number.parseFloat(input.getAttribute(name));
  return Number.isFinite(value) ? value : fallback;
}

function controlRange(id, fallbackMin = Number.NEGATIVE_INFINITY, fallbackMax = Number.POSITIVE_INFINITY) {
  const custom = customControlRanges[id];
  if (custom && Number.isFinite(custom.min) && Number.isFinite(custom.max)) {
    const customMin = Math.min(custom.min, custom.max);
    const customMax = Math.max(custom.min, custom.max);
    const constrainCustom = isDynamicallyConstrainedControl(id);
    const min = constrainCustom && Number.isFinite(fallbackMin) ? Math.max(customMin, fallbackMin) : customMin;
    const max = constrainCustom && Number.isFinite(fallbackMax) ? Math.min(customMax, fallbackMax) : customMax;
    return min <= max ? { min, max } : { min, max: min };
  }
  if (Number.isFinite(fallbackMin) || Number.isFinite(fallbackMax)) {
    return { min: fallbackMin, max: fallbackMax };
  }
  const base = defaultControlRanges[id];
  if (base) return { min: base.min, max: base.max };
  const input = document.getElementById(id);
  if (!input) return { min: fallbackMin, max: fallbackMax };
  return {
    min: numericAttribute(input, "min", fallbackMin),
    max: numericAttribute(input, "max", fallbackMax)
  };
}

function setRangeInputBounds(id, min, max, step = null) {
  const input = document.getElementById(id);
  if (!input) return;
  const custom = customControlRanges[id];
  const constrainCustom = isDynamicallyConstrainedControl(id);
  const lower = custom
    ? (constrainCustom ? Math.max(Math.min(custom.min, custom.max), min) : Math.min(custom.min, custom.max))
    : min;
  const upper = custom
    ? (constrainCustom ? Math.min(Math.max(custom.min, custom.max), max) : Math.max(custom.min, custom.max))
    : max;
  input.min = Math.min(lower, upper);
  input.max = Math.max(input.min, upper);
  if (step !== null) input.step = step;
  const manual = document.getElementById(`${id}_manual`);
  if (manual) {
    manual.min = input.min;
    manual.max = input.max;
    manual.step = input.step;
  }
}

function spacingRangeForWasher(p) {
  const breakdownKvPerMm = washerBreakdownKvPerMm(p);
  if (!Number.isFinite(breakdownKvPerMm)) {
    return { ...CUSTOM_SPACING_RANGE_MM };
  }
  const min = Math.max(0.1, Math.ceil((p.bias_voltage_v / 1000 / breakdownKvPerMm) * 10) / 10);
  return {
    min,
    max: Math.round(min * BREAKDOWN_DESIGN_FACTOR_MAX * 10) / 10
  };
}

function minHvPlateOdForGeometry(p) {
  const groundInner = p.ground_plate_inner_diameter_mm;
  return Math.max(MIN_HV_PLATE_OD_MM, groundInner + 2 * MIN_RADIAL_OVERLAP_MM);
}

function derivedGeometry(p) {
  return {
    coreToGroundGap: (p.ground_plate_inner_diameter_mm - p.core_od_mm) / 2,
    hvToTubeGap: (p.tube_id_mm - p.hv_plate_od_mm) / 2,
    groundPlateOd: p.tube_id_mm
  };
}

function minimumSpacingForMaterial(preset, biasVoltageV) {
  if (!Number.isFinite(preset?.breakdownKvPerMm)) return CUSTOM_SPACING_RANGE_MM.min;
  return Math.max(0.1, Math.ceil((biasVoltageV / 1000 / preset.breakdownKvPerMm) * 10) / 10);
}

function applyDerivedGeometry(p) {
  const derived = derivedGeometry(p);
  p.core_to_ground_gap_mm = derived.coreToGroundGap;
  p.hv_to_tube_gap_mm = derived.hvToTubeGap;
  p.ground_plate_od_mm = derived.groundPlateOd;
}

function applyWasherGeometry(p) {
  const minWidthDiameter = 2 * MIN_WASHER_RADIAL_WIDTH_MM;
  const groundRadius = edgeRadiusMm(p, "ground");
  const biasRadius = edgeRadiusMm(p, "hv");
  const coreGapMin = minimumSpacingForMaterial(epoxyMaterialPresets[p.epoxy_material], p.bias_voltage_v);
  const tubeGapMin = coreGapMin;
  const minGroundId = p.core_od_mm + 2 * coreGapMin;
  p.tube_id_mm = Math.max(p.tube_id_mm, MIN_HV_PLATE_OD_MM + 2 * tubeGapMin);
  const maxGroundId = Math.max(minGroundId, p.tube_id_mm - 2 * tubeGapMin - 2 * MIN_RADIAL_OVERLAP_MM);

  p.washer_id_mode = WASHER_ID_MODES.has(p.washer_id_mode) ? p.washer_id_mode : "ground_id";
  p.washer_od_mode = WASHER_OD_MODES.has(p.washer_od_mode) ? p.washer_od_mode : "bias_od";
  p.washer_id_matches_ground = p.washer_id_mode === "ground_id";
  p.washer_od_matches_bias = p.washer_od_mode === "bias_od";
  if (!Number.isFinite(p.washer_id_mm)) p.washer_id_mm = p.ground_plate_inner_diameter_mm;
  if (!Number.isFinite(p.washer_od_mm)) p.washer_od_mm = p.hv_plate_od_mm;

  if (p.washer_id_mode === "ground_id") {
    p.ground_plate_inner_diameter_mm = clamp(p.washer_id_mm, minGroundId, maxGroundId);
    p.washer_id_mm = p.ground_plate_inner_diameter_mm;
    p.core_to_ground_gap_mm = (p.ground_plate_inner_diameter_mm - p.core_od_mm) / 2;
  } else if (p.washer_id_mode === "ground_flat_id") {
    p.ground_plate_inner_diameter_mm = clamp(p.washer_id_mm - 2 * groundRadius, minGroundId, maxGroundId);
    p.washer_id_mm = p.ground_plate_inner_diameter_mm + 2 * groundRadius;
    p.core_to_ground_gap_mm = (p.ground_plate_inner_diameter_mm - p.core_od_mm) / 2;
  } else {
    p.ground_plate_inner_diameter_mm = clamp(p.ground_plate_inner_diameter_mm, minGroundId, maxGroundId);
  }

  p.washer_id_mm = Math.max(p.core_od_mm, p.washer_id_mm);
  p.washer_od_mm = Math.max(p.washer_id_mm + minWidthDiameter, p.washer_od_mm);
  const minHvOd = Math.max(MIN_HV_PLATE_OD_MM, p.ground_plate_inner_diameter_mm + 2 * MIN_RADIAL_OVERLAP_MM);
  const maxHvOd = p.tube_id_mm - 2 * tubeGapMin;
  if (p.washer_od_mode === "bias_od") {
    p.hv_plate_od_mm = clamp(p.washer_od_mm, minHvOd, maxHvOd);
    p.washer_od_mm = p.hv_plate_od_mm;
  } else if (p.washer_od_mode === "bias_flat_od") {
    p.hv_plate_od_mm = clamp(p.washer_od_mm + 2 * biasRadius, minHvOd, maxHvOd);
    p.washer_od_mm = p.hv_plate_od_mm - 2 * biasRadius;
  } else {
    p.hv_plate_od_mm = clamp(p.hv_plate_od_mm, minHvOd, maxHvOd);
  }

  applyDerivedGeometry(p);
  const maxWasherOd = Math.max(p.washer_id_mm + minWidthDiameter, p.tube_id_mm);
  if (p.washer_id_mode === "custom") {
    p.washer_id_mm = clamp(p.washer_id_mm, p.core_od_mm, Math.max(p.core_od_mm, p.washer_od_mm - minWidthDiameter));
  }
  if (p.washer_od_mode === "custom") {
    p.washer_od_mm = clamp(p.washer_od_mm, p.washer_id_mm + minWidthDiameter, maxWasherOd);
  }
}

function syncDynamicRanges() {
  const spacingRange = spacingRangeForWasher(params);
  for (const id of hvSpacingControlIds) {
    const min = Math.max(spacingRange.min, minimumMelfPlateGapMm(params));
    const max = spacingRange.max;
    setRangeInputBounds(id, min, max, 0.1);
  }
  const hvOdInput = document.getElementById("hv_plate_od_mm");
  const hvOdBaseMax = defaultControlRanges.hv_plate_od_mm?.max ?? numericAttribute(hvOdInput, "max", 56);
  setRangeInputBounds("hv_plate_od_mm", minHvPlateOdForGeometry(params), hvOdBaseMax, 0.5);
  const epoxyGapMin = minimumSpacingForMaterial(epoxyMaterialPresets[params.epoxy_material], params.bias_voltage_v);
  const washerIdOffset = params.washer_id_mode === "ground_flat_id" ? 2 * edgeRadiusMm(params, "ground") : 0;
  const washerIdMin = params.core_od_mm + 2 * epoxyGapMin + washerIdOffset;
  const washerIdMax = Math.max(washerIdMin, Math.min(params.washer_od_mm - 2 * MIN_WASHER_RADIAL_WIDTH_MM, params.tube_id_mm - 2 * epoxyGapMin - 2 * MIN_RADIAL_OVERLAP_MM + washerIdOffset));
  setRangeInputBounds("washer_id_mm", washerIdMin, washerIdMax, 0.1);
  const washerOdMin = params.washer_id_mm + 2 * MIN_WASHER_RADIAL_WIDTH_MM;
  const washerOdOffset = params.washer_od_mode === "bias_flat_od" ? 2 * edgeRadiusMm(params, "hv") : 0;
  const washerOdMax = Math.max(washerOdMin, params.tube_id_mm - 2 * epoxyGapMin - washerOdOffset);
  setRangeInputBounds("washer_od_mm", washerOdMin, washerOdMax, 0.1);
}

const engineeringPrefixMultipliers = {
  T: 1e12,
  G: 1e9,
  M: 1e6,
  k: 1e3,
  K: 1e3,
  m: 1e-3,
  u: 1e-6,
  "µ": 1e-6,
  "μ": 1e-6,
  n: 1e-9,
  p: 1e-12,
  f: 1e-15
};

function controlInternalUnitInSi(id) {
  if (id.endsWith("_resistance_mohm")) return 1e6;
  if (id.endsWith("_resistance_ohm") || id.endsWith("_impedance_ohm")) return 1;
  if (id.endsWith("_pf")) return 1e-12;
  if (id.endsWith("_na")) return 1e-9;
  if (id.endsWith("_mm")) return 1e-3;
  if (id.endsWith("_length_m")) return 1;
  if (id.endsWith("_voltage_v")) return 1;
  return null;
}

function controlValueFromInput(id, value) {
  const text = String(value).trim();
  if (id === "plate_pairs") return Number.parseInt(text, 10);
  const match = text.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)\s*([TGMkKmuµμnpf])?\s*(?:[a-zA-ZΩΩ]+)?$/);
  if (!match) return Number.NaN;
  const number = Number.parseFloat(match[1]);
  const prefix = match[2];
  if (!prefix) return number;
  const internalUnitInSi = controlInternalUnitInSi(id);
  if (!Number.isFinite(internalUnitInSi)) return Number.NaN;
  return number * engineeringPrefixMultipliers[prefix] / internalUnitInSi;
}

function updateMaterialSelectionsForControl(id) {
  if (id === "ferrite_epsr" || id === "core_volume_resistivity_log10_ohm_cm") {
    params.core_material = corePresetForElectrical(params.ferrite_epsr, params.core_volume_resistivity_log10_ohm_cm);
  }
  if (id === "washer_epsr") params.washer_material = washerPresetForEpsr(params.washer_epsr);
  if (id === "epoxy_epsr") {
    params.epoxy_material = epoxyPresetForEpsr(params.epoxy_epsr);
    if (washerUsesEpoxy(params)) params.washer_epsr = params.epoxy_epsr;
  }
  if (id === "plate_conductivity_log10_s_per_m" || id === "plate_relative_permeability") {
    params.plate_material = conductorPresetForElectrical(params.plate_conductivity_log10_s_per_m, params.plate_relative_permeability);
  }
  if (id === "tube_conductivity_log10_s_per_m" || id === "tube_relative_permeability") {
    params.tube_material = conductorPresetForElectrical(params.tube_conductivity_log10_s_per_m, params.tube_relative_permeability);
  }
}

function applyControlValue(id, value) {
  const parsed = controlValueFromInput(id, value);
  if (!Number.isFinite(parsed)) return;
  const range = controlRange(id);
  if (parsed < range.min || parsed > range.max) {
    customControlRanges[id] = {
      min: Math.min(range.min, parsed),
      max: Math.max(range.max, parsed)
    };
  }
  params[id] = parsed;
  updateMaterialSelectionsForControl(id);
  normalizeParams();
  syncControls();
  if (id === "additional_ground_capacitance_pf") return;
  drawCadModel();
  drawGeometry();
  clearField();
}

function decimalsFromStep(step) {
  const text = String(step || "");
  if (!text.includes(".")) return 0;
  return Math.min(6, text.split(".")[1].length);
}

function formatManualControlValue(id, value) {
  if (!Number.isFinite(value)) return "";
  if (id === "plate_pairs") return `${Math.round(value)}`;
  return Number(value.toPrecision(12)).toString();
}

function setupManualControlInput(id) {
  const input = document.getElementById(id);
  const output = document.getElementById(`${id}_out`);
  if (!input || !output || document.getElementById(`${id}_manual`)) return;
  defaultControlRanges[id] = {
    min: numericAttribute(input, "min", Number.NEGATIVE_INFINITY),
    max: numericAttribute(input, "max", Number.POSITIVE_INFINITY),
    step: input.step || "any"
  };

  const valueWrap = document.createElement("span");
  valueWrap.className = "control-value-edit";
  output.replaceWith(valueWrap);
  valueWrap.appendChild(output);

  const manual = document.createElement("input");
  manual.id = `${id}_manual`;
  manual.className = "control-number";
  manual.type = "text";
  manual.inputMode = "decimal";
  manual.step = input.step || "any";
  manual.min = input.min;
  manual.max = input.max;
  manual.value = formatManualControlValue(id, params[id]);
  const parameterHelp = translatedParameterTooltip(id);
  manual.title = `${parameterHelp ? `${parameterHelp} ` : ""}${translateText(EXACT_VALUE_HELP)}`;
  valueWrap.appendChild(manual);

  manual.addEventListener("change", () => applyControlValue(id, manual.value));
  manual.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      applyControlValue(id, manual.value);
      manual.blur();
    }
  });

  input.title = `${parameterHelp} ${translateText(RANGE_EDITOR_HELP)}`;
  input.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    openRangeEditor(id, event.clientX, event.clientY);
  });
}

function rangeEditorElement() {
  let editor = document.getElementById("rangeEditor");
  if (editor) return editor;
  editor = document.createElement("form");
  editor.id = "rangeEditor";
  editor.className = "range-editor";
  editor.innerHTML = `
    <strong>Slider range</strong>
    <label>Min <input id="rangeEditorMin" type="text" inputmode="decimal"></label>
    <label>Max <input id="rangeEditorMax" type="text" inputmode="decimal"></label>
    <div>
      <button type="submit">Apply</button>
      <button type="button" id="rangeEditorReset">Reset</button>
      <button type="button" id="rangeEditorClose">Close</button>
    </div>
  `;
  document.body.appendChild(editor);
  document.getElementById("rangeEditorClose").addEventListener("click", closeRangeEditor);
  document.getElementById("rangeEditorReset").addEventListener("click", () => {
    const id = editor.dataset.controlId;
    if (!id) return;
    delete customControlRanges[id];
    closeRangeEditor();
    normalizeParams();
    syncControls();
    drawCadModel();
    drawGeometry();
    clearField();
  });
  editor.addEventListener("submit", (event) => {
    event.preventDefault();
    const id = editor.dataset.controlId;
    const min = controlValueFromInput(id, document.getElementById("rangeEditorMin").value);
    const max = controlValueFromInput(id, document.getElementById("rangeEditorMax").value);
    if (!id || !Number.isFinite(min) || !Number.isFinite(max)) return;
    customControlRanges[id] = { min: Math.min(min, max), max: Math.max(min, max) };
    closeRangeEditor();
    normalizeParams();
    syncControls();
    drawCadModel();
    drawGeometry();
    clearField();
  });
  return editor;
}

function openRangeEditor(id, clientX, clientY) {
  const input = document.getElementById(id);
  if (!input) return;
  const editor = rangeEditorElement();
  editor.dataset.controlId = id;
  document.getElementById("rangeEditorMin").value = input.min;
  document.getElementById("rangeEditorMax").value = input.max;
  editor.style.left = `${Math.min(clientX, window.innerWidth - 250)}px`;
  editor.style.top = `${Math.min(clientY, window.innerHeight - 180)}px`;
  editor.hidden = false;
  document.getElementById("rangeEditorMin").focus();
}

function closeRangeEditor() {
  const editor = document.getElementById("rangeEditor");
  if (editor) editor.hidden = true;
}

function settingsFileName() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `discoidal-capacitor-bias-filter-settings-${stamp}.json`;
}

function exportedSettingsPayload() {
  return {
    format: "discoidal-capacitor-bias-filter-settings",
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: structuredClone(params),
    ui: {
      customControlRanges: structuredClone(customControlRanges)
    }
  };
}

function downloadTextFile(filename, text, mimeType = "application/json") {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function formatArtifactSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "size unavailable";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(bytes >= 100 * 1024 ? 0 : 1)} KiB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
}

function artifactModifiedLabel(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? `updated ${date.toLocaleString()}` : "date unavailable";
}

function renderArtifactManifest(payload) {
  const container = document.getElementById("artifactGroups");
  const status = document.getElementById("artifactStatus");
  const downloadAll = document.getElementById("artifactDownloadAll");
  if (!container || !status || !downloadAll) return;
  container.replaceChildren();

  const files = Array.isArray(payload?.files) ? payload.files : [];
  const groupDefinitions = [
    { key: "simulation", label: "Simulation outputs" },
    { key: "cad", label: "CAD and mesh exports" }
  ];
  for (const definition of groupDefinitions) {
    const section = document.createElement("section");
    section.className = "artifact-group";
    const heading = document.createElement("h3");
    heading.textContent = definition.label;
    section.appendChild(heading);
    const list = document.createElement("ul");
    list.className = "artifact-list";

    for (const file of files.filter((entry) => entry.group === definition.key)) {
      const item = document.createElement("li");
      item.className = `artifact-file${file.available ? "" : " unavailable"}`;
      const name = document.createElement("code");
      name.textContent = file.name;
      const details = document.createElement("small");
      details.textContent = file.available
        ? `${formatArtifactSize(Number(file.sizeBytes))} | ${artifactModifiedLabel(file.modifiedAt)}`
        : "not generated on this server";
      item.append(name, details);
      if (file.available && file.downloadUrl) {
        const link = document.createElement("a");
        link.href = file.downloadUrl;
        link.download = file.name;
        link.textContent = translateText("Download");
        item.appendChild(link);
      }
      list.appendChild(item);
    }
    section.appendChild(list);
    container.appendChild(section);
  }

  const available = Number(payload?.availableCount) || 0;
  const total = Number(payload?.totalCount) || files.length;
  status.textContent = `${available} of ${total} generated files available on this server.`;
  downloadAll.hidden = !payload?.zipUrl || available === 0;
  if (payload?.zipUrl) downloadAll.href = payload.zipUrl;
}

async function refreshArtifactDownloads(force = false) {
  if (artifactManifestLoaded && !force) return;
  const status = document.getElementById("artifactStatus");
  try {
    const payload = await fetchJson("/api/artifacts");
    renderArtifactManifest(payload);
    artifactManifestLoaded = true;
  } catch {
    if (status) status.textContent = "Generated-file downloads require the project backend.";
  }
}

function setSettingsStatus(message, isError = false) {
  const status = document.getElementById("settingsStatus");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function importedSettingsPayload(json) {
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    throw new Error("Settings file must contain a JSON object.");
  }
  const ranges = json.ui?.customControlRanges || json.customControlRanges || {};
  if (json.settings && typeof json.settings === "object" && !Array.isArray(json.settings)) {
    return { settings: json.settings, ranges };
  }
  return { settings: json, ranges };
}

function replaceCustomControlRanges(ranges) {
  Object.keys(customControlRanges).forEach((key) => {
    delete customControlRanges[key];
  });
  if (!ranges || typeof ranges !== "object" || Array.isArray(ranges)) return;
  Object.entries(ranges).forEach(([key, value]) => {
    if (!value || typeof value !== "object") return;
    const min = Number.parseFloat(value.min);
    const max = Number.parseFloat(value.max);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return;
    customControlRanges[key] = { min: Math.min(min, max), max: Math.max(min, max) };
  });
}

function settingsWithBuiltInFallback(imported) {
  const next = { ...structuredClone(defaults), ...imported };
  if (!Object.prototype.hasOwnProperty.call(imported, "washer_id_mode") && Object.prototype.hasOwnProperty.call(imported, "washer_id_matches_ground")) {
    next.washer_id_mode = imported.washer_id_matches_ground === false ? "custom" : "ground_id";
  }
  if (!Object.prototype.hasOwnProperty.call(imported, "washer_od_mode") && Object.prototype.hasOwnProperty.call(imported, "washer_od_matches_bias")) {
    next.washer_od_mode = imported.washer_od_matches_bias === false ? "custom" : "bias_od";
  }
  if (!Object.prototype.hasOwnProperty.call(imported, "use_direct_stage_capacitance")) {
    const importedMelf = String(next.core_material || "").startsWith("mmb020");
    next.use_direct_stage_capacitance = Boolean(next.use_direct_stage_circuit && !importedMelf);
  }
  if (!Object.prototype.hasOwnProperty.call(imported, "use_package_core_od") && Object.prototype.hasOwnProperty.call(imported, "core_od_mm")) {
    next.use_package_core_od = false;
  }
  return next;
}

function applyImportedSettings(imported, ranges = {}) {
  replaceCustomControlRanges(ranges);
  params = settingsWithBuiltInFallback(imported);
  lastResult = null;
  fullWaveCache = null;
  normalizeParams();
  loadBundledDefaultFieldResult();
  loadBundledDefaultFullWaveResult();
  syncControls();
  drawCadModel();
  drawGeometry();
  if (lastResult) drawSolvedResult(lastResult);
  else clearField();
}

function exportSettingsToFile() {
  const text = JSON.stringify(exportedSettingsPayload(), null, 2);
  downloadTextFile(settingsFileName(), `${text}\n`);
  setSettingsStatus("Settings exported.");
}

function downloadInstallationDefault() {
  const text = JSON.stringify(exportedSettingsPayload(), null, 2);
  downloadTextFile("default.json", `${text}\n`);
  setSettingsStatus("Downloaded default.json. Place it beside index.html on this deployment, then reload the page.");
}

async function loadInstallationDefaults() {
  installationDefaultSource = "built-in defaults";
  installationDefaultLoadError = null;
  params = structuredClone(defaults);
  replaceCustomControlRanges({});

  if (window.location.protocol === "file:") {
    installationDefaultLoadError = "Optional default.json requires this directory to be served over HTTP.";
    return;
  }

  try {
    const response = await fetch("default.json", { cache: "no-store" });
    if (response.status === 404) return;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = importedSettingsPayload(await response.json());
    params = settingsWithBuiltInFallback(payload.settings);
    replaceCustomControlRanges(payload.ranges);
    installationDefaultSource = "default.json";
  } catch (error) {
    params = structuredClone(defaults);
    replaceCustomControlRanges({});
    installationDefaultLoadError = `default.json was not loaded: ${error.message}`;
    console.warn(installationDefaultLoadError);
  }
}

function bundledDefaultParametersMatch(
  saved,
  current,
  diagnosticKey = "defaultFieldMismatch",
  ignoredPrefixes = ["noise_", "thermal_", "full_wave_"]
) {
  const left = backendParameters(saved);
  const right = backendParameters(current);
  delete left.additional_ground_capacitance_pf;
  delete right.additional_ground_capacitance_pf;
  for (const derivedKey of [
    "core_volume_resistivity_ohm_cm",
    "washer_id_matches_ground",
    "washer_od_matches_bias"
  ]) {
    delete left[derivedKey];
    delete right[derivedKey];
  }
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if (ignoredPrefixes.some((prefix) => key.startsWith(prefix))) continue;
    const a = left[key];
    const b = right[key];
    if (typeof a === "number" && typeof b === "number") {
      if (!Number.isFinite(a) || !Number.isFinite(b)) {
        document.documentElement.dataset[diagnosticKey] = `${key}: ${String(a)} != ${String(b)}`;
        return false;
      }
      if (Math.abs(a - b) > 1e-9 * Math.max(1, Math.abs(a), Math.abs(b))) {
        document.documentElement.dataset[diagnosticKey] = `${key}: ${a} != ${b}`;
        return false;
      }
    } else if (JSON.stringify(a) !== JSON.stringify(b)) {
      document.documentElement.dataset[diagnosticKey] = `${key}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`;
      return false;
    }
  }
  delete document.documentElement.dataset[diagnosticKey];
  return true;
}

function loadBundledDefaultFieldResult() {
  const bundle = window.DISCOIDAL_BUNDLED_DEFAULT_FIELD_RESULT;
  if (
    !bundle
    || bundle.format !== "discoidal-capacitor-bias-filter-bundled-field"
    || bundle.version !== 2
    || !bundle.settings
    || !bundle.result
  ) {
    document.documentElement.dataset.defaultFieldResult = "unavailable";
    return false;
  }

  const bundledParameters = settingsWithBuiltInFallback(bundle.settings);
  if (!bundledDefaultParametersMatch(bundledParameters, params)) {
    document.documentElement.dataset.defaultFieldResult = "geometry-mismatch";
    return false;
  }

  try {
    const result = backendResultFromPayload(bundle.result);
    result.bundledDefault = true;
    captureResultParameters(result, params);
    lastResult = result;
    const spiceKey = spiceLadderRequestKey();
    if (spiceKey && Array.isArray(bundle.spiceLadder?.samples) && bundle.spiceLadder.samples.length) {
      spiceLadderCache = { key: spiceKey, payload: bundle.spiceLadder };
      spiceLadderPendingKey = null;
      spiceLadderDisabled = false;
      document.documentElement.dataset.defaultSpiceResult = "loaded";
    } else {
      document.documentElement.dataset.defaultSpiceResult = "unavailable";
    }
    document.documentElement.dataset.defaultFieldResult = "fenicsx-loaded";
    return true;
  } catch (error) {
    document.documentElement.dataset.defaultFieldResult = "invalid";
    console.warn(`Bundled default FEniCSx result was not loaded: ${error.message}`);
    return false;
  }
}

function updateInstallationDefaultLabels() {
  const source = installationDefaultSource === "default.json"
    ? "installation default from default.json"
    : "built-in defaults";
  const slideSource = document.getElementById("slideConfigurationSource");
  if (slideSource) slideSource.textContent = `Simulation geometry: ${source}.`;

  if (installationDefaultLoadError) {
    setSettingsStatus(`Using built-in defaults. ${installationDefaultLoadError}`, true);
  } else if (installationDefaultSource === "default.json") {
    setSettingsStatus("Loaded installation defaults from default.json.");
  } else {
    setSettingsStatus("Using built-in defaults; optional default.json was not found.");
  }
}

async function importSettingsFromFile(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const json = JSON.parse(text);
    const payload = importedSettingsPayload(json);
    applyImportedSettings(payload.settings, payload.ranges);
    setSettingsStatus(`Imported ${file.name}.`);
  } catch (error) {
    setSettingsStatus(`Import failed: ${error.message}`, true);
  }
}

function parallelPlateCapacitancePf(epsr, areaMm2, separationMm) {
  if (epsr <= 0 || areaMm2 <= 0 || separationMm <= 0) return 0;
  return EPSILON_0_F_PER_M * epsr * (areaMm2 / separationMm) * 1e9;
}

function coreVolumeResistivityOhmCm(p) {
  return 10 ** p.core_volume_resistivity_log10_ohm_cm;
}

function coreCrossSectionAreaMm2(p) {
  return Math.PI * (p.core_od_mm / 2) ** 2;
}

function coreResistanceForLengthOhm(p, lengthMm) {
  const areaMm2 = coreCrossSectionAreaMm2(p);
  if (areaMm2 <= 0 || lengthMm <= 0) return Number.NaN;
  // rho is in ohm-cm. Geometry is in mm, so L/A becomes
  // (length_mm / 10) / (area_mm2 / 100) = 10 * length_mm / area_mm2.
  return coreVolumeResistivityOhmCm(p) * (10 * lengthMm / areaMm2) * ferriteResistiveLengthFraction(p);
}

function directStageResistanceOhm(p) {
  if (Number.isFinite(p.melf_stage_resistance_mohm)) {
    return p.melf_stage_resistance_mohm * 1e6;
  }
  return 10 ** p.melf_stage_resistance_log10_ohm;
}

function directStageParasiticPf(p) {
  return Math.max(0, p.melf_stage_parasitic_pf);
}

function stageResistanceOhmForCircuit(p, biasBiasSeparationMm) {
  if (usesDirectStageCircuit(p)) return directStageResistanceOhm(p);
  return coreResistanceForLengthOhm(p, biasBiasSeparationMm);
}

function stageResistanceReferenceOhm(p) {
  return stageResistanceOhmForCircuit(p, stageCoreLengthMm(p));
}

function stageCoreLengthMm(p) {
  return groundPlateThicknessMm(p) + 2 * p.plate_gap_mm;
}

function endCoreLengthMm(p) {
  return groundPlateThicknessMm(p) + p.plate_gap_mm;
}

function matchedEndSeriesResistanceOhm(p) {
  return usesDirectStageCircuit(p)
    ? directStageResistanceOhm(p)
    : coreResistanceForLengthOhm(p, endCoreLengthMm(p));
}

function matchedSeriesResistanceMohm(p) {
  const ohms = matchedEndSeriesResistanceOhm(p);
  return Number.isFinite(ohms) && ohms >= 0 ? ohms / 1e6 : 0;
}

function inputSeriesResistanceOhm(circuit, p) {
  const mohms = p.input_series_matches_stage ? matchedEndSeriesResistanceOhm(p) / 1e6 : p.input_series_resistance_mohm;
  return Math.max(0, Number(mohms) || 0) * 1e6;
}

function outputSeriesResistanceOhm(circuit, p) {
  const ohms = p.output_series_matches_stage ? matchedEndSeriesResistanceOhm(p) : p.output_series_resistance_ohm;
  return Math.max(0, Number(ohms) || 0);
}

function activeSeriesSectionCount(circuit, p, includeOutput = true) {
  const values = [
    inputSeriesResistanceOhm(circuit, p),
    ...Array.from({ length: Math.max(0, Math.floor(p.plate_pairs) - 1) }, () => circuit.stageResistanceOhm)
  ];
  if (includeOutput) values.push(outputSeriesResistanceOhm(circuit, p));
  return values.filter((ohms) => Number.isFinite(ohms) && ohms > 0).length;
}

function totalCoreResistanceOhm(p) {
  const stageResistance = stageResistanceReferenceOhm(p);
  const circuit = { stageResistanceOhm: stageResistance };
  const internalStageCount = Math.max(0, p.plate_pairs - 1);
  const totalOhm = (
    internalStageCount * stageResistance
    + inputSeriesResistanceOhm(circuit, p)
    + outputSeriesResistanceOhm(circuit, p)
  );
  return totalOhm > 0 ? totalOhm : Number.NaN;
}

function applyDerivedElectrical(p) {
  p.core_resistance_gohm = totalCoreResistanceOhm(p) / 1e9;
}

function formatResistivity(ohmCm) {
  if (!Number.isFinite(ohmCm) || ohmCm <= 0) return "--";
  const exponent = Math.floor(Math.log10(ohmCm));
  const mantissa = ohmCm / (10 ** exponent);
  const mantissaText = Math.abs(mantissa - 1) < 0.005
    ? "1"
    : mantissa.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return `${mantissaText} × 10<sup>${exponent}</sup> Ω·cm`;
}

function formatScientificHtml(value, unit, digits = 2) {
  if (!Number.isFinite(value) || value <= 0) return "--";
  const exponent = Math.floor(Math.log10(value));
  const mantissa = value / (10 ** exponent);
  const mantissaText = Math.abs(mantissa - 1) < 0.005
    ? "1"
    : mantissa.toLocaleString(undefined, { maximumFractionDigits: digits });
  return `${mantissaText} × 10<sup>${exponent}</sup> ${unit}`;
}

function formatConductivity(siemensPerMeter) {
  return formatScientificHtml(siemensPerMeter, "S/m");
}

function formatFrequencyControl(logMhz) {
  const hz = rfFrequencyHzFromLogMhz(logMhz);
  return formatFrequency(hz);
}

function formatControlOutput(id, value) {
  if (id === "core_volume_resistivity_log10_ohm_cm") {
    return formatResistivity(10 ** value);
  }
  if (id === "melf_stage_resistance_mohm" || id === "input_series_resistance_mohm") {
    return formatResistance(value * 1e6);
  }
  if (id === "output_series_resistance_ohm") return formatResistance(value);
  if (id === "melf_stage_parasitic_pf" || id === "additional_ground_capacitance_pf") {
    return formatCapacitance(value);
  }
  if (id === "melf_metal_fill_factor") {
    return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
  if (id === "ferrite_conductor_fill_factor") {
    return `${(100 * value).toLocaleString(undefined, { maximumFractionDigits: 0 })}%`;
  }
  if (id === "load_current_na") {
    return formatCurrentFromNa(value);
  }
  if (id === "detector_capacitance_pf") {
    return formatCapacitance(value);
  }
  if (id === "bias_plate_thickness_mm" || id === "ground_plate_thickness_mm") {
    return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 4 })} mm`;
  }
  if (id === "load_cable_velocity_factor") {
    return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  if (id === "noise_fano_factor") {
    return Number(value).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  }
  if (id === "plate_conductivity_log10_s_per_m" || id === "tube_conductivity_log10_s_per_m") {
    return formatConductivity(10 ** value);
  }
  if (id === "rf_compare_frequency_log10_mhz") {
    return formatFrequencyControl(value);
  }
  if (id === "mesh_edge_radius_ratio") {
    const divisor = value > 0 ? 1 / value : Number.NaN;
    const divisorText = Number.isFinite(divisor)
      ? `r/${divisor.toLocaleString(undefined, { maximumFractionDigits: 1 })}`
      : "r/--";
    return `${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} x r (${divisorText})`;
  }
  if (id === "plate_relative_permeability" || id === "tube_relative_permeability") {
    return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}${translateText(units[id])}`;
}

function formatCapacitance(pf) {
  if (!Number.isFinite(pf)) return "--";
  if (pf >= 1000) return `${(pf / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} nF`;
  if (pf >= 100) return `${pf.toLocaleString(undefined, { maximumFractionDigits: 0 })} pF`;
  if (pf >= 10) return `${pf.toLocaleString(undefined, { maximumFractionDigits: 1 })} pF`;
  if (pf >= 1) return `${pf.toLocaleString(undefined, { maximumFractionDigits: 2 })} pF`;
  return `${(pf * 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} fF`;
}

function formatResistance(ohms) {
  if (!Number.isFinite(ohms)) return "--";
  if (ohms >= 1e12) return `${(ohms / 1e12).toLocaleString(undefined, { maximumFractionDigits: 2 })} TΩ`;
  if (ohms >= 1e9) return `${(ohms / 1e9).toLocaleString(undefined, { maximumFractionDigits: 2 })} GΩ`;
  if (ohms >= 1e6) return `${(ohms / 1e6).toLocaleString(undefined, { maximumFractionDigits: 1 })} MΩ`;
  if (ohms >= 1e3) return `${(ohms / 1e3).toLocaleString(undefined, { maximumFractionDigits: 1 })} kΩ`;
  if (ohms >= 1) return `${ohms.toLocaleString(undefined, { maximumFractionDigits: 2 })} Ω`;
  if (ohms >= 1e-3) return `${(ohms * 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} mΩ`;
  return `${ohms.toLocaleString(undefined, { maximumFractionDigits: 0 })} Ω`;
}

function formatCurrentFromNa(currentNa) {
  if (!Number.isFinite(currentNa)) return "--";
  const magnitude = Math.abs(currentNa);
  if (magnitude >= 1e6) return `${(currentNa / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 })} mA`;
  if (magnitude >= 1e3) return `${(currentNa / 1e3).toLocaleString(undefined, { maximumFractionDigits: 2 })} uA`;
  if (magnitude >= 1) return `${currentNa.toLocaleString(undefined, { maximumFractionDigits: 2 })} nA`;
  return `${(currentNa * 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} pA`;
}

function formatAdmittance(siemens) {
  if (!Number.isFinite(siemens)) return "--";
  const magnitude = Math.abs(siemens);
  if (magnitude >= 1) return `${siemens.toLocaleString(undefined, { maximumFractionDigits: 3 })} S`;
  if (magnitude >= 1e-3) return `${(siemens * 1e3).toLocaleString(undefined, { maximumFractionDigits: 3 })} mS`;
  if (magnitude >= 1e-6) return `${(siemens * 1e6).toLocaleString(undefined, { maximumFractionDigits: 3 })} uS`;
  if (magnitude >= 1e-9) return `${(siemens * 1e9).toLocaleString(undefined, { maximumFractionDigits: 3 })} nS`;
  if (magnitude >= 1e-12) return `${(siemens * 1e12).toLocaleString(undefined, { maximumFractionDigits: 3 })} pS`;
  if (magnitude >= 1e-15) return `${(siemens * 1e15).toLocaleString(undefined, { maximumFractionDigits: 3 })} fS`;
  return formatScientificHtml(siemens, "S");
}

function formatFrequency(hz) {
  if (!Number.isFinite(hz)) return "--";
  if (hz >= 1e9) return `${(hz / 1e9).toLocaleString(undefined, { maximumFractionDigits: 3 })} GHz`;
  if (hz >= 1e6) return `${(hz / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 })} MHz`;
  if (hz >= 1e3) return `${(hz / 1e3).toLocaleString(undefined, { maximumFractionDigits: 2 })} kHz`;
  if (hz >= 1) return `${hz.toLocaleString(undefined, { maximumFractionDigits: 2 })} Hz`;
  return `${(hz * 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} mHz`;
}

function formatLength(lengthMm) {
  if (!Number.isFinite(lengthMm)) return "--";
  if (lengthMm >= 1) return `${lengthMm.toLocaleString(undefined, { maximumFractionDigits: 3 })} mm`;
  const micrometers = lengthMm * 1000;
  if (micrometers >= 1) return `${micrometers.toLocaleString(undefined, { maximumFractionDigits: 2 })} µm`;
  const nanometers = micrometers * 1000;
  return `${nanometers.toLocaleString(undefined, { maximumFractionDigits: 1 })} nm`;
}

function formatKvPerMm(kvPerMm) {
  if (!Number.isFinite(kvPerMm)) return "--";
  return `${kvPerMm.toLocaleString(undefined, { maximumFractionDigits: 2 })} kV/mm`;
}

function formatFieldVPerMm(vPerMm) {
  if (!Number.isFinite(vPerMm) || vPerMm <= 0) return "--";
  return `${(vPerMm / 1000).toLocaleString(undefined, { maximumFractionDigits: 3 })} kV/mm`;
}

function formatMargin(margin) {
  if (!Number.isFinite(margin)) return "--";
  if (margin >= 100) return `${margin.toLocaleString(undefined, { maximumFractionDigits: 0 })}×`;
  if (margin >= 10) return `${margin.toLocaleString(undefined, { maximumFractionDigits: 1 })}×`;
  return `${margin.toLocaleString(undefined, { maximumFractionDigits: 2 })}×`;
}

function washerElectrodeOverlapBounds(p) {
  const washerBounds = washerRadialBounds(p);
  const groundInner = p.ground_plate_inner_diameter_mm / 2;
  const hvOuter = p.hv_plate_od_mm / 2;
  const inner = Math.max(washerBounds.inner, groundInner);
  const outer = Math.min(washerBounds.outer, hvOuter);
  return {
    inner,
    outer,
    hasOverlap: washerBounds.hasWasher && outer > inner
  };
}

function parseFrequencyList(text) {
  const multipliers = { hz: 1, khz: 1e3, mhz: 1e6, ghz: 1e9 };
  const values = String(text).split(/[;,\n]+/).map((entry) => {
    const match = entry.trim().match(/^([+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*(hz|khz|mhz|ghz)?$/i);
    if (!match) return Number.NaN;
    return Number(match[1]) * multipliers[(match[2] || "hz").toLowerCase()];
  });
  if (values.some((value) => !Number.isFinite(value) || value <= 0 || value > 100e9)) return null;
  return [...new Set(values)].sort((left, right) => left - right).slice(0, 64);
}

function formatFrequencyList(values) {
  return (values || []).map((value) => formatFrequency(value)).join(", ");
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return "--";
  if (seconds < 90) return `${Math.max(1, Math.round(seconds))} s`;
  if (seconds < 2 * 60 * 60) return `${(seconds / 60).toLocaleString(undefined, { maximumFractionDigits: 1 })} min`;
  return `${(seconds / 3600).toLocaleString(undefined, { maximumFractionDigits: 1 })} h`;
}

function additionalGroundCapacitancePf(p) {
  return Math.max(0, Number(p.additional_ground_capacitance_pf) || 0);
}

function circuitEstimates(p) {
  const core = p.core_od_mm / 2;
  const groundInner = p.ground_plate_inner_diameter_mm / 2;
  const overlapBounds = washerElectrodeOverlapBounds(p);
  const overlapArea = overlapBounds.hasOverlap
    ? Math.PI * Math.max(0, overlapBounds.outer ** 2 - overlapBounds.inner ** 2)
    : 0;
  const pairCapPf = parallelPlateCapacitancePf(p.washer_epsr, overlapArea, p.plate_gap_mm);
  const fr4PairCapPf = parallelPlateCapacitancePf(FR4_WASHER_EPSR, overlapArea, p.plate_gap_mm);
  const geometricShuntCapPf = 2 * pairCapPf;
  const addedGroundCapPf = additionalGroundCapacitancePf(p);
  const shuntCapPf = geometricShuntCapPf + addedGroundCapPf;
  const totalGroundCapPf = Math.max(1, Math.floor(p.plate_pairs)) * shuntCapPf;

  const biasBiasSeparation = groundPlateThicknessMm(p) + 2 * p.plate_gap_mm;
  const ferriteArea = Math.PI * core ** 2;
  const coreEpoxyArea = Math.PI * Math.max(0, groundInner ** 2 - core ** 2);
  const coreEpsr = coreCapacitanceEpsr(p);
  const ferriteParasiticPf = parallelPlateCapacitancePf(coreEpsr, ferriteArea, biasBiasSeparation);
  const epoxyParasiticPf = parallelPlateCapacitancePf(p.epoxy_epsr, coreEpoxyArea, biasBiasSeparation);
  const directParasiticPf = directStageParasiticPf(p);
  const parasiticPf = p.plate_pairs > 1
    ? (usesDirectStageCapacitance(p) ? directParasiticPf + epoxyParasiticPf : ferriteParasiticPf + epoxyParasiticPf)
    : Number.NaN;

  const totalResistanceOhm = totalCoreResistanceOhm(p);
  // Adjacent bias plates are separated by the dielectric gap, the intervening
  // ground-plate thickness, and the second dielectric gap. Do not include the
  // bias-plate thickness itself here: the bias plate shorts that core section
  // to the bias node, so it is not part of the bias-to-bias stage resistance.
  // For discrete MELF resistor stages, the app uses the entered per-stage
  // resistance instead of inventing an effective bulk resistivity.
  const stageResistanceOhm = stageResistanceOhmForCircuit(p, biasBiasSeparation);
  const cornerHz = Number.isFinite(stageResistanceOhm) && shuntCapPf > 0
    ? 1 / (2 * Math.PI * stageResistanceOhm * shuntCapPf * 1e-12)
    : Number.NaN;
  const parasiticTakeoverHz = Number.isFinite(stageResistanceOhm) && parasiticPf > 0
    ? 1 / (2 * Math.PI * stageResistanceOhm * parasiticPf * 1e-12)
    : Number.NaN;

  return {
    pairCapPf,
    geometricShuntCapPf,
    additionalGroundCapacitancePf: addedGroundCapPf,
    shuntCapPf,
    totalGroundCapPf,
    parasiticPf,
    directParasiticPf,
    ferriteParasiticPf,
    coreParasiticPf: ferriteParasiticPf,
    coreCapacitanceEpsr: coreEpsr,
    epoxyParasiticPf,
    parasiticRatio: parasiticPf / shuntCapPf,
    washerCapGain: pairCapPf / fr4PairCapPf,
    totalResistanceOhm,
    stageResistanceOhm,
    cornerHz,
    parasiticTakeoverHz
  };
}

function normalizedCapacitancePayload(payload) {
  if (!payload || typeof payload !== "object") return null;
  const totalPf = Number(payload.totalPf ?? payload.total_pf ?? payload.biasToGroundPf ?? payload.bias_to_ground_pf);
  if (!(totalPf > 0)) return null;
  const parasiticPf = Number(
    payload.parasiticPf
      ?? payload.parasitic_pf
      ?? payload.adjacentBiasPf
      ?? payload.adjacent_bias_pf
      ?? payload.biasToBiasPf
      ?? payload.bias_to_bias_pf
  );
  return {
    totalPf,
    parasiticPf: Number.isFinite(parasiticPf) && parasiticPf >= 0 ? parasiticPf : Number.NaN,
    network: payload.capacitanceNetwork ?? payload.capacitance_network ?? null,
    parasiticEstimate: payload.parasiticEstimate ?? payload.parasitic_estimate ?? null,
    groundComparison: payload.biasToGroundComparison ?? payload.bias_to_ground_comparison ?? null,
    cgMatrixComparison: payload.cgMatrixPlateCountComparison ?? payload.cg_matrix_plate_count_comparison ?? null,
    method: payload.method || payload.source || "field solve",
    energyJoules: Number(payload.energyJoules ?? payload.energy_joules),
    voltageV: Number(payload.voltageV ?? payload.voltage_v)
  };
}

function solvedCapacitanceForCurrentDesign() {
  if (lastResult?.parameterKey !== comparableResultParameters(params)) return null;
  return normalizedCapacitancePayload(lastResult.capacitance);
}

function capacitanceForAdmittance(circuit, p) {
  const solved = solvedCapacitanceForCurrentDesign();
  const addedTotalPf = biasPlateCount(p) * additionalGroundCapacitancePf(p);
  if (solved) {
    return {
      capacitancePf: solved.totalPf + addedTotalPf,
      sourceLabel: `${solved.method === "fenicsx-energy" ? "FEniCSx energy" : solved.method} + added Cg`
    };
  }
  return {
    capacitancePf: circuit.totalGroundCapPf,
    sourceLabel: `${2 * Math.max(1, Math.floor(p.plate_pairs))} ${translateText("x washer C est.")} + added Cg`
  };
}

function loadConductanceS(p) {
  const currentA = Math.max(0, Number(p.load_current_na) || 0) * 1e-9;
  const voltage = Math.abs(Number(p.bias_voltage_v) || 0);
  return voltage > 0 ? currentA / voltage : 0;
}

function cableCapacitancePf(p) {
  const lengthM = Math.max(0, Number(p.load_cable_length_m) || 0);
  const impedanceOhm = Math.max(1e-9, Number(p.load_cable_impedance_ohm) || 0);
  const velocityFactor = Math.max(1e-9, Number(p.load_cable_velocity_factor) || 0);
  return lengthM / (impedanceOhm * velocityFactor * SPEED_OF_LIGHT_M_PER_S) * 1e12;
}

function detectorCapacitancePf(p) {
  return Math.max(0, Number(p.detector_capacitance_pf) || 0);
}

function loadCapacitancePf(p) {
  return cableCapacitancePf(p) + detectorCapacitancePf(p);
}

function loadAdmittanceAtFrequency(p, frequencyHz) {
  return c(
    loadConductanceS(p),
    2 * Math.PI * frequencyHz * loadCapacitancePf(p) * 1e-12
  );
}

function admittanceAtFrequency(capacitancePf, p, frequencyHz) {
  const conductanceS = loadConductanceS(p);
  const susceptanceS = 2 * Math.PI * frequencyHz * Math.max(0, capacitancePf || 0) * 1e-12;
  const magnitudeS = Math.hypot(conductanceS, susceptanceS);
  return {
    frequencyHz,
    capacitancePf,
    conductanceS,
    susceptanceS,
    magnitudeS,
    phaseDeg: magnitudeS > 0 ? Math.atan2(susceptanceS, conductanceS) * 180 / Math.PI : Number.NaN,
    loadResistanceOhm: conductanceS > 0 ? 1 / conductanceS : Number.POSITIVE_INFINITY
  };
}

function singleStageTransferMagnitude(circuit, frequencyHz, loadConductance = 0, loadCapPf = 0) {
  if (!Number.isFinite(circuit.stageResistanceOhm) || !(circuit.stageResistanceOhm > 0)) {
    return Number.NaN;
  }
  const shuntCapPf = Math.max(0, circuit.shuntCapPf || 0);
  const loadConductanceS = Math.max(0, Number(loadConductance) || 0);
  const externalCapPf = Math.max(0, Number(loadCapPf) || 0);
  if (!(shuntCapPf > 0) && !(loadConductanceS > 0) && !(externalCapPf > 0)) return Number.NaN;
  const omega = 2 * Math.PI * frequencyHz;
  const yR = 1 / circuit.stageResistanceOhm;
  const yPar = c(yR, omega * Math.max(0, circuit.parasiticPf || 0) * 1e-12);
  const yGround = c(loadConductanceS, omega * (shuntCapPf + externalCapPf) * 1e-12);
  return cAbs(cDiv(yPar, cAdd(yPar, yGround)));
}

function attenuationDbFromMagnitude(magnitude) {
  if (!Number.isFinite(magnitude) || magnitude <= 0) return Number.NaN;
  return -20 * Math.log10(Math.max(1e-12, magnitude));
}

function singleStageAttenuationDb(circuit, frequencyHz, loadConductance = 0, loadCapPf = 0) {
  return attenuationDbFromMagnitude(singleStageTransferMagnitude(circuit, frequencyHz, loadConductance, loadCapPf));
}

function highFrequencyCapRatioAttenuationDb(circuit) {
  return circuit.parasiticRatio > 0 && circuit.parasiticRatio < 1
    ? -20 * Math.log10(circuit.parasiticRatio)
    : Number.NaN;
}

function rfFrequencyHzFromLogMhz(logMhz) {
  return (10 ** logMhz) * 1e6;
}

function conductorElectricalValues(p, prefix) {
  const conductivity = 10 ** p[`${prefix}_conductivity_log10_s_per_m`];
  const mur = p[`${prefix}_relative_permeability`];
  return { conductivity, mur };
}

function skinDepthMm(frequencyHz, conductivity, mur) {
  if (!(frequencyHz > 0) || !(conductivity > 0) || !(mur > 0)) return Number.NaN;
  return Math.sqrt(2 / (2 * Math.PI * frequencyHz * MU_0_H_PER_M * mur * conductivity)) * 1000;
}

function rfMaterialEstimates(p) {
  const frequencyHz = rfFrequencyHzFromLogMhz(p.rf_compare_frequency_log10_mhz);
  const plate = conductorElectricalValues(p, "plate");
  const tube = conductorElectricalValues(p, "tube");
  return {
    frequencyHz,
    plate: {
      ...plate,
      material: conductorMaterialPresets[p.plate_material]?.label || "Custom",
      skinDepthMm: skinDepthMm(frequencyHz, plate.conductivity, plate.mur)
    },
    tube: {
      ...tube,
      material: conductorMaterialPresets[p.tube_material]?.label || "Custom",
      skinDepthMm: skinDepthMm(frequencyHz, tube.conductivity, tube.mur)
    }
  };
}

function roundedOuterPlate(p, r, z, zc, rInner, rOuter) {
  const half = biasPlateThicknessMm(p) / 2;
  if (z < zc - half || z > zc + half || r < rInner || r > rOuter) return false;
  const rad = Math.max(0, Math.min(edgeRadiusMm(p, "hv"), half, (rOuter - rInner) / 2));
  if (rad === 0) return true;
  const dz = Math.abs(z - zc);
  if (r <= rOuter - rad || dz <= half - rad) return true;
  return (r - (rOuter - rad)) ** 2 + (dz - (half - rad)) ** 2 <= rad ** 2;
}

function roundedInnerPlate(p, r, z, zc, rInner, rOuter) {
  const half = groundPlateThicknessMm(p) / 2;
  if (z < zc - half || z > zc + half || r < rInner || r > rOuter) return false;
  const rad = Math.max(0, Math.min(edgeRadiusMm(p, "ground"), half, (rOuter - rInner) / 2));
  if (rad === 0) return true;
  const dz = Math.abs(z - zc);
  if (r >= rInner + rad || dz <= half - rad) return true;
  return (r - (rInner + rad)) ** 2 + (dz - (half - rad)) ** 2 <= rad ** 2;
}

function roundedOuterProfile(rInner, rOuter, z0, z1, radius, steps = 8) {
  const rad = Math.max(0, Math.min(radius, (z1 - z0) / 2, (rOuter - rInner) / 2));
  if (rad === 0) return [[rInner, z0], [rOuter, z0], [rOuter, z1], [rInner, z1]];
  const points = [[rInner, z0], [rOuter - rad, z0]];
  let cx = rOuter - rad;
  let cz = z0 + rad;
  for (let step = 1; step <= steps; step += 1) {
    const theta = -Math.PI / 2 + (Math.PI / 2) * step / steps;
    points.push([cx + rad * Math.cos(theta), cz + rad * Math.sin(theta)]);
  }
  points.push([rOuter, z1 - rad]);
  cz = z1 - rad;
  for (let step = 1; step <= steps; step += 1) {
    const theta = (Math.PI / 2) * step / steps;
    points.push([cx + rad * Math.cos(theta), cz + rad * Math.sin(theta)]);
  }
  points.push([rInner, z1]);
  return points;
}

function roundedInnerProfile(rInner, rOuter, z0, z1, radius, steps = 8) {
  const rad = Math.max(0, Math.min(radius, (z1 - z0) / 2, (rOuter - rInner) / 2));
  if (rad === 0) return [[rInner, z0], [rOuter, z0], [rOuter, z1], [rInner, z1]];
  const points = [[rInner + rad, z0], [rOuter, z0], [rOuter, z1], [rInner + rad, z1]];
  let cx = rInner + rad;
  let cz = z1 - rad;
  for (let step = 1; step <= steps; step += 1) {
    const theta = Math.PI / 2 + (Math.PI / 2) * step / steps;
    points.push([cx + rad * Math.cos(theta), cz + rad * Math.sin(theta)]);
  }
  points.push([rInner, z0 + rad]);
  cz = z0 + rad;
  for (let step = 1; step <= steps; step += 1) {
    const theta = Math.PI + (Math.PI / 2) * step / steps;
    points.push([cx + rad * Math.cos(theta), cz + rad * Math.sin(theta)]);
  }
  return points;
}

function componentProfiles(p) {
  const length = stackLength(p);
  const core = p.core_od_mm / 2;
  const hvOuter = p.hv_plate_od_mm / 2;
  const groundInner = p.ground_plate_inner_diameter_mm / 2;
  const groundOuter = p.ground_plate_od_mm / 2;
  const tubeInner = p.tube_id_mm / 2;
  const tubeOuter = tubeInner + p.tube_wall_thickness_mm;
  const washerBounds = washerRadialBounds(p);
  const components = [
    { name: epoxyComponentName(p), material: "epoxy", color: "#9bc6c2", alpha: 0.16, profile: [[core, 0], [tubeInner, 0], [tubeInner, length], [core, length]] }
  ];
  coreSegmentIntervals(p).forEach(([z0, z1], index) => {
    components.push({
      name: `${coreComponentName(p)} segment ${index + 1}`,
      material: "ferrite",
      color: "#8a5b30",
      alpha: 0.72,
      profile: [[0, z0], [core, z0], [core, z1], [0, z1]]
    });
  });
  if (!washerUsesEpoxy(p) && washerBounds.hasWasher) {
    washerGapIntervals(p).forEach(([z0, z1], index) => {
      components.push({
        name: `${washerComponentName(p)} ${index + 1}`,
        material: "washer",
        color: "#d6b75d",
        alpha: 0.45,
        profile: [[washerBounds.inner, z0], [washerBounds.outer, z0], [washerBounds.outer, z1], [washerBounds.inner, z1]]
      });
    });
  }
  if (p.include_ground_tube) {
    components.push({ name: `${tubeConductorName(p)} grounded tube`, material: "ground", color: "#384b2b", alpha: 0.98, profile: [[tubeInner, 0], [tubeOuter, 0], [tubeOuter, length], [tubeInner, length]] });
  }
  for (const [kind, zc] of plateCenters(p)) {
    const half = plateThicknessMm(p, kind) / 2;
    const z0 = zc - half;
    const z1 = zc + half;
    if (kind === "hv") {
      components.push({
        name: `${plateConductorName(p)} HV plate`,
        material: "hv",
        color: "#b73e3e",
        alpha: 1,
        profile: roundedOuterProfile(0, hvOuter, z0, z1, edgeRadiusMm(p, "hv"))
      });
    } else {
      components.push({
        name: `${plateConductorName(p)} ground plate`,
        material: "ground",
        color: "#557a38",
        alpha: 1,
        profile: roundedInnerProfile(groundInner, groundOuter, z0, z1, edgeRadiusMm(p, "ground"))
      });
    }
  }
  return components;
}

function materialEpsr(p, r, zStack = null) {
  // The browser fallback treats the washer as flat annular slabs between
  // adjacent plate faces, bounded by the explicit washer ID/OD. The core body
  // is not a dielectric region in this solve; classifyPoint() fixes it at the
  // HV potential before the material map is consulted.
  const region = materialRegion(p, r, zStack);
  if (region === "washer") return p.washer_epsr;
  return p.epoxy_epsr;
}

function coth(value) {
  return 1 / Math.tanh(value);
}

function analyticClearanceCases(p) {
  const core = p.core_od_mm / 2;
  const groundInner = p.ground_plate_inner_diameter_mm / 2;
  const hvOuter = p.hv_plate_od_mm / 2;
  const tubeInner = p.tube_id_mm / 2;
  const edgeRadius = Math.max(edgeRadiusMm(p), 0.001);
  const cases = [
    {
      id: "axial",
      label: "Axial plate gap",
      shortLabel: "Axial",
      clearance: p.plate_gap_mm,
      clearanceLabel: "axial plate",
      innerConductorRadius: Number.NaN,
      edgeMajorRadius: Number.NaN,
      note: "parallel plate baseline"
    },
    {
      id: "core",
      label: "Ground inner edge to HV core",
      shortLabel: "Core side",
      clearance: groundInner - core,
      clearanceLabel: "radial core-ground",
      innerConductorRadius: core,
      edgeMajorRadius: groundInner + edgeRadius,
      note: "smaller-radius coaxial gap"
    }
  ];
  if (p.include_ground_tube) {
    cases.push({
      id: "tube",
      label: "HV outer edge to ground tube",
      shortLabel: "Tube side",
      clearance: tubeInner - hvOuter,
      clearanceLabel: "radial HV-tube",
      innerConductorRadius: hvOuter,
      edgeMajorRadius: hvOuter - edgeRadius,
      note: "larger-radius coaxial gap"
    });
  }
  return cases.filter((entry) => Number.isFinite(entry.clearance) && entry.clearance > 0);
}

function nearestEdgeClearance(p) {
  const clearances = analyticClearanceCases(p)
    .map((entry) => ({ label: entry.clearanceLabel, value: entry.clearance }));
  return clearances
    .sort((a, b) => a.value - b.value)[0] || { label: "axial plate", value: p.plate_gap_mm };
}

function radiusGapBound(p) {
  const edgeRadius = Math.max(edgeRadiusMm(p), 0.001);
  const coreRadius = Number.isFinite(p.core_od_mm) && p.core_od_mm > 0
    ? p.core_od_mm / 2
    : defaults.core_od_mm / 2;
  const radius = [
    { label: "edge radius", value: edgeRadius },
    { label: "core radius", value: coreRadius }
  ]
    .filter((entry) => Number.isFinite(entry.value) && entry.value > 0)
    .sort((a, b) => a.value - b.value)[0] || { label: "edge radius", value: edgeRadius };
  const voltage = Number.isFinite(p.bias_voltage_v) ? p.bias_voltage_v : defaults.bias_voltage_v;
  const gaps = [
    { label: "plate gap", value: p.plate_gap_mm },
    { label: "core-ground", value: p.core_to_ground_gap_mm },
    { label: "HV-tube", value: p.hv_to_tube_gap_mm }
  ]
    .map((entry) => ({ ...entry, value: Number(entry.value) }))
    .filter((entry) => Number.isFinite(entry.value) && entry.value > 0)
    .sort((a, b) => a.value - b.value);
  const gap = gaps[0] || { label: "plate gap", value: defaults.plate_gap_mm };
  return {
    radius: radius.value,
    radiusLabel: radius.label,
    voltage,
    gap,
    field: voltage * (radius.value + gap.value) / (radius.value * gap.value),
    factor: (radius.value + gap.value) / radius.value
  };
}

function cylinderPlaneEdgeField(voltage, edgeRadius, clearance) {
  const xi = Math.acosh(1 + clearance / edgeRadius);
  return (voltage / (edgeRadius * xi)) * coth(xi / 2);
}

function coaxialShellEdgeField(voltage, edgeRadius, clearance) {
  return voltage / (edgeRadius * Math.log1p(clearance / edgeRadius));
}

function sphereShellEdgeField(voltage, edgeRadius, clearance) {
  return voltage * (edgeRadius + clearance) / (edgeRadius * clearance);
}

function coaxialRadialField(voltage, innerRadius, clearance) {
  if (!(innerRadius > 0) || !(clearance > 0)) return Number.NaN;
  return voltage / (innerRadius * Math.log1p(clearance / innerRadius));
}

function analyticCaseEstimate(p, entry, edgeRadius) {
  const gap = Math.max(entry.clearance, 0.001);
  const idealField = p.bias_voltage_v / gap;
  const cylinderPlaneField = cylinderPlaneEdgeField(p.bias_voltage_v, edgeRadius, gap);
  const coaxialShellField = coaxialShellEdgeField(p.bias_voltage_v, edgeRadius, gap);
  const sphereShellField = sphereShellEdgeField(p.bias_voltage_v, edgeRadius, gap);
  const coaxialField = coaxialRadialField(p.bias_voltage_v, entry.innerConductorRadius, gap);
  const edgeCylinderField = Math.max(cylinderPlaneField, coaxialShellField);
  const torusRatio = Number.isFinite(entry.edgeMajorRadius) ? entry.edgeMajorRadius / edgeRadius : Number.NaN;
  const estimatedField = sphereShellField;
  return {
    ...entry,
    clearance: { label: entry.clearanceLabel, value: entry.clearance },
    idealField,
    cylinderPlaneField,
    coaxialShellField,
    sphereShellField,
    edgeCylinderField,
    coaxialField,
    torusRatio,
    radiusGapBoundField: sphereShellField,
    estimatedField,
    edgeFactor: estimatedField / idealField
  };
}

function analyticEdgeEstimate(p) {
  const edgeRadius = Math.max(edgeRadiusMm(p), 0.001);
  const cases = analyticClearanceCases(p).map((entry) => analyticCaseEstimate(p, entry, edgeRadius));
  const controlling = cases
    .slice()
    .sort((a, b) => b.estimatedField - a.estimatedField)[0]
    || analyticCaseEstimate(p, {
      id: "axial",
      label: "Axial plate gap",
      shortLabel: "Axial",
      clearance: p.plate_gap_mm,
      clearanceLabel: "axial plate",
      innerConductorRadius: Number.NaN,
      edgeMajorRadius: Number.NaN,
      note: "parallel plate baseline"
    }, edgeRadius);
  return {
    cases,
    controlling,
    clearance: controlling.clearance,
    idealField: controlling.idealField,
    edgeFactor: controlling.edgeFactor,
    estimatedField: controlling.estimatedField,
    cylinderPlaneField: controlling.cylinderPlaneField,
    coaxialShellField: controlling.coaxialShellField,
    sphereShellField: controlling.sphereShellField,
    edgeCylinderField: controlling.edgeCylinderField,
    coaxialField: controlling.coaxialField,
    torusRatio: controlling.torusRatio
  };
}

function classifyPoint(p, r, z) {
  // This function is the "geometry sampler" used by the field solver. At each
  // r-z grid node it decides whether that node is a fixed-potential conductor
  // or a free dielectric node whose voltage should be solved.
  //
  // Important limitation: the rounded plate profiles are sampled on a
  // structured r-z grid. There is no conforming mesh, no curved finite
  // elements, and no sub-cell boundary reconstruction. The grid is locally
  // refined around rounded edges, but peak fields are still screening numbers.
  const core = p.core_od_mm / 2;
  const hvOuter = p.hv_plate_od_mm / 2;
  const groundInner = p.ground_plate_inner_diameter_mm / 2;
  const groundOuter = p.ground_plate_od_mm / 2;
  const tubeInner = p.tube_id_mm / 2;
  const tubeOuter = tubeInner + p.tube_wall_thickness_mm;
  const length = stackLength(p);
  const zStack = Math.max(0, Math.min(length, z));

  if (r <= core) return { kind: "hv", value: p.bias_voltage_v };
  if (p.include_ground_tube && r >= tubeInner) return { kind: "ground", value: 0 };

  for (const [kind, zc] of plateCenters(p)) {
    if (kind === "hv" && roundedOuterPlate(p, r, zStack, zc, 0, hvOuter)) {
      return { kind: "hv", value: p.bias_voltage_v };
    }
    if (kind === "ground" && roundedInnerPlate(p, r, zStack, zc, groundInner, groundOuter)) {
      return { kind: "ground", value: 0 };
    }
  }
  return { kind: "dielectric", value: null };
}

function geometryBounds(p) {
  const length = stackLength(p);
  const rMax = p.tube_id_mm / 2 + p.tube_wall_thickness_mm + p.domain_margin_mm;
  return { length, rMax, zMin: -p.domain_margin_mm, zMax: length + p.domain_margin_mm };
}

function setupControlTabs() {
  const tabs = Array.from(document.querySelectorAll(".control-tab"));
  const panels = Array.from(document.querySelectorAll(".control-panel"));
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const selected = tab.dataset.controlTab;
      tabs.forEach((candidate) => {
        const active = candidate === tab;
        candidate.classList.toggle("active", active);
        candidate.setAttribute("aria-selected", active ? "true" : "false");
      });
      panels.forEach((panel) => {
        const active = panel.dataset.controlPanel === selected;
        panel.hidden = !active;
        panel.classList.toggle("active", active);
      });
    });
  });
}

function setupControls() {
  setupControlTabs();

  const coreMaterial = document.getElementById("core_material");
  coreMaterial.value = params.core_material;
  coreMaterial.addEventListener("change", () => {
    params.core_material = coreMaterial.value;
    const preset = coreMaterialPresets[params.core_material];
    if (preset) {
      params.ferrite_epsr = preset.epsr;
      params.core_volume_resistivity_log10_ohm_cm = preset.resistivityLog10;
      params.use_direct_stage_circuit = Boolean(preset.defaultDirectStageResistance);
      params.use_direct_stage_capacitance = Boolean(preset.defaultDirectStageCapacitance);
      applyDirectStageDefaultsForMaterial(params);
      if (params.use_package_core_od && Number.isFinite(preset.coreOdMm)) params.core_od_mm = preset.coreOdMm;
    }
    normalizeParams();
    syncControls();
    drawCadModel();
    drawGeometry();
    clearField();
  });

  const washerMaterial = document.getElementById("washer_material");
  washerMaterial.value = params.washer_material;
  washerMaterial.addEventListener("change", () => {
    params.washer_material = washerMaterial.value;
    const preset = washerMaterialPresets[params.washer_material];
    if (washerUsesEpoxy(params)) params.washer_epsr = params.epoxy_epsr;
    else if (preset) params.washer_epsr = preset.epsr;
    thermalFeaError = null;
    normalizeParams();
    syncControls();
    drawCadModel();
    drawGeometry();
    clearField();
  });

  const epoxyMaterial = document.getElementById("epoxy_material");
  epoxyMaterial.value = params.epoxy_material;
  epoxyMaterial.addEventListener("change", () => {
    params.epoxy_material = epoxyMaterial.value;
    const preset = epoxyMaterialPresets[params.epoxy_material];
    if (preset) params.epoxy_epsr = preset.epsr;
    if (washerUsesEpoxy(params)) params.washer_epsr = params.epoxy_epsr;
    thermalFeaError = null;
    normalizeParams();
    syncControls();
    drawCadModel();
    drawGeometry();
    clearField();
  });

  const plateMaterial = document.getElementById("plate_material");
  plateMaterial.value = params.plate_material;
  plateMaterial.addEventListener("change", () => {
    params.plate_material = plateMaterial.value;
    const preset = conductorMaterialPresets[params.plate_material];
    if (preset) {
      params.plate_conductivity_log10_s_per_m = Math.log10(preset.conductivity);
      params.plate_relative_permeability = preset.mur;
    }
    normalizeParams();
    syncControls();
    clearField();
  });

  const tubeMaterial = document.getElementById("tube_material");
  tubeMaterial.value = params.tube_material;
  tubeMaterial.addEventListener("change", () => {
    params.tube_material = tubeMaterial.value;
    const preset = conductorMaterialPresets[params.tube_material];
    if (preset) {
      params.tube_conductivity_log10_s_per_m = Math.log10(preset.conductivity);
      params.tube_relative_permeability = preset.mur;
    }
    normalizeParams();
    syncControls();
    clearField();
  });

  const fieldSolver = document.getElementById("field_solver");
  fieldSolver.value = params.field_solver;
  fieldSolver.addEventListener("change", () => {
    params.field_solver = fieldSolver.value;
    clearField();
  });

  const repeatingCellApproximation = document.getElementById("use_repeating_cell_approximation");
  repeatingCellApproximation.checked = params.use_repeating_cell_approximation;
  repeatingCellApproximation.addEventListener("change", () => {
    params.use_repeating_cell_approximation = repeatingCellApproximation.checked;
    params.solve_strategy = repeatingCellApproximation.checked ? "end_repeat_approx" : "mirror_half";
    clearField();
  });

  const directStageCircuit = document.getElementById("use_direct_stage_circuit");
  directStageCircuit.checked = params.use_direct_stage_circuit;
  directStageCircuit.addEventListener("change", () => {
    params.use_direct_stage_circuit = directStageCircuit.checked;
    if (params.use_direct_stage_circuit) applyDirectStageDefaultsForMaterial(params);
    normalizeParams();
    syncControls();
    drawCadModel();
    drawGeometry();
    clearField();
  });

  const directStageCapacitance = document.getElementById("use_direct_stage_capacitance");
  directStageCapacitance.checked = params.use_direct_stage_capacitance;
  directStageCapacitance.addEventListener("change", () => {
    params.use_direct_stage_capacitance = directStageCapacitance.checked;
    if (params.use_direct_stage_capacitance) applyDirectStageDefaultsForMaterial(params);
    normalizeParams();
    syncControls();
    clearField();
  });

  const groundMatchesBiasThickness = document.getElementById("ground_matches_bias_thickness");
  groundMatchesBiasThickness.checked = params.ground_matches_bias_thickness;
  groundMatchesBiasThickness.addEventListener("change", () => {
    params.ground_matches_bias_thickness = groundMatchesBiasThickness.checked;
    if (params.ground_matches_bias_thickness) {
      params.ground_plate_thickness_mm = params.bias_plate_thickness_mm;
    }
    normalizeParams();
    syncControls();
    drawCadModel();
    drawGeometry();
    clearField();
  });

  const usePackageCoreOd = document.getElementById("use_package_core_od");
  usePackageCoreOd.checked = params.use_package_core_od;
  usePackageCoreOd.addEventListener("change", () => {
    params.use_package_core_od = usePackageCoreOd.checked;
    const packageDiameter = packageCoreOdMm(params);
    if (params.use_package_core_od && packageDiameter !== null) {
      params.core_od_mm = packageDiameter;
    }
    normalizeParams();
    syncControls();
    drawCadModel();
    drawGeometry();
    clearField();
  });

  const inputSeriesMatchesStage = document.getElementById("input_series_matches_stage");
  inputSeriesMatchesStage.checked = params.input_series_matches_stage;
  inputSeriesMatchesStage.addEventListener("change", () => {
    params.input_series_matches_stage = inputSeriesMatchesStage.checked;
    normalizeParams();
    syncControls();
    clearField();
  });

  const outputSeriesMatchesStage = document.getElementById("output_series_matches_stage");
  outputSeriesMatchesStage.checked = params.output_series_matches_stage;
  outputSeriesMatchesStage.addEventListener("change", () => {
    params.output_series_matches_stage = outputSeriesMatchesStage.checked;
    normalizeParams();
    syncControls();
    clearField();
  });

  const washerIdMode = document.getElementById("washer_id_mode");
  washerIdMode.value = params.washer_id_mode;
  washerIdMode.addEventListener("change", () => {
    params.washer_id_mode = washerIdMode.value;
    normalizeParams();
    syncControls();
    drawCadModel();
    drawGeometry();
    clearField();
  });

  const washerOdMode = document.getElementById("washer_od_mode");
  washerOdMode.value = params.washer_od_mode;
  washerOdMode.addEventListener("change", () => {
    params.washer_od_mode = washerOdMode.value;
    normalizeParams();
    syncControls();
    drawCadModel();
    drawGeometry();
    clearField();
  });

  for (const id of ids) {
    const input = document.getElementById(id);
    setupManualControlInput(id);
    input.value = params[id];
    input.addEventListener("input", () => {
      applyControlValue(id, input.value);
    });
  }
  for (const [id, key] of [
    ["full_wave_eqs_frequencies", "full_wave_eqs_frequencies_hz"],
    ["full_wave_frequencies", "full_wave_frequencies_hz"]
  ]) {
    const input = document.getElementById(id);
    input.addEventListener("change", () => {
      const parsed = parseFrequencyList(input.value);
      if (!parsed?.length) {
        input.setCustomValidity("Enter comma-separated positive frequencies using Hz, kHz, MHz, or GHz.");
        input.reportValidity();
        return;
      }
      input.setCustomValidity("");
      params[key] = parsed;
      normalizeParams();
      syncControls();
    });
  }
  const verifyResonances = document.getElementById("full_wave_verify_resonances");
  verifyResonances.checked = params.full_wave_verify_resonances;
  verifyResonances.addEventListener("change", () => {
    params.full_wave_verify_resonances = verifyResonances.checked;
    fullWaveCache = null;
    normalizeParams();
    syncControls();
    updateFullWaveReadouts();
  });
  const tube = document.getElementById("include_ground_tube");
  tube.checked = params.include_ground_tube;
  tube.addEventListener("change", () => {
    params.include_ground_tube = tube.checked;
    drawCadModel();
    drawGeometry();
    clearField();
  });
  document.getElementById("solve").addEventListener("click", () => {
    solveAndDraw();
  });
  document.getElementById("solveThermalFea").addEventListener("click", () => {
    solveThermalFea();
  });
  document.getElementById("solveFullWave").addEventListener("click", () => {
    solveFullWave();
  });
  document.getElementById("reset").addEventListener("click", () => {
    replaceCustomControlRanges(installationDefaultControlRanges);
    params = structuredClone(installationDefaults);
    lastResult = null;
    fullWaveCache = null;
    normalizeParams();
    loadBundledDefaultFieldResult();
    loadBundledDefaultFullWaveResult();
    syncControls();
    drawCadModel();
    drawGeometry();
    if (lastResult) drawSolvedResult(lastResult);
    else clearField();
    setSettingsStatus(`Reset to ${installationDefaultSource}.`);
  });
  document.getElementById("exportSettings").addEventListener("click", () => {
    exportSettingsToFile();
  });
  document.getElementById("downloadInstallationDefault").addEventListener("click", () => {
    downloadInstallationDefault();
  });
  const settingsFile = document.getElementById("settingsFile");
  document.getElementById("importSettings").addEventListener("click", () => {
    settingsFile.click();
  });
  settingsFile.addEventListener("change", () => {
    importSettingsFromFile(settingsFile.files?.[0]);
    settingsFile.value = "";
  });
}

function setupCadViewer() {
  const canvas = document.getElementById("cadCanvas");
  const reset = document.getElementById("cadReset");
  const cutaway = document.getElementById("cadCutaway");
  const fill = document.getElementById("cadFill");
  const opacity = document.getElementById("cadFillOpacity");
  const opacityValue = document.getElementById("cadFillOpacityValue");
  let drag = null;

  const syncFillControls = () => {
    fill.classList.toggle("active", cadView.filled);
    fill.setAttribute("aria-pressed", cadView.filled ? "true" : "false");
    fill.textContent = translateText(cadView.filled ? "Filled" : "Surface");
    opacity.disabled = !cadView.filled;
    opacity.value = String(cadView.fillOpacity);
    opacityValue.value = `${Math.round(cadView.fillOpacity * 100)}%`;
  };

  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  canvas.addEventListener("pointerdown", (event) => {
    canvas.setPointerCapture(event.pointerId);
    drag = {
      x: event.clientX,
      y: event.clientY,
      mode: event.button === 2 || event.shiftKey ? "pan" : "rotate"
    };
    event.preventDefault();
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    drag.x = event.clientX;
    drag.y = event.clientY;
    if (drag.mode === "pan") {
      cadView.panX += dx;
      cadView.panY += dy;
    } else {
      cadView.yaw += dx * 0.008;
      cadView.pitch = Math.max(-1.2, Math.min(1.25, cadView.pitch + dy * 0.008));
    }
    drawCadModel();
  });
  canvas.addEventListener("pointerup", () => {
    drag = null;
  });
  canvas.addEventListener("pointercancel", () => {
    drag = null;
  });
  canvas.addEventListener("wheel", (event) => {
    cadView.zoom = Math.max(0.45, Math.min(2.8, cadView.zoom * Math.exp(-event.deltaY * 0.001)));
    drawCadModel();
    event.preventDefault();
  }, { passive: false });

  reset.addEventListener("click", () => {
    cadView = {
      ...structuredClone(defaultCadView),
      cutaway: cadView.cutaway,
      filled: cadView.filled,
      fillOpacity: cadView.fillOpacity
    };
    drawCadModel();
  });
  cutaway.addEventListener("click", () => {
    cadView.cutaway = !cadView.cutaway;
    cutaway.classList.toggle("active", cadView.cutaway);
    cutaway.textContent = translateText(cadView.cutaway ? "Cutaway" : "Full");
    drawCadModel();
  });
  fill.addEventListener("click", () => {
    cadView.filled = !cadView.filled;
    syncFillControls();
    drawCadModel();
  });
  opacity.addEventListener("input", () => {
    cadView.fillOpacity = Math.max(0.1, Math.min(1, Number(opacity.value) || 1));
    syncFillControls();
    drawCadModel();
  });
  cutaway.classList.toggle("active", cadView.cutaway);
  syncFillControls();
}

function normalizeParams() {
  delete params.noise_observed_resolution_fwhm_kev;
  delete params.noise_target_fano_fraction;
  if (washerUsesEpoxy(params)) params.washer_epsr = params.epoxy_epsr;
  const spacingRange = spacingRangeForWasher(params);
  params.use_package_core_od = params.use_package_core_od !== false;
  const packageDiameter = packageCoreOdMm(params);
  const genericRangeIds = [
    "bias_voltage_v",
    "core_volume_resistivity_log10_ohm_cm",
    "load_current_na",
    "load_cable_length_m",
    "load_cable_impedance_ohm",
    "load_cable_velocity_factor",
    "detector_capacitance_pf",
    "additional_ground_capacitance_pf",
    "noise_fano_factor",
    "input_series_resistance_mohm",
    "output_series_resistance_ohm",
    "ferrite_epsr",
    "ferrite_conductor_fill_factor",
    "melf_substrate_epsr",
    "melf_metal_fill_factor",
    "washer_epsr",
    "epoxy_epsr",
    "core_od_mm",
    "ground_plate_inner_diameter_mm",
    "tube_id_mm",
    "washer_id_mm",
    "washer_od_mm",
    "bias_plate_thickness_mm",
    "ground_plate_thickness_mm",
    "plate_pairs",
    "thermal_min_temperature_c",
    "thermal_epoxy_modulus_gpa",
    "thermal_restraint_factor",
    "thermal_mesh_size_mm",
    "full_wave_resolution_per_mm",
    "full_wave_timeout_hours"
  ];
  for (const id of ["thermal_min_temperature_c", "thermal_epoxy_modulus_gpa", "thermal_restraint_factor", "thermal_mesh_size_mm", "full_wave_resolution_per_mm", "full_wave_timeout_hours"]) {
    if (!Number.isFinite(params[id])) params[id] = defaults[id];
  }
  for (const key of ["full_wave_eqs_frequencies_hz", "full_wave_frequencies_hz"]) {
    const values = Array.isArray(params[key]) ? params[key] : defaults[key];
    params[key] = [...new Set(values.map(Number).filter((value) => Number.isFinite(value) && value > 0 && value <= 100e9))]
      .sort((left, right) => left - right)
      .slice(0, 64);
    if (!params[key].length) params[key] = [...defaults[key]];
  }
  for (const id of genericRangeIds) {
    const range = controlRange(id);
    params[id] = clamp(params[id], range.min, range.max);
  }
  if (params.use_package_core_od && packageDiameter !== null) {
    params.core_od_mm = packageDiameter;
  }
  params.plate_pairs = Math.round(params.plate_pairs);
  if (!Number.isFinite(params.melf_stage_resistance_mohm) && Number.isFinite(params.melf_stage_resistance_log10_ohm)) {
    params.melf_stage_resistance_mohm = (10 ** params.melf_stage_resistance_log10_ohm) / 1e6;
  }
  const edgeRange = controlRange("edge_diameter_percent", 0, 100);
  const rfRange = controlRange("rf_compare_frequency_log10_mhz", -3, 4);
  const melfRRange = controlRange("melf_stage_resistance_mohm", 1, 1000);
  const melfCRange = controlRange("melf_stage_parasitic_pf", 0.001, 5);
  const melfSubstrateRange = controlRange("melf_substrate_epsr", 3, 30);
  const melfFillRange = controlRange("melf_metal_fill_factor", 0, 0.9);
  const ferriteFillRange = controlRange("ferrite_conductor_fill_factor", 0, 0.9);
  const inputSeriesRange = controlRange("input_series_resistance_mohm", 0, 1000);
  const outputSeriesRange = controlRange("output_series_resistance_ohm", 0, 1000);
  const plateSigmaRange = controlRange("plate_conductivity_log10_s_per_m", 5, 8.2);
  const tubeSigmaRange = controlRange("tube_conductivity_log10_s_per_m", 5, 8.2);
  const plateMuRange = controlRange("plate_relative_permeability", 1, 50);
  const tubeMuRange = controlRange("tube_relative_permeability", 1, 50);
  const meshRatioRange = controlRange("mesh_edge_radius_ratio", 0.05, 0.5);
  params.use_direct_stage_circuit = Boolean(params.use_direct_stage_circuit);
  params.use_direct_stage_capacitance = Boolean(params.use_direct_stage_capacitance);
  params.ground_matches_bias_thickness = Boolean(params.ground_matches_bias_thickness);
  params.input_series_matches_stage = params.input_series_matches_stage !== false;
  params.output_series_matches_stage = Boolean(params.output_series_matches_stage);
  params.full_wave_verify_resonances = Boolean(params.full_wave_verify_resonances);
  params.use_repeating_cell_approximation = Boolean(params.use_repeating_cell_approximation || params.solve_strategy === "end_repeat_approx");
  params.solve_strategy = params.use_repeating_cell_approximation ? "end_repeat_approx" : "mirror_half";
  params.washer_id_mode = WASHER_ID_MODES.has(params.washer_id_mode) ? params.washer_id_mode : "ground_id";
  params.washer_od_mode = WASHER_OD_MODES.has(params.washer_od_mode) ? params.washer_od_mode : "bias_od";
  if (params.ground_matches_bias_thickness) {
    params.ground_plate_thickness_mm = params.bias_plate_thickness_mm;
  }
  params.edge_diameter_percent = clamp(params.edge_diameter_percent, edgeRange.min, edgeRange.max);
  params.rf_compare_frequency_log10_mhz = clamp(params.rf_compare_frequency_log10_mhz, rfRange.min, rfRange.max);
  params.melf_stage_resistance_mohm = clamp(params.melf_stage_resistance_mohm, melfRRange.min, melfRRange.max);
  params.melf_stage_resistance_log10_ohm = Math.log10(params.melf_stage_resistance_mohm * 1e6);
  params.melf_stage_parasitic_pf = clamp(params.melf_stage_parasitic_pf, melfCRange.min, melfCRange.max);
  params.melf_substrate_epsr = clamp(params.melf_substrate_epsr, melfSubstrateRange.min, melfSubstrateRange.max);
  params.melf_metal_fill_factor = clamp(params.melf_metal_fill_factor, melfFillRange.min, melfFillRange.max);
  params.ferrite_conductor_fill_factor = clamp(
    params.ferrite_conductor_fill_factor,
    ferriteFillRange.min,
    ferriteFillRange.max
  );
  if (!Number.isFinite(params.input_series_resistance_mohm)) params.input_series_resistance_mohm = params.input_series_matches_stage ? matchedSeriesResistanceMohm(params) : 0;
  if (!Number.isFinite(params.output_series_resistance_ohm)) params.output_series_resistance_ohm = params.output_series_matches_stage ? matchedEndSeriesResistanceOhm(params) : 50;
  params.input_series_resistance_mohm = clamp(params.input_series_resistance_mohm, inputSeriesRange.min, inputSeriesRange.max);
  params.output_series_resistance_ohm = clamp(params.output_series_resistance_ohm, outputSeriesRange.min, outputSeriesRange.max);
  params.plate_conductivity_log10_s_per_m = clamp(params.plate_conductivity_log10_s_per_m, plateSigmaRange.min, plateSigmaRange.max);
  params.tube_conductivity_log10_s_per_m = clamp(params.tube_conductivity_log10_s_per_m, tubeSigmaRange.min, tubeSigmaRange.max);
  params.plate_relative_permeability = clamp(params.plate_relative_permeability, plateMuRange.min, plateMuRange.max);
  params.tube_relative_permeability = clamp(params.tube_relative_permeability, tubeMuRange.min, tubeMuRange.max);
  params.mesh_edge_radius_ratio = clamp(params.mesh_edge_radius_ratio, meshRatioRange.min, meshRatioRange.max);
  if (washerUsesEpoxy(params)) params.washer_epsr = params.epoxy_epsr;
  for (const id of hvSpacingControlIds) {
    const min = Math.max(spacingRange.min, minimumMelfPlateGapMm(params));
    const max = spacingRange.max;
    const range = controlRange(id, min, max);
    params[id] = clamp(params[id], range.min, range.max);
  }
  if (params.ground_matches_bias_thickness) {
    params.ground_plate_thickness_mm = params.bias_plate_thickness_mm;
  }

  applyDerivedGeometry(params);
  applyWasherGeometry(params);
  if (params.input_series_matches_stage) params.input_series_resistance_mohm = clamp(matchedSeriesResistanceMohm(params), inputSeriesRange.min, inputSeriesRange.max);
  if (params.output_series_matches_stage) params.output_series_resistance_ohm = matchedEndSeriesResistanceOhm(params);
  applyDerivedElectrical(params);
}

function syncCoreCircuitModeControls() {
  const directResistance = usesDirectStageCircuit(params);
  const directCapacitance = usesDirectStageCapacitance(params);
  const melf = usesMelfCoreModel(params);
  const coreResistivityControl = document.getElementById("core_resistivity_control");
  const directResistanceControl = document.getElementById("melf_stage_resistance_control");
  const coreEpsrControl = document.getElementById("core_epsr_control");
  const directCapacitanceControl = document.getElementById("melf_stage_parasitic_control");
  const ferriteFillControl = document.getElementById("ferrite_conductor_fill_factor_control");
  const melfControls = [
    document.getElementById("melf_substrate_epsr_control"),
    document.getElementById("melf_metal_fill_factor_control")
  ];
  const visibility = [
    [coreResistivityControl, !directResistance],
    [directResistanceControl, directResistance],
    [coreEpsrControl, !directCapacitance && !melf],
    [directCapacitanceControl, directCapacitance],
    [ferriteFillControl, supportsFerriteConductorFill(params) && (!directResistance || !directCapacitance)]
  ];
  for (const [label, visible] of visibility) {
    label.hidden = !visible;
    label.querySelectorAll("input").forEach((input) => {
      input.disabled = label.hidden;
    });
  }
  for (const label of melfControls) {
    label.hidden = !melf || directCapacitance;
    label.querySelectorAll("input").forEach((input) => {
      input.disabled = label.hidden;
    });
  }
}

function syncControls() {
  document.getElementById("core_material").value = params.core_material;
  document.getElementById("washer_material").value = params.washer_material;
  document.getElementById("epoxy_material").value = params.epoxy_material;
  document.getElementById("plate_material").value = params.plate_material;
  document.getElementById("tube_material").value = params.tube_material;
  document.getElementById("field_solver").value = params.field_solver;
  document.getElementById("use_repeating_cell_approximation").checked = params.use_repeating_cell_approximation;
  document.getElementById("use_direct_stage_circuit").checked = params.use_direct_stage_circuit;
  document.getElementById("use_direct_stage_capacitance").checked = params.use_direct_stage_capacitance;
  document.getElementById("use_package_core_od").checked = params.use_package_core_od;
  document.getElementById("ground_matches_bias_thickness").checked = params.ground_matches_bias_thickness;
  document.getElementById("input_series_matches_stage").checked = params.input_series_matches_stage;
  document.getElementById("output_series_matches_stage").checked = params.output_series_matches_stage;
  document.getElementById("full_wave_verify_resonances").checked = params.full_wave_verify_resonances;
  document.getElementById("washer_id_mode").value = params.washer_id_mode;
  document.getElementById("washer_od_mode").value = params.washer_od_mode;
  syncDynamicRanges();
  for (const id of ids) {
    if (isDynamicallyConstrainedControl(id)) continue;
    const base = defaultControlRanges[id];
    if (base) setRangeInputBounds(id, base.min, base.max, base.step);
  }
  for (const id of ids) {
    const input = document.getElementById(id);
    const output = document.getElementById(`${id}_out`);
    const manual = document.getElementById(`${id}_manual`);
    input.value = params[id];
    output.innerHTML = formatControlOutput(id, params[id]);
    if (manual) {
      manual.value = formatManualControlValue(id, params[id]);
      manual.min = input.min;
      manual.max = input.max;
      manual.step = input.step || "any";
    }
  }
  document.getElementById("full_wave_eqs_frequencies").value = formatFrequencyList(params.full_wave_eqs_frequencies_hz);
  document.getElementById("full_wave_frequencies").value = formatFrequencyList(params.full_wave_frequencies_hz);
  const groundThicknessInput = document.getElementById("ground_plate_thickness_mm");
  const groundThicknessManual = document.getElementById("ground_plate_thickness_mm_manual");
  if (groundThicknessInput) groundThicknessInput.disabled = params.ground_matches_bias_thickness;
  if (groundThicknessManual) groundThicknessManual.disabled = params.ground_matches_bias_thickness;
  const washerEpsrInput = document.getElementById("washer_epsr");
  const washerEpsrManual = document.getElementById("washer_epsr_manual");
  if (washerEpsrInput) washerEpsrInput.disabled = washerUsesEpoxy(params);
  if (washerEpsrManual) washerEpsrManual.disabled = washerUsesEpoxy(params);
  const packageDiameter = packageCoreOdMm(params);
  const packageCoreControl = document.getElementById("use_package_core_od_control");
  const coreOdInput = document.getElementById("core_od_mm");
  const coreOdManual = document.getElementById("core_od_mm_manual");
  packageCoreControl.hidden = packageDiameter === null;
  coreOdInput.disabled = params.use_package_core_od && packageDiameter !== null;
  if (coreOdManual) coreOdManual.disabled = coreOdInput.disabled;
  const inputSeriesInput = document.getElementById("input_series_resistance_mohm");
  const inputSeriesManual = document.getElementById("input_series_resistance_mohm_manual");
  const outputSeriesInput = document.getElementById("output_series_resistance_ohm");
  const outputSeriesManual = document.getElementById("output_series_resistance_ohm_manual");
  if (inputSeriesInput) inputSeriesInput.disabled = params.input_series_matches_stage;
  if (inputSeriesManual) inputSeriesManual.disabled = params.input_series_matches_stage;
  if (outputSeriesInput) outputSeriesInput.disabled = params.output_series_matches_stage;
  if (outputSeriesManual) outputSeriesManual.disabled = params.output_series_matches_stage;
  const washerIdInput = document.getElementById("washer_id_mm");
  const washerIdManual = document.getElementById("washer_id_mm_manual");
  const washerOdInput = document.getElementById("washer_od_mm");
  const washerOdManual = document.getElementById("washer_od_mm_manual");
  const groundIdInput = document.getElementById("ground_plate_inner_diameter_mm");
  const groundIdManual = document.getElementById("ground_plate_inner_diameter_mm_manual");
  const hvOdInput = document.getElementById("hv_plate_od_mm");
  const hvOdManual = document.getElementById("hv_plate_od_mm_manual");
  if (washerIdInput) washerIdInput.disabled = false;
  if (washerIdManual) washerIdManual.disabled = false;
  if (washerOdInput) washerOdInput.disabled = false;
  if (washerOdManual) washerOdManual.disabled = false;
  if (groundIdInput) groundIdInput.disabled = params.washer_id_mode !== "custom";
  if (groundIdManual) groundIdManual.disabled = params.washer_id_mode !== "custom";
  if (hvOdInput) hvOdInput.disabled = params.washer_od_mode !== "custom";
  if (hvOdManual) hvOdManual.disabled = params.washer_od_mode !== "custom";
  syncCoreCircuitModeControls();
  document.getElementById("core_resistance_gohm_out").textContent = formatResistance(totalCoreResistanceOhm(params));
  document.getElementById("core_to_ground_gap_mm_out").textContent = `${params.core_to_ground_gap_mm.toLocaleString(undefined, { maximumFractionDigits: 2 })} mm`;
  document.getElementById("hv_to_tube_gap_mm_out").textContent = `${params.hv_to_tube_gap_mm.toLocaleString(undefined, { maximumFractionDigits: 2 })} mm`;
  document.getElementById("ground_plate_od_mm_out").textContent = `${params.ground_plate_od_mm.toLocaleString(undefined, { maximumFractionDigits: 2 })} mm`;
  document.getElementById("include_ground_tube").checked = params.include_ground_tube;
  updateBreakdownReadouts();
  updateRfMaterialReadouts();
  updateEdgeEstimate();
  updateCircuitEstimates();
  updateThermalReadouts();
  updateFullWaveReadouts();
  drawSlideGraphics();
}

function updateBreakdownReadouts() {
  for (const definition of dielectricDefinitions(params)) {
    document.getElementById(`${definition.key}_breakdown_out`).textContent = formatKvPerMm(definition.breakdownKvPerMm);
  }
}

function updateEdgeEstimate() {
  const bound = radiusGapBound(params);
  document.getElementById("edgeApprox").textContent = `${(bound.field / 1000).toFixed(2)} kV/mm`;
  document.getElementById("edgeFactor").textContent = `${bound.factor.toFixed(2)}x`;
  document.getElementById("edgeGap").textContent =
    `${bound.gap.value.toFixed(2)} mm ${translateText(bound.gap.label)}`;
  document.getElementById("radiusGapBound").textContent =
    `E = V(r + d)/(r d), V ${bound.voltage.toFixed(0)} V, r ${bound.radius.toFixed(2)} mm ${bound.radiusLabel}, d ${bound.gap.value.toFixed(2)} mm`;
}

function updateCircuitEstimates() {
  const circuit = circuitEstimates(params);
  const admittanceCap = capacitanceForAdmittance(circuit, params);
  const feaCap = feaCapacitanceForCurrentDesign();
  const feaCircuit = feaCap?.network
    ? circuitWithFeaCapacitances(circuit, params, feaCap)
    : null;
  const cableCapPf = cableCapacitancePf(params);
  const detectorCapPf = detectorCapacitancePf(params);
  const externalLoadCapPf = cableCapPf + detectorCapPf;
  const admittance = admittanceAtFrequency(
    admittanceCap.capacitancePf + externalLoadCapPf,
    params,
    rfFrequencyHzFromLogMhz(params.rf_compare_frequency_log10_mhz)
  );
  document.getElementById("analyticStageCapacitance").textContent = formatCapacitance(circuit.geometricShuntCapPf);
  document.getElementById("shuntCapacitance").textContent = feaCircuit
    ? feaCircuit.geometricShuntCapPfByNode.map(formatCapacitance).join(", ")
    : translateText("not solved");
  document.getElementById("circuitShuntCapacitance").textContent = feaCircuit
    ? feaCircuit.shuntCapPfByNode.map(formatCapacitance).join(", ")
    : Array.from({ length: biasPlateCount(params) }, () => circuit.shuntCapPf).map(formatCapacitance).join(", ");
  document.getElementById("additionalGroundCapacitanceSummary").textContent =
    `+ ${formatCapacitance(additionalGroundCapacitancePf(params))} per node; Cpar unchanged`;
  const cgComparison = feaCap?.groundComparison;
  const singleBiasCgPf = Number(
    cgComparison?.single_bias_geometry_pf ?? cgComparison?.singleBiasGeometryPf
  );
  const threeBiasCgPf = Number(
    cgComparison?.three_bias_middle_ground_pf ?? cgComparison?.threeBiasMiddleGroundPf
  );
  const cgDifferenceFraction = Number(
    cgComparison?.three_minus_single_fraction ?? cgComparison?.threeMinusSingleFraction
  );
  document.getElementById("cgMethodComparison").textContent = (
    Number.isFinite(singleBiasCgPf) && Number.isFinite(threeBiasCgPf)
      ? `${formatCapacitance(singleBiasCgPf)} / ${formatCapacitance(threeBiasCgPf)}`
      : translateText("not solved")
  );
  document.getElementById("cgMethodComparisonDifference").textContent = Number.isFinite(cgDifferenceFraction)
    ? `one bias / corrected three bias; Δ ${(100 * cgDifferenceFraction).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`
    : translateText("one bias vs corrected three bias");
  document.getElementById("totalGroundCapacitance").textContent = formatCapacitance(admittanceCap.capacitancePf);
  document.getElementById("totalGroundCapSource").textContent = admittanceCap.sourceLabel;
  document.getElementById("parasiticCapacitance").textContent = formatCapacitance(circuit.parasiticPf);
  const hasFeaParasitic = feaCircuit && Array.isArray(feaCircuit.parasiticPfByAdjacentPair);
  document.getElementById("feaParasiticCapacitance").textContent = hasFeaParasitic
    ? (
        feaCircuit.parasiticPfByAdjacentPair.length
          ? feaCircuit.parasiticPfByAdjacentPair.map(formatCapacitance).join(", ")
          : translateText("none")
      )
    : translateText(feaCap ? "not available" : "not solved");
  document.getElementById("feaParasiticCapacitanceSource").textContent = hasFeaParasitic
    ? `${feaCap.solverLabel}; axial pair order`
    : translateText(feaCap ? "backend did not return capacitance matrix" : "run matching FEA solve");
  const portGroundValues = feaCircuit?.electricalNodeGroundCapPf;
  const hasFeaPortGround = feaCircuit?.hasFeaPortNetwork
    && Array.isArray(portGroundValues)
    && portGroundValues.length === biasPlateCount(params) + 2;
  document.getElementById("feaPortGroundCapacitance").textContent = hasFeaPortGround
    ? `${formatCapacitance(portGroundValues[0])} / ${formatCapacitance(portGroundValues.at(-1))}`
    : translateText(feaCap ? "not available" : "not solved");
  document.getElementById("feaPortGroundCapacitanceSource").textContent = hasFeaPortGround
    ? `${feaCap.solverLabel}; input / output`
    : translateText(feaCap ? "rerun FEA with terminal electrodes" : "run matching FEA solve");
  document.getElementById("parasiticRatio").textContent = Number.isFinite(feaCircuit?.parasiticRatio)
    ? `${(100 * feaCircuit.parasiticRatio).toLocaleString(undefined, { maximumFractionDigits: 2 })}% avg`
    : "--";
  document.getElementById("stageAttenuation50Hz").textContent = feaCircuit
    ? formatAttenuationDb(singleStageAttenuationDb(feaCircuit, 50))
    : "--";
  document.getElementById("stageAttenuationHighFrequency").textContent = feaCircuit
    ? formatAttenuationDb(highFrequencyCapRatioAttenuationDb(feaCircuit))
    : "--";
  document.getElementById("washerGain").textContent = Number.isFinite(circuit.washerCapGain)
    ? `${circuit.washerCapGain.toLocaleString(undefined, { maximumFractionDigits: 2 })}×`
    : "--";
  document.getElementById("stageResistance").textContent = formatResistance(circuit.stageResistanceOhm);
  document.getElementById("stageCorner").textContent = formatFrequency(feaCircuit?.cornerHz);
  document.getElementById("parasiticTakeover").textContent = formatFrequency(feaCircuit?.parasiticTakeoverHz);
  document.getElementById("loadResistance").textContent = Number.isFinite(admittance.loadResistanceOhm)
    ? formatResistance(admittance.loadResistanceOhm)
    : "open";
  document.getElementById("loadCurrentSummary").textContent = `Iload = ${formatCurrentFromNa(params.load_current_na)}`;
  document.getElementById("loadCapacitance").textContent = formatCapacitance(externalLoadCapPf);
  document.getElementById("loadCapacitanceSummary").textContent = `${formatCapacitance(cableCapPf)} cable + ${formatCapacitance(detectorCapPf)} det.`;
  document.getElementById("loadAdmittance").textContent = formatAdmittance(admittance.magnitudeS);
  document.getElementById("loadAdmittancePhase").textContent = `${formatFrequency(admittance.frequencyHz)}, phase ${Number.isFinite(admittance.phaseDeg) ? admittance.phaseDeg.toFixed(1) : "--"} deg`;
  updateNoiseReadouts();
}

function updateRfMaterialReadouts() {
  const rf = rfMaterialEstimates(params);
  document.getElementById("rfFrequency").textContent = formatFrequency(rf.frequencyHz);
  document.getElementById("plateMaterialSummary").textContent = translateText(rf.plate.material);
  document.getElementById("tubeMaterialSummary").textContent = translateText(rf.tube.material);
  document.getElementById("plateConductorSummary").innerHTML = `σ ${formatConductivity(rf.plate.conductivity)}, μ<sub>r</sub> ${rf.plate.mur.toLocaleString(undefined, { maximumFractionDigits: 2 })}, δ ${formatLength(rf.plate.skinDepthMm)}`;
  document.getElementById("tubeConductorSummary").innerHTML = `σ ${formatConductivity(rf.tube.conductivity)}, μ<sub>r</sub> ${rf.tube.mur.toLocaleString(undefined, { maximumFractionDigits: 2 })}, δ ${formatLength(rf.tube.skinDepthMm)}`;
  document.getElementById("plate_skin_depth_out").textContent = formatLength(rf.plate.skinDepthMm);
  document.getElementById("tube_skin_depth_out").textContent = formatLength(rf.tube.skinDepthMm);
  document.getElementById("rfBackendStatus").textContent = translateText("Planned");
}

function emptyDielectricPeak(key) {
  return {
    key,
    maxField: 0,
    maxLocation: null
  };
}

function normalizedDielectricPeaks(rawPeaks = {}) {
  const peaks = {
    washer: emptyDielectricPeak("washer"),
    epoxy: emptyDielectricPeak("epoxy")
  };
  for (const [rawKey, rawPeak] of Object.entries(rawPeaks || {})) {
    // Older browser/backend code used "core" for the solved dielectric gap
    // next to the conductive core. Treat that as epoxy so mixed-version backend
    // results still land in the physically relevant breakdown bucket.
    const key = rawKey === "core" || rawKey === "core_adjacent" || rawKey === "core-adjacent"
      ? "epoxy"
      : rawKey;
    if (!Object.hasOwn(peaks, key)) continue;
    const maxField = Number(rawPeak?.maxField ?? rawPeak?.max_field_v_per_mm ?? 0);
    if (!(maxField > peaks[key].maxField)) continue;
    peaks[key] = {
      key,
      maxField,
      maxLocation: rawPeak?.maxLocation ?? rawPeak?.max_location_mm ?? null
    };
  }
  return peaks;
}

function updateDielectricMarginReadouts(summaries = null) {
  for (const definition of dielectricDefinitions(params)) {
    const summary = summaries?.[definition.key] || {
      maxField: Number.NaN,
      margin: Number.NaN,
      breakdownKvPerMm: definition.breakdownKvPerMm
    };
    const emax = formatFieldVPerMm(summary.maxField);
    const margin = formatMargin(summary.margin);
    document.getElementById(`${definition.key}DielectricMargin`).textContent =
      margin === "--" ? `${emax} / --` : `${emax} / ${margin}`;
    document.getElementById(`${definition.key}DielectricBreakdown`).innerHTML =
      `E<sub>bd</sub> ${formatKvPerMm(summary.breakdownKvPerMm)}`;
  }
}

function canvasMetrics(canvas, p, options = {}) {
  const suppliedBounds = options.bounds;
  const bounds = suppliedBounds
    ? {
        ...suppliedBounds,
        length: suppliedBounds.length ?? suppliedBounds.zMax - suppliedBounds.zMin
      }
    : geometryBounds(p);
  const reservedLeftPx = Math.max(0, options.reservedLeftPx || 0);
  const pad = { left: 46 + reservedLeftPx, right: 22, top: 22, bottom: 34 };
  const plotWidth = canvas.width - pad.left - pad.right;
  const plotHeight = canvas.height - pad.top - pad.bottom;
  const zSpan = bounds.zMax - bounds.zMin;
  const scale = Math.min(plotWidth / zSpan, plotHeight / bounds.rMax);
  const extraX = Math.max(0, plotWidth - zSpan * scale) / 2;
  const extraY = Math.max(0, plotHeight - bounds.rMax * scale) / 2;
  const originX = pad.left + extraX;
  const originY = canvas.height - pad.bottom - extraY;
  return {
    bounds,
    sx: scale,
    sy: scale,
    x: (z) => originX + (z - bounds.zMin) * scale,
    y: (r) => originY - r * scale,
    pad,
    reservedLeftPx
  };
}

function visualForGeometryMaterial(material) {
  const normalized = material === "core" ? "ferrite" : material;
  const visuals = {
    epoxy: { material: "epoxy", color: "#9bc6c2", alpha: 0.16 },
    washer: { material: "washer", color: "#d6b75d", alpha: 0.45 },
    ferrite: { material: "ferrite", color: "#8a5b30", alpha: 0.72 },
    ground: { material: "ground", color: "#557a38", alpha: 1 },
    hv: { material: "hv", color: "#b73e3e", alpha: 1 }
  };
  return visuals[normalized] || { material: normalized, color: "#8a8f95", alpha: 0.6 };
}

function componentsFromGeometrySummary(summary) {
  if (!Array.isArray(summary?.components)) return null;
  const components = [];
  for (const component of summary.components) {
    const rawProfile = component.profile_mm || component.profile;
    if (!Array.isArray(rawProfile) || rawProfile.length < 3) continue;
    const profile = rawProfile.map((point) => {
      if (Array.isArray(point)) return [Number(point[0]), Number(point[1])];
      return [Number(point.r), Number(point.z)];
    }).filter(([r, z]) => Number.isFinite(r) && Number.isFinite(z));
    if (profile.length < 3) continue;
    const visual = visualForGeometryMaterial(component.material);
    components.push({
      name: component.name || visual.material,
      material: visual.material,
      color: visual.color,
      alpha: visual.alpha,
      profile
    });
  }
  return components.length ? components : null;
}

function canUseBackendGeometry() {
  return !backendGeometryDisabled && window.location?.protocol !== "file:";
}

function localModelFromParameters(p) {
  return {
    source: "browser-local-model",
    parameters: structuredClone(p),
    geometry: {
      units: "mm",
      length_mm: stackLength(p),
      components: componentProfiles(p).map((component) => ({
        name: component.name,
        material: component.material === "ferrite" ? "core" : component.material,
        profile_mm: component.profile.map(([r, z]) => ({ r, z }))
      }))
    },
    boundaryConditions: {
      biasPotentialV: p.bias_voltage_v,
      groundPotentialV: 0,
      fieldModelCoreTreatment: "equipotential bias boundary"
    }
  };
}

function modelForParameters(p, result = null) {
  const key = comparableResultParameters(p);
  if (result?.parameterKey === key && result.model?.geometry) return result.model;
  if (lastResult?.parameterKey === key && lastResult.model?.geometry) return lastResult.model;
  if (backendGeometryCache?.key === key && backendGeometryCache.model?.geometry) {
    return backendGeometryCache.model;
  }
  return canUseBackendGeometry() ? null : localModelFromParameters(p);
}

function modelBounds(model, fallbackParameters) {
  const geometry = model?.geometry;
  const modelParameters = model?.parameters || fallbackParameters;
  if (!geometry) return geometryBounds(fallbackParameters);
  const length = Number(geometry.length_mm) || stackLength(modelParameters);
  const profileRadius = (geometry.components || []).flatMap((component) =>
    (component.profile_mm || []).map((point) => Number(Array.isArray(point) ? point[0] : point.r))
  ).filter(Number.isFinite);
  const geometryRadius = Math.max(0, ...profileRadius);
  const margin = Number(modelParameters?.domain_margin_mm) || 0;
  return {
    length,
    rMax: Math.max(geometryRadius + margin, Number(geometry.radii_mm?.tube_outer) + margin || 0.001),
    zMin: -margin,
    zMax: length + margin
  };
}

function modelComponents(p, result = null) {
  return componentsFromGeometrySummary(modelForParameters(p, result)?.geometry);
}

function drawBackendModelPending(canvas, p) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#5b6670";
  ctx.font = "16px Arial";
  ctx.fillText("Loading backend model geometry...", 32, 42);
  requestBackendGeometry(canvas, p);
}

async function refreshBackendGeometry(p, key, requestId) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), GEOMETRY_CONNECT_TIMEOUT_MS);
  try {
    const payload = await fetchJson(GEOMETRY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parameters: backendParameters(p) }),
      signal: controller.signal
    });
    const components = componentsFromGeometrySummary(payload.geometry || payload);
    if (requestId !== backendGeometryRequestId || comparableResultParameters(params) !== key || !components) return;
    const model = {
      source: payload.source || "axisymmetric-model",
      parameters: payload.parameters || p,
      geometry: payload.geometry || payload,
      boundaryConditions: {
        biasPotentialV: (payload.parameters || p).bias_voltage_v,
        groundPotentialV: 0,
        fieldModelCoreTreatment: "equipotential bias boundary"
      }
    };
    backendGeometryCache = { key, components, model };
    backendGeometryPendingKey = null;
    drawCadModel();
    drawGeometry();
    drawSlideGraphics();
  } catch {
    if (requestId === backendGeometryRequestId) {
      backendGeometryPendingKey = null;
      backendGeometryDisabled = true;
      drawCadModel();
      drawGeometry();
      drawSlideGraphics();
    }
  } finally {
    window.clearTimeout(timeout);
  }
}

function requestBackendGeometry(canvas, p) {
  if (!canUseBackendGeometry()) return;
  const key = comparableResultParameters(p);
  if (backendGeometryCache?.key === key || backendGeometryPendingKey === key) return;
  backendGeometryPendingKey = key;
  const requestId = backendGeometryRequestId + 1;
  backendGeometryRequestId = requestId;
  refreshBackendGeometry(structuredClone(p), key, requestId);
}

function drawRoundedPlate(ctx, m, p, zc, r0, r1, fill, roundedEdge) {
  const kind = roundedEdge === "outer" ? "hv" : "ground";
  const t = plateThicknessMm(p, kind);
  const z0 = zc - t / 2;
  const rad = Math.max(0, Math.min(edgeRadiusMm(p, kind), t / 2));
  const x = m.x(z0);
  const y = m.y(r1);
  const w = t * m.sx;
  const h = (r1 - r0) * m.sy;
  const rr = Math.max(0, rad * Math.min(m.sx, m.sy));
  ctx.fillStyle = fill;
  ctx.beginPath();
  if (roundedEdge === "inner") {
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.closePath();
  } else {
    ctx.moveTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
  }
  ctx.fill();
}

function drawGeometry(canvas = document.getElementById("geometryCanvas"), p = params, showLegend = true, options = {}) {
  const model = modelForParameters(p);
  const components = componentsFromGeometrySummary(model?.geometry);
  if (!components) {
    drawBackendModelPending(canvas, p);
    return;
  }
  const ctx = canvas.getContext("2d");
  const m = canvasMetrics(canvas, model.parameters || p, {
    ...options,
    bounds: modelBounds(model, p)
  });
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const drawOrder = ["epoxy", "washer", "ferrite", "ground", "hv"];
  for (const material of drawOrder) {
    for (const component of components) {
      if (component.material !== material) continue;
      ctx.save();
      ctx.globalAlpha = component.alpha ?? 1;
      ctx.fillStyle = component.color;
      drawRzProfileFill(ctx, m, component.profile);
      ctx.restore();
    }
  }

  drawAxes(ctx, canvas, m);
  if (showLegend) drawLegend(ctx);
  requestBackendGeometry(canvas, p);
}

function drawRzProfileFill(ctx, m, profile) {
  ctx.beginPath();
  profile.forEach(([r, z], index) => {
    const px = m.x(z);
    const py = m.y(r);
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
  ctx.fill();
}

function drawConductorFills(ctx, m, components, colorForComponent = null) {
  for (const component of components || []) {
    if (!["hv", "ground", "ferrite"].includes(component.material)) continue;
    ctx.save();
    ctx.globalAlpha = component.material === "ferrite" ? 0.86 : 1;
    ctx.fillStyle = colorForComponent ? colorForComponent(component) : component.color;
    drawRzProfileFill(ctx, m, component.profile);
    ctx.restore();
  }
}

function drawComponentOutlines(ctx, m, components) {
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.lineWidth = 2;
  for (const component of components || []) {
    if (!["hv", "ground", "ferrite"].includes(component.material)) continue;
    ctx.beginPath();
    component.profile.forEach(([r, z], index) => {
      if (index === 0) ctx.moveTo(m.x(z), m.y(r));
      else ctx.lineTo(m.x(z), m.y(r));
    });
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}

function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16)
  };
}

function shadedColor(hex, shade, alpha) {
  const rgb = hexToRgb(hex);
  const mix = (value) => Math.round(Math.max(0, Math.min(255, value * shade)));
  return `rgba(${mix(rgb.r)}, ${mix(rgb.g)}, ${mix(rgb.b)}, ${alpha})`;
}

function latheFaces(component, segments = 54, cutaway = true, capCutaway = false) {
  const faces = [];
  const profile = component.profile;
  const rings = [];
  const thetaSpan = cutaway ? Math.PI * 1.56 : Math.PI * 2;
  const thetaStart = -thetaSpan / 2;
  const ringCount = cutaway ? segments + 1 : segments;
  for (let segment = 0; segment < ringCount; segment += 1) {
    const theta = cutaway ? thetaStart + (thetaSpan * segment) / segments : (2 * Math.PI * segment) / segments;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    rings.push(profile.map(([r, z]) => ({ x: r * cos, y: r * sin, z })));
  }
  const faceSegments = cutaway ? segments : ringCount;
  for (let segment = 0; segment < faceSegments; segment += 1) {
    const nextSegment = cutaway ? segment + 1 : (segment + 1) % ringCount;
    for (let index = 0; index < profile.length; index += 1) {
      const nextIndex = (index + 1) % profile.length;
      if (profile[index][0] === 0 && profile[nextIndex][0] === 0) continue;
      const points = [
        rings[segment][index],
        rings[nextSegment][index],
        rings[nextSegment][nextIndex],
        rings[segment][nextIndex]
      ];
      faces.push({ points, color: component.color, alpha: component.alpha, material: component.material });
    }
  }
  if (cutaway && capCutaway) {
    faces.push({
      points: [...rings[0]].reverse(),
      color: component.color,
      alpha: component.alpha,
      material: component.material,
      sectionCap: true
    });
    faces.push({
      points: [...rings[rings.length - 1]],
      color: component.color,
      alpha: component.alpha,
      material: component.material,
      sectionCap: true
    });
  }
  return faces;
}

function drawCadModel(canvas = document.getElementById("cadCanvas"), view = cadView, showHelp = true) {
  const model = modelForParameters(params);
  const components = componentsFromGeometrySummary(model?.geometry);
  if (!components) {
    drawBackendModelPending(canvas, params);
    return;
  }
  const ctx = canvas.getContext("2d");
  const bounds = modelBounds(model, params);
  const faces = components.flatMap((component) => latheFaces(component, 54, view.cutaway, view.filled));
  const length = bounds.length;
  const rMax = bounds.rMax;
  const scale = Math.min(canvas.width / (length + rMax * 2.2), canvas.height / (rMax * 2.7)) * view.zoom;
  const originX = canvas.width / 2 + view.panX;
  const originY = canvas.height / 2 + view.panY;
  const camera = 130;

  function transform(point) {
    const x0 = point.z - length / 2;
    const y0 = point.x;
    const z0 = point.y;
    const x1 = x0 * Math.cos(view.yaw) + z0 * Math.sin(view.yaw);
    const z1 = -x0 * Math.sin(view.yaw) + z0 * Math.cos(view.yaw);
    const y2 = y0 * Math.cos(view.pitch) - z1 * Math.sin(view.pitch);
    const z2 = y0 * Math.sin(view.pitch) + z1 * Math.cos(view.pitch);
    const perspective = camera / (camera - z2);
    const screenX = originX + x1 * scale * perspective;
    const screenY = originY - y2 * scale * perspective;
    return { x: screenX, y: screenY, depth: z2, vx: x1, vy: y2, vz: z2 };
  }

  function normal(points) {
    const a = points[0];
    const b = points[1];
    const c = points[2];
    const ux = b.vx - a.vx;
    const uy = b.vy - a.vy;
    const uz = b.vz - a.vz;
    const vx = c.vx - b.vx;
    const vy = c.vy - b.vy;
    const vz = c.vz - b.vz;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const mag = Math.hypot(nx, ny, nz) || 1;
    return { x: nx / mag, y: ny / mag, z: nz / mag };
  }

  const projected = faces.map((face) => {
    const pts = face.points.map(transform);
    const depth = pts.reduce((sum, point) => sum + point.depth, 0) / pts.length;
    const n = normal(pts);
    const light = Math.max(0.18, n.x * -0.28 + n.y * 0.42 + Math.abs(n.z) * 0.72);
    const shade = 0.56 + light * 0.62;
    return { ...face, pts, depth, shade };
  }).sort((a, b) => a.depth - b.depth);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (showHelp) {
    ctx.fillStyle = "#5b6670";
    ctx.font = "13px Arial";
    ctx.fillText("Drag to rotate. Wheel zooms. Shift/right-drag pans. Model uses the backend geometry sent to the solver.", 22, 24);
  }

  for (const face of projected) {
    ctx.beginPath();
    ctx.moveTo(face.pts[0].x, face.pts[0].y);
    for (let i = 1; i < face.pts.length; i += 1) ctx.lineTo(face.pts[i].x, face.pts[i].y);
    ctx.closePath();
    const fillAlpha = view.filled ? view.fillOpacity : face.alpha;
    ctx.fillStyle = shadedColor(face.color, face.shade, fillAlpha);
    ctx.fill();
    if (!view.filled && (face.material === "hv" || face.material === "ground")) {
      ctx.strokeStyle = "rgba(23, 32, 42, 0.28)";
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
  }
  drawCadAxes(ctx, canvas, view);
}

function drawCadAxes(ctx, canvas, view = cadView) {
  const x0 = canvas.width - 84;
  const y0 = canvas.height - 58;
  const axisLength = 35;

  function orientVector(point) {
    const x0p = point.z;
    const y0p = point.x;
    const z0p = point.y;
    const x1 = x0p * Math.cos(view.yaw) + z0p * Math.sin(view.yaw);
    const z1 = -x0p * Math.sin(view.yaw) + z0p * Math.cos(view.yaw);
    const y2 = y0p * Math.cos(view.pitch) - z1 * Math.sin(view.pitch);
    return { x: x1, y: -y2 };
  }

  function drawAxis(vector, color, label) {
    const mag = Math.hypot(vector.x, vector.y) || 1;
    const x1 = x0 + (vector.x / mag) * axisLength;
    const y1 = y0 + (vector.y / mag) * axisLength;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x1, y1, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText(label, x1 + 5, y1 + 4);
  }

  ctx.save();
  ctx.lineWidth = 2;
  ctx.font = "11px Arial";
  ctx.fillStyle = "rgba(255, 253, 248, 0.82)";
  ctx.fillRect(x0 - 44, y0 - 48, 112, 78);
  ctx.strokeStyle = "rgba(23, 32, 42, 0.16)";
  ctx.strokeRect(x0 - 44, y0 - 48, 112, 78);
  drawAxis(orientVector({ x: 0, y: 0, z: 1 }), "#b73e3e", "z");
  drawAxis(orientVector({ x: 1, y: 0, z: 0 }), "#557a38", "r");
  ctx.restore();
}

function drawAxes(ctx, canvas, m) {
  ctx.strokeStyle = "#17202a";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(m.x(m.bounds.zMin), m.y(0));
  ctx.lineTo(m.x(m.bounds.zMax), m.y(0));
  ctx.moveTo(m.x(0), m.y(0));
  ctx.lineTo(m.x(0), m.y(m.bounds.rMax));
  ctx.stroke();
  ctx.fillStyle = "#5b6670";
  ctx.font = "13px Arial";
  ctx.fillText("z", canvas.width - 38, canvas.height - 12);
  ctx.fillText("r", 18, 26);
}

function drawLegend(ctx) {
  const items = [
    ["#b73e3e", "HV"],
    ["#557a38", "Cu ground"],
    ["#8a5b30", "Core"],
    ["#d6b75d", "Washer"],
    ["#d9e4e2", "Epoxy"]
  ];
  ctx.font = "12px Arial";
  let x = 56;
  for (const [color, label] of items) {
    ctx.fillStyle = color;
    ctx.fillRect(x, 12, 14, 10);
    ctx.fillStyle = "#17202a";
    ctx.fillText(label, x + 19, 22);
    x += 82;
  }
}

function drawSlideLabel(ctx, text, x, y, color = "#17202a") {
  ctx.fillStyle = color;
  ctx.font = "22px Arial";
  drawEngineeringText(ctx, text, x, y);
}

function drawWrappedLines(ctx, lines, x, y, lineHeight, color = "#5b6670", font = "19px Arial", maxWidth = null) {
  ctx.fillStyle = color;
  ctx.font = font;
  let lineIndex = 0;
  for (const line of lines) {
    const localizedLine = translateCanvasText(line);
    if (!Number.isFinite(maxWidth) || maxWidth <= 0) {
      drawEngineeringText(ctx, localizedLine, x, y + lineIndex * lineHeight);
      lineIndex += 1;
      continue;
    }
    const words = String(localizedLine).split(/\s+/).filter(Boolean);
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && ctx.measureText(candidate).width > maxWidth) {
        drawEngineeringText(ctx, current, x, y + lineIndex * lineHeight);
        lineIndex += 1;
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) {
      drawEngineeringText(ctx, current, x, y + lineIndex * lineHeight);
      lineIndex += 1;
    }
  }
}

function fontSizePx(font) {
  const match = font.match(/(\d+(?:\.\d+)?)px/);
  return match ? Number.parseFloat(match[1]) : 16;
}

function fontWithSize(font, sizePx) {
  return font.replace(/(\d+(?:\.\d+)?)px/, `${sizePx}px`);
}

function drawSubscriptText(ctx, segments, x, y, options = {}) {
  const {
    align = "left",
    color = "#17202a",
    font = "19px Arial",
    background = null,
    paddingX = 6,
    paddingY = 4
  } = options;
  const baseSize = fontSizePx(font);
  const subFont = fontWithSize(font, baseSize * 0.68);
  const subOffset = baseSize * 0.28;

  ctx.save();
  const width = segments.reduce((sum, segment) => {
    ctx.font = segment.sub ? subFont : font;
    return sum + ctx.measureText(segment.text).width;
  }, 0);
  const x0 = align === "center" ? x - width / 2 : align === "right" ? x - width : x;
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(x0 - paddingX, y - baseSize - paddingY, width + 2 * paddingX, baseSize + subOffset + 2 * paddingY);
  }
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  let cursor = x0;
  segments.forEach((segment) => {
    ctx.font = segment.sub ? subFont : font;
    ctx.fillText(segment.text, cursor, y + (segment.sub ? subOffset : 0));
    cursor += ctx.measureText(segment.text).width;
  });
  ctx.restore();
  return width;
}

function drawEngineeringText(ctx, text, x, y) {
  const source = String(text);
  const notation = /(Cpar(?:,[A-Za-z0-9]+)*|Cg(?:,[A-Za-z0-9]+)*|Rstage|Xc,par)/g;
  const segments = [];
  let cursor = 0;
  for (const match of source.matchAll(notation)) {
    if (match.index > cursor) segments.push({ text: source.slice(cursor, match.index) });
    const token = match[0];
    if (token.startsWith("Cpar")) {
      segments.push({ text: "C" }, { text: `par${token.slice(4)}`, sub: true });
    } else if (token.startsWith("Cg")) {
      segments.push({ text: "C" }, { text: `g${token.slice(2)}`, sub: true });
    } else if (token === "Rstage") {
      segments.push({ text: "R" }, { text: "stage", sub: true });
    } else {
      segments.push({ text: "X" }, { text: "c,par", sub: true });
    }
    cursor = match.index + token.length;
  }
  if (!segments.length) {
    ctx.fillText(source, x, y);
    return;
  }
  if (cursor < source.length) segments.push({ text: source.slice(cursor) });
  drawSubscriptText(ctx, segments, x, y, {
    align: ctx.textAlign,
    color: ctx.fillStyle,
    font: ctx.font
  });
}

function drawArrow(ctx, x0, y0, x1, y1, color = "#17202a") {
  const angle = Math.atan2(y1 - y0, x1 - x0);
  const head = 10;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - head * Math.cos(angle - Math.PI / 6), y1 - head * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x1 - head * Math.cos(angle + Math.PI / 6), y1 - head * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawMaterialSlide(canvas) {
  const labelGutterPx = 300;
  const model = modelForParameters(params);
  if (!model) {
    drawBackendModelPending(canvas, params);
    return;
  }
  const modelParameters = model.parameters || params;
  const bounds = modelBounds(model, modelParameters);
  drawGeometry(canvas, params, false, { reservedLeftPx: labelGutterPx });
  const ctx = canvas.getContext("2d");
  const m = canvasMetrics(canvas, modelParameters, { reservedLeftPx: labelGutterPx, bounds });
  const length = stackLength(modelParameters);
  const core = modelParameters.core_od_mm / 2;
  const hvOuter = modelParameters.hv_plate_od_mm / 2;
  const groundInner = modelParameters.ground_plate_inner_diameter_mm / 2;
  const groundOuter = modelParameters.ground_plate_od_mm / 2;
  const tubeInner = modelParameters.tube_id_mm / 2;
  const washerBounds = washerRadialBounds(modelParameters);
  const dielectricGapZ = groundPlateThicknessMm(modelParameters) + modelParameters.plate_gap_mm / 2;
  const centers = plateCenters(modelParameters);
  const groundPlateCenter = centers.find(([kind]) => kind === "ground")?.[1] ?? groundPlateThicknessMm(modelParameters) / 2;
  const biasPlateCenter = centers.find(([kind]) => kind === "hv")?.[1] ?? dielectricGapZ;
  const labelX = 54;
  const arrowStartX = labelGutterPx - 36;
  const targetX = m.x(dielectricGapZ);
  const coreY = m.y(core * 0.55);
  const groundPlateY = m.y((groundInner + groundOuter) / 2);
  const biasPlateY = m.y((core + hvOuter) / 2);
  const washerY = m.y((washerBounds.inner + washerBounds.outer) / 2);
  const epoxyY = m.y((hvOuter + tubeInner) / 2);
  const labels = [
    {
      text: "Ground plate",
      color: "#557a38",
      arrowColor: "#23472e",
      targetX: m.x(groundPlateCenter),
      targetY: groundPlateY
    },
    {
      text: "Bias plate",
      color: "#b73e3e",
      arrowColor: "#74202b",
      targetX: m.x(biasPlateCenter),
      targetY: biasPlateY
    },
    { text: coreComponentName(modelParameters), color: "#8a5b30", arrowColor: "#6e421f", targetX, targetY: coreY },
    { text: washerComponentName(modelParameters), color: "#8a6a18", arrowColor: "#74570d", targetX, targetY: washerY },
    { text: epoxyComponentName(modelParameters), color: "#35736f", arrowColor: "#245d78", targetX, targetY: epoxyY }
  ].sort((a, b) => a.targetY - b.targetY);

  ctx.save();
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, labelGutterPx, canvas.height);
  ctx.strokeStyle = "#d8d0bf";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(labelGutterPx, 26);
  ctx.lineTo(labelGutterPx, canvas.height - 34);
  ctx.stroke();
  const labelTop = 92;
  const labelBottom = canvas.height - 64;
  const labelGap = labels.length > 1 ? (labelBottom - labelTop) / (labels.length - 1) : 0;
  labels.forEach((label, index) => {
    const labelY = labelTop + index * labelGap;
    ctx.fillStyle = label.color;
    ctx.fillRect(labelX, labelY - 18, 16, 12);
    drawSlideLabel(ctx, label.text, labelX + 26, labelY - 6, label.color);
    drawArrow(ctx, arrowStartX, labelY - 12, label.targetX, label.targetY, label.arrowColor);
  });
  ctx.restore();
}

function drawProfilePolygon(ctx, profile, rToX, zToY) {
  ctx.beginPath();
  profile.forEach(([r, z], index) => {
    const px = rToX(r);
    const py = zToY(z);
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
  ctx.fill();
}

function drawDoubleArrow(ctx, x0, y0, x1, y1, color = "#17202a") {
  drawArrow(ctx, x0, y0, x1, y1, color);
  drawArrow(ctx, x1, y1, x0, y0, color);
}

function drawAnalyticRadialCase(ctx, entry, x, y, width, height, orientation) {
  const targetKind = orientation === "core" ? "ground" : "hv";
  const edgeRadius = Math.max(edgeRadiusMm(params, targetKind), 0.001);
  const thickness = plateThicknessMm(params, targetKind);
  const half = thickness / 2;
  const core = params.core_od_mm / 2;
  const groundInner = params.ground_plate_inner_diameter_mm / 2;
  const hvOuter = params.hv_plate_od_mm / 2;
  const tubeInner = params.tube_id_mm / 2;
  const tubeOuter = tubeInner + params.tube_wall_thickness_mm;
  const centers = plateCenters(params);
  const zc = centers.find(([kind]) => kind === targetKind)?.[1] ?? thickness / 2;
  const z0 = zc - half;
  const z1 = zc + half;
  const radialPad = Math.max(0.45, edgeRadius * 0.85);
  const zPad = Math.max(0.35, edgeRadius * 0.75);
  const bodyTop = y + 76;
  const bodyHeight = height - 160;
  const bodyLeft = x + 34;
  const bodyWidth = width - 68;
  const zMin = z0 - zPad;
  const zMax = z1 + zPad;
  const rMin = orientation === "core"
    ? core - radialPad
    : hvOuter - Math.max(edgeRadius * 3.0, 0.9);
  const rMax = orientation === "core"
    ? groundInner + Math.max(edgeRadius * 3.0, 0.9)
    : Math.max(tubeOuter, tubeInner + Math.max(edgeRadius * 2.0, 0.9));
  const scale = Math.min(bodyWidth / Math.max(rMax - rMin, 0.001), bodyHeight / Math.max(zMax - zMin, 0.001));
  const innerWidth = (rMax - rMin) * scale;
  const innerHeight = (zMax - zMin) * scale;
  const originX = bodyLeft + (bodyWidth - innerWidth) / 2;
  const originY = bodyTop + (bodyHeight - innerHeight) / 2;
  const rToX = (r) => originX + (r - rMin) * scale;
  const zToY = (z) => originY + (zMax - z) * scale;

  ctx.save();
  ctx.strokeStyle = "#c9c1b0";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);
  ctx.fillStyle = "#17202a";
  ctx.font = "21px Arial";
  ctx.fillText(entry.shortLabel, x + 18, y + 32);
  ctx.fillStyle = "#5b6670";
  ctx.font = "15px Arial";
  ctx.fillText(entry.note, x + 18, y + 55);
  ctx.font = "13px Arial";
  ctx.fillText(`${entry.clearance.value.toFixed(2)} mm ${entry.clearance.label}`, x + width - 174, y + 32);
  drawSubscriptText(ctx, [
    { text: "r" },
    { text: ` = ${edgeRadius.toFixed(2)} mm` }
  ], x + width - 174, y + 54, { color: "#1f6f78", font: "13px Arial" });

  const labelY = y + height - 49;
  const radiusY = y + height - 28;
  const arrowY = y + height - 76;
  const labelX = (value) => Math.max(x + 60, Math.min(x + width - 60, value));
  const drawBottomLabel = (anchorX, label, radiusText) => {
    ctx.textAlign = "center";
    ctx.fillStyle = "#5b6670";
    ctx.font = "13px Arial";
    ctx.fillText(label, labelX(anchorX), labelY);
    ctx.fillText(radiusText, labelX(anchorX), radiusY);
    ctx.textAlign = "left";
  };

  if (orientation === "core") {
    ctx.fillStyle = "#b73e3e";
    ctx.fillRect(rToX(rMin), zToY(zMax), rToX(core) - rToX(rMin), zToY(zMin) - zToY(zMax));
    ctx.fillStyle = "#557a38";
    drawProfilePolygon(ctx, roundedInnerProfile(groundInner, rMax, z0, z1, edgeRadius, 18), rToX, zToY);
    ctx.strokeStyle = "rgba(23, 32, 42, 0.36)";
    ctx.setLineDash([8, 7]);
    ctx.beginPath();
    ctx.arc(rToX(groundInner + edgeRadius), zToY(zc), edgeRadius * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = "#1f6f78";
    ctx.lineWidth = 2;
    drawDoubleArrow(ctx, rToX(groundInner), zToY(zc), rToX(groundInner + edgeRadius), zToY(zc), "#1f6f78");
    drawBottomLabel(rToX(core), "HV core", `r=${core.toFixed(2)} mm`);
    drawBottomLabel(rToX(groundInner), "ground inner fillet", `r=${groundInner.toFixed(2)} mm`);
    drawDoubleArrow(ctx, rToX(core) + 8, arrowY, rToX(groundInner) - 8, arrowY, "#17202a");
  } else {
    ctx.fillStyle = "#b73e3e";
    drawProfilePolygon(ctx, roundedOuterProfile(rMin, hvOuter, z0, z1, edgeRadius, 18), rToX, zToY);
    ctx.fillStyle = "#557a38";
    ctx.fillRect(rToX(tubeInner), zToY(zMax), rToX(rMax) - rToX(tubeInner), zToY(zMin) - zToY(zMax));
    ctx.strokeStyle = "rgba(23, 32, 42, 0.36)";
    ctx.setLineDash([8, 7]);
    ctx.beginPath();
    ctx.arc(rToX(hvOuter - edgeRadius), zToY(zc), edgeRadius * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = "#1f6f78";
    ctx.lineWidth = 2;
    drawDoubleArrow(ctx, rToX(hvOuter - edgeRadius), zToY(zc), rToX(hvOuter), zToY(zc), "#1f6f78");
    drawBottomLabel(rToX(hvOuter), "HV outer fillet", `r=${hvOuter.toFixed(2)} mm`);
    drawBottomLabel(rToX(tubeInner), "ground tube", `r=${tubeInner.toFixed(2)} mm`);
    drawDoubleArrow(ctx, rToX(hvOuter) + 8, arrowY, rToX(tubeInner) - 8, arrowY, "#17202a");
  }
  ctx.restore();
}

function drawAnalyticComparisonTable(ctx, edge, x, y, width) {
  const rowH = 28;
  const ordered = ["core", "tube", "axial"]
    .map((id) => edge.cases.find((entry) => entry.id === id))
    .filter(Boolean);
  ctx.save();
  ctx.font = "13px Arial";
  ctx.fillStyle = "#17202a";
  ctx.fillText("Case", x, y);
  drawSubscriptText(ctx, [
    { text: "R" },
    { text: "maj", sub: true },
    { text: "/r" },
  ], x + width * 0.14, y, { color: "#17202a", font: "13px Arial" });
  ctx.fillText("d", x + width * 0.29, y);
  ctx.fillText("local 2D", x + width * 0.42, y);
  ctx.fillText("axis coax", x + width * 0.60, y);
  ctx.fillText("r,d bound", x + width * 0.80, y);
  ctx.strokeStyle = "#c9c1b0";
  ctx.beginPath();
  ctx.moveTo(x, y + 8);
  ctx.lineTo(x + width, y + 8);
  ctx.stroke();

  ordered.forEach((entry, index) => {
    const yy = y + 32 + index * rowH;
    const isControl = entry.id === edge.controlling.id;
    ctx.fillStyle = isControl ? "#17202a" : "#5b6670";
    ctx.font = isControl ? "bold 13px Arial" : "13px Arial";
    ctx.fillText(entry.shortLabel, x, yy);
    ctx.fillText(Number.isFinite(entry.torusRatio) ? `${entry.torusRatio.toFixed(1)}` : "--", x + width * 0.17, yy);
    ctx.fillText(`${entry.clearance.value.toFixed(2)}`, x + width * 0.29, yy);
    ctx.fillText(formatFieldVPerMm(entry.edgeCylinderField), x + width * 0.42, yy);
    ctx.fillText(Number.isFinite(entry.coaxialField) ? formatFieldVPerMm(entry.coaxialField) : "--", x + width * 0.60, yy);
    ctx.fillText(formatFieldVPerMm(entry.estimatedField), x + width * 0.80, yy);
  });
  ctx.fillStyle = "#5b6670";
  ctx.font = "12px Arial";
  ctx.fillText("R major / r is torus center radius divided by minimum local radius. The local 2D column does not use it.", x, y + 128);
  ctx.restore();
}

function drawEdgeSlide(canvas) {
  const ctx = canvas.getContext("2d");
  const edge = analyticEdgeEstimate(params);
  const bound = radiusGapBound(params);
  const coreCase = edge.cases.find((entry) => entry.id === "core");
  const tubeCase = edge.cases.find((entry) => entry.id === "tube");
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, w, h);

  if (coreCase) drawAnalyticRadialCase(ctx, coreCase, 52, 74, 480, 310, "core");
  if (tubeCase) drawAnalyticRadialCase(ctx, tubeCase, 568, 74, 480, 310, "tube");
  const radialRatios = edge.cases
    .filter((entry) => Number.isFinite(entry.torusRatio))
    .map((entry) => entry.torusRatio);
  const minTorusRatio = radialRatios.length ? Math.min(...radialRatios) : Number.NaN;

  ctx.fillStyle = "#17202a";
  ctx.font = "30px Arial";
  ctx.fillText(`${formatFieldVPerMm(bound.field)} radius-gap bound`, 62, 430);
  ctx.font = "19px Arial";
  ctx.fillStyle = "#5b6670";
  ctx.fillText(`${bound.gap.label}: ${bound.factor.toFixed(2)}x local V/d`, 62, 462);
  ctx.fillText(`Minimum radius r = ${bound.radius.toFixed(2)} mm (${bound.radiusLabel})`, 62, 492);
  drawSubscriptText(ctx, [
    { text: "E" },
    { text: "max", sub: true },
    { text: ` = V(r+d)/(r d), d = ${bound.gap.value.toFixed(2)} mm` }
  ], 62, 522, { color: "#5b6670", font: "19px Arial" });
  if (Number.isFinite(minTorusRatio)) {
    drawSubscriptText(ctx, [
      { text: "Smallest R" },
      { text: "maj", sub: true },
      { text: "/r" },
      { text: ` on radial sides: ${minTorusRatio.toFixed(1)}` }
    ], 62, 552, { color: "#5b6670", font: "19px Arial" });
  }

  drawAnalyticComparisonTable(ctx, edge, 560, 425, 480);

  drawWrappedLines(ctx, [
    "The bound assumes every exposed conductor feature has radius at least r and every opposite-conductor gap is at least d.",
    "Use FEA to confirm the drawn geometry respects those assumptions and to measure the actual margin."
  ], 62, 582, 22, "#5b6670", "16px Arial");
}

function drawDeformationSlide(canvas) {
  const ctx = canvas.getContext("2d");
  const bound = radiusGapBound(params);
  const radius = bound.radius;
  const gap = bound.gap.value;
  const w = canvas.width;
  const h = canvas.height;
  const y = h * 0.44;
  const sphereX = w * 0.19;
  const stretchX = w * 0.50;
  const filterX = w * 0.80;
  const shellR = 112;
  const innerR = 42;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "rgba(85, 122, 56, 0.15)";
  ctx.strokeStyle = "#557a38";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(sphereX, y, shellR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#b73e3e";
  ctx.beginPath();
  ctx.arc(sphereX, y, innerR, 0, Math.PI * 2);
  ctx.fill();
  drawArrow(ctx, sphereX + innerR, y + shellR + 28, sphereX + shellR, y + shellR + 28, "#17202a");
  drawArrow(ctx, sphereX + shellR, y + shellR + 28, sphereX + innerR, y + shellR + 28, "#17202a");
  drawSlideLabel(ctx, "minimum gap d", sphereX - 56, y + shellR + 62);

  ctx.fillStyle = "rgba(85, 122, 56, 0.13)";
  ctx.strokeStyle = "#557a38";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(stretchX, y, 135, 74, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#b73e3e";
  ctx.beginPath();
  ctx.ellipse(stretchX, y, 120, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(23, 32, 42, 0.35)";
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.arc(stretchX + 120, y, innerR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "rgba(217, 228, 226, 0.85)";
  ctx.fillRect(filterX - 126, y - 82, 252, 164);
  ctx.fillStyle = "#557a38";
  ctx.fillRect(filterX + 114, y - 104, 26, 208);
  ctx.fillStyle = "#b73e3e";
  ctx.beginPath();
  ctx.moveTo(filterX - 142, y - 27);
  ctx.lineTo(filterX + 58, y - 27);
  ctx.quadraticCurveTo(filterX + 84, y - 27, filterX + 84, y);
  ctx.quadraticCurveTo(filterX + 84, y + 27, filterX + 58, y + 27);
  ctx.lineTo(filterX - 142, y + 27);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(23, 32, 42, 0.35)";
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.arc(filterX + 57, y, 27, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  drawArrow(ctx, sphereX + shellR + 24, y, stretchX - 166, y, "#1f6f78");
  drawArrow(ctx, stretchX + 156, y, filterX - 172, y, "#1f6f78");

  ctx.fillStyle = "#17202a";
  ctx.font = "24px Arial";
  ctx.fillText("1. Limiting sphere", sphereX - 92, h * 0.16);
  ctx.fillText("2. Larger-area shape", stretchX - 106, h * 0.16);
  ctx.fillText("3. Filter rim check", filterX - 92, h * 0.16);

  drawWrappedLines(ctx, [
    `Bound: Eₘₐₓ = V(r+d)/(r d), V = ${bound.voltage.toFixed(0)} V, r = ${radius.toFixed(2)} mm, d = ${gap.toFixed(2)} mm`,
    `Minimum radius: ${bound.radiusLabel}; minimum gap: ${bound.gap.label}; current bound: ${(bound.field / 1000).toFixed(2)} kV/mm`,
    "Constraint: every exposed conductor feature has radius >= r and every opposite-conductor gap is >= d.",
    "FEA is still the geometry audit: it checks that no modeled fillet, lip, or tolerance violates the bound inputs."
  ], w * 0.10, h * 0.78, 28, "#5b6670", "20px Arial");
}

function packingShapeFactor(x) {
  if (!(x > 0)) return 0;
  return x / ((1 + x) * (1 + 2 * x));
}

function drawPackingSlide(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const optimum = 1 / Math.sqrt(2);
  const optimumValue = packingShapeFactor(optimum);
  const gap = Number.isFinite(params.plate_gap_mm) && params.plate_gap_mm > 0
    ? params.plate_gap_mm
    : defaults.plate_gap_mm;
  const currentRatio = gap > 0 ? edgeRadiusMm(params) / gap : Number.NaN;
  const currentValue = packingShapeFactor(currentRatio);

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "#17202a";
  ctx.font = "30px Arial";
  ctx.fillText("Field-limited capacitance packing", 56, 62);

  ctx.fillStyle = "#f4efe3";
  ctx.strokeStyle = "#d7cbb5";
  ctx.lineWidth = 1.5;
  ctx.fillRect(50, 92, 455, 405);
  ctx.strokeRect(50, 92, 455, 405);

  drawWrappedLines(ctx, [
    "Assumptions",
    "plate thickness = 2r",
    "gap = d",
    "C ∝ 1/d",
    "L = d + 2r",
    "Eₘₐₓ uses radius-gap limit"
  ], 74, 132, 28, "#5b6670", "20px Arial");

  ctx.fillStyle = "#17202a";
  ctx.font = "24px Georgia";
  ctx.fillText("FOM = C / (L Eₘₐₓ)", 74, 316);
  ctx.font = "21px Georgia";
  ctx.fillStyle = "#5b6670";
  ctx.fillText("FOM ∝ r / ((r + d)(d + 2r))", 74, 354);
  ctx.fillText("x = r/d", 74, 392);
  ctx.fillStyle = "#17202a";
  ctx.font = "24px Georgia";
  ctx.fillText("shape factor = x / ((1 + x)(1 + 2x))", 74, 430);
  ctx.fillText("x* = 1/√2 = 0.707", 74, 470);

  const plotX = 590;
  const plotY = 104;
  const plotW = 430;
  const plotH = 330;
  const xMax = 3;
  const yMax = optimumValue * 1.16;
  const xToPx = (x) => plotX + (x / xMax) * plotW;
  const yToPx = (y) => plotY + plotH - (y / yMax) * plotH;

  ctx.strokeStyle = "#c9c1b0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(plotX, plotY);
  ctx.lineTo(plotX, plotY + plotH);
  ctx.lineTo(plotX + plotW, plotY + plotH);
  ctx.stroke();

  ctx.fillStyle = "#5b6670";
  ctx.font = "14px Arial";
  ctx.fillText("r/d", plotX + plotW - 28, plotY + plotH + 34);
  ctx.fillText("FOM shape", plotX - 10, plotY - 18);
  [0, 0.5, 1, 1.5, 2, 2.5, 3].forEach((tick) => {
    const x = xToPx(tick);
    ctx.strokeStyle = "#e2d8c4";
    ctx.beginPath();
    ctx.moveTo(x, plotY + plotH);
    ctx.lineTo(x, plotY + plotH + 6);
    ctx.stroke();
    ctx.fillStyle = "#5b6670";
    ctx.fillText(`${tick}`, x - 8, plotY + plotH + 24);
  });

  ctx.strokeStyle = "#1f6f78";
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let i = 0; i <= 180; i += 1) {
    const x = 0.02 + (xMax - 0.02) * i / 180;
    const px = xToPx(x);
    const py = yToPx(packingShapeFactor(x));
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  const optX = xToPx(optimum);
  const optY = yToPx(optimumValue);
  ctx.strokeStyle = "#b73e3e";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 7]);
  ctx.beginPath();
  ctx.moveTo(optX, plotY + plotH);
  ctx.lineTo(optX, optY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#b73e3e";
  ctx.beginPath();
  ctx.arc(optX, optY, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = "17px Arial";
  ctx.fillText("x* = 1/√2", optX + 12, optY - 10);

  if (Number.isFinite(currentRatio) && currentRatio > 0 && currentRatio <= xMax) {
    const currentX = xToPx(currentRatio);
    const currentY = yToPx(currentValue);
    const currentLabel = `current ${currentRatio.toFixed(2)}`;
    ctx.fillStyle = "#8a5b30";
    ctx.beginPath();
    ctx.arc(currentX, currentY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = "17px Arial";
    const labelWidth = ctx.measureText(currentLabel).width;
    const useUpperLeft = !(currentX < plotX + 155 && currentY < plotY + 92);
    const labelX = useUpperLeft ? plotX + 18 : plotX + plotW - labelWidth - 18;
    const labelY = plotY + 42;
    ctx.strokeStyle = "rgba(138, 91, 48, 0.65)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(labelX + (useUpperLeft ? labelWidth + 8 : -8), labelY - 8);
    ctx.lineTo(currentX, currentY);
    ctx.stroke();
    drawRcLabel(ctx, currentLabel, labelX, labelY, {
      color: "#8a5b30",
      font: "17px Arial",
      background: "#fffdf8"
    });
  }

  drawWrappedLines(ctx, [
    "Field stress is taken from the radius-gap limit for the most limiting local geometry.",
    "This FOM rewards capacitance, penalizes stack length, and also penalizes electric-field stress.",
    "It is a shape metric; absolute performance still scales with material permittivity, area, and allowed voltage margin."
  ], 64, 532, 24, "#5b6670", "18px Arial", 960);
}

function c(re, im = 0) {
  return { re, im };
}

function cAdd(a, b) {
  return c(a.re + b.re, a.im + b.im);
}

function cSub(a, b) {
  return c(a.re - b.re, a.im - b.im);
}

function cMul(a, b) {
  return c(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
}

function cDiv(a, b) {
  const denom = b.re * b.re + b.im * b.im;
  if (denom === 0) return c(0, 0);
  return c((a.re * b.re + a.im * b.im) / denom, (a.im * b.re - a.re * b.im) / denom);
}

function cAbs(a) {
  return Math.hypot(a.re, a.im);
}

function solveComplexLinear(matrix, rhs) {
  const n = rhs.length;
  const a = matrix.map((row) => row.map((value) => c(value.re, value.im)));
  const b = rhs.map((value) => c(value.re, value.im));

  for (let pivot = 0; pivot < n; pivot += 1) {
    let best = pivot;
    let bestAbs = cAbs(a[pivot][pivot]);
    for (let row = pivot + 1; row < n; row += 1) {
      const candidate = cAbs(a[row][pivot]);
      if (candidate > bestAbs) {
        best = row;
        bestAbs = candidate;
      }
    }
    if (bestAbs < 1e-30) return null;
    if (best !== pivot) {
      [a[pivot], a[best]] = [a[best], a[pivot]];
      [b[pivot], b[best]] = [b[best], b[pivot]];
    }

    const pivotValue = a[pivot][pivot];
    for (let col = pivot; col < n; col += 1) {
      a[pivot][col] = cDiv(a[pivot][col], pivotValue);
    }
    b[pivot] = cDiv(b[pivot], pivotValue);

    for (let row = 0; row < n; row += 1) {
      if (row === pivot) continue;
      const factor = a[row][pivot];
      if (cAbs(factor) < 1e-30) continue;
      for (let col = pivot; col < n; col += 1) {
        a[row][col] = cSub(a[row][col], cMul(factor, a[pivot][col]));
      }
      b[row] = cSub(b[row], cMul(factor, b[pivot]));
    }
  }
  return b;
}

function ladderTransferMagnitude(circuit, p, frequencyHz, options = {}) {
  const stages = Math.max(1, Math.floor(p.plate_pairs));
  const omega = 2 * Math.PI * frequencyHz;
  const nodeGroundPf = Array.isArray(circuit.shuntCapPfByNode) && circuit.shuntCapPfByNode.length === stages
    ? circuit.shuntCapPfByNode
    : Array(stages).fill(Math.max(0, circuit.shuntCapPf || 0));
  const mutualPf = Array.isArray(circuit.mutualCapPfMatrix) && circuit.mutualCapPfMatrix.length === stages
    ? circuit.mutualCapPfMatrix
    : Array.from({ length: stages }, (_, row) => (
        Array.from({ length: stages }, (_, col) => (
          Math.abs(row - col) === 1 ? Math.max(0, circuit.parasiticPf || 0) : 0
        ))
      ));
  const electricalGroundPf = Array.isArray(circuit.electricalNodeGroundCapPf)
    && circuit.electricalNodeGroundCapPf.length === stages + 2
    ? circuit.electricalNodeGroundCapPf
    : [0, ...nodeGroundPf, 0];
  const electricalMutualPf = Array.isArray(circuit.electricalMutualCapPfMatrix)
    && circuit.electricalMutualCapPfMatrix.length === stages + 2
    ? circuit.electricalMutualCapPfMatrix
    : null;
  const yLoad = options.includeLoad ? loadAdmittanceAtFrequency(p, frequencyHz) : c(0, 0);
  const inputOhm = inputSeriesResistanceOhm(circuit, p);
  const outputOhm = outputSeriesResistanceOhm(circuit, p);
  let nextNode = stages;
  const inputNode = inputOhm > 0 ? nextNode++ : 0;
  const outputNode = outputOhm > 0 ? nextNode++ : stages - 1;
  const allNodes = Array.from({ length: nextNode }, (_, index) => index);
  const fixed = new Map([[inputNode, c(1, 0)]]);
  const unknownNodes = allNodes.filter((node) => !fixed.has(node));
  const unknownIndex = new Map(unknownNodes.map((node, index) => [node, index]));
  if (!unknownNodes.length) return cAbs(fixed.get(outputNode) || c(1, 0));

  const matrix = Array.from({ length: unknownNodes.length }, () => Array.from({ length: unknownNodes.length }, () => c(0, 0)));
  const rhs = Array.from({ length: unknownNodes.length }, () => c(0, 0));
  const addShunt = (node, y) => {
    if (cAbs(y) <= 0 || fixed.has(node)) return;
    const row = unknownIndex.get(node);
    matrix[row][row] = cAdd(matrix[row][row], y);
  };
  const addBranch = (a, b, y) => {
    if (a === b || cAbs(y) <= 0) return;
    const aFixed = fixed.get(a);
    const bFixed = fixed.get(b);
    const aRow = unknownIndex.get(a);
    const bRow = unknownIndex.get(b);
    if (aRow !== undefined) {
      matrix[aRow][aRow] = cAdd(matrix[aRow][aRow], y);
      if (bRow !== undefined) matrix[aRow][bRow] = cSub(matrix[aRow][bRow], y);
      else if (bFixed) rhs[aRow] = cAdd(rhs[aRow], cMul(y, bFixed));
    }
    if (bRow !== undefined) {
      matrix[bRow][bRow] = cAdd(matrix[bRow][bRow], y);
      if (aRow !== undefined) matrix[bRow][aRow] = cSub(matrix[bRow][aRow], y);
      else if (aFixed) rhs[bRow] = cAdd(rhs[bRow], cMul(y, aFixed));
    }
  };
  const resistorY = (ohms) => (Number.isFinite(ohms) && ohms > 0 ? c(1 / ohms, 0) : c(0, 0));

  for (let node = 0; node < stages; node += 1) {
    addShunt(node, c(0, omega * Math.max(0, Number(nodeGroundPf[node]) || 0) * 1e-12));
  }
  addShunt(inputNode, c(0, omega * Math.max(0, Number(electricalGroundPf[0]) || 0) * 1e-12));
  addShunt(outputNode, c(0, omega * Math.max(0, Number(electricalGroundPf.at(-1)) || 0) * 1e-12));
  if (inputOhm > 0) addBranch(inputNode, 0, resistorY(inputOhm));
  for (let node = 1; node < stages; node += 1) {
    addBranch(node - 1, node, resistorY(circuit.stageResistanceOhm));
  }
  for (let row = 0; row < stages; row += 1) {
    for (let col = row + 1; col < stages; col += 1) {
      addBranch(row, col, c(0, omega * Math.max(0, Number(mutualPf[row]?.[col]) || 0) * 1e-12));
    }
  }
  if (electricalMutualPf) {
    for (let stage = 0; stage < stages; stage += 1) {
      addBranch(inputNode, stage, c(0, omega * Math.max(0, Number(electricalMutualPf[0]?.[stage + 1]) || 0) * 1e-12));
      addBranch(outputNode, stage, c(0, omega * Math.max(0, Number(electricalMutualPf.at(-1)?.[stage + 1]) || 0) * 1e-12));
    }
    addBranch(inputNode, outputNode, c(0, omega * Math.max(0, Number(electricalMutualPf[0]?.at(-1)) || 0) * 1e-12));
  }
  if (outputOhm > 0) addBranch(stages - 1, outputNode, resistorY(outputOhm));
  addShunt(outputNode, yLoad);

  const solution = solveComplexLinear(matrix, rhs);
  if (!solution) return Number.NaN;
  if (fixed.has(outputNode)) return cAbs(fixed.get(outputNode));
  return cAbs(solution[unknownIndex.get(outputNode)]);
}

function electromagneticStageInductanceH(p) {
  const pathLengthM = (groundPlateThicknessMm(p) + 2 * p.plate_gap_mm) * 1e-3;
  const conductorRadiusM = Math.max(0.05, p.core_od_mm / 2) * 1e-3;
  const returnRadiusM = Math.max(conductorRadiusM * 1.05, p.tube_id_mm / 2 * 1e-3);
  return MU_0_H_PER_M * pathLengthM / (2 * Math.PI) * Math.log(returnRadiusM / conductorRadiusM);
}

function electromagneticCircuitForCurrentDesign() {
  const estimate = circuitEstimates(params);
  const fea = feaCapacitanceForCurrentDesign();
  return fea ? circuitWithFeaCapacitances(estimate, params, fea) : estimate;
}

function electromagneticTransferMagnitude(circuit, p, frequencyHz, branchResistanceOhm) {
  const stages = biasPlateCount(p);
  const omega = 2 * Math.PI * frequencyHz;
  const inductanceH = electromagneticStageInductanceH(p);
  const nodeGroundPf = Array.isArray(circuit.shuntCapPfByNode)
    ? circuit.shuntCapPfByNode
    : Array.from({ length: stages }, () => Math.max(0, circuit.shuntCapPf || 0));
  const mutual = Array.isArray(circuit.mutualCapPfMatrix) ? circuit.mutualCapPfMatrix : null;
  const matrix = Array.from({ length: stages }, () => Array.from({ length: stages }, () => c(0, 0)));
  const rhs = Array.from({ length: stages }, () => c(0, 0));
  const sourceVoltage = c(1, 0);

  const addShunt = (node, admittance) => {
    matrix[node][node] = cAdd(matrix[node][node], admittance);
  };
  const addBranch = (a, b, admittance) => {
    matrix[a][a] = cAdd(matrix[a][a], admittance);
    matrix[b][b] = cAdd(matrix[b][b], admittance);
    matrix[a][b] = cSub(matrix[a][b], admittance);
    matrix[b][a] = cSub(matrix[b][a], admittance);
  };
  const seriesAdmittance = (resistanceOhm) => cDiv(c(1, 0), c(Math.max(0, resistanceOhm), omega * inductanceH));

  for (let node = 0; node < stages; node += 1) {
    addShunt(node, c(0, omega * Math.max(0, Number(nodeGroundPf[node]) || 0) * 1e-12));
  }
  if (mutual) {
    for (let row = 0; row < stages; row += 1) {
      for (let col = row + 1; col < stages; col += 1) {
        const pf = Math.max(0, Number(mutual[row]?.[col]) || 0);
        if (pf > 0) addBranch(row, col, c(0, omega * pf * 1e-12));
      }
    }
  } else {
    for (let node = 1; node < stages; node += 1) {
      addBranch(node - 1, node, c(0, omega * Math.max(0, circuit.parasiticPf || 0) * 1e-12));
    }
  }

  const sourceBranch = seriesAdmittance(branchResistanceOhm);
  addShunt(0, sourceBranch);
  rhs[0] = cAdd(rhs[0], cMul(sourceBranch, sourceVoltage));
  for (let node = 1; node < stages; node += 1) {
    addBranch(node - 1, node, seriesAdmittance(branchResistanceOhm));
  }

  const solution = solveComplexLinear(matrix, rhs);
  return solution ? cAbs(solution[stages - 1]) : Number.NaN;
}

function electromagneticResponseSamples(circuit, p, resistanceOhm, minimumHz = 1e6, maximumHz = 5e9, steps = 320) {
  const samples = [];
  for (let index = 0; index <= steps; index += 1) {
    const frequencyHz = minimumHz * (maximumHz / minimumHz) ** (index / steps);
    const magnitude = electromagneticTransferMagnitude(circuit, p, frequencyHz, resistanceOhm);
    samples.push({
      frequencyHz,
      magnitudeDb: Number.isFinite(magnitude) && magnitude > 0 ? 20 * Math.log10(magnitude) : Number.NaN
    });
  }
  return samples;
}

function matchedModalOscillator(circuit, resonanceFrequencyHz, resistanceOhm) {
  const nodeGroundPf = Array.isArray(circuit.shuntCapPfByNode) && circuit.shuntCapPfByNode.length
    ? circuit.shuntCapPfByNode
    : [Math.max(0, circuit.shuntCapPf || 0)];
  const effectiveCapacitanceF = Math.max(
    1e-18,
    nodeGroundPf.reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0) / nodeGroundPf.length * 1e-12
  );
  const omega0 = 2 * Math.PI * resonanceFrequencyHz;
  const effectiveInductanceH = 1 / (omega0 ** 2 * effectiveCapacitanceF);
  const dampingRatio = Math.max(0, resistanceOhm) / 2 * Math.sqrt(effectiveCapacitanceF / effectiveInductanceH);
  const samples = [];
  const minimumHz = 1e6;
  const maximumHz = 5e9;
  const steps = 320;
  for (let index = 0; index <= steps; index += 1) {
    const frequencyHz = minimumHz * (maximumHz / minimumHz) ** (index / steps);
    const omega = 2 * Math.PI * frequencyHz;
    const denominator = c(
      1 - omega ** 2 * effectiveInductanceH * effectiveCapacitanceF,
      omega * Math.max(0, resistanceOhm) * effectiveCapacitanceF
    );
    const magnitude = cAbs(cDiv(c(1, 0), denominator));
    samples.push({
      frequencyHz,
      magnitudeDb: magnitude > 0 ? 20 * Math.log10(magnitude) : Number.NaN
    });
  }
  return {
    effectiveCapacitanceF,
    effectiveInductanceH,
    dampingRatio,
    dampedNaturalFrequencyHz: dampingRatio < 1
      ? resonanceFrequencyHz * Math.sqrt(1 - dampingRatio ** 2)
      : Number.NaN,
    resonantPeakFrequencyHz: dampingRatio < 1 / Math.sqrt(2)
      ? resonanceFrequencyHz * Math.sqrt(1 - 2 * dampingRatio ** 2)
      : Number.NaN,
    samples
  };
}

function coupledModePredictions(circuit, p, minimumHz = 1e6, maximumHz = 5e9) {
  const lowLossResistanceOhm = 0.35;
  const physicalResistanceOhm = Math.max(0.01, Number(circuit.stageResistanceOhm) || 0.01);
  const reference = electromagneticResponseSamples(
    circuit,
    p,
    lowLossResistanceOhm,
    Math.max(1, minimumHz),
    Math.max(minimumHz * 1.01, maximumHz),
    720
  );
  const modes = reference.filter((sample, index) => (
    index > 0
    && index + 1 < reference.length
    && sample.magnitudeDb > reference[index - 1].magnitudeDb
    && sample.magnitudeDb > reference[index + 1].magnitudeDb
  )).map((sample) => {
    const modal = matchedModalOscillator(circuit, sample.frequencyHz, physicalResistanceOhm);
    return {
      naturalFrequencyHz: sample.frequencyHz,
      lowLossMagnitudeDb: sample.magnitudeDb,
      loadedPeakFrequencyHz: modal.resonantPeakFrequencyHz,
      dampingRatio: modal.dampingRatio
    };
  });
  return { lowLossResistanceOhm, physicalResistanceOhm, modes };
}

function fullWaveResonanceHints() {
  const frequencies = params.full_wave_frequencies_hz || [];
  if (frequencies.length < 2) return [];
  const minimumHz = Math.min(...frequencies);
  const maximumHz = Math.max(...frequencies);
  const circuit = electromagneticCircuitForCurrentDesign();
  const prediction = coupledModePredictions(circuit, params, minimumHz, maximumHz);
  const modes = [...prediction.modes].sort((left, right) => right.lowLossMagnitudeDb - left.lowLossMagnitudeDb);
  const hints = [];
  modes.slice(0, 4).forEach((mode) => {
    hints.push(mode.naturalFrequencyHz);
    if (Number.isFinite(mode.loadedPeakFrequencyHz)) hints.push(mode.loadedPeakFrequencyHz);
  });
  return [...new Set(hints
    .filter((frequency) => Number.isFinite(frequency) && frequency >= minimumHz && frequency <= maximumHz)
    .map((frequency) => Number(frequency.toPrecision(12))))]
    .sort((left, right) => left - right)
    .slice(0, 8);
}

function drawElectromagneticSlide(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const circuit = electromagneticCircuitForCurrentDesign();
  const inductanceH = electromagneticStageInductanceH(params);
  const physicalResistance = Math.max(0.01, Number(circuit.stageResistanceOhm) || 0.01);
  const lowLossResistance = 0.35;
  const reference = electromagneticResponseSamples(circuit, params, lowLossResistance);
  const damped = electromagneticResponseSamples(circuit, params, physicalResistance);
  const plot = { x0: 86, y0: 82, x1: 815, y1: 480 };
  const yMinimum = -180;
  const yMaximum = 40;
  const xFor = (frequencyHz) => plot.x0 + (Math.log10(frequencyHz) - 6) / (Math.log10(5e9) - 6) * (plot.x1 - plot.x0);
  const yFor = (db) => plot.y1 - (Math.max(yMinimum, Math.min(yMaximum, db)) - yMinimum) / (yMaximum - yMinimum) * (plot.y1 - plot.y0);
  const peakOf = (samples) => samples.reduce((best, sample) => (
    Number.isFinite(sample.magnitudeDb) && (!best || sample.magnitudeDb > best.magnitudeDb) ? sample : best
  ), null);
  const referencePeaks = reference.filter((sample, index) => (
    index > 0
    && index + 1 < reference.length
    && sample.magnitudeDb > reference[index - 1].magnitudeDb
    && sample.magnitudeDb > reference[index + 1].magnitudeDb
  ));
  const referencePeak = referencePeaks[0] || peakOf(reference);
  const modal = matchedModalOscillator(
    circuit,
    referencePeak?.frequencyHz || 1 / (2 * Math.PI * Math.sqrt(inductanceH * Math.max(1e-18, circuit.shuntCapPf * 1e-12))),
    physicalResistance
  );
  const dampedAtReference = referencePeak
    ? damped.reduce((best, sample) => (
        Math.abs(Math.log(sample.frequencyHz / referencePeak.frequencyHz)) < Math.abs(Math.log(best.frequencyHz / referencePeak.frequencyHz)) ? sample : best
      ), damped[0])
    : null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#17202a";
  ctx.font = "22px Arial";
  ctx.fillText("Intrinsic coupled-stage electromagnetic response", plot.x0, 48);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(plot.x0, plot.y0, plot.x1 - plot.x0, plot.y1 - plot.y0);
  ctx.strokeStyle = "#cbd4dc";
  ctx.strokeRect(plot.x0, plot.y0, plot.x1 - plot.x0, plot.y1 - plot.y0);

  [-160, -120, -80, -40, 0, 40].forEach((tick) => {
    const y = yFor(tick);
    ctx.strokeStyle = "#e0e6eb";
    ctx.beginPath();
    ctx.moveTo(plot.x0, y);
    ctx.lineTo(plot.x1, y);
    ctx.stroke();
    ctx.fillStyle = "#5b6670";
    ctx.font = "14px Arial";
    ctx.textAlign = "right";
    ctx.fillText(`${tick}`, plot.x0 - 10, y + 5);
  });
  [1e6, 1e7, 1e8, 1e9, 5e9].forEach((tick) => {
    const x = xFor(tick);
    ctx.strokeStyle = "#e0e6eb";
    ctx.beginPath();
    ctx.moveTo(x, plot.y0);
    ctx.lineTo(x, plot.y1);
    ctx.stroke();
    ctx.fillStyle = "#5b6670";
    ctx.textAlign = "center";
    ctx.fillText(formatFrequency(tick), x, plot.y1 + 24);
  });
  ctx.save();
  ctx.translate(24, (plot.y0 + plot.y1) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = "#5b6670";
  ctx.textAlign = "center";
  ctx.fillText("Vout / Vin (dB)", 0, 0);
  ctx.restore();

  const drawCurve = (samples, color, dash = []) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.setLineDash(dash);
    ctx.beginPath();
    let started = false;
    samples.forEach((sample) => {
      if (!Number.isFinite(sample.magnitudeDb)) return;
      const x = xFor(sample.frequencyHz);
      const y = yFor(sample.magnitudeDb);
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();
  };
  drawCurve(reference, "#1f6f78");
  drawCurve(damped, "#b73e3e", [9, 6]);
  drawCurve(modal.samples, "#7354a3", [3, 5]);

  referencePeaks.forEach((peak, index) => {
    const resonanceX = xFor(peak.frequencyHz);
    ctx.save();
    ctx.strokeStyle = "#7354a3";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.moveTo(resonanceX, plot.y0);
    ctx.lineTo(resonanceX, plot.y1);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "#7354a3";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`f0,${index + 1}`, resonanceX, plot.y0 + 16 + index * 15);
  });

  drawSlideLegend(ctx, [
    { label: `Low-loss reference (${formatResistance(lowLossResistance)}/stage)`, color: "#1f6f78" },
    { label: `Coupled model + ${formatResistance(physicalResistance)}/stage`, color: "#b73e3e", dashed: [9, 6] },
    { label: "Matched single-mode RLC + same R", color: "#7354a3", dashed: [3, 5] }
  ], 835, 88, { maxWidth: 235 });

  const cgPf = Array.isArray(circuit.shuntCapPfByNode)
    ? circuit.shuntCapPfByNode.reduce((sum, value) => sum + value, 0) / circuit.shuntCapPfByNode.length
    : circuit.shuntCapPf;
  const cards = [
    ["Partial L / stage", `${(inductanceH * 1e9).toFixed(2)} nH`],
    ["Matched effective L", `${(modal.effectiveInductanceH * 1e9).toFixed(2)} nH`],
    ["Low-loss natural modes", referencePeaks.length ? referencePeaks.slice(0, 2).map((peak) => formatFrequency(peak.frequencyHz)).join(" / ") : "--"],
    ["Physical damping ratio", modal.dampingRatio >= 1000 ? modal.dampingRatio.toExponential(1) : modal.dampingRatio.toFixed(2)],
    ["RLC peak with physical R", Number.isFinite(modal.resonantPeakFrequencyHz) ? formatFrequency(modal.resonantPeakFrequencyHz) : "none; overdamped"]
  ];
  cards.forEach(([label, value], index) => {
    const x = 845;
    const y = 190 + index * 59;
    ctx.fillStyle = "#f5f2ea";
    ctx.fillRect(x, y, 215, 50);
    ctx.fillStyle = "#5b6670";
    ctx.font = "13px Arial";
    ctx.textAlign = "left";
    ctx.fillText(label, x + 12, y + 18);
    ctx.fillStyle = "#17202a";
    ctx.font = "20px Arial";
    ctx.fillText(value, x + 12, y + 42);
  });
  ctx.fillStyle = "#5b6670";
  ctx.font = "14px Arial";
  ctx.textAlign = "left";
  drawWrappedLines(ctx, [
    "Capacitance: current exact FEniCSx matrix when available.",
    `Modal check: mean Cg ${formatCapacitance(cgPf)}; Leff is chosen so zero-R f0 equals the first coupled peak.`,
    "For zeta < 1/sqrt(2), fpeak = f0 sqrt(1 - 2 zeta^2). With the physical R this mode is overdamped, so no shifted amplitude peak exists.",
    "The cable is excluded because a lumped cable capacitor is invalid in this frequency range."
  ], 86, 522, 18, "#5b6670", "13px Arial", 955);
}

function drawEqsSlide(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const sweep = window.DISCOIDAL_DEFAULT_EQS_SWEEP;
  const samples = Array.isArray(sweep?.samples) ? sweep.samples : [];
  const plot = { x0: 88, y0: 72, x1: 815, y1: 492 };
  const xFor = (frequencyHz) => plot.x0 + Math.log10(Math.max(1, frequencyHz)) / 8 * (plot.x1 - plot.x0);
  const yFor = (db) => plot.y1 - (Math.max(-90, Math.min(0, db)) + 90) / 90 * (plot.y1 - plot.y0);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#17202a";
  ctx.font = "22px Arial";
  ctx.textAlign = "left";
  ctx.fillText("Field-derived loaded transfer", plot.x0, 42);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(plot.x0, plot.y0, plot.x1 - plot.x0, plot.y1 - plot.y0);
  ctx.strokeStyle = "#cbd4dc";
  ctx.strokeRect(plot.x0, plot.y0, plot.x1 - plot.x0, plot.y1 - plot.y0);

  [-90, -75, -60, -45, -30, -15, 0].forEach((tick) => {
    const y = yFor(tick);
    ctx.strokeStyle = "#e0e6eb";
    ctx.beginPath();
    ctx.moveTo(plot.x0, y);
    ctx.lineTo(plot.x1, y);
    ctx.stroke();
    ctx.fillStyle = "#5b6670";
    ctx.font = "14px Arial";
    ctx.textAlign = "right";
    ctx.fillText(String(tick), plot.x0 - 10, y + 5);
  });
  [1, 10, 100, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8].forEach((tick) => {
    const x = xFor(tick);
    ctx.strokeStyle = "#e0e6eb";
    ctx.beginPath();
    ctx.moveTo(x, plot.y0);
    ctx.lineTo(x, plot.y1);
    ctx.stroke();
    ctx.fillStyle = "#5b6670";
    ctx.font = "13px Arial";
    ctx.textAlign = "center";
    ctx.fillText(formatFrequency(tick), x, plot.y1 + 24);
  });
  ctx.save();
  ctx.translate(26, (plot.y0 + plot.y1) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = "#5b6670";
  ctx.font = "14px Arial";
  ctx.textAlign = "center";
  ctx.fillText("Vout / Vin (dB)", 0, 0);
  ctx.restore();

  if (samples.length) {
    ctx.strokeStyle = "#1f6f78";
    ctx.lineWidth = 4;
    ctx.beginPath();
    samples.forEach((sample, index) => {
      const x = xFor(sample.frequencyHz);
      const y = yFor(sample.magnitudeDb);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    samples.forEach((sample) => {
      ctx.fillStyle = "#b73e3e";
      ctx.beginPath();
      ctx.arc(xFor(sample.frequencyHz), yFor(sample.magnitudeDb), 4.5, 0, 2 * Math.PI);
      ctx.fill();
    });
  } else {
    ctx.fillStyle = "#b73e3e";
    ctx.font = "18px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Saved EQS sweep unavailable", (plot.x0 + plot.x1) / 2, (plot.y0 + plot.y1) / 2);
  }

  const validation = sweep?.validation || {};
  const meshTransferValues = Object.values(validation.mesh1kHzDb || {}).map(Number).filter(Number.isFinite);
  const meshTransferRangeDb = meshTransferValues.length >= 2
    ? Math.max(...meshTransferValues) - Math.min(...meshTransferValues)
    : NaN;
  const cards = [
    ["FEA mesh", sweep ? `${sweep.meshMm.toFixed(2)} mm · ${sweep.cells.toLocaleString()} cells` : "--"],
    ["1 kHz transfer", samples.length ? `${samples.find((sample) => sample.frequencyHz === 1000)?.magnitudeDb.toFixed(2)} dB` : "--"],
    ["High-f plateau", samples.length ? `${samples.at(-1).magnitudeDb.toFixed(2)} dB` : "--"],
    ["Mesh change @ 1 kHz", Number.isFinite(meshTransferRangeDb) ? `${meshTransferRangeDb.toFixed(5)} dB` : "--"],
    ["C diagonal vs electrostatic", Number.isFinite(validation.capacitanceComparison?.diagonalDifferencePercent) ? `${validation.capacitanceComparison.diagonalDifferencePercent.toFixed(2)}%` : "--"],
    ["C mutual vs electrostatic", Number.isFinite(validation.capacitanceComparison?.mutualDifferencePercent) ? `${validation.capacitanceComparison.mutualDifferencePercent.toFixed(2)}%` : "--"]
  ];
  cards.forEach(([label, value], index) => {
    const x = 842;
    const y = 72 + index * 66;
    ctx.fillStyle = "#f5f2ea";
    ctx.fillRect(x, y, 220, 56);
    ctx.fillStyle = "#5b6670";
    ctx.font = "13px Arial";
    ctx.textAlign = "left";
    ctx.fillText(label, x + 12, y + 20);
    ctx.fillStyle = "#17202a";
    ctx.font = "19px Arial";
    drawEngineeringText(ctx, value, x + 12, y + 45);
  });
  drawWrappedLines(ctx, [
    "Solid line and points: saved FEniCSx full-stack EQS solutions.",
    "The continuous MELF cylinder is calibrated to 12 MΩ per stage; the physical helix still requires 3D validation."
  ], 88, 540, 19, "#5b6670", "14px Arial", 965);
}

function drawIntrinsicComparisonSlide(canvas, spiceOnly = false) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const sweep = window.DISCOIDAL_DEFAULT_EQS_SWEEP;
  const samples = Array.isArray(sweep?.samples) ? sweep.samples : [];
  const validation = sweep?.validation || {};
  const plot = { x0: 88, y0: 72, x1: 815, y1: 492 };
  const xFor = (frequencyHz) => plot.x0 + Math.log10(Math.max(1, frequencyHz)) / 8 * (plot.x1 - plot.x0);
  const yFor = (db) => plot.y1 - (Math.max(-60, Math.min(0, db)) + 60) / 60 * (plot.y1 - plot.y0);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#17202a";
  ctx.font = "22px Arial";
  ctx.textAlign = "left";
  ctx.fillText(spiceOnly ? "Intrinsic SPICE transfer" : "Intrinsic field / SPICE comparison", plot.x0, 42);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(plot.x0, plot.y0, plot.x1 - plot.x0, plot.y1 - plot.y0);
  ctx.strokeStyle = "#cbd4dc";
  ctx.strokeRect(plot.x0, plot.y0, plot.x1 - plot.x0, plot.y1 - plot.y0);

  [-60, -50, -40, -30, -20, -10, 0].forEach((tick) => {
    const y = yFor(tick);
    ctx.strokeStyle = "#e0e6eb";
    ctx.beginPath();
    ctx.moveTo(plot.x0, y);
    ctx.lineTo(plot.x1, y);
    ctx.stroke();
    ctx.fillStyle = "#5b6670";
    ctx.font = "14px Arial";
    ctx.textAlign = "right";
    ctx.fillText(String(tick), plot.x0 - 10, y + 5);
  });
  [1, 10, 100, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8].forEach((tick) => {
    const x = xFor(tick);
    ctx.strokeStyle = "#e0e6eb";
    ctx.beginPath();
    ctx.moveTo(x, plot.y0);
    ctx.lineTo(x, plot.y1);
    ctx.stroke();
    ctx.fillStyle = "#5b6670";
    ctx.font = "13px Arial";
    ctx.textAlign = "center";
    ctx.fillText(formatFrequency(tick), x, plot.y1 + 24);
  });
  ctx.save();
  ctx.translate(26, (plot.y0 + plot.y1) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = "#5b6670";
  ctx.font = "14px Arial";
  ctx.textAlign = "center";
  ctx.fillText("Vout / Vin (dB)", 0, 0);
  ctx.restore();

  const drawSeries = (key, color, dash = [], points = false) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.setLineDash(dash);
    ctx.beginPath();
    samples.forEach((sample, index) => {
      const x = xFor(sample.frequencyHz);
      const y = yFor(sample[key]);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();
    if (points) samples.forEach((sample) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(xFor(sample.frequencyHz), yFor(sample[key]), 4.5, 0, 2 * Math.PI);
      ctx.fill();
    });
  };
  if (samples.length) {
    if (!spiceOnly) drawSeries("intrinsicFieldDb", "#1f6f78", [], true);
    drawSeries("intrinsicSpiceDb", "#b73e3e", [9, 6]);
  }

  const oneKhz = samples.find((sample) => sample.frequencyHz === 1000);
  const meshTransferValues = Object.values(validation.mesh1kHzDb || {}).map(Number).filter(Number.isFinite);
  const meshTransferRangeDb = meshTransferValues.length >= 2
    ? Math.max(...meshTransferValues) - Math.min(...meshTransferValues)
    : NaN;
  const cards = spiceOnly ? [
    ["Input condition", "Plate 1 = 1 V"],
    ["Output condition", "Open circuit"],
    ["External network", "None"],
    ["1 kHz transfer", oneKhz ? `${oneKhz.intrinsicSpiceDb.toFixed(2)} dB` : "--"],
    ["High-f plateau", samples.length ? `${samples.at(-1).intrinsicSpiceDb.toFixed(2)} dB` : "--"],
    ["Elements retained", "Rstage, Cg, Cpar"]
  ] : [
    ["FEA mesh", sweep ? `${sweep.meshMm.toFixed(2)} mm · ${sweep.cells.toLocaleString()} cells` : "--"],
    ["1 kHz FEniCSx", oneKhz ? `${oneKhz.intrinsicFieldDb.toFixed(2)} dB` : "--"],
    ["1 kHz SPICE", oneKhz ? `${oneKhz.intrinsicSpiceDb.toFixed(2)} dB` : "--"],
    ["Worst curve difference", Number.isFinite(validation.maxLumpedComparisonDifferenceDb) ? `${validation.maxLumpedComparisonDifferenceDb.toFixed(2)} dB` : "--"],
    ["Mesh change @ 1 kHz", Number.isFinite(meshTransferRangeDb) ? `${meshTransferRangeDb.toFixed(5)} dB` : "--"],
    ["Output condition", "Open circuit"]
  ];
  cards.forEach(([label, value], index) => {
    const x = 842;
    const y = 72 + index * 66;
    ctx.fillStyle = "#f5f2ea";
    ctx.fillRect(x, y, 220, 56);
    ctx.fillStyle = "#5b6670";
    ctx.font = "13px Arial";
    ctx.textAlign = "left";
    ctx.fillText(label, x + 12, y + 20);
    ctx.fillStyle = "#17202a";
    ctx.font = "19px Arial";
    ctx.fillText(value, x + 12, y + 45);
  });
  drawSlideLegend(ctx, spiceOnly ? [
    { label: "Intrinsic SPICE: no external network", color: "#b73e3e", dashed: [9, 6] }
  ] : [
    { label: "FEniCSx EQS, open output", color: "#1f6f78" },
    { label: "Intrinsic SPICE, same ports", color: "#b73e3e", dashed: [9, 6] }
  ], 88, 520, { maxWidth: 430 });
  drawWrappedLines(ctx, spiceOnly ? [
    "The source is the first bias plate itself; the output is the final bias plate at infinite impedance."
  ] : [
    "Both curves remove the source resistor, output resistor, cable, detector, and load conductance.",
    "The continuous MELF cylinder is calibrated to 12 MΩ per stage; the physical helix still requires 3D validation."
  ], 88, 570, 18, "#5b6670", "13px Arial", 965);
}

function attenuationSamples(circuit, p) {
  const fMin = ATTENUATION_PLOT_FMIN_HZ;
  const fMax = ATTENUATION_PLOT_FMAX_HZ;
  const samples = [];
  const steps = 140;
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const frequency = fMin * (fMax / fMin) ** t;
    const magnitude = Math.max(1e-12, singleStageTransferMagnitude(circuit, frequency));
    samples.push({
      frequency,
      magnitude,
      attenuationDb: -20 * Math.log10(magnitude)
    });
  }
  return { samples, fMin, fMax };
}

function formatAttenuationDb(db) {
  if (!Number.isFinite(db)) return "--";
  if (Math.abs(db) >= 100) return `${db.toFixed(0)} dB`;
  return `${db.toFixed(1)} dB`;
}

function drawRcCapacitor(ctx, x, nodeY, groundY) {
  const plateWidth = 58;
  const plateGap = 18;
  const capCenterY = (nodeY + groundY) / 2;
  const upperPlateY = capCenterY - plateGap / 2;
  const lowerPlateY = capCenterY + plateGap / 2;

  ctx.save();
  ctx.strokeStyle = "#17202a";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, nodeY);
  ctx.lineTo(x, upperPlateY);
  ctx.moveTo(x - plateWidth / 2, upperPlateY);
  ctx.lineTo(x + plateWidth / 2, upperPlateY);
  ctx.moveTo(x - plateWidth / 2, lowerPlateY);
  ctx.lineTo(x + plateWidth / 2, lowerPlateY);
  ctx.moveTo(x, lowerPlateY);
  ctx.lineTo(x, groundY);
  ctx.stroke();
  ctx.restore();
}

function drawRcResistor(ctx, x0, y, x1) {
  const leadLength = Math.min(34, Math.max(18, (x1 - x0) * 0.18));
  const zigStart = x0 + leadLength;
  const zigEnd = x1 - leadLength;
  const amplitude = 17;
  const peaks = 8;

  ctx.save();
  ctx.strokeStyle = "#17202a";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(zigStart, y);
  for (let peak = 0; peak < peaks; peak += 1) {
    const x = zigStart + (zigEnd - zigStart) * (peak + 0.5) / peaks;
    const yy = y + (peak % 2 === 0 ? -amplitude : amplitude);
    ctx.lineTo(x, yy);
  }
  ctx.lineTo(zigEnd, y);
  ctx.lineTo(x1, y);
  ctx.stroke();
  ctx.restore();
}

function drawRcLabel(ctx, text, x, y, options = {}) {
  const {
    align = "left",
    color = "#17202a",
    font = "24px Arial",
    background = "#fffdf8",
    paddingX = 6,
    paddingY = 4
  } = options;

  ctx.save();
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  const metrics = ctx.measureText(text);
  const width = metrics.width;
  const height = parseInt(font, 10) || 20;
  const x0 = align === "center" ? x - width / 2 : align === "right" ? x - width : x;
  ctx.fillStyle = background;
  ctx.fillRect(x0 - paddingX, y - height - paddingY, width + 2 * paddingX, height + 2 * paddingY);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawRcParasiticCapacitor(ctx, x0, nodeY, x1, branchY) {
  const capX = (x0 + x1) / 2;
  const plateGap = 26;
  const plateHeight = 42;
  const leftPlateX = capX - plateGap / 2;
  const rightPlateX = capX + plateGap / 2;

  ctx.save();
  ctx.strokeStyle = "#1f6f78";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(x0, nodeY);
  ctx.lineTo(x0, branchY);
  ctx.lineTo(leftPlateX, branchY);
  ctx.moveTo(rightPlateX, branchY);
  ctx.lineTo(x1, branchY);
  ctx.lineTo(x1, nodeY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(leftPlateX, branchY - plateHeight / 2);
  ctx.lineTo(leftPlateX, branchY + plateHeight / 2);
  ctx.moveTo(rightPlateX, branchY - plateHeight / 2);
  ctx.lineTo(rightPlateX, branchY + plateHeight / 2);
  ctx.stroke();
  ctx.restore();

  return { capX, labelX: rightPlateX + 22, labelY: branchY - 16 };
}

function drawRcDiagram(canvas) {
  const ctx = canvas.getContext("2d");
  const analyticCircuit = circuitEstimates(params);
  const feaCapacitance = feaCapacitanceForCurrentDesign();
  const circuit = feaCapacitance
    ? circuitWithFeaCapacitances(analyticCircuit, params, feaCapacitance)
    : {
        ...analyticCircuit,
        shuntCapPf: Number.NaN,
        totalGroundCapPf: Number.NaN,
        parasiticPf: Number.NaN,
        parasiticRatio: Number.NaN,
        cornerHz: Number.NaN,
        parasiticTakeoverHz: Number.NaN
      };
  const hasFeaStageCapacitances = Number.isFinite(circuit.shuntCapPf)
    && circuit.shuntCapPf > 0
    && Number.isFinite(circuit.parasiticPf)
    && circuit.parasiticPf >= 0;
  const nodeGroundCapacitances = circuit.shuntCapPfByNode || [];
  const adjacentParasiticCapacitances = circuit.parasiticPfByAdjacentPair || [];
  const w = canvas.width;
  const h = canvas.height;
  const y = h * 0.27;
  const groundY = h * 0.49;
  const xs = [w * 0.18, w * 0.43];
  const capCenterY = (y + 14 + groundY) / 2;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#17202a";
  ctx.lineWidth = 4;

  for (const x of xs) {
    drawRcCapacitor(ctx, x, y, groundY);
  }

  drawRcResistor(ctx, xs[0], y, xs[1]);

  const cparLabel = drawRcParasiticCapacitor(ctx, xs[0], y, xs[1], y - 106);

  ctx.strokeStyle = "#557a38";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(w * 0.1, groundY);
  ctx.lineTo(w * 0.62, groundY);
  ctx.stroke();

  drawSubscriptText(ctx, [
    { text: "R" },
    { text: "stage", sub: true },
    { text: ` ${formatResistance(circuit.stageResistanceOhm)}` }
  ], w * 0.18, y - 38, { font: "24px Arial", background: "#fffdf8" });
  drawSubscriptText(ctx, [
    { text: "C" },
    { text: "g", sub: true },
    { text: " avg" },
    { text: ` ${formatCapacitance(circuit.shuntCapPf)}` }
  ], xs[1] + 56, capCenterY + 4, { font: "24px Arial", background: "#fffdf8" });
  drawSubscriptText(ctx, [
    { text: "C" },
    { text: "par", sub: true },
    { text: " adj avg" },
    { text: ` ${formatCapacitance(circuit.parasiticPf)}` }
  ], cparLabel.labelX, cparLabel.labelY, { font: "24px Arial", background: "#fffdf8" });
  drawRcLabel(ctx, `RC corner ${formatFrequency(circuit.cornerHz)}`, w * 0.66, y - 38);
  drawSubscriptText(ctx, [
    { text: "C" },
    { text: "par", sub: true },
    { text: "/C" },
    { text: "g", sub: true },
    { text: Number.isFinite(circuit.parasiticRatio) ? ` ${(100 * circuit.parasiticRatio).toFixed(2)}%` : " --" }
  ], w * 0.66, y - 6, { color: "#5b6670", font: "19px Arial", background: "#fffdf8" });
  drawSubscriptText(ctx, [
    { text: "|X" },
    { text: "C,par", sub: true },
    { text: "| = R" },
    { text: "stage", sub: true },
    { text: ` at ${formatFrequency(circuit.parasiticTakeoverHz)}` }
  ], w * 0.66, y + 28, { color: "#5b6670", font: "19px Arial", background: "#fffdf8" });

  drawRcLabel(
    ctx,
    feaCapacitance
      ? `FEA matrix + added Cg: ${feaCapacitance.solverLabel}`
      : "FEA capacitances: run matching solve",
    w * 0.66,
    y + 62,
    {
      color: feaCapacitance ? "#315a73" : "#b73e3e",
      font: "17px Arial",
      background: "#fffdf8"
    }
  );
  if (feaCapacitance) {
    drawWrappedLines(ctx, [
      `Circuit Cg by bias node: ${nodeGroundCapacitances.map(formatCapacitance).join(", ")}`,
      `Added Cg: ${formatCapacitance(additionalGroundCapacitancePf(params))} per node; FEA Cpar is unchanged.`,
      `Cpar by adjacent pair: ${
        adjacentParasiticCapacitances.length
          ? adjacentParasiticCapacitances.map(formatCapacitance).join(", ")
          : "none"
      }`
    ], w * 0.66, y + 86, 21, "#5b6670", "15px Arial", w * 0.31);
  }

  if (hasFeaStageCapacitances) {
    drawAttenuationPlot(ctx, circuit, params, w * 0.10, h * 0.59, w * 0.78, h * 0.32);
  } else {
    const plotX = w * 0.10;
    const plotY = h * 0.59;
    const plotWidth = w * 0.78;
    const plotHeight = h * 0.32;
    ctx.fillStyle = "#f5f2ea";
    ctx.strokeStyle = "#c9c1b0";
    ctx.lineWidth = 1;
    ctx.fillRect(plotX, plotY, plotWidth, plotHeight);
    ctx.strokeRect(plotX, plotY, plotWidth, plotHeight);
    ctx.fillStyle = "#17202a";
    ctx.font = "23px Arial";
    ctx.fillText("Run a matching FEA solve to calculate the one-section response.", plotX + 42, plotY + 78);
    drawWrappedLines(ctx, [
      "Cg is the matching FEA bias-node-to-ground value plus any entered additional Cg.",
      "Cpar is the average matching FEA mutual capacitance between adjacent bias nodes."
    ], plotX + 42, plotY + 120, 27, "#5b6670", "17px Arial", plotWidth - 84);
  }
}

function drawAttenuationPlot(ctx, circuit, p, x, y, width, height) {
  const { samples, fMin, fMax } = attenuationSamples(circuit, p);
  const capRatioLimitDb = highFrequencyCapRatioAttenuationDb(circuit);
  const fiftyHzAttenuationDb = singleStageAttenuationDb(circuit, 50);
  const plottedMax = Math.max(
    ...samples.map((sample) => sample.attenuationDb),
    Number.isFinite(capRatioLimitDb) ? capRatioLimitDb : 0,
    Number.isFinite(fiftyHzAttenuationDb) ? fiftyHzAttenuationDb : 0
  );
  const maxDb = Math.max(20, Math.ceil(plottedMax / 10) * 10);
  const yTicks = [0, maxDb / 2, maxDb];
  const xFor = (frequency) => x + ((Math.log10(frequency) - Math.log10(fMin)) / (Math.log10(fMax) - Math.log10(fMin))) * width;
  const yFor = (db) => y + height - (db / maxDb) * height;

  ctx.save();
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = "#c9c1b0";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);

  for (const tick of yTicks) {
    const yy = yFor(tick);
    ctx.strokeStyle = "rgba(201, 193, 176, 0.8)";
    ctx.beginPath();
    ctx.moveTo(x, yy);
    ctx.lineTo(x + width, yy);
    ctx.stroke();
    ctx.fillStyle = "#5b6670";
    ctx.font = "15px Arial";
    ctx.fillText(`${tick.toFixed(0)} dB`, x - 58, yy + 5);
  }

  const decadeStart = Math.ceil(Math.log10(fMin));
  const decadeEnd = Math.floor(Math.log10(fMax));
  for (let decade = decadeStart; decade <= decadeEnd; decade += 1) {
    const frequency = 10 ** decade;
    const xx = xFor(frequency);
    ctx.strokeStyle = "rgba(201, 193, 176, 0.55)";
    ctx.beginPath();
    ctx.moveTo(xx, y);
    ctx.lineTo(xx, y + height);
    ctx.stroke();
    ctx.fillStyle = "#5b6670";
    ctx.font = "14px Arial";
    ctx.fillText(formatFrequency(frequency), xx - 22, y + height + 22);
  }

  ctx.strokeStyle = "#1f6f78";
  ctx.lineWidth = 4;
  ctx.beginPath();
  samples.forEach((sample, index) => {
    const xx = xFor(sample.frequency);
    const yy = yFor(sample.attenuationDb);
    if (index === 0) ctx.moveTo(xx, yy);
    else ctx.lineTo(xx, yy);
  });
  ctx.stroke();

  if (Number.isFinite(capRatioLimitDb)) {
    const yy = yFor(capRatioLimitDb);
    ctx.strokeStyle = "#8b5a2b";
    ctx.lineWidth = 3;
    ctx.setLineDash([9, 7]);
    ctx.beginPath();
    ctx.moveTo(x, yy);
    ctx.lineTo(x + width, yy);
    ctx.stroke();
    ctx.setLineDash([]);
    const labelY = Math.min(y + height - 8, yy + 24);
    drawSubscriptText(ctx, [
      { text: "HF C" },
      { text: "par", sub: true },
      { text: "/C" },
      { text: "g", sub: true },
      { text: ` limit ${formatAttenuationDb(capRatioLimitDb)}` }
    ], x + width - 300, labelY, { color: "#8b5a2b", font: "16px Arial", background: "#fffdf8" });
  }

  if (Number.isFinite(fiftyHzAttenuationDb) && 50 >= fMin && 50 <= fMax) {
    const xx = xFor(50);
    const yy = yFor(fiftyHzAttenuationDb);
    ctx.fillStyle = "#b73e3e";
    ctx.strokeStyle = "#fffdf8";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(xx, yy, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fill();
    ctx.strokeStyle = "#b73e3e";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(xx - 8, yy - 8);
    ctx.lineTo(xx - 62, yy - 38);
    ctx.stroke();
    drawRcLabel(ctx, `50 Hz ${formatAttenuationDb(fiftyHzAttenuationDb)}`, xx - 68, yy - 34, {
      align: "right",
      color: "#b73e3e",
      font: "16px Arial",
      background: "#fffdf8"
    });
  }

  if (Number.isFinite(circuit.cornerHz) && circuit.cornerHz >= fMin && circuit.cornerHz <= fMax) {
    const xx = xFor(circuit.cornerHz);
    ctx.strokeStyle = "#557a38";
    ctx.lineWidth = 3;
    ctx.setLineDash([4, 7]);
    ctx.beginPath();
    ctx.moveTo(xx, y);
    ctx.lineTo(xx, y + height);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = "16px Arial";
    const label = "RC corner";
    const labelWidth = ctx.measureText(label).width;
    const labelX = Math.max(x + 8, xx - labelWidth - 14);
    drawRcLabel(ctx, label, labelX, y + 34, {
      color: "#557a38",
      font: "16px Arial",
      background: "#fffdf8"
    });
  }

  if (Number.isFinite(circuit.parasiticTakeoverHz) && circuit.parasiticTakeoverHz >= fMin && circuit.parasiticTakeoverHz <= fMax) {
    const xx = xFor(circuit.parasiticTakeoverHz);
    ctx.strokeStyle = "#b73e3e";
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(xx, y);
    ctx.lineTo(xx, y + height);
    ctx.stroke();
    ctx.setLineDash([]);
    drawSubscriptText(ctx, [
      { text: "|X" },
      { text: "C,par", sub: true },
      { text: "| = R" },
      { text: "stage", sub: true }
    ], xx + 8, y + height - 18, { color: "#b73e3e", font: "16px Arial", background: "#fffdf8" });
  }

  ctx.fillStyle = "#17202a";
  ctx.font = "20px Arial";
  drawSubscriptText(ctx, [
    { text: "One-section example: attenuation dB, -20 log" },
    { text: "10", sub: true },
    { text: "(|V" },
    { text: "out", sub: true },
    { text: "/V" },
    { text: "in", sub: true },
    { text: "|)" }
  ], x, y - 14, { color: "#17202a", font: "20px Arial" });
  ctx.fillStyle = "#5b6670";
  ctx.font = "15px Arial";
  ctx.fillText("10× voltage noise reduction = 20 dB", x + width - 280, y - 14);
  ctx.restore();
}

function biasPlateCount(p) {
  return Math.max(1, Math.floor(p.plate_pairs));
}

function feaCapacitanceForCurrentDesign() {
  const solved = solvedCapacitanceForCurrentDesign();
  if (!solved || !lastResult) return null;
  return {
    ...solved,
    solverLabel: resultSolverLabel(lastResult)
  };
}

function equivalentCircuitWithTotalCap(circuit, p, totalCapPf) {
  const plates = biasPlateCount(p);
  const shuntCapPf = totalCapPf > 0 ? totalCapPf / plates : Number.NaN;
  const cornerHz = Number.isFinite(circuit.stageResistanceOhm) && shuntCapPf > 0
    ? 1 / (2 * Math.PI * circuit.stageResistanceOhm * shuntCapPf * 1e-12)
    : Number.NaN;
  return {
    ...circuit,
    shuntCapPf,
    parasiticRatio: circuit.parasiticPf / shuntCapPf,
    cornerHz
  };
}

function circuitWithFeaCapacitances(circuit, p, feaCapacitance) {
  const stages = biasPlateCount(p);
  const network = feaCapacitance.network;
  const nodeGroundRaw = network?.node_ground_pf ?? network?.nodeGroundPf;
  const mutualRaw = network?.mutual_pf_matrix ?? network?.mutualPfMatrix;
  const geometricNodeGroundPf = Array.isArray(nodeGroundRaw) && nodeGroundRaw.length === stages
    ? nodeGroundRaw.map((value) => Math.max(0, Number(value) || 0))
    : Array.from({ length: stages }, () => feaCapacitance.totalPf / stages);
  const addedGroundCapPf = additionalGroundCapacitancePf(p);
  const nodeGroundPf = geometricNodeGroundPf.map((value) => value + addedGroundCapPf);
  const mutualCapPfMatrix = Array.isArray(mutualRaw) && mutualRaw.length === stages
    ? mutualRaw.map((row) => (
        Array.isArray(row) && row.length === stages
          ? row.map((value) => Math.max(0, Number(value) || 0))
          : Array(stages).fill(0)
      ))
    : null;
  const electricalGroundRaw = network?.electrical_node_ground_pf ?? network?.electricalNodeGroundPf;
  const electricalMutualRaw = network?.electrical_mutual_pf_matrix ?? network?.electricalMutualPfMatrix;
  const electricalCount = stages + 2;
  const hasFeaPortNetwork = Array.isArray(electricalGroundRaw)
    && electricalGroundRaw.length === electricalCount
    && Array.isArray(electricalMutualRaw)
    && electricalMutualRaw.length === electricalCount;
  const electricalNodeGroundCapPf = hasFeaPortNetwork
    ? electricalGroundRaw.map((value) => Math.max(0, Number(value) || 0))
    : [0, ...geometricNodeGroundPf, 0];
  const electricalMutualCapPfMatrix = hasFeaPortNetwork
    ? electricalMutualRaw.map((row) => (
        Array.isArray(row) && row.length === electricalCount
          ? row.map((value) => Math.max(0, Number(value) || 0))
          : Array(electricalCount).fill(0)
      ))
    : null;
  const adjacentParasiticPf = mutualCapPfMatrix
    ? Array.from({ length: Math.max(0, stages - 1) }, (_, index) => mutualCapPfMatrix[index][index + 1])
    : Array.from({ length: Math.max(0, stages - 1) }, () => Number(feaCapacitance.parasiticPf));
  const shuntCapPf = nodeGroundPf.reduce((sum, value) => sum + value, 0) / stages;
  const parasiticPf = adjacentParasiticPf.length
    ? adjacentParasiticPf.reduce((sum, value) => sum + value, 0) / adjacentParasiticPf.length
    : 0;
  const stageResistanceOhm = circuit.stageResistanceOhm;
  const cornerHz = Number.isFinite(stageResistanceOhm) && stageResistanceOhm > 0 && shuntCapPf > 0
    ? 1 / (2 * Math.PI * stageResistanceOhm * shuntCapPf * 1e-12)
    : Number.NaN;
  const parasiticTakeoverHz = Number.isFinite(stageResistanceOhm)
    && stageResistanceOhm > 0
    && Number.isFinite(parasiticPf)
    && parasiticPf > 0
    ? 1 / (2 * Math.PI * stageResistanceOhm * parasiticPf * 1e-12)
    : Number.NaN;
  return {
    ...circuit,
    pairCapPf: (geometricNodeGroundPf.reduce((sum, value) => sum + value, 0) / stages) / 2,
    geometricShuntCapPf: geometricNodeGroundPf.reduce((sum, value) => sum + value, 0) / stages,
    geometricShuntCapPfByNode: geometricNodeGroundPf,
    additionalGroundCapacitancePf: addedGroundCapPf,
    shuntCapPf,
    shuntCapPfByNode: nodeGroundPf,
    totalGroundCapPf: nodeGroundPf.reduce((sum, value) => sum + value, 0),
    parasiticPf,
    parasiticPfByAdjacentPair: adjacentParasiticPf,
    mutualCapPfMatrix,
    electricalNodeGroundCapPf,
    electricalMutualCapPfMatrix,
    hasFeaPortNetwork,
    inputPortGroundCapPf: electricalNodeGroundCapPf[0],
    outputPortGroundCapPf: electricalNodeGroundCapPf.at(-1),
    parasiticRatio: Number.isFinite(parasiticPf) && shuntCapPf > 0
      ? parasiticPf / shuntCapPf
      : Number.NaN,
    cornerHz,
    parasiticTakeoverHz
  };
}

function scaledSingleStageAttenuationDb(circuit, p, frequencyHz, includeLoad = false) {
  const sections = activeSeriesSectionCount(circuit, p, includeLoad);
  if (sections <= 0) return 0;
  const oneStage = singleStageAttenuationDb(
    circuit,
    frequencyHz,
    includeLoad ? loadConductanceS(p) : 0,
    includeLoad ? loadCapacitancePf(p) : 0
  );
  return Number.isFinite(oneStage) ? sections * oneStage : Number.NaN;
}

function admittanceSweep(capacitancePf, p, fMin, fMax, steps = 140) {
  const samples = [];
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const frequency = fMin * (fMax / fMin) ** t;
    samples.push(admittanceAtFrequency(capacitancePf, p, frequency));
  }
  return samples;
}

function logScaleBounds(values, padding = 0.25) {
  const positives = values.filter((value) => Number.isFinite(value) && value > 0);
  if (!positives.length) return { min: 1e-15, max: 1e-9 };
  const min = Math.min(...positives);
  const max = Math.max(...positives);
  return {
    min: 10 ** Math.floor(Math.log10(min) - padding),
    max: 10 ** Math.ceil(Math.log10(max) + padding)
  };
}

function drawLogPlotFrame(ctx, x, y, width, height, fMin, fMax, yMin, yMax, options = {}) {
  const xFor = (frequency) => x + ((Math.log10(frequency) - Math.log10(fMin)) / (Math.log10(fMax) - Math.log10(fMin))) * width;
  const yFor = (value) => y + height - ((Math.log10(value) - Math.log10(yMin)) / (Math.log10(yMax) - Math.log10(yMin))) * height;

  ctx.save();
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = "#c9c1b0";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);

  const fStart = Math.ceil(Math.log10(fMin));
  const fEnd = Math.floor(Math.log10(fMax));
  for (let decade = fStart; decade <= fEnd; decade += 1) {
    const frequency = 10 ** decade;
    const xx = xFor(frequency);
    ctx.strokeStyle = "rgba(201, 193, 176, 0.55)";
    ctx.beginPath();
    ctx.moveTo(xx, y);
    ctx.lineTo(xx, y + height);
    ctx.stroke();
    ctx.fillStyle = "#5b6670";
    ctx.font = "13px Arial";
    ctx.fillText(formatFrequency(frequency), xx - 22, y + height + 22);
  }

  const yStart = Math.ceil(Math.log10(yMin));
  const yEnd = Math.floor(Math.log10(yMax));
  for (let decade = yStart; decade <= yEnd; decade += 1) {
    const value = 10 ** decade;
    const yy = yFor(value);
    ctx.strokeStyle = "rgba(201, 193, 176, 0.75)";
    ctx.beginPath();
    ctx.moveTo(x, yy);
    ctx.lineTo(x + width, yy);
    ctx.stroke();
    ctx.fillStyle = "#5b6670";
    ctx.font = "13px Arial";
    ctx.textAlign = "right";
    ctx.fillText(options.yFormatter ? options.yFormatter(value) : value.toExponential(0), x - 10, yy + 4);
    ctx.textAlign = "left";
  }

  ctx.fillStyle = "#17202a";
  ctx.font = "19px Arial";
  if (options.title) ctx.fillText(options.title, x, y - 18);
  if (options.yLabel) ctx.fillText(options.yLabel, x - 66, y - 18);
  ctx.restore();
  return { xFor, yFor, left: x, right: x + width, top: y, bottom: y + height };
}

function drawLogCurve(ctx, samples, xFor, yFor, valueKey, color, options = {}) {
  const valid = samples.filter((sample) => Number.isFinite(sample.frequencyHz ?? sample.frequency) && Number.isFinite(sample[valueKey]) && sample[valueKey] > 0);
  if (!valid.length) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = options.lineWidth || 4;
  if (options.dashed) ctx.setLineDash(options.dashed);
  ctx.beginPath();
  valid.forEach((sample, index) => {
    const frequency = sample.frequencyHz ?? sample.frequency;
    const xx = xFor(frequency);
    const yy = yFor(sample[valueKey]);
    if (index === 0) ctx.moveTo(xx, yy);
    else ctx.lineTo(xx, yy);
  });
  ctx.stroke();
  ctx.restore();
}

function wrappedLegendLines(ctx, text, maxWidth) {
  if (!Number.isFinite(maxWidth) || maxWidth <= 0) return [String(text)];
  const words = String(translateCanvasText(text)).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(candidate).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [String(text)];
}

function drawSlideLegend(ctx, entries, x, y, options = {}) {
  ctx.save();
  ctx.textAlign = "left";
  let yy = y;
  const font = options.font || "17px Arial";
  const lineHeight = options.lineHeight || 20;
  const rowGap = options.rowGap || 8;
  const labelX = x + 46;
  const labelWidth = Number.isFinite(options.maxWidth) ? options.maxWidth : null;
  entries.forEach((entry) => {
    ctx.strokeStyle = entry.color;
    ctx.lineWidth = 4;
    if (entry.dashed) ctx.setLineDash(entry.dashed);
    ctx.beginPath();
    ctx.moveTo(x, yy - 6);
    ctx.lineTo(x + 34, yy - 6);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = entry.color;
    ctx.font = font;
    const lines = wrappedLegendLines(ctx, entry.label, labelWidth);
    lines.forEach((line, lineIndex) => {
      drawEngineeringText(ctx, line, labelX, yy + lineIndex * lineHeight);
    });
    yy += Math.max(28, lines.length * lineHeight + rowGap);
  });
  ctx.restore();
}

function drawLegacyCapacitanceExtractionOverviewSlide(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const feaCap = feaCapacitanceForCurrentDesign();
  const network = feaCap?.network;
  const nodeGroundPf = network?.node_ground_pf ?? network?.nodeGroundPf ?? [];
  const model = network?.visualization_model ?? network?.visualizationModel ?? null;
  const components = componentsFromGeometrySummary(model?.geometry);
  const states = model?.excitation_states ?? model?.excitationStates ?? [];

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#17202a";
  ctx.font = "22px Arial";
  ctx.fillText("Bias-to-ground capacitance: one solved unit-voltage basis field", 48, 40);

  if (!components || !states.length) {
    ctx.fillStyle = "#f5f2ea";
    ctx.strokeStyle = "#c9c1b0";
    ctx.fillRect(70, 88, 960, 390);
    ctx.strokeRect(70, 88, 960, 390);
    ctx.fillStyle = "#17202a";
    ctx.font = "25px Arial";
    ctx.fillText("Run a matching FEniCSx field solve to load the capacitance model.", 112, 174);
    drawWrappedLines(ctx, [
      "The completed slide uses the normalized full-stack r-z geometry returned by the backend.",
      "It shows one bias plate at 1 V, every other conductor at 0 V, and the resistive core retained as dielectric."
    ], 112, 232, 32, "#5b6670", "19px Arial", 835);
    ctx.fillStyle = "#17202a";
    ctx.font = "21px Arial";
    ctx.fillText("Cii = 2Ui / V\u00B2", 112, 350);
    drawEngineeringText(ctx, "Cg,i = Maxwell row sum for node i", 112, 390);
    return;
  }

  const state = states.find((candidate) => {
    const potentials = candidate.bias_plate_potentials_v
      ?? candidate.biasPlatePotentialsV
      ?? {};
    return Object.values(potentials).filter((value) => Number(value) > 0.5).length === 1;
  }) ?? states[0];
  const bounds = model.solved_bounds_mm ?? model.solvedBoundsMm;
  const zMin = Number(bounds.z_min ?? bounds.zMin);
  const zMax = Number(bounds.z_max ?? bounds.zMax);
  const rMin = Number(bounds.r_min ?? bounds.rMin ?? 0);
  const rMax = Number(bounds.r_max ?? bounds.rMax);
  const groundPotential = Number(model.ground_potential_v ?? model.groundPotentialV ?? 0);
  const coreEpsr = Number(model.core_relative_permittivity ?? model.coreRelativePermittivity);
  const biasPotentials = state.bias_plate_potentials_v ?? state.biasPlatePotentialsV ?? {};
  const activeEntry = Object.entries(biasPotentials)
    .find(([, potential]) => Number(potential) > 0.5);
  const activeMatch = activeEntry?.[0]?.match(/(\d+)$/);
  const activeNode = activeMatch ? Number(activeMatch[1]) : 0;
  const ciiPf = Number(state.capacitance_pf ?? state.capacitancePf);
  const selectedCgPf = Number(nodeGroundPf[activeNode]);

  const geometryPanel = { x: 35, y: 68, width: 690, height: 424 };
  const detailPanel = { x: 750, y: 68, width: 315, height: 424 };
  for (const panel of [geometryPanel, detailPanel]) {
    ctx.fillStyle = "#f5f2ea";
    ctx.strokeStyle = "#c9c1b0";
    ctx.lineWidth = 1.5;
    ctx.fillRect(panel.x, panel.y, panel.width, panel.height);
    ctx.strokeRect(panel.x, panel.y, panel.width, panel.height);
  }

  ctx.fillStyle = "#17202a";
  ctx.font = "18px Arial";
  ctx.fillText(`Basis field for bias node ${activeNode + 1}`, geometryPanel.x + 18, geometryPanel.y + 28);

  const plot = {
    x: geometryPanel.x + 20,
    y: geometryPanel.y + 48,
    width: geometryPanel.width - 40,
    height: geometryPanel.height - 78
  };
  const zSpan = Math.max(zMax - zMin, 0.001);
  const rSpan = Math.max(rMax - rMin, 0.001);
  const scale = Math.min((plot.width - 8) / zSpan, (plot.height - 8) / rSpan);
  const modelWidth = zSpan * scale;
  const modelHeight = rSpan * scale;
  const originX = plot.x + (plot.width - modelWidth) / 2;
  const originY = plot.y + (plot.height + modelHeight) / 2;
  const metrics = {
    x: (z) => originX + (z - zMin) * scale,
    y: (r) => originY - (r - rMin) * scale
  };
  const materialColors = {
    epoxy: "#c8dcdf",
    washer: "#d9bf6a",
    ferrite: "#ad8058"
  };
  const groundColor = "#315a73";
  const activeColor = "#c46a32";
  const zeroBiasColor = "#8a949c";

  ctx.fillStyle = materialColors.epoxy;
  ctx.fillRect(originX, originY - modelHeight, modelWidth, modelHeight);
  ctx.save();
  ctx.beginPath();
  ctx.rect(originX, originY - modelHeight, modelWidth, modelHeight);
  ctx.clip();
  for (const material of ["epoxy", "washer", "ferrite", "ground", "hv"]) {
    for (const component of components) {
      if (component.material !== material) continue;
      if (material === "hv") {
        const potential = Number(biasPotentials[component.name] ?? 0);
        ctx.fillStyle = potential > 0.5 ? activeColor : zeroBiasColor;
      } else if (material === "ground") {
        ctx.fillStyle = groundColor;
      } else {
        ctx.fillStyle = materialColors[material];
      }
      ctx.globalAlpha = material === "epoxy" ? 0.32 : 1;
      drawRzProfileFill(ctx, metrics, component.profile);
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  ctx.strokeStyle = "#69747d";
  ctx.lineWidth = 1.2;
  ctx.strokeRect(originX, originY - modelHeight, modelWidth, modelHeight);
  ctx.strokeStyle = groundColor;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(originX, metrics.y(rMax));
  ctx.lineTo(originX + modelWidth, metrics.y(rMax));
  ctx.stroke();
  ctx.strokeStyle = "#17202a";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(originX, metrics.y(0));
  ctx.lineTo(originX + modelWidth, metrics.y(0));
  ctx.stroke();

  ctx.fillStyle = "#5b6670";
  ctx.font = "14px Arial";
  ctx.fillText(
    `orange: selected bias at 1 V | gray: other bias at 0 V | blue: ground at ${formatPotentialV(groundPotential)}`,
    geometryPanel.x + 18,
    geometryPanel.y + geometryPanel.height - 13
  );

  ctx.fillStyle = "#17202a";
  ctx.font = "18px Arial";
  ctx.fillText("Energy extraction", detailPanel.x + 18, detailPanel.y + 30);
  ctx.font = "21px Arial";
  ctx.fillText("Ui = 1/2 \u222B \u03B5|\u2207\u03C6i|\u00B2 dV", detailPanel.x + 18, detailPanel.y + 78);
  ctx.fillText("Cii = 2Ui / V\u00B2", detailPanel.x + 18, detailPanel.y + 118);
  drawEngineeringText(ctx, "Cg,i = \u03A3j Cij", detailPanel.x + 18, detailPanel.y + 158);
  ctx.fillStyle = "#5b6670";
  ctx.font = "15px Arial";
  drawWrappedLines(ctx, [
    "The row sum retains only coupling from the selected bias plate to grounded conductors.",
    `Core: dielectric, \u03B5r ${Number.isFinite(coreEpsr) ? coreEpsr.toFixed(1) : "--"}`
  ], detailPanel.x + 18, detailPanel.y + 198, 23, "#5b6670", "15px Arial", 275);

  ctx.fillStyle = "#17202a";
  ctx.font = "18px Arial";
  ctx.fillText(
    `Cii = ${Number.isFinite(ciiPf) ? formatCapacitance(ciiPf) : "--"}`,
    detailPanel.x + 18,
    detailPanel.y + 294
  );
  ctx.fillStyle = activeColor;
  ctx.font = "22px Arial";
  drawEngineeringText(
    ctx,
    `Cg,${activeNode + 1} = ${Number.isFinite(selectedCgPf) ? formatCapacitance(selectedCgPf) : "--"}`,
    detailPanel.x + 18,
    detailPanel.y + 337
  );
  ctx.fillStyle = "#5b6670";
  ctx.font = "14px Arial";
  drawWrappedLines(ctx, [
    "The complete Maxwell row, rather than Cii alone, is passed to SPICE."
  ], detailPanel.x + 18, detailPanel.y + 375, 20, "#5b6670", "14px Arial", 275);

  ctx.fillStyle = "#17202a";
  ctx.font = "17px Arial";
  ctx.fillText("FEA capacitance to ground by bias node", 48, 530);
  drawWrappedLines(ctx, [
    nodeGroundPf.length
      ? nodeGroundPf.map((value, index) => `Cg,${index + 1} = ${formatCapacitance(value)}`).join("   |   ")
      : "Run a matching FEniCSx solve to obtain the node-resolved values."
  ], 48, 563, 23, "#5b6670", "16px Arial", 1000);
}

function drawCapacitanceExtractionOverviewSlide(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const feaCapacitance = feaCapacitanceForCurrentDesign();
  const comparison = feaCapacitance?.groundComparison;

  // Repeating-cell solves deliberately omit the additional one- and three-bias
  // comparison models. In that mode, show the node-resolved Maxwell extraction
  // from the geometry that was actually solved instead of leaving a stale prompt.
  if (!comparison && feaCapacitance?.network) {
    drawLegacyCapacitanceExtractionOverviewSlide(canvas);
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#17202a";
  ctx.font = "22px Arial";
  ctx.fillText("Two independent FEniCSx extractions of bias-to-ground capacitance", 42, 38);

  if (!comparison) {
    ctx.fillStyle = "#f5f2ea";
    ctx.strokeStyle = "#c9c1b0";
    ctx.fillRect(70, 82, 960, 400);
    ctx.strokeRect(70, 82, 960, 400);
    ctx.fillStyle = "#17202a";
    ctx.font = "25px Arial";
    drawEngineeringText(ctx, "Run a matching FEniCSx field solve to compare both Cg methods.", 112, 172);
    drawWrappedLines(ctx, [
      "One model contains a single bias plate, so its energy gives Cg directly.",
      "The second contains three bias plates and subtracts the middle plate's mutual capacitance to both neighbors."
    ], 112, 230, 34, "#5b6670", "19px Arial", 835);
    ctx.fillStyle = "#17202a";
    ctx.font = "23px Arial";
    drawEngineeringText(ctx, "Cg,m = (Cm - Cn + Ca) / 2 = Cm - Nneighbors Cpar", 112, 365);
    return;
  }

  const value = (snake, camel) => Number(comparison[snake] ?? comparison[camel]);
  const singlePf = value("single_bias_geometry_pf", "singleBiasGeometryPf");
  const middlePf = value("three_bias_middle_only_equivalent_pf", "threeBiasMiddleOnlyEquivalentPf");
  const neighborsPf = value("three_bias_neighbors_only_equivalent_pf", "threeBiasNeighborsOnlyEquivalentPf");
  const allPf = value("three_bias_all_bias_equivalent_pf", "threeBiasAllBiasEquivalentPf");
  const correctedPf = value("three_bias_middle_ground_pf", "threeBiasMiddleGroundPf");
  const overcountPf = value("three_bias_mutual_overcount_pf", "threeBiasMutualOvercountPf");
  const cparPf = value("three_bias_adjacent_cpar_pf", "threeBiasAdjacentCparPf");
  const neighborCount = value("three_bias_neighbor_count", "threeBiasNeighborCount");
  const differenceFraction = value("three_minus_single_fraction", "threeMinusSingleFraction");
  const singleModel = comparison.single_bias_visualization_model
    ?? comparison.singleBiasVisualizationModel;
  const threeModel = comparison.three_bias_visualization_model
    ?? comparison.threeBiasVisualizationModel;

  const drawModelPanel = (panel, title, model, preferredStateKey) => {
    ctx.fillStyle = "#f5f2ea";
    ctx.strokeStyle = "#c9c1b0";
    ctx.lineWidth = 1.4;
    ctx.fillRect(panel.x, panel.y, panel.width, panel.height);
    ctx.strokeRect(panel.x, panel.y, panel.width, panel.height);
    ctx.fillStyle = "#17202a";
    ctx.font = "18px Arial";
    ctx.fillText(title, panel.x + 16, panel.y + 26);

    const components = componentsFromGeometrySummary(model?.geometry);
    const states = model?.excitation_states ?? model?.excitationStates ?? [];
    const state = states.find((candidate) => candidate.key === preferredStateKey) ?? states[0];
    const bounds = model?.solved_bounds_mm ?? model?.solvedBoundsMm;
    if (!components || !state || !bounds) {
      ctx.fillStyle = "#5b6670";
      ctx.font = "17px Arial";
      ctx.fillText("Comparison geometry unavailable", panel.x + 28, panel.y + 110);
      return;
    }

    const zMin = Number(bounds.z_min ?? bounds.zMin);
    const zMax = Number(bounds.z_max ?? bounds.zMax);
    const rMin = Number(bounds.r_min ?? bounds.rMin ?? 0);
    const rMax = Number(bounds.r_max ?? bounds.rMax);
    const plot = {
      x: panel.x + 18,
      y: panel.y + 43,
      width: panel.width - 36,
      height: panel.height - 84
    };
    const zSpan = Math.max(zMax - zMin, 0.001);
    const rSpan = Math.max(rMax - rMin, 0.001);
    const scale = Math.min((plot.width - 6) / zSpan, (plot.height - 6) / rSpan);
    const modelWidth = zSpan * scale;
    const modelHeight = rSpan * scale;
    const originX = plot.x + (plot.width - modelWidth) / 2;
    const originY = plot.y + (plot.height + modelHeight) / 2;
    const metrics = {
      x: (z) => originX + (z - zMin) * scale,
      y: (r) => originY - (r - rMin) * scale
    };
    const potentials = state.bias_plate_potentials_v ?? state.biasPlatePotentialsV ?? {};
    const materialColors = { epoxy: "#c8dcdf", washer: "#d9bf6a", ferrite: "#ad8058" };
    const groundColor = "#315a73";
    const activeColor = "#c46a32";
    const zeroBiasColor = "#8a949c";

    ctx.fillStyle = materialColors.epoxy;
    ctx.fillRect(originX, originY - modelHeight, modelWidth, modelHeight);
    ctx.save();
    ctx.beginPath();
    ctx.rect(originX, originY - modelHeight, modelWidth, modelHeight);
    ctx.clip();
    for (const material of ["epoxy", "washer", "ferrite", "ground", "hv"]) {
      for (const component of components) {
        if (component.material !== material) continue;
        if (material === "hv") {
          ctx.fillStyle = Number(potentials[component.name] ?? 0) > 0.5
            ? activeColor
            : zeroBiasColor;
        } else if (material === "ground") {
          ctx.fillStyle = groundColor;
        } else {
          ctx.fillStyle = materialColors[material];
        }
        ctx.globalAlpha = material === "epoxy" ? 0.32 : 1;
        drawRzProfileFill(ctx, metrics, component.profile);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.strokeStyle = "#69747d";
    ctx.lineWidth = 1.1;
    ctx.strokeRect(originX, originY - modelHeight, modelWidth, modelHeight);
    ctx.fillStyle = "#5b6670";
    ctx.font = "13px Arial";
    ctx.fillText("orange 1 V | gray bias 0 V | blue ground 0 V", panel.x + 16, panel.y + panel.height - 14);
  };

  drawModelPanel(
    { x: 28, y: 62, width: 500, height: 305 },
    "A  One bias plate: direct Cg",
    singleModel,
    "single_bias_only"
  );
  drawModelPanel(
    { x: 572, y: 62, width: 500, height: 305 },
    "B  Three-bias matrix: middle-only basis",
    threeModel,
    "middle_only"
  );

  const boxes = [
    {
      x: 38,
      title: "One-bias direct",
      main: formatCapacitance(singlePf),
      detail: "C1 = 2U1 / V2"
    },
    {
      x: 385,
      title: "Middle-only diagonal",
      main: formatCapacitance(middlePf),
      detail: `includes ${formatCapacitance(overcountPf)} = ${neighborCount.toFixed(0)} x ${formatCapacitance(cparPf)}`
    },
    {
      x: 732,
      title: "Three-bias corrected",
      main: formatCapacitance(correctedPf),
      detail: Number.isFinite(differenceFraction)
        ? `vs one-bias: ${(100 * differenceFraction).toFixed(2)}%`
        : "comparison unavailable"
    }
  ];
  boxes.forEach((box, index) => {
    ctx.fillStyle = index === 1 ? "#f7e7df" : "#eef3ea";
    ctx.strokeStyle = index === 1 ? "#c46a32" : "#799260";
    ctx.lineWidth = 1.4;
    ctx.fillRect(box.x, 392, 322, 104);
    ctx.strokeRect(box.x, 392, 322, 104);
    ctx.fillStyle = "#5b6670";
    ctx.font = "15px Arial";
    ctx.fillText(box.title, box.x + 16, 418);
    ctx.fillStyle = "#17202a";
    ctx.font = "25px Arial";
    ctx.fillText(box.main, box.x + 16, 454);
    ctx.fillStyle = "#5b6670";
    ctx.font = "14px Arial";
    ctx.fillText(box.detail, box.x + 16, 480);
  });

  ctx.fillStyle = "#17202a";
  ctx.font = "21px Arial";
  drawEngineeringText(ctx, "Cg,m = (Cm - Cn + Ca) / 2 = Cm - Nneighbors Cpar", 78, 535);
  ctx.fillStyle = "#5b6670";
  ctx.font = "15px Arial";
  ctx.fillText(
    `Cm ${formatCapacitance(middlePf)} | Cn ${formatCapacitance(neighborsPf)} | Ca ${formatCapacitance(allPf)}`,
    78,
    565
  );
  ctx.fillText("The full-design Maxwell row sum performs the same mutual-capacitance subtraction node by node.", 78, 592);
}

function drawCgPlateCountComparisonSlide(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const comparison = feaCapacitanceForCurrentDesign()?.cgMatrixComparison;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#17202a";
  ctx.font = "22px Arial";
  ctx.fillText("Exact-reflection solve plan and node-to-ground results", 48, 40);

  if (!comparison) {
    ctx.fillStyle = "#f5f2ea";
    ctx.strokeStyle = "#c9c1b0";
    ctx.fillRect(70, 88, 960, 380);
    ctx.strokeRect(70, 88, 960, 380);
    ctx.fillStyle = "#17202a";
    ctx.font = "25px Arial";
    ctx.fillText("Run a matching FEniCSx solve to compare the two matrices.", 112, 180);
    drawWrappedLines(ctx, [
      "The two-plate matrix solves one end basis plus all-bias.",
      "The three-plate matrix solves one end basis, the center basis, and all-bias; the far end is reused by exact reflection."
    ], 112, 238, 33, "#5b6670", "19px Arial", 835);
    return;
  }

  const readNumber = (snake, camel) => Number(comparison[snake] ?? comparison[camel]);
  const twoValues = comparison.two_bias_node_ground_pf ?? comparison.twoBiasNodeGroundPf ?? [];
  const threeValues = comparison.three_bias_node_ground_pf ?? comparison.threeBiasNodeGroundPf ?? [];
  const twoMean = readNumber("two_bias_mean_ground_pf", "twoBiasMeanGroundPf");
  const threeEnd = readNumber("three_bias_end_mean_ground_pf", "threeBiasEndMeanGroundPf");
  const threeCenter = readNumber("three_bias_center_ground_pf", "threeBiasCenterGroundPf");
  const endDelta = readNumber("three_end_minus_two_fraction", "threeEndMinusTwoFraction");
  const centerDelta = readNumber("three_center_minus_two_fraction", "threeCenterMinusTwoFraction");
  const twoSolves = readNumber("two_bias_energy_solve_count", "twoBiasEnergySolveCount");
  const threeSolves = readNumber("three_bias_energy_solve_count", "threeBiasEnergySolveCount");
  const twoSaved = readNumber("two_bias_solves_saved", "twoBiasSolvesSaved");
  const threeSaved = readNumber("three_bias_solves_saved", "threeBiasSolvesSaved");

  const drawPlan = (panel, plateCount, solves, saved) => {
    ctx.fillStyle = "#f5f2ea";
    ctx.strokeStyle = "#c9c1b0";
    ctx.lineWidth = 1.4;
    ctx.fillRect(panel.x, panel.y, panel.width, panel.height);
    ctx.strokeRect(panel.x, panel.y, panel.width, panel.height);
    ctx.fillStyle = "#17202a";
    ctx.font = "18px Arial";
    ctx.fillText(`${plateCount}-bias Maxwell matrix`, panel.x + 18, panel.y + 29);
    const nodeY = panel.y + 83;
    const spacing = plateCount === 2 ? 130 : 95;
    const startX = panel.x + panel.width / 2 - spacing * (plateCount - 1) / 2;
    for (let index = 0; index < plateCount; index += 1) {
      const mirrored = index === plateCount - 1;
      const x = startX + index * spacing;
      ctx.beginPath();
      ctx.arc(x, nodeY, 25, 0, Math.PI * 2);
      ctx.fillStyle = mirrored ? "#dbe8d1" : "#f1d8ca";
      ctx.fill();
      ctx.strokeStyle = mirrored ? "#557a38" : "#c46a32";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#17202a";
      ctx.font = "15px Arial";
      ctx.textAlign = "center";
      ctx.fillText(`${index + 1}`, x, nodeY + 5);
      ctx.fillStyle = "#5b6670";
      ctx.font = "12px Arial";
      ctx.fillText(mirrored ? "mirror" : "solve", x, nodeY + 47);
    }
    ctx.textAlign = "left";
    ctx.fillStyle = "#315a73";
    ctx.font = "18px Arial";
    ctx.fillText(`${solves.toFixed(0)} potential solves`, panel.x + 18, panel.y + 156);
    ctx.fillStyle = "#5b6670";
    ctx.font = "14px Arial";
    ctx.fillText(`${saved.toFixed(0)} reflected basis solve saved`, panel.x + 18, panel.y + 181);
  };

  drawPlan({ x: 45, y: 66, width: 470, height: 205 }, 2, twoSolves, twoSaved);
  drawPlan({ x: 585, y: 66, width: 470, height: 205 }, 3, threeSolves, threeSaved);

  ctx.fillStyle = "#17202a";
  ctx.font = "19px Arial";
  ctx.fillText("Node-to-ground capacitance from Maxwell row sums", 55, 310);
  const rows = [
    { label: "Two-bias symmetric node", value: twoMean, delta: 0, color: "#315a73" },
    { label: "Three-bias end node", value: threeEnd, delta: endDelta, color: "#c46a32" },
    { label: "Three-bias center node", value: threeCenter, delta: centerDelta, color: "#557a38" }
  ];
  const maxValue = Math.max(...rows.map((row) => row.value), 1) * 1.08;
  rows.forEach((row, index) => {
    const y = 344 + index * 68;
    ctx.fillStyle = "#5b6670";
    ctx.font = "15px Arial";
    ctx.fillText(row.label, 55, y + 17);
    ctx.fillStyle = "#ebe6db";
    ctx.fillRect(275, y, 580, 30);
    ctx.fillStyle = row.color;
    ctx.fillRect(275, y, 580 * row.value / maxValue, 30);
    ctx.fillStyle = "#17202a";
    ctx.font = "18px Arial";
    ctx.fillText(formatCapacitance(row.value), 875, y + 21);
    ctx.fillStyle = row.color;
    ctx.font = "15px Arial";
    ctx.fillText(
      index === 0 || !Number.isFinite(row.delta)
        ? "reference"
        : `${row.delta >= 0 ? "+" : ""}${(100 * row.delta).toFixed(3)}%`,
      985,
      y + 21
    );
  });

  ctx.fillStyle = "#5b6670";
  ctx.font = "15px Arial";
  ctx.fillText(
    `Two-node values: ${twoValues.map(formatCapacitance).join(", ")} | Three-node values: ${threeValues.map(formatCapacitance).join(", ")}`,
    55,
    568
  );
  ctx.fillStyle = "#805a36";
  ctx.fillText("Repeat interior adds no further equivalence for two or three bias plates.", 55, 596);
}

function drawFeaSanitySlide(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const circuit = circuitEstimates(params);
  const plates = biasPlateCount(params);
  const analyticTotalCapPf = circuit.totalGroundCapPf;
  const feaCap = feaCapacitanceForCurrentDesign();
  const feaTotalRatio = feaCap ? feaCap.totalPf / analyticTotalCapPf : Number.NaN;
  const formatRatioText = (ratio) => (Number.isFinite(ratio)
    ? `${ratio.toLocaleString(undefined, { maximumFractionDigits: 3 })}x`
    : "--");

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#17202a";
  ctx.font = "22px Arial";
  ctx.fillText("Total HV-to-ground capacitance", 92, 54);

  const capRows = [
    ["Analytic Ctotal", formatCapacitance(analyticTotalCapPf), `Cg per bias plate x ${plates}`],
    ["FEA Ctotal", feaCap ? formatCapacitance(feaCap.totalPf) : "not solved", feaCap ? feaCap.solverLabel : "run FEniCSx required"],
    ["FEA / analytic", formatRatioText(feaTotalRatio), "total Cg sanity ratio"]
  ];
  capRows.forEach((row, index) => {
    const x = 92 + index * 300;
    const y = 88;
    ctx.fillStyle = "#f5f2ea";
    ctx.strokeStyle = "#c9c1b0";
    ctx.lineWidth = 1;
    ctx.fillRect(x, y, 260, 96);
    ctx.strokeRect(x, y, 260, 96);
    ctx.fillStyle = "#5b6670";
    ctx.font = "15px Arial";
    ctx.fillText(row[0], x + 18, y + 28);
    ctx.fillStyle = "#17202a";
    ctx.font = "27px Arial";
    ctx.fillText(row[1], x + 18, y + 62);
    ctx.fillStyle = "#5b6670";
    ctx.font = "14px Arial";
    ctx.fillText(row[2], x + 18, y + 84);
  });

  const chartX = 150;
  const chartY = 250;
  const chartW = 760;
  const barH = 72;
  const maxCap = Math.max(analyticTotalCapPf, feaCap?.totalPf || 0, 1);
  const barRows = [
    { label: "Analytic washer overlap", value: analyticTotalCapPf, color: "#c46a32" },
    { label: "FEA energy integral", value: feaCap?.totalPf, color: "#315a73" }
  ];
  barRows.forEach((row, index) => {
    const y = chartY + index * 120;
    ctx.fillStyle = "#5b6670";
    ctx.font = "17px Arial";
    ctx.fillText(row.label, chartX, y - 12);
    ctx.fillStyle = "#ebe6db";
    ctx.fillRect(chartX, y, chartW, barH);
    const width = Number.isFinite(row.value) ? chartW * row.value / maxCap : 0;
    ctx.fillStyle = row.color;
    ctx.fillRect(chartX, y, width, barH);
    ctx.fillStyle = "#17202a";
    ctx.font = "24px Arial";
    ctx.fillText(Number.isFinite(row.value) ? formatCapacitance(row.value) : "not solved", chartX + 18, y + 45);
  });

  drawWrappedLines(ctx, [
    "All bias conductors are tied to V; every ground conductor and the tube are held at 0 V.",
    "The FEA value comes from Ctotal = 2U/V². Agreement checks the overall dielectric and geometry scale before using the detailed field result."
  ], 92, 520, 27, "#5b6670", "18px Arial", 910);
}

function drawLegacyCparExtractionSlide(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const circuit = circuitEstimates(params);
  const analyticPf = circuit.parasiticPf;
  const feaCap = feaCapacitanceForCurrentDesign();
  const feaPf = feaCap ? feaCap.parasiticPf : Number.NaN;
  const ratio = Number.isFinite(feaPf) && analyticPf > 0 ? feaPf / analyticPf : Number.NaN;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#17202a";
  ctx.font = "22px Arial";
  ctx.fillText("Three excitation states cancel capacitance to ground", 56, 48);

  const panelY = 78;
  const panelW = 300;
  const panelH = 330;
  const panelXs = [45, 400, 755];
  const groundColor = "#315a73";
  const activeColor = "#c46a32";
  const zeroBiasColor = "#8a949c";
  const epoxyColor = "#f2e7d5";

  const drawState = (x, title, activeBiases, symbol, subtitle) => {
    ctx.fillStyle = "#f5f2ea";
    ctx.strokeStyle = "#c9c1b0";
    ctx.lineWidth = 1;
    ctx.fillRect(x, panelY, panelW, panelH);
    ctx.strokeRect(x, panelY, panelW, panelH);
    ctx.fillStyle = "#17202a";
    ctx.font = "18px Arial";
    ctx.fillText(title, x + 18, panelY + 30);

    const axisX = x + 42;
    const tubeX = x + 250;
    const biasEndX = x + 205;
    ctx.fillStyle = epoxyColor;
    ctx.fillRect(axisX, panelY + 52, tubeX - axisX, 210);
    ctx.strokeStyle = "#b7aa94";
    ctx.strokeRect(axisX, panelY + 52, tubeX - axisX, 210);
    ctx.fillStyle = groundColor;
    ctx.fillRect(tubeX - 7, panelY + 52, 7, 210);
    ctx.fillStyle = "#5b6670";
    ctx.font = "12px Arial";
    ctx.fillText("axis", axisX - 12, panelY + 282);
    ctx.fillText("ground tube", tubeX - 58, panelY + 282);

    const groundYs = [panelY + 66, panelY + 126, panelY + 186, panelY + 246];
    const biasYs = [panelY + 96, panelY + 156, panelY + 216];
    groundYs.forEach((y) => {
      ctx.fillStyle = groundColor;
      ctx.fillRect(axisX + 62, y, tubeX - axisX - 62, 8);
    });
    biasYs.forEach((y, index) => {
      ctx.fillStyle = activeBiases.includes(index) ? activeColor : zeroBiasColor;
      ctx.fillRect(axisX, y, biasEndX - axisX, 8);
      ctx.fillStyle = activeBiases.includes(index) ? activeColor : "#5b6670";
      ctx.font = "12px Arial";
      ctx.fillText(activeBiases.includes(index) ? "V" : "0", biasEndX + 8, y + 8);
    });

    ctx.fillStyle = "#17202a";
    ctx.font = "25px Arial";
    ctx.fillText(symbol, x + 18, panelY + 300);
    ctx.fillStyle = "#5b6670";
    ctx.font = "14px Arial";
    ctx.fillText(subtitle, x + 85, panelY + 299);
  };

  drawState(panelXs[0], "A  Middle only", [1], "Cₘ", "2Uₘ / V²");
  drawState(panelXs[1], "B  Neighbors only", [0, 2], "Cₙ", "2Uₙ / V²");
  drawState(panelXs[2], "C  All bias plates", [0, 1, 2], "Cₐ", "2Uₐ / V²");

  ctx.fillStyle = "#17202a";
  ctx.font = "25px Arial";
  drawEngineeringText(ctx, "Cpar = (Cₘ + Cₙ − Cₐ) / (2 Nneighbors)", 82, 462);
  ctx.fillStyle = "#5b6670";
  ctx.font = "16px Arial";
  ctx.fillText("Energy polarization removes every term that couples only to ground.", 82, 491);

  const comparison = Number.isFinite(feaPf)
    ? `Current design: axial εA/d = ${formatCapacitance(analyticPf)}, shielded FEA = ${formatCapacitance(feaPf)} (${ratio.toLocaleString(undefined, { maximumFractionDigits: 3 })}x).`
    : `Current design: axial εA/d = ${formatCapacitance(analyticPf)}; run a matching FEniCSx solve for the shielded value.`;
  drawWrappedLines(ctx, [
    comparison,
    "The axial model assigns core and epoxy flux directly to the neighboring bias plate. In the real stack, the intervening grounded annulus intercepts part of that flux, so εA/d is expected to be high."
  ], 82, 535, 25, "#5b6670", "17px Arial", 940);
}

function drawCparExtractionSlide(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const circuit = circuitEstimates(params);
  const analyticPf = circuit.parasiticPf;
  const feaCap = feaCapacitanceForCurrentDesign();
  const feaPf = feaCap ? feaCap.parasiticPf : Number.NaN;
  const ratio = Number.isFinite(feaPf) && analyticPf > 0 ? feaPf / analyticPf : Number.NaN;
  const extraction = feaCap?.network || feaCap?.parasiticEstimate;
  const model = extraction?.visualization_model ?? extraction?.visualizationModel ?? null;
  const components = componentsFromGeometrySummary(model?.geometry);
  const states = model?.excitation_states ?? model?.excitationStates ?? [];

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#17202a";
  ctx.font = "22px Arial";
  ctx.fillText("FEniCSx capacitance-matrix model: solved region and boundary potentials", 56, 42);

  if (!components || states.length !== 3) {
    ctx.fillStyle = "#f5f2ea";
    ctx.strokeStyle = "#c9c1b0";
    ctx.fillRect(70, 92, 960, 330);
    ctx.strokeRect(70, 92, 960, 330);
    ctx.fillStyle = "#17202a";
    ctx.font = "25px Arial";
    ctx.fillText("Run a matching FEniCSx field solve to load the capacitance matrix.", 112, 180);
    drawWrappedLines(ctx, [
      "This slide intentionally does not rebuild the capacitance geometry from the browser controls.",
      "After a solve it displays the normalized full-stack model, dielectric core, two solved unit basis states, and their reconstructed sum returned by the backend."
    ], 112, 232, 30, "#5b6670", "19px Arial", 835);
    ctx.fillStyle = "#5b6670";
    ctx.font = "17px Arial";
    ctx.fillText(`Analytic axial estimate for the current controls: ${formatCapacitance(analyticPf)}`, 112, 370);
    return;
  }

  const bounds = model.solved_bounds_mm ?? model.solvedBoundsMm;
  const zMin = Number(bounds.z_min ?? bounds.zMin);
  const zMax = Number(bounds.z_max ?? bounds.zMax);
  const rMin = Number(bounds.r_min ?? bounds.rMin ?? 0);
  const rMax = Number(bounds.r_max ?? bounds.rMax);
  const groundPotential = Number(model.ground_potential_v ?? model.groundPotentialV ?? 0);
  const coreEpsr = Number(model.core_relative_permittivity ?? model.coreRelativePermittivity);
  const panelY = 62;
  const panelW = 300;
  const panelH = 365;
  const panelXs = [45, 400, 755];
  const groundColor = "#315a73";
  const activeColor = "#c46a32";
  const zeroBiasColor = "#8a949c";
  const materialColors = {
    epoxy: "#c8dcdf",
    washer: "#d9bf6a",
    ferrite: "#ad8058"
  };

  const drawState = (x, state, symbol) => {
    ctx.fillStyle = "#f5f2ea";
    ctx.strokeStyle = "#c9c1b0";
    ctx.lineWidth = 1;
    ctx.fillRect(x, panelY, panelW, panelH);
    ctx.strokeRect(x, panelY, panelW, panelH);
    ctx.fillStyle = "#17202a";
    ctx.font = "17px Arial";
    ctx.fillText(state.title, x + 16, panelY + 27);

    const plot = { x: x + 18, y: panelY + 43, width: panelW - 36, height: 238 };
    const zSpan = Math.max(zMax - zMin, 0.001);
    const rSpan = Math.max(rMax - rMin, 0.001);
    const scale = Math.min((plot.width - 8) / zSpan, (plot.height - 8) / rSpan);
    const modelWidth = zSpan * scale;
    const modelHeight = rSpan * scale;
    const originX = plot.x + (plot.width - modelWidth) / 2;
    const originY = plot.y + (plot.height + modelHeight) / 2;
    const metrics = {
      x: (z) => originX + (z - zMin) * scale,
      y: (r) => originY - (r - rMin) * scale
    };
    const biasPotentials = state.bias_plate_potentials_v ?? state.biasPlatePotentialsV ?? {};

    ctx.fillStyle = materialColors.epoxy;
    ctx.fillRect(originX, originY - modelHeight, modelWidth, modelHeight);
    ctx.save();
    ctx.beginPath();
    ctx.rect(originX, originY - modelHeight, modelWidth, modelHeight);
    ctx.clip();
    for (const material of ["epoxy", "washer", "ferrite", "ground", "hv"]) {
      for (const component of components) {
        if (component.material !== material) continue;
        if (material === "hv") {
          const potential = Number(biasPotentials[component.name] ?? 0);
          ctx.fillStyle = potential > 0.5 ? activeColor : zeroBiasColor;
        } else if (material === "ground") {
          ctx.fillStyle = groundColor;
        } else {
          ctx.fillStyle = materialColors[material];
        }
        ctx.globalAlpha = material === "epoxy" ? 0.32 : 1;
        drawRzProfileFill(ctx, metrics, component.profile);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    ctx.strokeStyle = "#69747d";
    ctx.lineWidth = 1.2;
    ctx.strokeRect(originX, originY - modelHeight, modelWidth, modelHeight);
    ctx.strokeStyle = groundColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(originX, metrics.y(rMax));
    ctx.lineTo(originX + modelWidth, metrics.y(rMax));
    ctx.stroke();
    ctx.strokeStyle = "#17202a";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(originX, metrics.y(0));
    ctx.lineTo(originX + modelWidth, metrics.y(0));
    ctx.stroke();

    ctx.fillStyle = "#17202a";
    ctx.font = "21px Arial";
    ctx.fillText(
      `${symbol} = ${formatCapacitance(Number(state.capacitance_pf ?? state.capacitancePf))}`,
      x + 16,
      panelY + 306
    );
    ctx.fillStyle = "#5b6670";
    ctx.font = "12px Arial";
    ctx.fillText(
      `orange 1 V | gray bias 0 V | blue ground ${formatPotentialV(groundPotential)}`,
      x + 16,
      panelY + 329
    );
    ctx.fillStyle = "#805a36";
    ctx.fillText(
      `brown core: dielectric, epsr ${Number.isFinite(coreEpsr) ? coreEpsr.toFixed(1) : "--"}`,
      x + 16,
      panelY + 350
    );
  };

  drawState(panelXs[0], states[0], "Cii");
  drawState(panelXs[1], states[1], "Cjj");
  drawState(panelXs[2], states[2], "Ci+j*");

  ctx.fillStyle = "#17202a";
  ctx.font = "20px Arial";
  drawEngineeringText(ctx, "Cij = \u222b 2\u03c0r \u03b5\u2080\u03b5r \u2207\u03c6i \u00b7 \u2207\u03c6j dA;   Cpar,i,j = -Cij", 82, 466);
  ctx.fillStyle = "#5b6670";
  ctx.font = "15px Arial";
  const mirroredBasisReused = states.some((state) => String(
    state.solution_source ?? state.solutionSource ?? ""
  ).startsWith("exact-reflection"));
  const twoNodeMirrorReuse = mirroredBasisReused
    && Number(extraction?.node_count ?? extraction?.nodeCount) === 2;
  ctx.fillText(
    twoNodeMirrorReuse
      ? "*B reuses the exact reflection of A; i+j uses the all-bias solve. No mirrored-node solve is run."
      : mirroredBasisReused
      ? "*The reflected end basis is reused; i+j is reconstructed without another potential solve."
      : "*The i+j state is reconstructed from linear basis fields; no additional solve is required.",
    82,
    492
  );

  const comparison = Number.isFinite(feaPf)
    ? `Current design: axial eps*A/d = ${formatCapacitance(analyticPf)}, shielded FEA = ${formatCapacitance(feaPf)} (${ratio.toLocaleString(undefined, { maximumFractionDigits: 3 })}x).`
    : `Current design: axial eps*A/d = ${formatCapacitance(analyticPf)}; run a matching FEniCSx solve for the shielded value.`;
  drawWrappedLines(ctx, [
    comparison,
    "The intervening grounded annulus intercepts part of the core and epoxy flux, so the axial parallel-plate estimate is expected to be high."
  ], 82, 528, 24, "#5b6670", "16px Arial", 940);
}

function loadedLadderSamples(circuit, p, fMin, fMax, steps = 150) {
  const loaded = [];
  const unloaded = [];
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const frequency = fMin * (fMax / fMin) ** t;
    loaded.push({
      frequency,
      attenuationDb: attenuationDbFromMagnitude(ladderTransferMagnitude(circuit, p, frequency, { includeLoad: true }))
    });
    unloaded.push({
      frequency,
      attenuationDb: attenuationDbFromMagnitude(ladderTransferMagnitude(circuit, p, frequency))
    });
  }
  return { loaded, unloaded };
}

function drawDbFrequencyFrame(ctx, x, y, width, height, fMin, fMax, maxDb, title) {
  const xFor = (frequency) => x + ((Math.log10(frequency) - Math.log10(fMin)) / (Math.log10(fMax) - Math.log10(fMin))) * width;
  const yFor = (db) => y + height - (Math.max(0, db) / maxDb) * height;
  ctx.save();
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = "#c9c1b0";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);

  [0, maxDb / 2, maxDb].forEach((tick) => {
    const yy = yFor(tick);
    ctx.strokeStyle = "rgba(201, 193, 176, 0.75)";
    ctx.beginPath();
    ctx.moveTo(x, yy);
    ctx.lineTo(x + width, yy);
    ctx.stroke();
    ctx.fillStyle = "#5b6670";
    ctx.font = "13px Arial";
    ctx.textAlign = "right";
    ctx.fillText(`${tick.toFixed(0)} dB`, x - 10, yy + 4);
    ctx.textAlign = "left";
  });

  for (let decade = Math.ceil(Math.log10(fMin)); decade <= Math.floor(Math.log10(fMax)); decade += 1) {
    const frequency = 10 ** decade;
    const xx = xFor(frequency);
    ctx.strokeStyle = "rgba(201, 193, 176, 0.55)";
    ctx.beginPath();
    ctx.moveTo(xx, y);
    ctx.lineTo(xx, y + height);
    ctx.stroke();
    ctx.fillStyle = "#5b6670";
    ctx.font = "13px Arial";
    ctx.fillText(formatFrequency(frequency), xx - 22, y + height + 22);
  }

  ctx.fillStyle = "#17202a";
  ctx.font = "19px Arial";
  ctx.fillText(title, x, y - 18);
  ctx.restore();
  return { xFor, yFor };
}

function drawLoadedLadderSlide(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const circuit = circuitEstimates(params);
  const cableCapPf = cableCapacitancePf(params);
  const detectorCapPf = detectorCapacitancePf(params);
  const externalLoadCapPf = cableCapPf + detectorCapPf;
  const loadG = loadConductanceS(params);
  const fMin = ATTENUATION_PLOT_FMIN_HZ;
  const fMax = ATTENUATION_PLOT_FMAX_HZ;
  const samples = loadedLadderSamples(circuit, params, fMin, fMax);
  const fiftyLoaded = attenuationDbFromMagnitude(ladderTransferMagnitude(circuit, params, 50, { includeLoad: true }));
  const plottedValues = [
    ...samples.loaded.map((sample) => sample.attenuationDb),
    ...samples.unloaded.map((sample) => sample.attenuationDb),
    fiftyLoaded
  ].filter((value) => Number.isFinite(value) && value >= 0);
  const maxDb = Math.max(5, Math.ceil(Math.max(...plottedValues, 1) / 10) * 10);

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#17202a";
  ctx.font = "22px Arial";
  ctx.fillText("Loaded RC ladder", 88, 52);

  const plot = drawDbFrequencyFrame(ctx, 88, 104, 735, 330, fMin, fMax, maxDb, "|Vout/Vin| attenuation");
  drawLogCurve(ctx, samples.unloaded, plot.xFor, plot.yFor, "attenuationDb", "#8a5b30", { dashed: [4, 6], lineWidth: 3 });
  drawLogCurve(ctx, samples.loaded, plot.xFor, plot.yFor, "attenuationDb", "#b73e3e");

  const fiftyX = plot.xFor(50);
  ctx.strokeStyle = "#557a38";
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 6]);
  ctx.beginPath();
  ctx.moveTo(fiftyX, 104);
  ctx.lineTo(fiftyX, 434);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#557a38";
  ctx.font = "14px Arial";
  ctx.fillText("50 Hz", fiftyX + 8, 128);

  drawSlideLegend(ctx, [
    { label: "Full ladder + load", color: "#b73e3e" },
    { label: "Full ladder unloaded", color: "#8a5b30", dashed: [4, 6] }
  ], 850, 132, { maxWidth: 190 });

  const cardRows = [
    ["Load C", formatCapacitance(externalLoadCapPf), `${formatCapacitance(cableCapPf)} cable + ${formatCapacitance(detectorCapPf)} det.`],
    ["Load G", formatAdmittance(loadG), `Iload ${formatCurrentFromNa(params.load_current_na)}`],
    ["50 Hz", formatAttenuationDb(fiftyLoaded), "full ladder + load"]
  ];
  cardRows.forEach((row, index) => {
    const x = 88 + index * 315;
    const y = 482;
    ctx.fillStyle = "#f5f2ea";
    ctx.strokeStyle = "#c9c1b0";
    ctx.lineWidth = 1;
    ctx.fillRect(x, y, 280, 84);
    ctx.strokeRect(x, y, 280, 84);
    ctx.fillStyle = "#5b6670";
    ctx.font = "14px Arial";
    ctx.fillText(row[0], x + 16, y + 25);
    ctx.fillStyle = "#17202a";
    ctx.font = "24px Arial";
    ctx.fillText(row[1], x + 16, y + 55);
    ctx.fillStyle = "#5b6670";
    ctx.font = "13px Arial";
    ctx.fillText(row[2], x + 16, y + 74);
  });

  drawWrappedLines(ctx, [
    `Cable model is lumped: C = length/(Z0 vf c), using ${params.load_cable_length_m.toLocaleString(undefined, { maximumFractionDigits: 1 })} m, ${params.load_cable_impedance_ohm.toLocaleString(undefined, { maximumFractionDigits: 0 })} ohm, vf ${params.load_cable_velocity_factor.toLocaleString(undefined, { maximumFractionDigits: 2 })}.`,
    "At frequencies where the cable is electrically long, replace this lumped load with a transmission-line termination."
  ], 850, 252, 21, "#5b6670", "15px Arial", 220);
}

function feaCapacitanceNetworkForCurrentDesign() {
  return solvedCapacitanceForCurrentDesign()?.network || null;
}

function spiceLadderRequestKey() {
  const network = feaCapacitanceNetworkForCurrentDesign();
  if (!network) return null;
  const nodeGround = network.node_ground_pf ?? network.nodeGroundPf ?? [];
  const mutual = network.mutual_pf_matrix ?? network.mutualPfMatrix ?? [];
  const electricalGround = network.electrical_node_ground_pf ?? network.electricalNodeGroundPf ?? [];
  const electricalMutual = network.electrical_mutual_pf_matrix ?? network.electricalMutualPfMatrix ?? [];
  return `${comparableResultParameters(params)}|addedCg=${additionalGroundCapacitancePf(params)}|${JSON.stringify([nodeGround, mutual, electricalGround, electricalMutual])}`;
}

async function requestSpiceLadderResult(key, capacitanceNetwork) {
  const requestId = spiceLadderRequestId + 1;
  spiceLadderRequestId = requestId;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), SPICE_CONNECT_TIMEOUT_MS);
  try {
    const payload = await fetchJson(SPICE_LADDER_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parameters: backendParameters(params),
        capacitanceNetwork
      }),
      signal: controller.signal
    });
    if (requestId !== spiceLadderRequestId || spiceLadderRequestKey() !== key) return;
    spiceLadderCache = { key, payload };
    spiceLadderPendingKey = null;
    drawSpiceLadderSlide(document.getElementById("slideSpiceLadderCanvas"));
  } catch (error) {
    if (requestId === spiceLadderRequestId) {
      spiceLadderPendingKey = null;
      spiceLadderDisabled = true;
      drawSpiceLadderSlide(document.getElementById("slideSpiceLadderCanvas"));
    }
  } finally {
    window.clearTimeout(timeout);
  }
}

function spiceLadderResultForCurrentDesign() {
  if (spiceLadderDisabled) return null;
  const capacitanceNetwork = feaCapacitanceNetworkForCurrentDesign();
  const key = spiceLadderRequestKey();
  if (!capacitanceNetwork || !key) return null;
  if (spiceLadderCache?.key === key) return spiceLadderCache.payload;
  if (spiceLadderPendingKey !== key) {
    spiceLadderPendingKey = key;
    requestSpiceLadderResult(key, capacitanceNetwork);
  }
  return null;
}

function backendSpiceCurve(samples, key) {
  return (samples || [])
    .map((sample) => ({
      frequency: sample.frequencyHz,
      attenuationDb: sample[key]?.attenuationDb
    }))
    .filter((sample) => Number.isFinite(sample.frequency) && Number.isFinite(sample.attenuationDb));
}

function shortSpicePackageLabel(label) {
  const text = String(label || "").trim();
  const ngspice = text.match(/ngspice[-\s]*[0-9][^\s:]*/i);
  if (ngspice) return ngspice[0].replace(/\s+/, "-");
  return text || "internal MNA";
}

function drawSpiceLadderSlide(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const payload = spiceLadderResultForCurrentDesign();

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#17202a";
  ctx.font = "22px Arial";
  ctx.fillText("SPICE AC simulation of the full RC ladder", 88, 52);

  if (!payload?.samples?.length) {
    const hasFeaNetwork = Boolean(feaCapacitanceNetworkForCurrentDesign());
    ctx.fillStyle = "#5b6670";
    ctx.font = "18px Arial";
    drawWrappedLines(ctx, [
      spiceLadderDisabled
        ? "Backend SPICE-style endpoint is not available from this page load."
        : hasFeaNetwork
          ? "Waiting for the Pi backend SPICE-style solve."
          : "Run a matching FEniCSx field solve to extract the capacitance network.",
      hasFeaNetwork
        ? "The backend receives each node-to-ground capacitance and the full mutual-capacitance matrix."
        : "SPICE is not run with analytical capacitance substitutions on this slide."
    ], 88, 118, 26, "#5b6670", "18px Arial", 880);
    return;
  }

  const tlineSamples = backendSpiceCurve(payload.samples, "fullTline");
  const lumpedSamples = backendSpiceCurve(payload.samples, "fullLumped");
  const unloadedSamples = backendSpiceCurve(payload.samples, "fullUnloaded");
  const instrumentSamples = backendSpiceCurve(payload.samples, "instrument50Ohm");
  const intrinsicSamples = (window.DISCOIDAL_DEFAULT_EQS_SWEEP?.samples || [])
    .filter((sample) => Number.isFinite(sample.frequencyHz) && Number.isFinite(sample.intrinsicSpiceDb))
    .map((sample) => ({
      frequency: sample.frequencyHz,
      attenuationDb: Math.max(0, -sample.intrinsicSpiceDb)
    }));
  const allValues = [...tlineSamples, ...lumpedSamples, ...unloadedSamples, ...instrumentSamples, ...intrinsicSamples]
    .map((sample) => sample.attenuationDb)
    .filter((value) => Number.isFinite(value) && value >= 0);
  const fMin = Math.min(...tlineSamples.map((sample) => sample.frequency));
  const fMax = Math.max(...tlineSamples.map((sample) => sample.frequency));
  const maxDb = Math.max(5, Math.ceil(Math.max(...allValues, 1) / 10) * 10);
  const plot = drawDbFrequencyFrame(ctx, 88, 104, 735, 330, fMin, fMax, maxDb, "|Vout/Vin| attenuation");
  drawLogCurve(ctx, lumpedSamples, plot.xFor, plot.yFor, "attenuationDb", "#8a5b30", { dashed: [4, 6], lineWidth: 3 });
  drawLogCurve(ctx, unloadedSamples, plot.xFor, plot.yFor, "attenuationDb", "#1f6f78", { dashed: [10, 5, 2, 5], lineWidth: 3 });
  drawLogCurve(ctx, tlineSamples, plot.xFor, plot.yFor, "attenuationDb", "#b73e3e");
  drawLogCurve(ctx, instrumentSamples, plot.xFor, plot.yFor, "attenuationDb", "#315f8c", { dashed: [2, 5], lineWidth: 3 });
  drawLogCurve(ctx, intrinsicSamples, plot.xFor, plot.yFor, "attenuationDb", "#7354a3", { dashed: [9, 6], lineWidth: 4 });

  const fiftyX = plot.xFor(50);
  if (50 >= fMin && 50 <= fMax) {
    ctx.strokeStyle = "#557a38";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 6]);
    ctx.beginPath();
    ctx.moveTo(fiftyX, 104);
    ctx.lineTo(fiftyX, 434);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#557a38";
    ctx.font = "14px Arial";
    ctx.fillText("50 Hz", fiftyX + 8, 128);
  }

  drawSlideLegend(ctx, [
    { label: "Full ladder + T-line", color: "#b73e3e" },
    { label: "Full ladder + lumped C", color: "#8a5b30", dashed: [4, 6] },
    { label: "Full ladder unloaded", color: "#1f6f78", dashed: [10, 5, 2, 5] },
    { label: "50 ohm test ports", color: "#315f8c", dashed: [2, 5] },
    { label: "Intrinsic filter, EM ports", color: "#7354a3", dashed: [9, 6] }
  ], 845, 126, { maxWidth: 190 });

  const summary50 = payload.summary?.at50Hz || {};
  const circuit = payload.circuit || {};
  const cardRows = [
    ["50 Hz loaded", formatAttenuationDb(summary50.fullTlineAttenuationDb), "full ladder + T-line"],
    ["50 Hz unloaded", formatAttenuationDb(summary50.fullUnloadedAttenuationDb), "filter output terminal"],
    ["Backend", shortSpicePackageLabel(payload.spicePackage), payload.method || payload.source]
  ];
  cardRows.forEach((row, index) => {
    const x = 88 + index * 315;
    const y = 482;
    ctx.fillStyle = "#f5f2ea";
    ctx.strokeStyle = "#c9c1b0";
    ctx.lineWidth = 1;
    ctx.fillRect(x, y, 280, 84);
    ctx.strokeRect(x, y, 280, 84);
    ctx.fillStyle = "#5b6670";
    ctx.font = "14px Arial";
    ctx.fillText(row[0], x + 16, y + 25);
    ctx.fillStyle = "#17202a";
    ctx.font = "23px Arial";
    ctx.fillText(row[1], x + 16, y + 55);
    ctx.fillStyle = "#5b6670";
    ctx.font = "13px Arial";
    ctx.fillText(String(row[2] || ""), x + 16, y + 74);
  });

  drawWrappedLines(ctx, [
    "ngspice runs separate loaded and unloaded AC analyses.",
    "Unloaded is measured at the physical output terminal; it retains Rout but removes the cable, detector, and DC load.",
    "Intrinsic additionally drives plate 1 directly, matching the open-output field-solve ports.",
    "50 ohm test ports include the FEA end-terminal capacitance network and source mismatch; a matched through is 0 dB.",
    `Capacitances: ${circuit.capacitanceSource || "unknown source"}`
  ], 845, 300, 19, "#5b6670", "14px Arial", 230);
}

function trapezoidTransferMagnitude(frequencyHz, p = params) {
  const sampleRateHz = Math.max(1, Number(p.noise_sample_rate_msps) || 62.5) * 1e6;
  const riseSamples = Math.max(1, Math.round(
    Math.max(0.01, Number(p.noise_trap_rise_us) || 10) * 1e-6 * sampleRateHz
  ));
  const flatSamples = Math.max(0, Math.round(
    Math.max(0, Number(p.noise_trap_flat_us) || 0) * 1e-6 * sampleRateHz
  ));
  const frequency = Math.max(0, Math.min(sampleRateHz / 2, Number(frequencyHz) || 0));
  if (!(frequency > 0)) return 0;
  const omega = 2 * Math.PI * frequency / sampleRateHz;
  const denominator = riseSamples * Math.sin(omega / 2);
  const movingAverage = Math.abs(denominator) < 1e-14
    ? 1
    : Math.abs(Math.sin(riseSamples * omega / 2) / denominator);
  const windowDifference = 2 * Math.abs(Math.sin((riseSamples + flatSamples) * omega / 2));
  return movingAverage * windowDifference;
}

function noisePathMagnitude(circuit, p, frequencyHz) {
  return ladderTransferMagnitude(circuit, p, frequencyHz, { includeLoad: true })
    * trapezoidTransferMagnitude(frequencyHz, p);
}

function fanoNoiseBudget(p = params) {
  const circuit = electromagneticCircuitForCurrentDesign();
  const cacheKey = JSON.stringify([p, circuit]);
  if (fanoNoiseBudgetCache?.key === cacheKey) {
    return fanoNoiseBudgetCache.value;
  }
  const endpointEv = 2039e3;
  const pairEnergyEv = 2.96;
  const enteredFanoFactor = Number(p.noise_fano_factor);
  const fanoFactor = Number.isFinite(enteredFanoFactor)
    ? Math.max(0.01, Math.min(0.3, enteredFanoFactor))
    : DEFAULT_GE_FANO_FACTOR;
  const fanoSigmaEv = Math.sqrt(fanoFactor * pairEnergyEv * endpointEv);
  const targetFraction = FANO_TARGET_FRACTION;
  const targetSigmaEv = targetFraction * fanoSigmaEv;
  const detectorCapF = Math.max(1e-15, detectorCapacitancePf(p) * 1e-12);
  const targetVoltageV = targetSigmaEv / pairEnergyEv * 1.602176634e-19 / detectorCapF;
  const sampleRateHz = Math.max(1, Number(p.noise_sample_rate_msps) || 62.5) * 1e6;
  const nyquistHz = sampleRateHz / 2;
  const waveformSamples = Math.max(1, Math.round(Number(p.noise_waveform_samples) || 8192));
  const waveformDurationUs = waveformSamples / sampleRateHz * 1e6;
  const trapSupportUs = 2 * Math.max(0, Number(p.noise_trap_rise_us) || 0)
    + Math.max(0, Number(p.noise_trap_flat_us) || 0);
  const supplyRmsV = Math.max(0, Number(p.noise_supply_noise_pp_mv) || 0) * 1e-3 / (2 * Math.sqrt(2));
  const labBroadbandRmsV = Math.max(0, Number(p.noise_lab_broadband_rms_mv) || 0) * 1e-3;
  const mainsInputRmsV = Math.max(0, Number(p.noise_mains_rms_mv) || 0) * 1e-3;
  const mainsFrequencyHz = Math.max(0, Number(p.noise_mains_frequency_hz) || 50);
  const points = 900;
  let weightedBandwidthHz = 0;
  let previousFrequency = 1;
  let previousMagnitude2 = noisePathMagnitude(circuit, p, previousFrequency) ** 2;
  let worstSupplyMagnitude = 0;
  let worstSupplyFrequencyHz = 5;
  for (let index = 1; index <= points; index += 1) {
    const frequency = 10 ** (Math.log10(nyquistHz) * index / points);
    const pathMagnitude = noisePathMagnitude(circuit, p, frequency);
    const magnitude2 = pathMagnitude ** 2;
    weightedBandwidthHz += 0.5 * (previousMagnitude2 + magnitude2) * (frequency - previousFrequency);
    if (frequency >= 5 && frequency <= Math.min(nyquistHz, 50e6) && pathMagnitude > worstSupplyMagnitude) {
      worstSupplyMagnitude = pathMagnitude;
      worstSupplyFrequencyHz = frequency;
    }
    previousFrequency = frequency;
    previousMagnitude2 = magnitude2;
  }
  const broadbandOutputV = labBroadbandRmsV * Math.sqrt(weightedBandwidthHz / Math.max(1, nyquistHz - 1));
  const supplyOutputV = supplyRmsV * worstSupplyMagnitude;
  const mainsLadderMagnitude = ladderTransferMagnitude(circuit, p, mainsFrequencyHz, { includeLoad: true });
  const mainsTrapMagnitude = trapezoidTransferMagnitude(mainsFrequencyHz, p);
  const mainsOutputV = mainsInputRmsV * mainsLadderMagnitude * mainsTrapMagnitude;
  const totalOutputV = Math.hypot(supplyOutputV, broadbandOutputV, mainsOutputV);
  const equivalentEnergyEv = totalOutputV * detectorCapF / 1.602176634e-19 * pairEnergyEv;
  const voltageToEnergy = detectorCapF / 1.602176634e-19 * pairEnergyEv;
  const supplyEquivalentEnergyEv = supplyOutputV * voltageToEnergy;
  const broadbandEquivalentEnergyEv = broadbandOutputV * voltageToEnergy;
  const mainsEquivalentEnergyEv = mainsOutputV * voltageToEnergy;
  const fwhmFactor = 2.354820045;
  const fanoFwhmKev = fwhmFactor * fanoSigmaEv / 1000;
  const fanoPlusBiasFwhmKev = fwhmFactor * Math.hypot(fanoSigmaEv, equivalentEnergyEv) / 1000;
  const signalPairs = endpointEv / pairEnergyEv;
  const signalChargeFc = signalPairs * 1.602176634e-19 * 1e15;
  const result = {
    endpointEv,
    pairEnergyEv,
    fanoFactor,
    fanoSigmaEv,
    fanoFwhmKev,
    targetFraction,
    targetSigmaEv,
    targetVoltageV,
    signalPairs,
    signalChargeFc,
    sampleRateHz,
    nyquistHz,
    waveformSamples,
    waveformDurationUs,
    trapSupportUs,
    trapFitsRecord: trapSupportUs <= waveformDurationUs,
    supplyRmsV,
    labBroadbandRmsV,
    mainsInputRmsV,
    mainsFrequencyHz,
    worstSupplyMagnitude,
    worstSupplyFrequencyHz,
    weightedBandwidthHz,
    supplyOutputV,
    broadbandOutputV,
    mainsOutputV,
    totalOutputV,
    supplyEquivalentEnergyEv,
    broadbandEquivalentEnergyEv,
    mainsEquivalentEnergyEv,
    equivalentEnergyEv,
    mainsLadderMagnitude,
    mainsTrapMagnitude,
    mainsCombinedMagnitude: mainsLadderMagnitude * mainsTrapMagnitude,
    fanoPlusBiasFwhmKev,
    margin: equivalentEnergyEv > 0 ? targetSigmaEv / equivalentEnergyEv : Number.POSITIVE_INFINITY
  };
  fanoNoiseBudgetCache = { key: cacheKey, value: result };
  return result;
}

function updateNoiseReadouts() {
  const budget = fanoNoiseBudget(params);
  const set = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  };
  set("noiseRecordDuration", `${budget.waveformDurationUs.toFixed(1)} µs`);
  set("noiseTrapMainsAttenuation", formatAttenuationDb(attenuationDbFromMagnitude(budget.mainsTrapMagnitude)));
  set("noiseEquivalentEnergy", `${budget.equivalentEnergyEv.toFixed(1)} eV rms`);
  set("noiseFanoLimit", `${budget.fanoSigmaEv.toFixed(0)} eV rms`);
  set("noiseFanoTarget", `${budget.targetSigmaEv.toFixed(1)} eV rms`);
}

function drawFanoNoiseSlide(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const budget = fanoNoiseBudget(params);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#17202a";
  ctx.font = "22px Arial";
  ctx.fillText("Noise budget at the Ge-76 endpoint", 72, 48);

  const rows = [
    ["Literature-weighted F", budget.fanoFactor.toFixed(4), "adjustable cryogenic Ge estimate"],
    ["Calculated Fano limit", `${budget.fanoFwhmKev.toFixed(3)} keV FWHM`, `${budget.fanoSigmaEv.toFixed(0)} eV rms at 2039 keV`],
    ["Predicted bias path", `${budget.equivalentEnergyEv.toFixed(1)} eV rms`, `${(budget.equivalentEnergyEv / budget.fanoSigmaEv).toFixed(3)}x Fano sigma`]
  ];
  rows.forEach(([label, value, note], index) => {
    const x = 72 + index * 328;
    ctx.fillStyle = "#f5f2ea";
    ctx.fillRect(x, 78, 300, 102);
    ctx.fillStyle = "#5b6670";
    ctx.font = "13px Arial";
    ctx.fillText(label, x + 16, 102);
    ctx.fillStyle = "#17202a";
    ctx.font = "bold 23px Arial";
    ctx.fillText(value, x + 16, 136);
    ctx.fillStyle = "#5b6670";
    ctx.font = "13px Arial";
    drawWrappedLines(ctx, [note], x + 16, 160, 16, "#5b6670", "13px Arial", 268);
  });

  const plot = { left: 210, right: 1018, top: 244, bottom: 444 };
  const entries = [
    { label: "Target allocation", value: budget.targetSigmaEv, color: "#8a6a18" },
    { label: "Supply bound", value: Math.max(1e-4, budget.supplyEquivalentEnergyEv), color: "#65737e" },
    { label: `${budget.mainsFrequencyHz.toFixed(0)} Hz line`, value: Math.max(1e-4, budget.mainsEquivalentEnergyEv), color: "#b73e3e" },
    { label: "Broadband pickup", value: Math.max(1e-4, budget.broadbandEquivalentEnergyEv), color: "#587b9b" },
    { label: "Total bias path", value: Math.max(1e-4, budget.equivalentEnergyEv), color: budget.margin >= 1 ? "#557a38" : "#b73e3e" },
    { label: "Irreducible Fano", value: budget.fanoSigmaEv, color: "#1f6f78" }
  ];
  const minLog = -1;
  const maxLog = 4;
  const xFor = (value) => plot.left + (Math.log10(Math.max(10 ** minLog, value)) - minLog) / (maxLog - minLog) * (plot.right - plot.left);
  for (let decade = minLog; decade <= maxLog; decade += 1) {
    const x = xFor(10 ** decade);
    ctx.strokeStyle = "#dfe3df";
    ctx.beginPath();
    ctx.moveTo(x, plot.top);
    ctx.lineTo(x, plot.bottom);
    ctx.stroke();
    ctx.fillStyle = "#5b6670";
    ctx.font = "14px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`${10 ** decade} eV`, x, plot.bottom + 22);
  }
  entries.forEach((entry, index) => {
    const y = plot.top + 21 + index * 31;
    ctx.fillStyle = "#17202a";
    ctx.font = "16px Arial";
    ctx.textAlign = "right";
    ctx.fillText(entry.label, plot.left - 12, y + 5);
    ctx.fillStyle = entry.color;
    ctx.fillRect(plot.left, y - 9, Math.max(3, xFor(entry.value) - plot.left), 18);
  });
  ctx.textAlign = "left";
  drawWrappedLines(ctx, [
    `${budget.mainsFrequencyHz.toFixed(0)} Hz: trap ${formatAttenuationDb(attenuationDbFromMagnitude(budget.mainsTrapMagnitude))}, ladder ${formatAttenuationDb(attenuationDbFromMagnitude(budget.mainsLadderMagnitude))}; ${(budget.mainsInputRmsV * 1e3).toFixed(2)} mV rms becomes ${budget.mainsEquivalentEnergyEv.toFixed(1)} eV rms.`,
    `Supply p-p bound is placed at the worst response (${formatFrequency(budget.worstSupplyFrequencyHz)}). Broadband pickup is integrated to ${formatFrequency(budget.nyquistHz)}. Record ${budget.waveformDurationUs.toFixed(1)} us; trap support ${budget.trapSupportUs.toFixed(1)} us${budget.trapFitsRecord ? "." : " DOES NOT FIT."}`,
    `The bias path is ${(budget.equivalentEnergyEv / budget.fanoSigmaEv).toFixed(3)}x the calculated Fano RMS fluctuation; the design target is ${budget.targetFraction.toFixed(2)}x Fano, with ${budget.margin.toFixed(2)}x margin to that target.`
  ], 76, 490, 20, "#5b6670", "15px Arial", 970);
}

function stageMultiplicationValidationData(p, frequencyHz = 50) {
  const isolatedParams = {
    ...p,
    plate_pairs: 1,
    input_series_matches_stage: true,
    output_series_matches_stage: false,
    output_series_resistance_ohm: 0,
    load_cable_length_m: 0,
    detector_capacitance_pf: 0,
    load_current_na: 0
  };
  const isolatedCircuit = circuitEstimates(isolatedParams);
  const isolatedAnalyticDb = singleStageAttenuationDb(isolatedCircuit, frequencyHz);
  const isolatedMnaDb = attenuationDbFromMagnitude(
    ladderTransferMagnitude(isolatedCircuit, isolatedParams, frequencyHz, { includeLoad: false })
  );
  const stageCounts = [2, 5, 10, 20];
  const loaded = [{
    stageCount: 1,
    fullDb: isolatedMnaDb,
    multipliedDb: isolatedAnalyticDb,
    isolated: true
  }, ...stageCounts.map((stageCount) => {
    const caseParams = { ...p, plate_pairs: stageCount };
    const circuit = circuitEstimates(caseParams);
    return {
      stageCount,
      fullDb: attenuationDbFromMagnitude(
        ladderTransferMagnitude(circuit, caseParams, frequencyHz, { includeLoad: true })
      ),
      multipliedDb: scaledSingleStageAttenuationDb(circuit, caseParams, frequencyHz, true)
    };
  })];
  return { frequencyHz, isolatedAnalyticDb, isolatedMnaDb, loaded };
}

function drawStageValidationSlide(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const data = stageMultiplicationValidationData(params, 50);
  const plot = { left: 82, top: 92, right: 770, bottom: 520 };
  const maxValue = Math.max(...data.loaded.flatMap((item) => [item.fullDb, item.multipliedDb]), 1);
  const yMax = Math.max(50, Math.ceil(maxValue / 50) * 50);
  const y = (value) => plot.bottom - Math.max(0, value) / yMax * (plot.bottom - plot.top);
  const x = (index) => plot.left + index / Math.max(1, data.loaded.length - 1) * (plot.right - plot.left);

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#17202a";
  ctx.font = "22px Arial";
  ctx.fillText("One stage isolated; 2+ stages use the default load at 50 Hz", plot.left, 52);

  ctx.strokeStyle = "#d8d1c3";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#5b6670";
  ctx.font = "15px Arial";
  ctx.textAlign = "right";
  const yStep = yMax <= 100 ? 20 : 50;
  for (let tick = 0; tick <= yMax; tick += yStep) {
    const yy = y(tick);
    ctx.beginPath();
    ctx.moveTo(plot.left, yy);
    ctx.lineTo(plot.right, yy);
    ctx.stroke();
    ctx.fillText(`${tick}`, plot.left - 12, yy + 5);
  }
  ctx.strokeStyle = "#17202a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(plot.left, plot.top);
  ctx.lineTo(plot.left, plot.bottom);
  ctx.lineTo(plot.right, plot.bottom);
  ctx.stroke();

  ctx.save();
  ctx.translate(24, (plot.top + plot.bottom) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.font = "17px Arial";
  ctx.fillText("Attenuation (dB)", 0, 0);
  ctx.restore();
  ctx.textAlign = "center";
  ctx.fillStyle = "#5b6670";
  ctx.font = "16px Arial";
  ctx.fillText("Bias stages", (plot.left + plot.right) / 2, plot.bottom + 52);

  data.loaded.forEach((item, index) => {
    const xx = x(index);
    ctx.strokeStyle = "rgba(201, 193, 176, 0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xx, plot.top);
    ctx.lineTo(xx, plot.bottom);
    ctx.stroke();
    ctx.fillStyle = "#5b6670";
    ctx.textAlign = "center";
    ctx.font = "15px Arial";
    ctx.fillText(`${item.stageCount}`, xx, plot.bottom + 25);
  });

  const drawSeries = (key, color, dashed = []) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.setLineDash(dashed);
    ctx.beginPath();
    data.loaded.forEach((item, index) => {
      const xx = x(index);
      const yy = y(item[key]);
      if (index === 0) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    });
    ctx.stroke();
    ctx.setLineDash([]);
    data.loaded.forEach((item, index) => {
      const xx = x(index);
      const yy = y(item[key]);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(xx, yy, 6, 0, 2 * Math.PI);
      ctx.fill();
      if (item.isolated && key === "multipliedDb") return;
      ctx.font = "14px Arial";
      ctx.textAlign = index === data.loaded.length - 1 ? "right" : "center";
      const label = item.isolated ? `${item[key].toFixed(3)} both` : item[key].toFixed(1);
      ctx.fillText(label, index === data.loaded.length - 1 ? xx - 8 : xx, yy - 13);
    });
  };
  drawSeries("multipliedDb", "#1f6f78", [9, 7]);
  drawSeries("fullDb", "#b73e3e");

  const isolatedX = x(0);
  const isolatedY = y(data.loaded[0].fullDb);
  ctx.strokeStyle = "#1f6f78";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(isolatedX, isolatedY, 9, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.fillStyle = "#b73e3e";
  ctx.beginPath();
  ctx.arc(isolatedX, isolatedY, 5, 0, 2 * Math.PI);
  ctx.fill();

  const loadedDividerX = (x(0) + x(1)) / 2;
  ctx.strokeStyle = "#8a6a18";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 6]);
  ctx.beginPath();
  ctx.moveTo(loadedDividerX, plot.top);
  ctx.lineTo(loadedDividerX, plot.bottom);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#8a6a18";
  ctx.font = "14px Arial";
  ctx.textAlign = "left";
  ctx.fillText("default loaded cases", loadedDividerX + 8, plot.top + 22);

  const drawRightSwatchLegend = (label, color, yy, dashed = []) => {
    ctx.fillStyle = color;
    ctx.font = "15px Arial";
    ctx.textAlign = "left";
    ctx.fillText(label, 845, yy);
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.setLineDash(dashed);
    ctx.beginPath();
    ctx.moveTo(1030, yy - 6);
    ctx.lineTo(1070, yy - 6);
    ctx.stroke();
    ctx.setLineDash([]);
  };
  drawRightSwatchLegend("Multiplied section", "#1f6f78", 68, [9, 7]);
  drawRightSwatchLegend("Full ladder", "#b73e3e", 98);

  const panelX = 845;
  ctx.textAlign = "left";
  ctx.fillStyle = "#17202a";
  ctx.font = "22px Arial";
  ctx.fillText("Isolated section check", panelX, 180);
  ctx.fillStyle = "#5b6670";
  ctx.font = "15px Arial";
  drawEngineeringText(ctx, "one Rstage–Cg section", panelX, 208);
  ctx.fillText("no extra end R or load", panelX, 232);
  ctx.fillStyle = "#17202a";
  ctx.font = "26px Arial";
  ctx.fillText(`${data.isolatedAnalyticDb.toFixed(5)} dB`, panelX, 276);
  ctx.fillStyle = "#5b6670";
  ctx.font = "15px Arial";
  ctx.fillText("analytical divider", panelX, 300);
  ctx.fillStyle = "#17202a";
  ctx.font = "26px Arial";
  ctx.fillText(`${data.isolatedMnaDb.toFixed(5)} dB`, panelX, 342);
  ctx.fillStyle = "#5b6670";
  ctx.font = "15px Arial";
  ctx.fillText("full MNA/SPICE", panelX, 366);
  ctx.fillStyle = "#557a38";
  ctx.font = "20px Arial";
  ctx.fillText("Exact match", panelX, 408);
  drawWrappedLines(ctx, [
    "Agreement validates Rstage and Cg. Divergence begins only when unbuffered sections and the one-time output load are multiplied as though independent."
  ], panelX, 450, 21, "#5b6670", "15px Arial", 225);
}

function drawCparStrategyValidationSlide(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const columns = [
    { label: "Bias plates", x: 70, align: "left" },
    { label: "Analytic", x: 285, align: "right" },
    { label: "Full", x: 470, align: "right" },
    { label: "Mirror", x: 650, align: "right" },
    { label: "Repeated", x: 830, align: "right" },
    { label: "FEA / analytic", x: 1030, align: "right" }
  ];

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#17202a";
  ctx.font = "23px Arial";
  ctx.textAlign = "left";
  drawEngineeringText(ctx, "Average adjacent Cpar from matched Maxwell-matrix solves", 54, 48);

  ctx.fillStyle = "#315a73";
  ctx.fillRect(48, 74, 1004, 48);
  ctx.fillStyle = "#ffffff";
  ctx.font = "16px Arial";
  columns.forEach((column) => {
    ctx.textAlign = column.align;
    ctx.fillText(column.label, column.x, 105);
  });

  CPAR_STRATEGY_VALIDATION.forEach((row, index) => {
    const top = 122 + index * 82;
    ctx.fillStyle = index % 2 === 0 ? "#f5f2ea" : "#fffdf8";
    ctx.fillRect(48, top, 1004, 82);
    ctx.strokeStyle = "#d8d1c3";
    ctx.beginPath();
    ctx.moveTo(48, top + 82);
    ctx.lineTo(1052, top + 82);
    ctx.stroke();
    const y = top + 34;
    ctx.fillStyle = "#17202a";
    ctx.font = "20px Arial";
    ctx.textAlign = "left";
    ctx.fillText(`${row.plates}`, columns[0].x, y);
    ctx.textAlign = "right";
    ctx.fillText(`${row.analyticPf.toFixed(6)} pF`, columns[1].x, y);
    ctx.fillText(`${row.fullPf.toFixed(6)} pF`, columns[2].x, y);
    ctx.fillText(`${row.mirrorPf.toFixed(6)} pF`, columns[3].x, y);
    ctx.fillText(`${row.repeatPf.toFixed(6)} pF`, columns[4].x, y);
    ctx.fillStyle = "#557a38";
    ctx.font = "bold 20px Arial";
    ctx.fillText((row.fullPf / row.analyticPf).toFixed(3), columns[5].x, y);
    ctx.fillStyle = "#5b6670";
    ctx.font = "14px Arial";
    ctx.textAlign = "left";
    ctx.fillText("all three FEA strategies agree to displayed precision", 285, top + 61);
  });

  ctx.fillStyle = "#e8f0ec";
  ctx.fillRect(48, 470, 1004, 104);
  ctx.strokeStyle = "#9db4a6";
  ctx.strokeRect(48, 470, 1004, 104);
  ctx.fillStyle = "#315a73";
  ctx.font = "bold 22px Arial";
  ctx.textAlign = "left";
  ctx.fillText("Consistency result", 72, 506);
  ctx.fillStyle = "#17202a";
  ctx.font = "18px Arial";
  drawEngineeringText(ctx, "Maximum strategy difference in average adjacent Cpar: below stored numerical precision.", 72, 538);
  ctx.fillStyle = "#5b6670";
  ctx.font = "15px Arial";
  ctx.fillText("Default-geometry shielding leaves about 47.8% of the uniform axial-field estimate.", 72, 562);
}

function drawCparLimitValidationSlide(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const plot = { left: 88, top: 76, right: 760, bottom: 520 };
  const xMin = 20;
  const xMax = 120;
  const yMin = 0.65;
  const yMax = 1.02;
  const x = (value) => plot.left + (value - xMin) / (xMax - xMin) * (plot.right - plot.left);
  const y = (value) => plot.bottom - (value - yMin) / (yMax - yMin) * (plot.bottom - plot.top);

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#17202a";
  ctx.font = "22px Arial";
  drawEngineeringText(ctx, "Wide-disc limit: FEA Cpar / analytic epsilon A/d", plot.left, 42);

  ctx.strokeStyle = "#d8d1c3";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#5b6670";
  ctx.font = "14px Arial";
  ctx.textAlign = "right";
  for (const tick of [0.7, 0.8, 0.9, 1.0]) {
    const yy = y(tick);
    ctx.beginPath();
    ctx.moveTo(plot.left, yy);
    ctx.lineTo(plot.right, yy);
    ctx.stroke();
    ctx.fillText(tick.toFixed(1), plot.left - 12, yy + 5);
  }
  ctx.textAlign = "center";
  for (const tick of [20, 40, 60, 80, 100, 120]) {
    const xx = x(tick);
    ctx.beginPath();
    ctx.moveTo(xx, plot.top);
    ctx.lineTo(xx, plot.bottom);
    ctx.stroke();
    ctx.fillText(`${tick}`, xx, plot.bottom + 24);
  }
  ctx.strokeStyle = "#17202a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(plot.left, plot.top);
  ctx.lineTo(plot.left, plot.bottom);
  ctx.lineTo(plot.right, plot.bottom);
  ctx.stroke();
  ctx.fillStyle = "#5b6670";
  ctx.font = "16px Arial";
  ctx.fillText("Ground/tube OD (mm)", (plot.left + plot.right) / 2, plot.bottom + 53);

  ctx.save();
  ctx.translate(25, (plot.top + plot.bottom) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("FEA / analytic", 0, 0);
  ctx.restore();

  ctx.strokeStyle = "#b73e3e";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 7]);
  ctx.beginPath();
  ctx.moveTo(plot.left, y(1));
  ctx.lineTo(plot.right, y(1));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#b73e3e";
  ctx.textAlign = "right";
  ctx.font = "14px Arial";
  ctx.fillText("axial parallel-plate limit", plot.right - 8, y(1) - 9);

  ctx.strokeStyle = "#1f6f78";
  ctx.lineWidth = 4;
  ctx.beginPath();
  CPAR_LIMIT_VALIDATION.forEach((point, index) => {
    const xx = x(point.outerMm);
    const yy = y(point.ratio);
    if (index === 0) ctx.moveTo(xx, yy);
    else ctx.lineTo(xx, yy);
  });
  ctx.stroke();
  CPAR_LIMIT_VALIDATION.forEach((point) => {
    const xx = x(point.outerMm);
    const yy = y(point.ratio);
    ctx.fillStyle = "#1f6f78";
    ctx.beginPath();
    ctx.arc(xx, yy, 6, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = "#17202a";
    ctx.font = "14px Arial";
    ctx.textAlign = point.outerMm === 120 ? "right" : "center";
    ctx.fillText(point.ratio.toFixed(3), point.outerMm === 120 ? xx - 10 : xx, yy - 14);
  });

  const panelX = 805;
  ctx.fillStyle = "#f5f2ea";
  ctx.fillRect(panelX, 76, 265, 444);
  ctx.strokeStyle = "#c9c1b0";
  ctx.strokeRect(panelX, 76, 265, 444);
  ctx.fillStyle = "#17202a";
  ctx.textAlign = "left";
  ctx.font = "20px Arial";
  ctx.fillText("Solved values", panelX + 22, 112);
  ctx.font = "14px Arial";
  ctx.fillStyle = "#5b6670";
  ctx.fillText("OD      analytic      FEA", panelX + 22, 142);
  CPAR_LIMIT_VALIDATION.forEach((point, index) => {
    const yy = 182 + index * 70;
    ctx.fillStyle = "#17202a";
    ctx.font = "15px Arial";
    ctx.fillText(`${point.outerMm} mm`, panelX + 22, yy);
    ctx.textAlign = "right";
    ctx.fillText(`${point.analyticPf.toFixed(2)} pF`, panelX + 166, yy);
    ctx.fillStyle = "#1f6f78";
    ctx.fillText(`${point.feaPf.toFixed(2)} pF`, panelX + 244, yy);
    ctx.textAlign = "left";
    ctx.fillStyle = "#5b6670";
    ctx.font = "13px Arial";
    ctx.fillText(`ground ID ${point.groundIdMm} mm; bias OD ${point.biasOdMm} mm`, panelX + 22, yy + 24);
  });
  ctx.fillStyle = "#557a38";
  ctx.font = "bold 17px Arial";
  ctx.fillText("Monotonic approach to 1", panelX + 22, 490);
}

function drawCgStrategyValidationSlide(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const columns = [
    { label: "Bias plates", x: 68, align: "left" },
    { label: "2 washer analytic", x: 280, align: "right" },
    { label: "Full mean", x: 470, align: "right" },
    { label: "Mirror mean", x: 650, align: "right" },
    { label: "Repeated mean", x: 835, align: "right" },
    { label: "Max node delta", x: 1030, align: "right" }
  ];

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#17202a";
  ctx.font = "23px Arial";
  ctx.textAlign = "left";
  ctx.fillText("Mean node-to-ground capacitance from matched Maxwell matrices", 54, 48);

  ctx.fillStyle = "#315a73";
  ctx.fillRect(48, 72, 1004, 46);
  ctx.fillStyle = "#ffffff";
  ctx.font = "15px Arial";
  columns.forEach((column) => {
    ctx.textAlign = column.align;
    ctx.fillText(column.label, column.x, 101);
  });

  CG_STRATEGY_VALIDATION.forEach((row, index) => {
    const top = 118 + index * 64;
    const y = top + 31;
    ctx.fillStyle = index % 2 === 0 ? "#f5f2ea" : "#fffdf8";
    ctx.fillRect(48, top, 1004, 64);
    ctx.strokeStyle = "#d8d1c3";
    ctx.beginPath();
    ctx.moveTo(48, top + 64);
    ctx.lineTo(1052, top + 64);
    ctx.stroke();
    ctx.fillStyle = "#17202a";
    ctx.font = "18px Arial";
    ctx.textAlign = "left";
    ctx.fillText(`${row.plates}`, columns[0].x, y);
    ctx.textAlign = "right";
    ctx.fillText(`${row.analyticPf.toFixed(3)} pF`, columns[1].x, y);
    ctx.fillText(`${row.fullPf.toFixed(3)} pF`, columns[2].x, y);
    ctx.fillText(`${row.mirrorPf.toFixed(3)} pF`, columns[3].x, y);
    ctx.fillText(`${row.repeatPf.toFixed(3)} pF`, columns[4].x, y);
    ctx.fillStyle = row.maxNodeDeltaPct <= 0.07 ? "#557a38" : "#b73e3e";
    ctx.font = "bold 18px Arial";
    ctx.fillText(`${row.maxNodeDeltaPct.toFixed(3)}%`, columns[5].x, y);
  });

  ctx.fillStyle = "#e8f0ec";
  ctx.fillRect(48, 458, 1004, 116);
  ctx.strokeStyle = "#9db4a6";
  ctx.strokeRect(48, 458, 1004, 116);
  ctx.fillStyle = "#315a73";
  ctx.font = "bold 21px Arial";
  ctx.textAlign = "left";
  ctx.fillText("Consistency result", 72, 493);
  ctx.fillStyle = "#17202a";
  ctx.font = "17px Arial";
  ctx.fillText("All mean values agree; the table's last column exposes the largest node-level treatment change.", 72, 524);
  ctx.fillStyle = "#5b6670";
  ctx.font = "15px Arial";
  drawEngineeringText(ctx, "One plate has no adjacent Cpar and is exactly unchanged by mirror or repeating treatment.", 72, 551);
}

function drawCgLimitValidationSlide(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const plot = { left: 88, top: 76, right: 748, bottom: 520 };
  const xMin = 10;
  const xMax = 120;
  const yMin = 0.98;
  const yMax = 1.50;
  const x = (value) => plot.left + (value - xMin) / (xMax - xMin) * (plot.right - plot.left);
  const y = (value) => plot.bottom - (value - yMin) / (yMax - yMin) * (plot.bottom - plot.top);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#17202a";
  ctx.font = "22px Arial";
  drawEngineeringText(ctx, "Wide-disc limit: FEA Cg / analytical 2 epsilon A/d", plot.left, 42);

  ctx.strokeStyle = "#d8d1c3";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#5b6670";
  ctx.font = "14px Arial";
  ctx.textAlign = "right";
  for (const tick of [1.0, 1.1, 1.2, 1.3, 1.4, 1.5]) {
    const yy = y(tick);
    ctx.beginPath();
    ctx.moveTo(plot.left, yy);
    ctx.lineTo(plot.right, yy);
    ctx.stroke();
    ctx.fillText(tick.toFixed(1), plot.left - 12, yy + 5);
  }
  ctx.textAlign = "center";
  for (const tick of [20, 40, 60, 80, 100, 120]) {
    const xx = x(tick);
    ctx.beginPath();
    ctx.moveTo(xx, plot.top);
    ctx.lineTo(xx, plot.bottom);
    ctx.stroke();
    ctx.fillText(`${tick}`, xx, plot.bottom + 24);
  }
  ctx.strokeStyle = "#17202a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(plot.left, plot.top);
  ctx.lineTo(plot.left, plot.bottom);
  ctx.lineTo(plot.right, plot.bottom);
  ctx.stroke();
  ctx.fillStyle = "#5b6670";
  ctx.font = "16px Arial";
  ctx.fillText("Bias and washer OD (mm)", (plot.left + plot.right) / 2, plot.bottom + 53);
  ctx.save();
  ctx.translate(25, (plot.top + plot.bottom) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("FEA / analytical", 0, 0);
  ctx.restore();

  ctx.strokeStyle = "#b73e3e";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 7]);
  ctx.beginPath();
  ctx.moveTo(plot.left, y(1));
  ctx.lineTo(plot.right, y(1));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#b73e3e";
  ctx.textAlign = "right";
  ctx.font = "14px Arial";
  ctx.fillText("flat-washer limit", plot.right - 8, y(1) - 9);

  ctx.strokeStyle = "#1f6f78";
  ctx.lineWidth = 4;
  ctx.beginPath();
  CG_LIMIT_VALIDATION.forEach((point, index) => {
    const xx = x(point.biasOdMm);
    const yy = y(point.ratio);
    if (index === 0) ctx.moveTo(xx, yy);
    else ctx.lineTo(xx, yy);
  });
  ctx.stroke();
  CG_LIMIT_VALIDATION.forEach((point) => {
    const xx = x(point.biasOdMm);
    const yy = y(point.ratio);
    ctx.fillStyle = "#1f6f78";
    ctx.beginPath();
    ctx.arc(xx, yy, 6, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = "#17202a";
    ctx.font = "14px Arial";
    ctx.textAlign = point.biasOdMm === 120 ? "right" : "center";
    ctx.fillText(point.ratio.toFixed(3), point.biasOdMm === 120 ? xx - 10 : xx, yy - 14);
  });

  const panelX = 785;
  ctx.fillStyle = "#f5f2ea";
  ctx.fillRect(panelX, 76, 285, 444);
  ctx.strokeStyle = "#c9c1b0";
  ctx.strokeRect(panelX, 76, 285, 444);
  ctx.fillStyle = "#17202a";
  ctx.textAlign = "left";
  ctx.font = "20px Arial";
  ctx.fillText("Exact-mirror results", panelX + 20, 112);
  ctx.font = "13px Arial";
  ctx.fillStyle = "#5b6670";
  ctx.fillText("OD       analytical       FEA", panelX + 20, 141);
  CG_LIMIT_VALIDATION.forEach((point, index) => {
    const yy = 179 + index * 59;
    ctx.fillStyle = "#17202a";
    ctx.font = "14px Arial";
    ctx.fillText(`${point.biasOdMm} mm`, panelX + 20, yy);
    ctx.textAlign = "right";
    ctx.fillText(`${point.analyticPf.toFixed(2)} pF`, panelX + 184, yy);
    ctx.fillStyle = "#1f6f78";
    ctx.fillText(`${point.feaPf.toFixed(2)} pF`, panelX + 265, yy);
    ctx.textAlign = "left";
    ctx.fillStyle = "#5b6670";
    ctx.font = "12px Arial";
    ctx.fillText(`tube OD ${point.tubeOdMm} mm; ground ID ${point.groundIdMm} mm`, panelX + 20, yy + 20);
  });
  ctx.fillStyle = "#557a38";
  ctx.font = "bold 16px Arial";
  ctx.fillText("1.449 to 1.038", panelX + 20, 493);
}

function drawCgValidationHistorySlide(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const entries = [
    {
      step: "1",
      title: "Oversized full-matrix batches stopped",
      detail: "120, 64, then 40 mm batches approached 5.7 GiB RSS; all were stopped before swap or OOM.",
      color: "#b73e3e"
    },
    {
      step: "2",
      title: "Mesh record corrected the diagnosis",
      detail: "The 0.01 mm radial gap forced 0.006/0.024 mm global fine/coarse targets. Retained memory was not the primary cause.",
      color: "#c46a32"
    },
    {
      step: "3",
      title: "First isolated runner failed before FEA",
      detail: "A local sys import shadowed the module import. Removing it fixed JSON input; no geometry or equations changed.",
      color: "#805a36"
    },
    {
      step: "4",
      title: "Corrected validation completed",
      detail: "One bias plate, exact mirror, 0.10 mm radial gap, isolated cases. Ratio reached 1.038 at 120 mm; swap stayed zero.",
      color: "#557a38"
    }
  ];

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#17202a";
  ctx.font = "23px Arial";
  drawEngineeringText(ctx, "Cg limiting-case validation audit trail", 58, 48);

  entries.forEach((entry, index) => {
    const top = 76 + index * 122;
    ctx.fillStyle = index % 2 === 0 ? "#f5f2ea" : "#fffdf8";
    ctx.fillRect(58, top, 984, 104);
    ctx.strokeStyle = "#d8d1c3";
    ctx.strokeRect(58, top, 984, 104);
    ctx.fillStyle = entry.color;
    ctx.beginPath();
    ctx.arc(105, top + 52, 27, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "bold 22px Arial";
    ctx.fillText(entry.step, 105, top + 60);
    ctx.textAlign = "left";
    ctx.fillStyle = "#17202a";
    ctx.font = "bold 19px Arial";
    ctx.fillText(entry.title, 154, top + 34);
    drawWrappedLines(ctx, [entry.detail], 154, top + 64, 20, "#5b6670", "15px Arial", 850);
  });

  ctx.fillStyle = "#315a73";
  ctx.font = "15px Arial";
  ctx.fillText("Raw records: cg-wide-disc-validation-tight-gap.json and cg-wide-disc-validation.json", 58, 590);
}

function slideResultParameters() {
  const p = structuredClone(params);
  p.grid_r_count = Math.min(p.grid_r_count, 58);
  p.grid_z_count = Math.min(p.grid_z_count, 86);
  p.solver_iterations = Math.min(p.solver_iterations, 240);
  p.solver_tolerance_v = Math.max(p.solver_tolerance_v, 0.08);
  return p;
}

function fieldInsetMetrics(result, x, y, width, height) {
  const bounds = result.grid.bounds;
  const zMin = bounds.zMin;
  const zMax = bounds.zMax;
  const rMax = bounds.rMax;
  return {
    sx: width / Math.max(zMax - zMin, 0.001),
    sy: height / Math.max(rMax, 0.001),
    x: (z) => x + (z - zMin) * width / Math.max(zMax - zMin, 0.001),
    y: (r) => y + height - r * height / Math.max(rMax, 0.001)
  };
}

function drawFieldMapInset(ctx, result, p, x, y, width, height) {
  const g = result.grid;
  const m = fieldInsetMetrics(result, x, y, width, height);
  const scaleMax = fieldScaleMaxForDisplay(result, p);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(x, y, width, height);
  for (let i = 1; i < g.nr - 1; i += 1) {
    const rBounds = nodeCellBounds(g.rCoords, i, 0, g.bounds.rMax);
    const r = gridR(g, i);
    const yTop = rBounds ? m.y(rBounds.hi) : m.y(r);
    const cellH = rBounds ? Math.max(1, (rBounds.hi - rBounds.lo) * m.sy + 0.5) : Math.max(1, g.dr * m.sy + 0.5);
    for (let j = 1; j < g.nz - 1; j += 1) {
      const zBounds = nodeCellBounds(g.zCoords, j, g.bounds.zMin, g.bounds.zMax);
      const z = gridZ(g, j);
      const xLeft = zBounds ? m.x(zBounds.lo) : m.x(z);
      const cellW = zBounds ? Math.max(1, (zBounds.hi - zBounds.lo) * m.sx + 0.5) : Math.max(1, g.dz * m.sx + 0.5);
      ctx.fillStyle = fieldDisplayColor(result, g, i, j, scaleMax);
      ctx.fillRect(xLeft, yTop, cellW, cellH);
    }
  }
  const components = modelComponents(p, result);
  drawConductorFills(ctx, m, components, boundaryColorForField);
  drawComponentOutlines(ctx, m, components);
  drawMaxFieldMarker(ctx, m, result, 10);
  ctx.restore();

  ctx.strokeStyle = "#c9c1b0";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);
  ctx.fillStyle = "#5b6670";
  ctx.font = "14px Arial";
  ctx.fillText("z", x + width - 22, y + height - 10);
  ctx.fillText("r", x + 10, y + 18);
}

function fieldBreakdownDefinitions(p) {
  const definitions = dielectricDefinitions(p)
    .filter((definition) => Number.isFinite(definition.breakdownKvPerMm))
    .map((definition) => ({
      ...definition,
      breakdownVPerMm: definition.breakdownKvPerMm * 1000
    }));
  return definitions;
}

function fieldScaleMaxForDisplay(result, p = null) {
  const expectedGapField = p?.plate_gap_mm > 0 ? p.bias_voltage_v / p.plate_gap_mm : Number.NaN;
  const candidates = [
    result?.maxField,
    result?.rawMaxField,
    expectedGapField
  ].filter((value) => Number.isFinite(value) && value > 0);
  if (!candidates.length) return 1;
  return Math.max(...candidates);
}

function drawFieldColorbar(ctx, x, y, width, height, maxField, options = {}) {
  const scaleMax = Number.isFinite(maxField) && maxField > 0 ? maxField : 1;
  const gradient = ctx.createLinearGradient(x, y + height, x, y);
  [0, 0.33, 0.66, 1].forEach((stop) => gradient.addColorStop(stop, fieldColor(stop * scaleMax, scaleMax)));
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = "#c9c1b0";
  ctx.strokeRect(x, y, width, height);
  ctx.fillStyle = "#5b6670";
  ctx.font = "13px Arial";
  ctx.textAlign = "right";
  ctx.fillText("E", x - 8, y - 8);
  ctx.fillText("0", x - 8, y + height);
  ctx.fillText(formatFieldVPerMm(scaleMax / 2), x - 8, y + height / 2 + 4);
  ctx.fillText(formatFieldVPerMm(scaleMax), x - 8, y + 4);
  ctx.textAlign = "left";

  const breakdownDefs = options.breakdownDefinitions || [];
  for (const definition of breakdownDefs) {
    const yBreak = y + height - (definition.breakdownVPerMm / scaleMax) * height;
    if (yBreak < y - 0.5 || yBreak > y + height + 0.5) continue;
    ctx.strokeStyle = definition.key === "washer" ? "#8a6a18" : "#35736f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 3, yBreak);
    ctx.lineTo(x + width + 5, yBreak);
    ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.font = "12px Arial";
    ctx.textAlign = "left";
    drawSubscriptText(ctx, [
      { text: `${definition.shortLabel || definition.label} E` },
      { text: "bd", sub: true }
    ], x + width + 8, yBreak + 4, { color: ctx.strokeStyle, font: "12px Arial" });
  }
  if (options.caption) {
    ctx.fillStyle = "#5b6670";
    ctx.font = "12px Arial";
    ctx.textAlign = "left";
    ctx.fillText(options.caption, x + width + 8, y + height + 16);
  }
  ctx.textAlign = "left";
}

function drawMaxFieldMarker(ctx, m, result, radius = 9) {
  if (!result.maxLocation) return;
  const px = m.x(result.maxLocation.z);
  const py = m.y(result.maxLocation.r);
  ctx.save();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(px, py, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "#b73e3e";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(px, py, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function resultSolverLabel(result) {
  const effective = result.solverStatus?.effective || result.solver;
  if (effective === "fenicsx") return "Backend FEniCSx";
  if (effective === "fd") return "Backend adaptive FD";
  if (result.source === "js-local") return result.adaptive?.enabled ? "Browser JS adaptive" : "Browser JS";
  if (result.source === "js-fallback") return "Backend fallback: JS adaptive";
  if (result.source === "js-slide-screening") return "Slide preview: JS screening";
  if (String(result.source || "").startsWith("js")) return "Browser JS screening";
  if (result.source) return String(result.source);
  return "Field solve";
}

function captureResultParameters(result, p) {
  result.requestedParameters = structuredClone(p);
  result.parameters = result.parameters || structuredClone(p);
  result.parameterKey = comparableResultParameters(p);
  result.potential = result.potential || result.grid?.v || null;
  result.model = result.model || localModelFromParameters(result.parameters);
  const components = componentsFromGeometrySummary(result.model?.geometry);
  if (components) {
    backendGeometryCache = {
      key: result.parameterKey,
      components,
      model: result.model
    };
  }
  return result;
}

function currentSolvedResultForSlides() {
  const currentKey = comparableResultParameters(params);
  if (lastResult?.parameterKey === currentKey) {
    const bundledDefault = Boolean(lastResult.bundledDefault);
    return {
      result: lastResult,
      parameters: lastResult.parameters || params,
      mode: bundledDefault ? "bundled-default" : "last-run",
      blurb: bundledDefault
        ? `Displaying the bundled FEniCSx field result for this exact default geometry: ${resultSolverLabel(lastResult)}.`
        : `Displaying the last solved field result for this exact design: ${resultSolverLabel(lastResult)}.`
    };
  }
  return null;
}

function slidePreviewResult() {
  const previewParams = slideResultParameters();
  const cacheKey = comparableResultParameters(previewParams);
  let result = slideResultCache?.key === cacheKey ? slideResultCache.result : null;
  if (!result) {
    result = solveField(previewParams);
    result.source = "js-slide-screening";
    captureResultParameters(result, previewParams);
    slideResultCache = { key: cacheKey, result };
  }
  return {
    result,
    parameters: previewParams,
    mode: "preview",
    blurb: "No current solved result is available for this exact design; displaying a reduced JS screening preview for the slide."
  };
}

function drawSimulationResultsSlide(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, w, h);

  const slideResult = currentSolvedResultForSlides() || slidePreviewResult();
  const result = slideResult.result;
  const resultParams = slideResult.parameters;

  const mapX = 48;
  const mapY = 86;
  const mapW = 552;
  const mapH = 390;
  drawFieldMapInset(ctx, result, resultParams, mapX, mapY, mapW, mapH);
  const breakdownDefinitions = fieldBreakdownDefinitions(resultParams);
  drawFieldColorbar(ctx, 700, mapY + 30, 18, mapH - 60, fieldScaleMaxForDisplay(result, resultParams), {
    breakdownDefinitions,
    caption: "absolute E scale"
  });

  const panelX = 835;
  ctx.fillStyle = "#17202a";
  ctx.font = "30px Arial";
  ctx.fillText("Field Screening", panelX, 104);
  ctx.fillStyle = "#5b6670";
  ctx.font = "17px Arial";
  ctx.fillText(resultSolverLabel(result), panelX, 134);
  ctx.font = "14px Arial";
  drawWrappedLines(ctx, [slideResult.blurb], panelX, 158, 18, "#5b6670", "14px Arial", 250);

  ctx.fillStyle = "#17202a";
  ctx.font = "21px Arial";
  ctx.fillText("Supported E", panelX, 216);
  ctx.font = "32px Arial";
  ctx.fillText(formatFieldVPerMm(result.maxField), panelX, 254);
  ctx.fillStyle = "#5b6670";
  ctx.font = "16px Arial";
  ctx.fillText(`r ${result.maxLocation.r.toFixed(2)} mm, z ${result.maxLocation.z.toFixed(2)} mm`, panelX, 284);
  ctx.fillText(rawMaxFieldSummary(result), panelX, 310);
  ctx.fillText(Number.isFinite(result.iterations) ? `${result.iterations} solver sweeps/iterations` : "solver iterations unavailable", panelX, 336);
  ctx.fillText(result.adaptive?.enabled ? "refined nonuniform grid" : "solver grid from displayed result", panelX, 362);

  const margins = dielectricMarginSummaries(result, resultParams);
  const marginRows = [
    ["Washer", margins.washer],
    ["Epoxy", margins.epoxy]
  ];
  ctx.font = "20px Arial";
  ctx.fillStyle = "#17202a";
  ctx.fillText("Dielectric checks", panelX, 394);
  marginRows.forEach(([label, summary], index) => {
    const yy = 432 + index * 58;
    ctx.fillStyle = index === 0 ? "#8a6a18" : "#35736f";
    ctx.font = "18px Arial";
    ctx.fillText(label, panelX, yy);
    ctx.fillStyle = "#17202a";
    ctx.font = "16px Arial";
    ctx.fillText(`${formatFieldVPerMm(summary.maxField)} supported`, panelX + 88, yy);
    ctx.fillStyle = "#5b6670";
    ctx.font = "14px Arial";
    const marginText = Number.isFinite(summary.margin) ? `${summary.margin.toFixed(1)}× margin` : "breakdown TBD";
    drawSubscriptText(ctx, [
      { text: `${marginText}; E` },
      { text: "bd", sub: true },
      { text: ` ${formatKvPerMm(summary.breakdownKvPerMm)}` }
    ], panelX + 88, yy + 22, { color: "#5b6670", font: "14px Arial" });
  });

  drawWrappedLines(ctx, [
    slideResult.mode !== "preview"
      ? slideResult.mode === "bundled-default"
        ? "This slide is using the committed default-geometry FEniCSx result. Change an input to switch to the browser preview."
        : "This slide is using the field result that was actually run in the Designer tab."
      : "Preview mode uses a reduced browser solve; run a field solve to replace this with the latest result.",
    "Color scale is absolute field magnitude; breakdown markers use material-specific placeholder thresholds where available."
  ], 52, 560, 23, "#5b6670", "17px Arial");
}

function drawThermalSlide(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, w, h);

  const thermalScreen = thermalScreenFor(params);
  const plot = { left: 82, top: 58, right: 790, bottom: 520 };
  const tMin = -80;
  const tMax = thermalScreen.stressFreeTemperatureC;
  const thermalFea = thermalFeaResultForCurrentDesign();
  const feaP99 = thermalFea?.epoxy_principal_tensile_stress_mpa?.p99;
  const feaSolvedDropC = thermalFea
    ? thermalFea.reference_temperature_c - thermalFea.evaluation_temperature_c
    : 0;
  const feaStressPerDegree = Number.isFinite(feaP99) && feaSolvedDropC > 0 ? feaP99 / feaSolvedDropC : null;
  const feaHalfStressPerDegree = feaStressPerDegree === null ? null : 0.5 * feaStressPerDegree;
  const feaStressAtMin = feaStressPerDegree === null ? 0 : feaStressPerDegree * (tMax - tMin);
  const triaxialStressPerDegree = params.thermal_epoxy_modulus_gpa * 1000
    * Math.abs(thermalScreen.epoxyCtePpmPerC - thermalScreen.aluminaCtePpmPerC) * 1e-6
    / (1 - 2 * thermalScreen.epoxyPoissonRatio);
  const triaxialStressAtMin = triaxialStressPerDegree * (tMax - tMin);
  const stressMax = Math.ceil(Math.max(50, feaStressAtMin * 1.1, triaxialStressAtMin * 1.1) / 10) * 10;
  const x = (temperatureC) => plot.left + (temperatureC - tMin) / (tMax - tMin) * (plot.right - plot.left);
  const y = (stressMpa) => plot.bottom - stressMpa / stressMax * (plot.bottom - plot.top);
  const stressAt = (temperatureC, restraint) => {
    const sample = { ...params, thermal_min_temperature_c: temperatureC };
    return thermalStressEstimate(sample, restraint).stressMpa;
  };

  ctx.strokeStyle = "#d8d1c3";
  ctx.lineWidth = 1;
  ctx.font = "15px Arial";
  ctx.fillStyle = "#5b6670";
  for (let stress = 0; stress <= stressMax; stress += 10) {
    const yy = y(stress);
    ctx.beginPath();
    ctx.moveTo(plot.left, yy);
    ctx.lineTo(plot.right, yy);
    ctx.stroke();
    ctx.textAlign = "right";
    ctx.fillText(`${stress}`, plot.left - 12, yy + 5);
  }
  for (let temperature = -80; temperature <= 60; temperature += 20) {
    const xx = x(temperature);
    ctx.beginPath();
    ctx.moveTo(xx, plot.top);
    ctx.lineTo(xx, plot.bottom);
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillText(`${temperature}`, xx, plot.bottom + 25);
  }
  ctx.textAlign = "center";
  ctx.fillText(`${thermalScreen.stressFreeTemperatureC}`, plot.right, plot.bottom + 25);
  ctx.strokeStyle = "#17202a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(plot.left, plot.top);
  ctx.lineTo(plot.left, plot.bottom);
  ctx.lineTo(plot.right, plot.bottom);
  ctx.stroke();
  ctx.save();
  ctx.translate(23, (plot.top + plot.bottom) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.font = "17px Arial";
  ctx.fillText("Epoxy tensile stress (MPa)", 0, 0);
  ctx.restore();
  ctx.textAlign = "center";
  ctx.fillText("Assembly temperature (°C)", (plot.left + plot.right) / 2, plot.bottom + 52);

  const drawCurve = (restraint, color, width) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (let temperature = tMin; temperature <= tMax; temperature += 2) {
      const xx = x(temperature);
      const yy = y(stressAt(temperature, restraint));
      if (temperature === tMin) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
  };
  drawCurve(1, "#b73e3e", 4);
  drawCurve(0.5, "#1f6f78", 4);
  ctx.save();
  ctx.strokeStyle = "#8a6a18";
  ctx.lineWidth = 4;
  ctx.setLineDash([9, 6]);
  ctx.beginPath();
  for (let temperature = tMin; temperature <= tMax; temperature += 2) {
    const xx = x(temperature);
    const yy = y(triaxialStressPerDegree * (tMax - temperature));
    if (temperature === tMin) ctx.moveTo(xx, yy);
    else ctx.lineTo(xx, yy);
  }
  ctx.stroke();
  ctx.restore();
  const drawFeaCurve = (stressPerDegree, color, dash = []) => {
    if (stressPerDegree === null) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.setLineDash(dash);
    ctx.beginPath();
    for (let temperature = tMin; temperature <= tMax; temperature += 2) {
      const xx = x(temperature);
      const yy = y(stressPerDegree * (tMax - temperature));
      if (temperature === tMin) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
    ctx.restore();
  };
  drawFeaCurve(feaStressPerDegree, "#7354a3");
  drawFeaCurve(feaHalfStressPerDegree, "#b18bd3", [10, 6]);

  const strengthY = y(thermalScreen.epoxyTensileStrengthMpa);
  ctx.strokeStyle = "#8a6a18";
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 7]);
  ctx.beginPath();
  ctx.moveTo(plot.left, strengthY);
  ctx.lineTo(plot.right, strengthY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.textAlign = "right";
  ctx.font = "16px Arial";
  ctx.fillStyle = "#8a6a18";
  ctx.fillText("Bulk cured tensile-strength proxy: 20 MPa", plot.right - 12, strengthY - 10);

  const full = thermalStressEstimate(params, 1);
  const half = thermalStressEstimate(params, 0.5);
  const lowModulus = thermalStressEstimate({ ...params, thermal_epoxy_modulus_gpa: 2 }, 1);
  const highModulus = thermalStressEstimate({ ...params, thermal_epoxy_modulus_gpa: 4 }, 1);
  const feaStrengthCrossingC = feaStressPerDegree > 0
    ? tMax - thermalScreen.epoxyTensileStrengthMpa / feaStressPerDegree
    : null;
  const feaHalfStrengthCrossingC = feaHalfStressPerDegree > 0
    ? tMax - thermalScreen.epoxyTensileStrengthMpa / feaHalfStressPerDegree
    : null;
  const drawStrengthCrossing = (estimate, color, label, labelOffsetY, labelAlign = "left") => {
    if (!Number.isFinite(estimate.failureOnsetC) || estimate.failureOnsetC < tMin || estimate.failureOnsetC > tMax) return;
    const xx = x(estimate.failureOnsetC);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(xx, strengthY);
    ctx.lineTo(xx, plot.bottom);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(xx, strengthY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = "14px Arial";
    ctx.textAlign = labelAlign;
    ctx.fillText(label, xx + (labelAlign === "right" ? -10 : 10), strengthY + labelOffsetY);
    ctx.restore();
  };
  drawStrengthCrossing(half, "#1f6f78", `k = 0.5: ${half.failureOnsetC.toFixed(0)} °C bulk proxy`, -12);
  drawStrengthCrossing(full, "#b73e3e", `k = 1: ${full.failureOnsetC.toFixed(0)} °C bulk proxy`, 22, "right");
  if (Number.isFinite(feaStrengthCrossingC)) {
    drawStrengthCrossing(
      { failureOnsetC: feaStrengthCrossingC },
      "#7354a3",
      `FEA P99 k = 1: ${feaStrengthCrossingC.toFixed(0)} °C`,
      -34,
      "right"
    );
  }
  if (Number.isFinite(feaHalfStrengthCrossingC)) {
    drawStrengthCrossing(
      { failureOnsetC: feaHalfStrengthCrossingC },
      "#b18bd3",
      `FEA P99 k = 0.5: ${feaHalfStrengthCrossingC.toFixed(0)} °C`,
      44
    );
  }

  const panelX = 840;
  ctx.textAlign = "left";
  ctx.fillStyle = "#17202a";
  ctx.font = "23px Arial";
  ctx.fillText("Bulk-stress comparison", panelX, 76);
  ctx.font = "15px Arial";
  ctx.fillStyle = "#5b6670";
  ctx.fillText(`Closed form at ${params.thermal_min_temperature_c.toFixed(0)} °C: ${thermalStressEstimate(params).stressMpa.toFixed(1)} MPa`, panelX, 106);
  ctx.fillStyle = Number.isFinite(feaP99) ? "#7354a3" : "#5b6670";
  ctx.fillText(Number.isFinite(feaP99) ? `FEA epoxy P99: ${feaP99.toFixed(1)} MPa` : "FEA epoxy P99: not solved", panelX, 132);
  ctx.fillStyle = "#5b6670";
  ctx.fillText("FEA maximum-principal stress", panelX, 160);
  ctx.fillText("includes axial + r-z shear.", panelX, 180);

  ctx.fillStyle = "#7354a3";
  ctx.font = "18px Arial";
  ctx.fillText("FEA P99, k = 1", panelX, 216);
  ctx.fillStyle = "#17202a";
  ctx.font = "21px Arial";
  ctx.fillText(
    Number.isFinite(feaStrengthCrossingC) ? `20 MPa at ${feaStrengthCrossingC.toFixed(0)} °C` : "20 MPa crossing: solve FEA",
    panelX,
    244
  );

  ctx.fillStyle = "#8d64b2";
  ctx.font = "18px Arial";
  ctx.fillText("FEA P99, k = 0.5 sensitivity", panelX, 280);
  ctx.fillStyle = "#17202a";
  ctx.font = "21px Arial";
  ctx.fillText(
    Number.isFinite(feaHalfStrengthCrossingC) ? `20 MPa at ${feaHalfStrengthCrossingC.toFixed(0)} °C` : "20 MPa crossing: solve FEA",
    panelX,
    308
  );

  ctx.fillStyle = "#b73e3e";
  ctx.font = "17px Arial";
  ctx.fillText("Closed form, radial + hoop", panelX, 350);
  ctx.fillStyle = "#17202a";
  ctx.font = "15px Arial";
  ctx.fillText(`k = 1: ${full.failureOnsetC.toFixed(0)} °C; k = 0.5: ${half.failureOnsetC.toFixed(0)} °C`, panelX, 376);
  ctx.fillStyle = "#5b6670";
  ctx.fillText(`2-4 GPa k = 1 range: ${lowModulus.failureOnsetC.toFixed(0)} to +${highModulus.failureOnsetC.toFixed(0)} °C`, panelX, 400);
  drawWrappedLines(ctx, [
    "Shear-driven bond separation could open a discharge path.",
    "The 20 MPa line is a bulk tensile proxy, not measured interface adhesion."
  ], panelX, 438, 20, "#5b6670", "14px Arial", 230);

  ctx.fillStyle = "#b73e3e";
  ctx.fillRect(105, 24, 25, 4);
  ctx.fillStyle = "#17202a";
  ctx.font = "15px Arial";
  ctx.fillText("r + hoop, k = 1", 140, 30);
  ctx.fillStyle = "#1f6f78";
  ctx.fillRect(260, 24, 25, 4);
  ctx.fillStyle = "#17202a";
  ctx.fillText("r + hoop, k = 0.5", 295, 30);
  ctx.fillStyle = "#8a6a18";
  ctx.fillRect(420, 24, 25, 4);
  ctx.fillStyle = "#17202a";
  ctx.fillText("uniform 3-direction", 455, 30);
  if (feaStressPerDegree !== null) {
    ctx.fillStyle = "#7354a3";
    ctx.fillRect(590, 18, 25, 4);
    ctx.fillStyle = "#17202a";
    ctx.fillText("FEA P99, k = 1", 625, 24);
    ctx.save();
    ctx.strokeStyle = "#b18bd3";
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 6]);
    ctx.beginPath();
    ctx.moveTo(590, 43);
    ctx.lineTo(615, 43);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "#17202a";
    ctx.fillText("FEA P99, k = 0.5 sensitivity", 625, 49);
  }
}

function drawFullWaveSlide(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const result = fullWaveResultForCurrentDesign();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!result?.samples?.length) {
    drawWrappedLines(ctx, [
      fullWavePending ? "Full-wave Maxwell solve is running on the Pi." : "Run Solve full-wave EM in the Electrical solver settings.",
      "The presentation combines the low-frequency EQS limit with the MEEP resonance search."
    ], 70, 90, 28, "#5b6670", "18px Arial", 920);
    return;
  }

  const resultEqsSamples = Array.isArray(result.eqs_samples)
    ? result.eqs_samples.map((sample) => ({
        frequencyHz: sample.frequency_hz,
        intrinsicFieldDb: sample.magnitude_db
      }))
    : [];
  const eqsSaved = (resultEqsSamples.length ? resultEqsSamples : (window.DISCOIDAL_DEFAULT_EQS_SWEEP?.samples || []))
    .filter((sample) => Number.isFinite(sample.frequencyHz) && Number.isFinite(sample.intrinsicFieldDb))
    .sort((a, b) => a.frequencyHz - b.frequencyHz);
  const interpolateTransmissionDb = (frequencyHz) => {
    const upperIndex = eqsSaved.findIndex((sample) => sample.frequencyHz >= frequencyHz);
    if (upperIndex < 0) return eqsSaved.at(-1)?.intrinsicFieldDb ?? Number.NaN;
    if (upperIndex === 0) return eqsSaved[0]?.intrinsicFieldDb ?? Number.NaN;
    const lower = eqsSaved[upperIndex - 1];
    const upper = eqsSaved[upperIndex];
    const fraction = Math.log(frequencyHz / lower.frequencyHz) / Math.log(upper.frequencyHz / lower.frequencyHz);
    return lower.intrinsicFieldDb + fraction * (upper.intrinsicFieldDb - lower.intrinsicFieldDb);
  };
  const meepRaw = result.samples
    .filter((sample) => Number.isFinite(sample.frequency_hz) && Number.isFinite(sample.magnitude_db))
    .sort((a, b) => a.frequency_hz - b.frequency_hz);
  const sharedFrequencies = meepRaw.map((sample) => sample.frequency_hz).filter((frequency) => (
    eqsSaved.some((sample) => Math.abs(Math.log(sample.frequencyHz / frequency)) < 1e-9)
  ));
  const normalizationFrequency = sharedFrequencies[0] || 1e9;
  const overlapFrequency = sharedFrequencies.at(-1) || normalizationFrequency;
  const fiftyHzField = eqsSaved.find((sample) => sample.frequencyHz === 50);
  const eqsCurve = [
    { frequency: 50, transmissionDb: fiftyHzField?.intrinsicFieldDb ?? interpolateTransmissionDb(50), source: "EQS" },
    ...eqsSaved.filter((sample) => sample.frequencyHz >= 100 && sample.frequencyHz <= overlapFrequency).map((sample) => ({
      frequency: sample.frequencyHz,
      transmissionDb: sample.intrinsicFieldDb,
      source: "EQS"
    }))
  ].map((sample) => ({ ...sample, attenuationDb: -sample.transmissionDb }));
  const normalizationEqsDb = interpolateTransmissionDb(normalizationFrequency);
  const normalizationMeep = meepRaw.reduce((best, sample) => (
    !best || Math.abs(Math.log(sample.frequency_hz / normalizationFrequency)) < Math.abs(Math.log(best.frequency_hz / normalizationFrequency))
      ? sample
      : best
  ), null);
  const meepOffsetDb = normalizationMeep ? normalizationEqsDb - normalizationMeep.magnitude_db : 0;
  const normalizedMeep = meepRaw
    .filter((sample) => sample.frequency_hz >= normalizationFrequency)
    .map((sample) => ({
      frequency: sample.frequency_hz,
      transmissionDb: sample.magnitude_db + meepOffsetDb,
      attenuationDb: -(sample.magnitude_db + meepOffsetDb),
      convergence: sample.convergence
    }));
  const verifiedModes = Array.isArray(result.resonance_verification?.verified_resonances)
    ? [...result.resonance_verification.verified_resonances].sort((a, b) => a.frequency_hz - b.frequency_hz)
    : [];
  let resonanceIndex = verifiedModes.length
    ? normalizedMeep.findIndex((sample) => Math.abs(Math.log(sample.frequency / verifiedModes[0].frequency_hz)) < 1e-9)
    : -1;
  if (resonanceIndex < 0 && !result.resonance_verification?.enabled) {
    for (let index = 1; index + 1 < normalizedMeep.length; index += 1) {
      if (normalizedMeep[index].transmissionDb > normalizedMeep[index - 1].transmissionDb
          && normalizedMeep[index].transmissionDb > normalizedMeep[index + 1].transmissionDb) {
        resonanceIndex = index;
        break;
      }
    }
  }
  const resonance = resonanceIndex >= 0 ? normalizedMeep[resonanceIndex] : null;
  const meepCurve = normalizedMeep.slice(0, resonanceIndex >= 0 ? resonanceIndex + 2 : normalizedMeep.length);
  const allCurve = [...eqsCurve, ...meepCurve];
  const fMin = 50;
  const fMax = meepCurve.at(-1)?.frequency || overlapFrequency;
  const ladderPrediction = coupledModePredictions(
    electromagneticCircuitForCurrentDesign(),
    params,
    1e6,
    fMax
  );
  const ladderModes = ladderPrediction.modes
    .filter((mode) => mode.naturalFrequencyHz >= fMin && mode.naturalFrequencyHz <= fMax)
    .slice(0, 4);
  const loadedLadderModes = ladderModes.filter((mode) => (
    Number.isFinite(mode.loadedPeakFrequencyHz)
    && mode.loadedPeakFrequencyHz >= fMin
    && mode.loadedPeakFrequencyHz <= fMax
  ));
  const overlapResiduals = sharedFrequencies.map((frequency) => {
    const meep = normalizedMeep.find((sample) => Math.abs(Math.log(sample.frequency / frequency)) < 1e-9);
    return {
      frequency,
      differenceDb: meep ? meep.transmissionDb - interpolateTransmissionDb(frequency) : Number.NaN
    };
  });
  const handoffResidual = overlapResiduals.find((sample) => sample.frequency === overlapFrequency)?.differenceDb;
  const overlapValidated = sharedFrequencies.length >= 2
    && Number.isFinite(handoffResidual)
    && Math.abs(handoffResidual) <= 1;
  const attenuationValues = allCurve.map((sample) => sample.attenuationDb).filter(Number.isFinite);
  const yMin = Math.min(0, Math.floor((Math.min(...attenuationValues) - 5) / 20) * 20);
  const yMax = Math.max(20, Math.ceil((Math.max(...attenuationValues) + 5) / 20) * 20);
  const frame = { left: 78, right: 790, top: 82, bottom: 485 };
  const xFor = (frequency) => frame.left
    + Math.log10(frequency / fMin) / Math.log10(fMax / fMin) * (frame.right - frame.left);
  const yFor = (attenuationDb) => frame.bottom
    - (attenuationDb - yMin) / (yMax - yMin) * (frame.bottom - frame.top);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(frame.left, frame.top, frame.right - frame.left, frame.bottom - frame.top);
  ctx.strokeStyle = "#c9c1b0";
  ctx.strokeRect(frame.left, frame.top, frame.right - frame.left, frame.bottom - frame.top);
  for (let tick = Math.ceil(yMin / 20) * 20; tick <= yMax; tick += 20) {
    const yy = yFor(tick);
    ctx.strokeStyle = "#e0e4e6";
    ctx.beginPath();
    ctx.moveTo(frame.left, yy);
    ctx.lineTo(frame.right, yy);
    ctx.stroke();
    ctx.fillStyle = "#5b6670";
    ctx.font = "13px Arial";
    ctx.textAlign = "right";
    ctx.fillText(`${tick} dB`, frame.left - 9, yy + 4);
  }
  const frequencyTicks = [50];
  for (let decade = 2; 10 ** decade <= fMax * 1.001; decade += 1) frequencyTicks.push(10 ** decade);
  frequencyTicks.forEach((frequency) => {
    const xx = xFor(frequency);
    ctx.strokeStyle = "#e0e4e6";
    ctx.beginPath();
    ctx.moveTo(xx, frame.top);
    ctx.lineTo(xx, frame.bottom);
    ctx.stroke();
    ctx.fillStyle = "#5b6670";
    ctx.font = "12px Arial";
    ctx.textAlign = frequency === 50 ? "left" : "center";
    ctx.fillText(formatFrequency(frequency), xx, frame.bottom + 22);
  });
  ctx.fillStyle = "#17202a";
  ctx.font = "20px Arial";
  ctx.textAlign = "left";
  ctx.fillText("Noise-power attenuation from 50 Hz", frame.left, 48);
  ctx.save();
  ctx.translate(23, (frame.top + frame.bottom) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = "#5b6670";
  ctx.font = "13px Arial";
  ctx.textAlign = "center";
  ctx.fillText("-10 log10(Sout / Sin), dB", 0, 0);
  ctx.restore();

  const drawCurve = (curve, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    curve.forEach((sample, index) => {
      const xx = xFor(sample.frequency);
      const yy = yFor(sample.attenuationDb);
      if (index === 0) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    });
    ctx.stroke();
    curve.forEach((sample) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(xFor(sample.frequency), yFor(sample.attenuationDb), 4, 0, 2 * Math.PI);
      ctx.fill();
    });
  };
  drawCurve(eqsCurve, "#1f6f78");
  drawCurve(meepCurve, "#b73e3e");

  const anchorX = xFor(normalizationFrequency);
  ctx.save();
  ctx.strokeStyle = "#8a6a18";
  ctx.setLineDash([2, 5]);
  ctx.beginPath();
  ctx.moveTo(anchorX, frame.top);
  ctx.lineTo(anchorX, frame.bottom);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = "#8a6a18";
  ctx.font = "12px Arial";
  ctx.textAlign = "right";
  ctx.fillText("normalization anchor", anchorX - 6, frame.top + 18);
  const handoffX = xFor(overlapFrequency);
  ctx.save();
  ctx.strokeStyle = "#8a6a18";
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(handoffX, frame.top);
  ctx.lineTo(handoffX, frame.bottom);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = "#8a6a18";
  ctx.font = "13px Arial";
  ctx.textAlign = "right";
  ctx.fillText("EQS / MEEP handoff check", handoffX - 7, frame.top + 38);
  ladderModes.forEach((mode, index) => {
    const naturalX = xFor(mode.naturalFrequencyHz);
    ctx.save();
    ctx.strokeStyle = "#1f6f78";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([2, 5]);
    ctx.beginPath();
    ctx.moveTo(naturalX, frame.top);
    ctx.lineTo(naturalX, frame.bottom);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "#1f6f78";
    ctx.font = "11px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`ladder f0,${index + 1}`, naturalX, frame.bottom - 10 - index * 14);
  });
  loadedLadderModes.forEach((mode, index) => {
    const loadedX = xFor(mode.loadedPeakFrequencyHz);
    ctx.save();
    ctx.strokeStyle = "#7354a3";
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 4]);
    ctx.beginPath();
    ctx.moveTo(loadedX, frame.top);
    ctx.lineTo(loadedX, frame.bottom);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "#7354a3";
    ctx.font = "11px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`loaded fpeak,${index + 1}`, loadedX, frame.top + 58 + index * 14);
  });
  if (resonance) {
    const resonanceX = xFor(resonance.frequency);
    ctx.fillStyle = "#7354a3";
    ctx.beginPath();
    ctx.arc(resonanceX, yFor(resonance.attenuationDb), 7, 0, 2 * Math.PI);
    ctx.fill();
  }

  const panelX = 825;
  const eqsValidationDifference = Number(window.DISCOIDAL_DEFAULT_EQS_SWEEP?.validation?.maxLumpedComparisonDifferenceDb);
  ctx.fillStyle = "#17202a";
  ctx.font = "bold 20px Arial";
  ctx.textAlign = "left";
  ctx.fillText("Sweep interpretation", panelX, 85);
  const rows = [
    ["EQS vs RC", Number.isFinite(eqsValidationDifference) ? `max ${eqsValidationDifference.toFixed(2)} dB` : "not available"],
    ["Normalize at", formatFrequency(normalizationFrequency)],
    ["Handoff check", `${formatFrequency(overlapFrequency)}; ${Number.isFinite(handoffResidual) ? `${handoffResidual >= 0 ? "+" : ""}${handoffResidual.toFixed(2)} dB` : "no shared point"}`],
    ["Overlap status", overlapValidated ? "consistent within 1 dB" : "handoff not validated"],
    ["Low-loss ladder f0", ladderModes.length ? ladderModes.slice(0, 2).map((mode) => formatFrequency(mode.naturalFrequencyHz)).join(" / ") : "not found"],
    ["Predicted loaded peaks", loadedLadderModes.length ? loadedLadderModes.slice(0, 2).map((mode) => formatFrequency(mode.loadedPeakFrequencyHz)).join(" / ") : "none; overdamped"],
    [result.resonance_verification?.enabled ? "First verified mode" : "First coarse bracket", resonance ? formatFrequency(resonance.frequency) : "not bracketed"],
    ["ADC Nyquist", "31.25 MHz"]
  ];
  rows.forEach(([label, value], index) => {
    const y = 96 + index * 46;
    ctx.fillStyle = "#f5f2ea";
    ctx.fillRect(panelX, y, 238, 39);
    ctx.fillStyle = "#5b6670";
    ctx.font = "11px Arial";
    ctx.fillText(label, panelX + 12, y + 14);
    ctx.fillStyle = label === "Overlap status" && !overlapValidated ? "#b73e3e" : "#17202a";
    ctx.font = "16px Arial";
    ctx.fillText(value, panelX + 12, y + 33);
  });
  ctx.fillStyle = "#1f6f78";
  ctx.fillRect(panelX, 476, 24, 5);
  ctx.fillStyle = "#17202a";
  ctx.font = "13px Arial";
  ctx.fillText("EQS field limit / low-loss f0", panelX + 34, 482);
  ctx.fillStyle = "#b73e3e";
  ctx.fillRect(panelX, 500, 24, 5);
  ctx.fillStyle = "#17202a";
  ctx.fillText("MEEP, lower-point normalized", panelX + 34, 506);
  ctx.fillStyle = "#7354a3";
  ctx.fillRect(panelX, 524, 24, 5);
  ctx.fillStyle = "#17202a";
  ctx.fillText("RLC-predicted loaded fpeak", panelX + 34, 530);
  drawWrappedLines(ctx, [
    "The point after the candidate peak remains visible; a mode is labeled only when lower solved points exist on both sides.",
    "Low-loss ladder f0 is converted with fpeak = f0 sqrt(1 - 2 zeta^2); overdamped modes have no predicted amplitude peak.",
    "Negative attenuation is voltage-noise resonance, not passive power gain."
  ], 78, 536, 18, "#5b6670", "12px Arial", 985);
}

function drawSimulationChainSlide(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const circuit = electromagneticCircuitForCurrentDesign();
  const stageR = Math.max(0, Number(circuit.stageResistanceOhm) || 0);
  const cgValues = Array.isArray(circuit.shuntCapPfByNode) && circuit.shuntCapPfByNode.length
    ? circuit.shuntCapPfByNode.map((value) => Math.max(0, Number(value) || 0))
    : [Math.max(0, Number(circuit.shuntCapPf) || 0)];
  const cgPf = cgValues.reduce((sum, value) => sum + value, 0) / cgValues.length;
  const adjacentCpar = [];
  if (Array.isArray(circuit.mutualCapPfMatrix)) {
    for (let index = 0; index + 1 < circuit.mutualCapPfMatrix.length; index += 1) {
      adjacentCpar.push(Math.max(0, Number(circuit.mutualCapPfMatrix[index]?.[index + 1]) || 0));
    }
  }
  const cparPf = adjacentCpar.length
    ? adjacentCpar.reduce((sum, value) => sum + value, 0) / adjacentCpar.length
    : Math.max(0, Number(circuit.parasiticPf) || 0);
  const cornerHz = stageR > 0 && cgPf > 0 ? 1 / (2 * Math.PI * stageR * cgPf * 1e-12) : Number.NaN;
  const bypassHz = stageR > 0 && cparPf > 0 ? 1 / (2 * Math.PI * stageR * cparPf * 1e-12) : Number.NaN;
  const hfStageDb = cgPf > 0 && cparPf > 0 ? 20 * Math.log10(1 + cgPf / cparPf) : Number.NaN;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const chain = [
    ["Full geometry", "materials + electrodes", "#d8ebee", "#1f6f78"],
    ["FEniCSx fields", "Maxwell C matrix", "#e8e0f0", "#7354a3"],
    ["RC ladder", "Rstage, Cg, Cpar", "#efe6d3", "#8a6a18"],
    ["SPICE + load", "cable + detector", "#f3dddd", "#b73e3e"]
  ];
  chain.forEach(([title, subtitle, fill, accent], index) => {
    const x = 38 + index * 266;
    const y = 52;
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, 220, 82);
    ctx.fillStyle = accent;
    ctx.fillRect(x, y, 7, 82);
    ctx.fillStyle = "#17202a";
    ctx.font = "bold 20px Arial";
    ctx.fillText(title, x + 20, y + 33);
    ctx.fillStyle = "#5b6670";
    ctx.font = "15px Arial";
    drawEngineeringText(ctx, subtitle, x + 20, y + 59);
    if (index < chain.length - 1) {
      const arrowX = x + 232;
      ctx.strokeStyle = "#55727a";
      ctx.fillStyle = "#55727a";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(arrowX, y + 41);
      ctx.lineTo(arrowX + 22, y + 41);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(arrowX + 22, y + 41);
      ctx.lineTo(arrowX + 13, y + 34);
      ctx.lineTo(arrowX + 13, y + 48);
      ctx.closePath();
      ctx.fill();
    }
  });

  ctx.fillStyle = "#17202a";
  ctx.font = "bold 19px Arial";
  ctx.fillText("What controls attenuation", 38, 190);
  const regimes = [
    {
      x: 38,
      title: "Low frequency",
      color: "#1f6f78",
      lines: ["Series R and shunt Cg", `Rstage = ${formatResistance(stageR)}`, `mean Cg = ${formatCapacitance(cgPf)}`, `1/(2πR Cg) = ${formatFrequency(cornerHz)}`]
    },
    {
      x: 392,
      title: "Parasitic rollover",
      color: "#8a6a18",
      lines: ["Cpar begins to bypass R", `mean adjacent Cpar = ${formatCapacitance(cparPf)}`, `1/(2πR Cpar) = ${formatFrequency(bypassHz)}`, "More R moves this corner lower"]
    },
    {
      x: 746,
      title: "High frequency",
      color: "#7354a3",
      lines: ["Capacitive divider dominates", "Geometry sets Cg / Cpar", `single-stage limit ≈ ${Number.isFinite(hfStageDb) ? hfStageDb.toFixed(1) : "--"} dB`, "More R no longer improves the limit"]
    }
  ];
  regimes.forEach((regime) => {
    ctx.fillStyle = "#f7f5ef";
    ctx.fillRect(regime.x, 212, 316, 205);
    ctx.fillStyle = regime.color;
    ctx.fillRect(regime.x, 212, 316, 6);
    ctx.fillStyle = "#17202a";
    ctx.font = "bold 19px Arial";
    ctx.fillText(regime.title, regime.x + 18, 248);
    ctx.font = "15px Arial";
    regime.lines.forEach((line, index) => {
      ctx.fillStyle = index === 0 ? "#17202a" : "#5b6670";
      drawEngineeringText(ctx, line, regime.x + 18, 282 + index * 31);
    });
  });

  ctx.fillStyle = "#e7eff0";
  ctx.fillRect(38, 448, 1024, 132);
  ctx.fillStyle = "#1f6f78";
  ctx.fillRect(38, 448, 8, 132);
  ctx.fillStyle = "#17202a";
  ctx.font = "bold 21px Arial";
  ctx.fillText("Why 10⁷-10⁸ Ω does not extend resistive filtering to MHz", 62, 482);
  drawWrappedLines(ctx, [
    "Even the optimistic combination 10 MΩ × 0.1 pF gives fpar ≈ 159 kHz; 100 MΩ × 1 pF gives ≈ 1.6 kHz.",
    "A 1 MHz parasitic-bypass corner would require Cpar < 16 fF at 10 MΩ, before counting epoxy and plate coupling."
  ], 62, 514, 27, "#35434a", "16px Arial", 970);
}

function drawSlideGraphics() {
  const slideCad = document.getElementById("slideCadCanvas");
  if (!slideCad) return;
  const slideView = { ...defaultCadView, zoom: 1.16, panY: 10 };
  drawCadModel(slideCad, slideView, false);
  drawMaterialSlide(document.getElementById("slideMaterialCanvas"));
  drawSimulationResultsSlide(document.getElementById("slideResultsCanvas"));
  drawThermalSlide(document.getElementById("slideThermalCanvas"));
  drawEdgeSlide(document.getElementById("slideEdgeCanvas"));
  drawDeformationSlide(document.getElementById("slideDeformationCanvas"));
  drawPackingSlide(document.getElementById("slidePackingCanvas"));
  drawRcDiagram(document.getElementById("slideRcCanvas"));
  drawSimulationChainSlide(document.getElementById("slideSimulationChainCanvas"));
  drawCapacitanceExtractionOverviewSlide(document.getElementById("slideCapacitanceExtractionCanvas"));
  drawCgPlateCountComparisonSlide(document.getElementById("slideCgPlateCountComparisonCanvas"));
  drawFeaSanitySlide(document.getElementById("slideFeaSanityCanvas"));
  drawCparExtractionSlide(document.getElementById("slideCparExtractionCanvas"));
  drawLoadedLadderSlide(document.getElementById("slideLoadedLadderCanvas"));
  drawSpiceLadderSlide(document.getElementById("slideSpiceLadderCanvas"));
  drawFanoNoiseSlide(document.getElementById("slideFanoNoiseCanvas"));
  drawStageValidationSlide(document.getElementById("slideStageValidationCanvas"));
  drawCparStrategyValidationSlide(document.getElementById("slideCparStrategyValidationCanvas"));
  drawCparLimitValidationSlide(document.getElementById("slideCparLimitValidationCanvas"));
  drawCgStrategyValidationSlide(document.getElementById("slideCgStrategyValidationCanvas"));
  drawCgLimitValidationSlide(document.getElementById("slideCgLimitValidationCanvas"));
  drawCgValidationHistorySlide(document.getElementById("slideCgValidationHistoryCanvas"));
  drawPrototypeGeometrySlide(document.getElementById("slidePrototypeGeometryCanvas"));
  drawPrototypePerformanceSlide(document.getElementById("slidePrototypePerformanceCanvas"));
  drawAluminaThermalStudySlide(document.getElementById("slideAluminaThermalStudyCanvas"));
  drawThermalConductorStudySlide(document.getElementById("slideThermalConductorStudyCanvas"));
  drawElectromagneticSlide(document.getElementById("slideElectromagneticCanvas"));
  drawIntrinsicComparisonSlide(document.getElementById("slideEqsCanvas"), false);
  drawFullWaveSlide(document.getElementById("slideFullWaveCanvas"));
  populateEpoxyChoiceTable();
}

function drawAluminaThermalStudySlide(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, w, h);

  const plot = { x0: 70, y0: 75, x1: 745, y1: 505 };
  const maximum = 45;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(plot.x0, plot.y0, plot.x1 - plot.x0, plot.y1 - plot.y0);
  ctx.strokeStyle = "#cbd4dc";
  ctx.lineWidth = 2;
  ctx.strokeRect(plot.x0, plot.y0, plot.x1 - plot.x0, plot.y1 - plot.y0);
  ctx.font = "14px Arial";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let tick = 0; tick <= maximum; tick += 5) {
    const y = plot.y1 - tick / maximum * (plot.y1 - plot.y0);
    ctx.strokeStyle = "#e0e6eb";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plot.x0, y);
    ctx.lineTo(plot.x1, y);
    ctx.stroke();
    ctx.fillStyle = "#5b6670";
    ctx.fillText(String(tick), plot.x0 - 10, y);
  }
  ctx.save();
  ctx.translate(20, (plot.y0 + plot.y1) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = "#17202a";
  ctx.font = "16px Arial";
  ctx.textAlign = "center";
  ctx.fillText("Stress (MPa)", 0, 0);
  ctx.restore();

  const xFor = (index) => plot.x0 + (index + 0.5) * (plot.x1 - plot.x0) / THERMAL_ALUMINA_INSERT_STUDY.length;
  const yFor = (value) => plot.y1 - Math.min(maximum, value) / maximum * (plot.y1 - plot.y0);
  const series = [
    { key: "principalP99", label: "P99 principal tension", color: "#b73e3e" },
    { key: "axialP99", label: "P99 axial tension", color: "#8a6a18" },
    { key: "shearP99", label: "P99 |r-z shear|", color: "#1f6f78" }
  ];
  series.forEach((entry) => {
    ctx.strokeStyle = entry.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    THERMAL_ALUMINA_INSERT_STUDY.forEach((row, index) => {
      const x = xFor(index);
      const y = yFor(row[entry.key]);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    THERMAL_ALUMINA_INSERT_STUDY.forEach((row, index) => {
      const x = xFor(index);
      const y = yFor(row[entry.key]);
      ctx.fillStyle = entry.color;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(row[entry.key].toFixed(1), x, y - 8);
    });
  });
  THERMAL_ALUMINA_INSERT_STUDY.forEach((row, index) => {
    const x = xFor(index);
    ctx.fillStyle = "#17202a";
    ctx.font = "14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(row.label, x, plot.y1 + 16);
    ctx.fillStyle = "#5b6670";
    ctx.font = "12px Arial";
    ctx.fillText(row.bondlineMm === null ? "baseline" : "bondline", x, plot.y1 + 37);
  });

  const panelX = 790;
  ctx.fillStyle = "#f3f6f6";
  ctx.strokeStyle = "#cbd4dc";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(panelX, 75, 270, 430, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#17202a";
  ctx.font = "bold 19px Arial";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("Epoxy cell fraction", panelX + 22, 108);
  THERMAL_ALUMINA_INSERT_STUDY.forEach((row, index) => {
    const y = 139 + index * 60;
    ctx.fillStyle = "#17202a";
    ctx.font = "13px Arial";
    ctx.fillText(row.label, panelX + 22, y);
    ctx.fillStyle = "#d9e4e2";
    ctx.fillRect(panelX + 105, y - 12, 105, 15);
    ctx.fillStyle = "#468597";
    ctx.fillRect(panelX + 105, y - 12, 105 * row.epoxyFraction, 15);
    ctx.fillStyle = "#17202a";
    ctx.textAlign = "right";
    ctx.fillText(`${(row.epoxyFraction * 100).toFixed(1)}%`, panelX + 248, y);
    ctx.textAlign = "left";
  });
  drawWrappedLines(ctx, [
    "Less epoxy does not mean lower local tensile stress.",
    "P99 shear is lower for every fitted-alumina case, but rises again at the finest 0.10 mm layer."
  ], panelX + 22, 441, 19, "#5b6670", "14px Arial", 225);

  const legendPositions = [90, 350, 610];
  series.forEach((entry, index) => {
    const x = legendPositions[index];
    ctx.strokeStyle = entry.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, 574);
    ctx.lineTo(x + 28, 574);
    ctx.stroke();
    ctx.fillStyle = "#17202a";
    ctx.font = "13px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(entry.label, x + 38, 574);
  });
  ctx.fillStyle = "#5b6670";
  ctx.font = "12px Arial";
  ctx.textAlign = "right";
  ctx.fillText("Checked-in FEniCSx study, generated 2026-07-31", 1055, 602);
}

function drawThermalConductorStudySlide(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const aluminumEnclosure = THERMAL_CONDUCTOR_ENCLOSURE_SENSITIVITY.aluminum;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#17202a";
  ctx.font = "22px Arial";
  ctx.textAlign = "left";
  ctx.fillText("Default geometry, 70 to 20 °C; dots use a copper tube", 62, 48);

  const panels = [
    { title: "P99 principal tension", unit: "MPa", x0: 62, x1: 535, minimum: 30, maximum: 38, bulkKey: "bulkPrincipal", fittedKey: "fittedPrincipal" },
    { title: "P99 |r-z shear|", unit: "MPa", x0: 610, x1: 1040, minimum: 4, maximum: 14, bulkKey: "bulkShear", fittedKey: "fittedShear" }
  ];
  const y0 = 112;
  const y1 = 430;
  const rowY = (index) => y0 + 47 + index * 44;
  const colors = { bulk: "#b73e3e", fitted: "#1f6f78" };

  panels.forEach((panel) => {
    const xFor = (value) => panel.x0 + 112 + (value - panel.minimum) / (panel.maximum - panel.minimum) * (panel.x1 - panel.x0 - 128);
    ctx.fillStyle = "#f8f6f0";
    ctx.fillRect(panel.x0, y0, panel.x1 - panel.x0, y1 - y0);
    ctx.strokeStyle = "#cbd4dc";
    ctx.strokeRect(panel.x0, y0, panel.x1 - panel.x0, y1 - y0);
    ctx.fillStyle = "#17202a";
    ctx.font = "bold 18px Arial";
    ctx.fillText(panel.title, panel.x0 + 16, y0 + 30);
    for (let tick = panel.minimum; tick <= panel.maximum; tick += 2) {
      const x = xFor(tick);
      ctx.strokeStyle = "#dfe5e9";
      ctx.beginPath();
      ctx.moveTo(x, y0 + 44);
      ctx.lineTo(x, y1 - 30);
      ctx.stroke();
      ctx.fillStyle = "#5b6670";
      ctx.font = "12px Arial";
      ctx.textAlign = "center";
      ctx.fillText(String(tick), x, y1 - 10);
    }
    THERMAL_CONDUCTOR_STUDY.forEach((row, index) => {
      const y = rowY(index);
      const bulkX = xFor(row[panel.bulkKey]);
      const fittedX = xFor(row[panel.fittedKey]);
      ctx.textAlign = "left";
      ctx.fillStyle = "#17202a";
      ctx.font = "13px Arial";
      ctx.fillText(row.label, panel.x0 + 12, y + 4);
      ctx.strokeStyle = "#9da8b1";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bulkX, y);
      ctx.lineTo(fittedX, y);
      ctx.stroke();
      [[bulkX, colors.bulk], [fittedX, colors.fitted]].forEach(([x, color]) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
      });
    });
    ctx.fillStyle = "#5b6670";
    ctx.font = "12px Arial";
    ctx.textAlign = "right";
    ctx.fillText(panel.unit, panel.x1 - 12, y1 - 10);
  });

  drawSlideLegend(ctx, [
    { label: "Bulk epoxy", color: colors.bulk },
    { label: "0.30 mm fitted-alumina bondline", color: colors.fitted }
  ], 650, 78, { maxWidth: 375 });

  const conductivity = THERMAL_CONDUCTOR_STUDY
    .map((row) => `${row.label} ${(100 * row.conductivity).toFixed(row.conductivity < 0.1 ? 1 : 0)}%`)
    .join("  ·  ");
  ctx.fillStyle = "#17202a";
  ctx.font = "bold 16px Arial";
  ctx.textAlign = "left";
  ctx.fillText("Electrical conductivity relative to copper", 62, 476);
  drawWrappedLines(ctx, [conductivity], 62, 503, 20, "#5b6670", "14px Arial", 970);
  drawWrappedLines(ctx, [
    `All 1050-O metalwork: ${aluminumEnclosure.bulkPrincipal.toFixed(2)} MPa bulk tension (-2.9%), but ${aluminumEnclosure.fittedPrincipal.toFixed(2)} MPa fitted tension (+0.3%) and ${aluminumEnclosure.fittedShear.toFixed(2)} MPa shear (+42%).`,
    `Ideal 69 MPa perfect-plastic Cu changes matched-mesh tension by ${THERMAL_ANNEALED_COPPER_SENSITIVITY.bulk.principalChangePct.toFixed(1)}% bulk / ${THERMAL_ANNEALED_COPPER_SENSITIVITY.fitted.principalChangePct.toFixed(3)}% fitted; no meaningful tensile relief.`
  ], 62, 540, 18, "#5b6670", "13px Arial", 970);
  ctx.textAlign = "right";
  ctx.fillText("18 elastic + 2 matched references + 2 J2 sensitivity cases, generated 2026-08-01", 1038, 604);
}

function drawPrototypeGeometrySlide(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const cases = prototypeSimulationCases();
  const melf = cases.find((entry) => entry.key === "melf");
  const ferrite = cases.find((entry) => entry.key === "ferrite");
  const pairCapPf = melf.circuit.pairCapPf;
  const shuntCapPf = melf.circuit.shuntCapPf;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, w, h);

  const centerX = 270;
  const centerY = 302;
  const scale = 15;
  const radiusPx = (diameterMm) => diameterMm * scale / 2;
  const drawRing = (outerDiameter, innerDiameter, fill, stroke, lineWidth = 2) => {
    ctx.beginPath();
    ctx.arc(centerX, centerY, radiusPx(outerDiameter), 0, Math.PI * 2);
    ctx.arc(centerX, centerY, radiusPx(innerDiameter), 0, Math.PI * 2, true);
    ctx.fillStyle = fill;
    ctx.fill("evenodd");
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  };

  ctx.fillStyle = "#17202a";
  ctx.font = "23px Arial";
  ctx.fillText("Shared radial envelope", 70, 58);
  drawRing(28, 26, "rgba(85, 122, 56, 0.24)", "#557a38", 3);
  drawRing(20, 6.6, "rgba(214, 183, 93, 0.55)", "#a7862e", 3);

  ctx.save();
  ctx.strokeStyle = "#557a38";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 7]);
  ctx.beginPath();
  ctx.arc(centerX, centerY, radiusPx(5.1), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = "rgba(31, 111, 120, 0.78)";
  ctx.beginPath();
  ctx.arc(centerX, centerY, radiusPx(2), 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#1f6f78";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = "#b73e3e";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radiusPx(2.2), 0, Math.PI * 2);
  ctx.stroke();

  const radialLabels = [
    { x: 76, y: 92, color: "#557a38", label: "Ground tube ID 26.0 mm" },
    { x: 300, y: 92, color: "#a7862e", label: "Washer OD 20.0 mm" },
    { x: 76, y: 520, color: "#a7862e", label: "Washer ID 6.6 mm" },
    { x: 300, y: 520, color: "#557a38", label: "Ground minimum ID 5.1 mm" }
  ];
  radialLabels.forEach((entry) => {
    ctx.strokeStyle = entry.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(entry.x, entry.y - 6);
    ctx.lineTo(entry.x + 22, entry.y - 6);
    ctx.stroke();
    ctx.fillStyle = entry.color;
    ctx.font = "14px Arial";
    ctx.fillText(entry.label, entry.x + 30, entry.y);
  });

  ctx.fillStyle = "#1f6f78";
  ctx.font = "16px Arial";
  ctx.fillText("2.0 mm ferrite", 116, 574);
  ctx.strokeStyle = "#1f6f78";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(82, 568);
  ctx.lineTo(106, 568);
  ctx.stroke();
  ctx.fillStyle = "#b73e3e";
  ctx.fillText("2.2 mm MELF", 338, 574);
  ctx.strokeStyle = "#b73e3e";
  ctx.beginPath();
  ctx.moveTo(304, 568);
  ctx.lineTo(328, 568);
  ctx.stroke();

  const panelX = 650;
  ctx.fillStyle = "#17202a";
  ctx.font = "23px Arial";
  ctx.fillText("Fixed two-pair simulation", panelX, 58);

  const rows = [
    ["Washer", "6.6 x 20 x 1.5 mm", "stock candidate"],
    ["Plate edge radius", "0.75 mm", "same machined copper"],
    ["MELF radial gap", "1.45 mm", "(5.1 - 2.2) / 2"],
    ["Ferrite radial gap", "1.55 mm", "(5.1 - 2.0) / 2"],
    ["One washer C", formatCapacitance(pairCapPf), "analytic overlap"],
    ["Node shunt C", formatCapacitance(shuntCapPf), "two washers"]
  ];
  rows.forEach((row, index) => {
    const y = 94 + index * 70;
    ctx.strokeStyle = "#d7cbb5";
    ctx.beginPath();
    ctx.moveTo(panelX, y + 45);
    ctx.lineTo(1040, y + 45);
    ctx.stroke();
    ctx.fillStyle = "#5b6670";
    ctx.font = "14px Arial";
    ctx.fillText(row[0], panelX, y);
    ctx.fillStyle = "#17202a";
    ctx.font = "21px Arial";
    ctx.fillText(row[1], panelX, y + 26);
    ctx.fillStyle = "#5b6670";
    ctx.font = "13px Arial";
    ctx.fillText(row[2], 860, y + 25);
  });

  drawWrappedLines(ctx, [
    "The washer and copper geometry remain fixed. Only the central resistive insert and its termination method change."
  ], panelX, 535, 22, "#5b6670", "16px Arial", 390);
}

function drawPrototypePerformanceSlide(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const cases = prototypeSimulationCases();
  const fMin = 1;
  const fMax = 100e6;
  const caseSamples = cases.map((entry) => ({
    ...entry,
    samples: loadedLadderSamples(entry.circuit, entry.params, fMin, fMax, 170)
  }));
  const plotted = caseSamples.flatMap((entry) => [
    ...entry.samples.loaded.map((sample) => sample.attenuationDb),
    ...entry.samples.unloaded.map((sample) => sample.attenuationDb)
  ]).filter((value) => Number.isFinite(value) && value >= 0);
  const maxDb = Math.max(50, Math.ceil(Math.max(...plotted, 1) / 20) * 20);

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, w, h);

  const plot = drawDbFrequencyFrame(ctx, 82, 92, 700, 365, fMin, fMax, maxDb, "Pre-run two-pair attenuation");
  caseSamples.forEach((entry) => {
    drawLogCurve(ctx, entry.samples.loaded, plot.xFor, plot.yFor, "attenuationDb", entry.color, { lineWidth: 4 });
    drawLogCurve(ctx, entry.samples.unloaded, plot.xFor, plot.yFor, "attenuationDb", entry.color, { dashed: [5, 7], lineWidth: 2.5 });
  });

  const fiftyX = plot.xFor(50);
  ctx.save();
  ctx.strokeStyle = "#557a38";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(fiftyX, 92);
  ctx.lineTo(fiftyX, 457);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = "#557a38";
  ctx.font = "14px Arial";
  ctx.fillText("50 Hz", fiftyX + 8, 118);

  drawSlideLegend(ctx, [
    { label: "MELF loaded", color: "#b73e3e" },
    { label: "MELF unloaded", color: "#b73e3e", dashed: [5, 7] },
    { label: "Ferrite loaded", color: "#1f6f78" },
    { label: "Ferrite unloaded", color: "#1f6f78", dashed: [5, 7] }
  ], 818, 94, { maxWidth: 240 });

  const summaryRows = caseSamples.map((entry) => {
    const loaded50 = attenuationDbFromMagnitude(
      ladderTransferMagnitude(entry.circuit, entry.params, 50, { includeLoad: true })
    );
    const unloaded50 = attenuationDbFromMagnitude(
      ladderTransferMagnitude(entry.circuit, entry.params, 50)
    );
    const loaded60 = attenuationDbFromMagnitude(
      ladderTransferMagnitude(entry.circuit, entry.params, 60, { includeLoad: true })
    );
    return { ...entry, loaded50, unloaded50, loaded60 };
  });

  ctx.fillStyle = "#17202a";
  ctx.font = "17px Arial";
  ctx.fillText("50/60 Hz comparison", 818, 260);
  summaryRows.forEach((entry, index) => {
    const y = 288 + index * 142;
    ctx.strokeStyle = entry.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(818, y - 8);
    ctx.lineTo(842, y - 8);
    ctx.stroke();
    ctx.fillStyle = "#17202a";
    ctx.font = "bold 16px Arial";
    ctx.fillText(entry.label, 852, y - 2);
    ctx.fillStyle = "#5b6670";
    ctx.font = "14px Arial";
    drawEngineeringText(ctx, `Rstage ${formatResistance(entry.circuit.stageResistanceOhm)}`, 818, y + 24);
    drawEngineeringText(ctx, `Cpar ${formatCapacitance(entry.circuit.parasiticPf)}`, 818, y + 46);
    ctx.fillStyle = "#17202a";
    ctx.font = "15px Arial";
    ctx.fillText(`50 Hz loaded ${formatAttenuationDb(entry.loaded50)}`, 818, y + 70);
    ctx.fillText(`50 Hz unloaded ${formatAttenuationDb(entry.unloaded50)}`, 818, y + 91);
    ctx.fillText(`60 Hz loaded ${formatAttenuationDb(entry.loaded60)}`, 818, y + 112);
  });

  drawWrappedLines(ctx, [
    "Solid curves include the cable, detector, and DC load. Dashed curves show the filter output before the cable.",
    "Ferrite uses the assumed 1e8 ohm-cm bulk resistivity; measure it before using the blue curve as a prediction."
  ], 82, 506, 23, "#5b6670", "16px Arial", 690);
}

function populateEpoxyChoiceTable() {
  const body = document.getElementById("epoxyChoiceTableBody");
  if (!body) return;
  const comparisonOrder = ["mg_9510", "mg_832fx", "mg_832fxt", "mg_832fxc", "epoxies_etc_20_3241"];
  body.replaceChildren();
  for (const key of comparisonOrder) {
    const material = epoxyMaterialPresets[key];
    const row = document.createElement("tr");
    row.classList.toggle("selected", params.epoxy_material === key);
    const values = [
      material.label,
      material.workingTime,
      material.viscosity,
      material.hardness,
      material.tg,
      material.resistivity,
      `${material.breakdownKvPerMm.toFixed(2)} kV/mm`,
      material.decisionNote
    ];
    for (const value of values) {
      const cell = document.createElement("td");
      cell.textContent = translateText(value);
      row.appendChild(cell);
    }
    body.appendChild(row);
  }
  const selected = epoxyMaterialPresets[params.epoxy_material];
  const note = document.getElementById("epoxyChoiceNote");
  if (note && selected?.epsrEstimated) {
    note.textContent = translateText(
      `${selected.label} uses a provisional relative permittivity of 3.1 from the related 832FX. Shore A and Shore D values are not directly comparable; bulk dielectric strength is not a DC partial-discharge rating.`
    );
  } else if (note) {
    note.textContent = translateText(
      "Shore A and Shore D values are not directly comparable. Dielectric strength is a bulk coupon result, not a DC partial-discharge rating."
    );
  }
}

function sortedUniqueCoords(values, lower, upper) {
  const clamped = values
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.max(lower, Math.min(upper, value)))
    .sort((a, b) => a - b);
  const coords = [];
  for (const value of clamped) {
    if (!coords.length || Math.abs(value - coords[coords.length - 1]) > 1e-6) {
      coords.push(value);
    }
  }
  if (coords[0] !== lower) coords.unshift(lower);
  if (coords[coords.length - 1] !== upper) coords.push(upper);
  return coords;
}

function addUniformCoords(values, lower, upper, count) {
  const n = Math.max(2, Math.floor(count));
  for (let index = 0; index < n; index += 1) {
    const t = index / (n - 1);
    values.push(lower + t * (upper - lower));
  }
}

function addLocalCoords(values, center, radius, lower, upper) {
  if (!(radius > 0)) return;
  const start = Math.max(lower, center - radius);
  const end = Math.min(upper, center + radius);
  if (end <= start) return;
  // The browser fallback is still only a screening solve, but the rounded edge
  // itself should never be represented by one or two huge cells. This injects
  // local coordinates with spacing no larger than one tenth of the physical
  // edge radius across the fillet neighborhood.
  const targetStep = radius / 10;
  const intervals = Math.max(1, Math.ceil((end - start) / targetStep));
  for (let index = 0; index <= intervals; index += 1) {
    values.push(start + (index / intervals) * (end - start));
  }
}

function addProbeCoords(values, center, radius, lower, upper) {
  if (!(radius > 0)) return;
  for (const scale of [-1, -0.35, 0, 0.35, 1]) {
    values.push(Math.max(lower, Math.min(upper, center + scale * radius)));
  }
}

function edgeRefinementCenters(p) {
  const core = p.core_od_mm / 2;
  const hvOuter = p.hv_plate_od_mm / 2;
  const groundInner = p.ground_plate_inner_diameter_mm / 2;
  const groundOuter = p.ground_plate_od_mm / 2;
  const centers = [];
  for (const [kind, zc] of plateCenters(p)) {
    const radius = edgeRadiusMm(p, kind);
    if (!(radius > 0)) continue;
    const half = plateThicknessMm(p, kind) / 2;
    const radialSpan = kind === "hv" ? hvOuter - core : groundOuter - groundInner;
    const rad = Math.max(0, Math.min(radius, half, radialSpan / 2));
    if (!(rad > 0)) continue;
    const rCenter = kind === "hv" ? hvOuter - rad : groundInner + rad;
    const zOffset = half - rad;
    centers.push({ r: rCenter, z: zc - zOffset, radius: rad });
    centers.push({ r: rCenter, z: zc + zOffset, radius: rad });
  }
  return centers;
}

function dielectricProbeRefinementCenters(p) {
  const core = p.core_od_mm / 2;
  const hvOuter = p.hv_plate_od_mm / 2;
  const groundInner = p.ground_plate_inner_diameter_mm / 2;
  const groundOuter = p.ground_plate_od_mm / 2;
  const tubeInner = p.tube_id_mm / 2;
  const overlapWidth = hvOuter - groundInner;
  const centers = [];

  function offsetIntoDielectric(clearance, radius) {
    if (!(clearance > 0)) return null;
    return Math.min(clearance * 0.35, Math.max(clearance * 0.15, radius * 0.5));
  }

  function probeRadius(clearance, radius) {
    if (!(clearance > 0)) return radius;
    return Math.max(0.05, Math.min(clearance * 0.45, radius * 1.5));
  }

  for (const [kind, zc] of plateCenters(p)) {
    const radius = Math.max(edgeRadiusMm(p, kind), 0.05);
    const half = plateThicknessMm(p, kind) / 2;
    const radialSpan = kind === "hv" ? hvOuter - core : groundOuter - groundInner;
    const localRadius = Math.max(0, Math.min(radius, half, radialSpan / 2));
    if (!(localRadius > 0)) continue;
    const zOffset = half - localRadius;
    if (kind === "hv") {
      const outerLimit = p.include_ground_tube ? tubeInner : hvOuter + p.domain_margin_mm;
      const clearance = outerLimit - hvOuter;
      const offset = offsetIntoDielectric(clearance, radius);
      if (offset !== null) {
        const r = hvOuter + offset;
        const rRadius = probeRadius(clearance, radius);
        centers.push({ type: "hv_outer_epoxy_probe", r, z: zc - zOffset, rRadius, zRadius: localRadius });
        centers.push({ type: "hv_outer_epoxy_probe", r, z: zc + zOffset, rRadius, zRadius: localRadius });
      }
    } else {
      const clearance = groundInner - core;
      const offset = offsetIntoDielectric(clearance, radius);
      if (offset !== null) {
        const r = groundInner - offset;
        const rRadius = probeRadius(clearance, radius);
        centers.push({ type: "ground_inner_epoxy_probe", r, z: zc - zOffset, rRadius, zRadius: localRadius });
        centers.push({ type: "ground_inner_epoxy_probe", r, z: zc + zOffset, rRadius, zRadius: localRadius });
      }
    }
  }

  if (overlapWidth > 0) {
    const radialSamples = [
      groundInner + overlapWidth * 0.25,
      groundInner + overlapWidth * 0.5,
      groundInner + overlapWidth * 0.75
    ];
    const plates = plateCenters(p);
    for (let index = 0; index < plates.length - 1; index += 1) {
      const [leftKind, leftZ] = plates[index];
      const [rightKind, rightZ] = plates[index + 1];
      if (leftKind === rightKind) continue;
      const leftHalf = plateThicknessMm(p, leftKind) / 2;
      const rightHalf = plateThicknessMm(p, rightKind) / 2;
      const z0 = leftZ + leftHalf;
      const z1 = rightZ - rightHalf;
      const gap = z1 - z0;
      if (!(gap > 0)) continue;
      const z = 0.5 * (z0 + z1);
      const radius = Math.max(edgeRadiusMm(p, leftKind), edgeRadiusMm(p, rightKind), 0.05);
      const zRadius = Math.max(0.05, Math.min(gap * 0.5, radius * 1.5));
      const rRadius = Math.max(0.05, Math.min(overlapWidth * 0.2, radius * 1.5));
      for (const r of radialSamples) {
        centers.push({ type: "washer_gap_probe", r, z, rRadius, zRadius });
      }
    }
  }

  return centers;
}

function buildGrid(p, adaptiveCoords = null) {
  // Build a fixed-potential, locally refined, axisymmetric r-z grid. This is
  // not FEA in the usual sense: no triangular/quadrilateral mesh is generated
  // and there are no basis functions. It is closer to a finite-volume
  // relaxation stencil on a structured grid.
  //
  // Coordinates:
  //   i indexes radius r from the symmetry axis to the outer model boundary.
  //   j indexes z along the stack length, including a margin at both ends.
  //
  // Arrays:
  //   v[i][j]      node voltage in volts.
  //   fixed[i][j]  true for conductor or imposed boundary nodes.
  //   eps[i][j]    relative permittivity sampled at the node.
  //   labels[i][j] rough material/conductor label for plotting and max-E scans.
  //   materials[i][j] dielectric region key: washer or epoxy.
  const bounds = geometryBounds(p);
  const rValues = [];
  const zValues = [];
  addUniformCoords(rValues, 0, bounds.rMax, p.grid_r_count);
  addUniformCoords(zValues, bounds.zMin, bounds.zMax, p.grid_z_count);

  const edgeCenters = edgeRefinementCenters(p);
  const dielectricProbeCenters = dielectricProbeRefinementCenters(p);
  for (const center of edgeCenters) {
    addLocalCoords(rValues, center.r, center.radius, 0, bounds.rMax);
    addLocalCoords(zValues, center.z, center.radius, bounds.zMin, bounds.zMax);
  }
  for (const center of dielectricProbeCenters) {
    addProbeCoords(rValues, center.r, center.rRadius, 0, bounds.rMax);
    addProbeCoords(zValues, center.z, center.zRadius, bounds.zMin, bounds.zMax);
  }
  if (adaptiveCoords) {
    rValues.push(...(adaptiveCoords.r || []));
    zValues.push(...(adaptiveCoords.z || []));
  }

  const rCoords = sortedUniqueCoords(rValues, 0, bounds.rMax);
  const zCoords = sortedUniqueCoords(zValues, bounds.zMin, bounds.zMax);
  const nr = rCoords.length;
  const nz = zCoords.length;
  const dr = bounds.rMax / (nr - 1);
  const dz = (bounds.zMax - bounds.zMin) / (nz - 1);
  const boundarySampleMinDistance = Math.max(0.01, edgeRadiusMm(p) / 10);
  const v = Array.from({ length: nr }, () => Array(nz).fill(p.bias_voltage_v * 0.5));
  const fixed = Array.from({ length: nr }, () => Array(nz).fill(false));
  const eps = Array.from({ length: nr }, () => Array(nz).fill(1));
  const labels = Array.from({ length: nr }, () => Array(nz).fill("dielectric"));
  const materials = Array.from({ length: nr }, () => Array(nz).fill("epoxy"));

  for (let i = 0; i < nr; i += 1) {
    const r = rCoords[i];
    for (let j = 0; j < nz; j += 1) {
      const z = zCoords[j];
      const zStack = Math.min(Math.max(z, 0), stackLength(p));
      eps[i][j] = materialEpsr(p, r, zStack);
      materials[i][j] = materialRegion(p, r, zStack);
      const c = classifyPoint(p, r, z);
      labels[i][j] = c.kind;
      if (c.value !== null) {
        // Conductors are Dirichlet nodes: high-voltage core/plates are fixed
        // at bias voltage and ground plates/tube are fixed at 0 V.
        v[i][j] = c.value;
        fixed[i][j] = true;
      } else if (i === nr - 1) {
        // The far radial edge of the computational box is grounded. This is a
        // crude outer boundary that usually over-constrains the fringe field;
        // the domain margin slider controls how far away that artificial wall is.
        v[i][j] = 0;
        fixed[i][j] = true;
      }
    }
  }
  return {
    nr,
    nz,
    dr,
    dz,
    rCoords,
    zCoords,
    bounds,
    v,
    fixed,
    eps,
    labels,
    materials,
    boundarySampleMinDistance,
    mesh: {
      type: "nonuniform-structured-fd",
      baseRCount: p.grid_r_count,
      baseZCount: p.grid_z_count,
      edgeRefinementCenters: edgeCenters.length,
      dielectricProbeCenters: dielectricProbeCenters.length,
      boundarySampleMinDistance,
      adaptiveRAdded: adaptiveCoords ? (adaptiveCoords.r || []).length : 0,
      adaptiveZAdded: adaptiveCoords ? (adaptiveCoords.z || []).length : 0,
      finalRCount: nr,
      finalZCount: nz
    }
  };
}

function lowerCoordIndex(coords, value) {
  if (value <= coords[0]) return 0;
  for (let index = 0; index < coords.length - 1; index += 1) {
    if (value >= coords[index] && value <= coords[index + 1]) return index;
  }
  return coords.length - 2;
}

function interpolatedVoltage(source, r, z) {
  const i0 = lowerCoordIndex(source.rCoords, r);
  const j0 = lowerCoordIndex(source.zCoords, z);
  const i1 = Math.min(i0 + 1, source.nr - 1);
  const j1 = Math.min(j0 + 1, source.nz - 1);
  const r0 = source.rCoords[i0];
  const r1 = source.rCoords[i1];
  const z0 = source.zCoords[j0];
  const z1 = source.zCoords[j1];
  const tr = r1 > r0 ? (r - r0) / (r1 - r0) : 0;
  const tz = z1 > z0 ? (z - z0) / (z1 - z0) : 0;
  const v00 = source.v[i0][j0];
  const v10 = source.v[i1][j0];
  const v01 = source.v[i0][j1];
  const v11 = source.v[i1][j1];
  const v0 = v00 + tr * (v10 - v00);
  const v1 = v01 + tr * (v11 - v01);
  return v0 + tz * (v1 - v0);
}

function seedGridFromPrevious(target, source) {
  for (let i = 0; i < target.nr; i += 1) {
    for (let j = 0; j < target.nz; j += 1) {
      if (!target.fixed[i][j]) {
        target.v[i][j] = interpolatedVoltage(source, target.rCoords[i], target.zCoords[j]);
      }
    }
  }
}

function relaxGrid(g, p, maxSweeps) {
  let lastDelta = 0;
  let sweeps = 0;
  while (sweeps < maxSweeps) {
    let maxDelta = 0;
    for (let i = 1; i < g.nr - 1; i += 1) {
      // Avoid the coordinate singularity at r = 0 inside the update equation.
      // The actual r = 0 row is handled after each sweep by symmetry.
      const r = Math.max(g.rCoords[i], (g.rCoords[i + 1] - g.rCoords[i - 1]) * 0.25);
      const hRp = g.rCoords[i + 1] - g.rCoords[i];
      const hRm = g.rCoords[i] - g.rCoords[i - 1];
      const rFaceP = 0.5 * (g.rCoords[i] + g.rCoords[i + 1]);
      const rFaceM = 0.5 * (g.rCoords[i] + g.rCoords[i - 1]);
      const radialVolume = 0.5 * (hRp + hRm);
      for (let j = 1; j < g.nz - 1; j += 1) {
        if (g.fixed[i][j]) continue;
        const hZp = g.zCoords[j + 1] - g.zCoords[j];
        const hZm = g.zCoords[j] - g.zCoords[j - 1];
        const axialVolume = 0.5 * (hZp + hZm);

        // Face permittivities. For example erp is epsilon halfway between this
        // node and the next radial node. Averaging keeps material jumps from
        // being completely ignored by the stencil, but it is still a rough
        // treatment of dielectric interfaces.
        const erp = 0.5 * (g.eps[i][j] + g.eps[i + 1][j]);
        const erm = 0.5 * (g.eps[i][j] + g.eps[i - 1][j]);
        const ezp = 0.5 * (g.eps[i][j] + g.eps[i][j + 1]);
        const ezm = 0.5 * (g.eps[i][j] + g.eps[i][j - 1]);

        // Discrete axisymmetric operator on a nonuniform structured grid. These
        // coefficients are face flux conductances divided by the local control
        // volume dimensions. With uniform spacing they reduce to the previous
        // fixed-dr/fixed-dz stencil.
        const arP = erp * rFaceP / (r * radialVolume * hRp);
        const arM = erm * rFaceM / (r * radialVolume * hRm);
        const azP = ezp / (axialVolume * hZp);
        const azM = ezm / (axialVolume * hZm);

        // Gauss-Seidel update: write the new voltage immediately, so later
        // nodes in this same sweep see the newest available neighbor values.
        const next = (arP * g.v[i + 1][j] + arM * g.v[i - 1][j] + azP * g.v[i][j + 1] + azM * g.v[i][j - 1]) / (arP + arM + azP + azM);
        const delta = Math.abs(next - g.v[i][j]);
        if (delta > maxDelta) maxDelta = delta;
        g.v[i][j] = next;
      }
    }

    // Boundary cleanup after each sweep:
    //   r = 0 is an axis of symmetry, so dV/dr = 0 and the first row copies the
    //   next radial row.
    //   z-min and z-max are open-ish ends, approximated by dV/dz = 0 unless a
    //   conductor already fixed that node.
    g.v[0] = [...g.v[1]];
    for (let i = 0; i < g.nr; i += 1) {
      if (!g.fixed[i][0]) g.v[i][0] = g.v[i][1];
      if (!g.fixed[i][g.nz - 1]) g.v[i][g.nz - 1] = g.v[i][g.nz - 2];
    }
    lastDelta = maxDelta;
    sweeps += 1;
    if (maxDelta < p.solver_tolerance_v) break;
  }
  return { sweeps, lastDelta };
}

function fieldFromGrid(g) {
  // Convert the solved potential into field magnitude using dielectric-side
  // face gradients. Central differences are tempting, but at fixed conductor
  // boundaries they span through the metal and can draw false high-field
  // stripes hugging a plate. Here each dielectric node only uses one-cell face
  // gradients to its immediate neighbors, so a conductor contributes as a
  // boundary value instead of as a sampled region to differentiate through.
  const field = Array.from({ length: g.nr }, () => Array(g.nz).fill(0));
  const dielectricPeaks = {
    washer: emptyDielectricPeak("washer"),
    epoxy: emptyDielectricPeak("epoxy")
  };
  let rawMaxField = 0;
  let rawMaxLocation = { r: 0, z: 0 };
  const boundarySampleMinDistance = g.boundarySampleMinDistance ?? 0;
  function gradientOption(ni, nj, distance, value) {
    if (!Number.isFinite(value) || !(distance > 0)) return null;
    const neighborLabel = g.labels?.[ni]?.[nj] || "dielectric";
    if (neighborLabel !== "dielectric" && distance < boundarySampleMinDistance) return null;
    return value;
  }
  for (let i = 1; i < g.nr - 1; i += 1) {
    for (let j = 1; j < g.nz - 1; j += 1) {
      if (g.labels[i][j] !== "dielectric") continue;
      const erOptions = [
        gradientOption(i + 1, j, g.rCoords[i + 1] - g.rCoords[i], -(g.v[i + 1][j] - g.v[i][j]) / (g.rCoords[i + 1] - g.rCoords[i])),
        gradientOption(i - 1, j, g.rCoords[i] - g.rCoords[i - 1], -(g.v[i][j] - g.v[i - 1][j]) / (g.rCoords[i] - g.rCoords[i - 1]))
      ].filter((value) => value !== null);
      const ezOptions = [
        gradientOption(i, j + 1, g.zCoords[j + 1] - g.zCoords[j], -(g.v[i][j + 1] - g.v[i][j]) / (g.zCoords[j + 1] - g.zCoords[j])),
        gradientOption(i, j - 1, g.zCoords[j] - g.zCoords[j - 1], -(g.v[i][j] - g.v[i][j - 1]) / (g.zCoords[j] - g.zCoords[j - 1]))
      ].filter((value) => value !== null);
      if (!erOptions.length) erOptions.push(0);
      if (!ezOptions.length) ezOptions.push(0);
      let e = 0;
      for (const er of erOptions) {
        for (const ez of ezOptions) {
          e = Math.max(e, Math.hypot(er, ez));
        }
      }
      field[i][j] = e;
      if (e > rawMaxField) {
        rawMaxField = e;
        rawMaxLocation = { r: g.rCoords[i], z: g.zCoords[j] };
      }
      const material = g.materials?.[i]?.[j] || "epoxy";
      const peak = dielectricPeaks[material];
      if (peak && e > peak.maxField) {
        peak.maxField = e;
        peak.maxLocation = { r: g.rCoords[i], z: g.zCoords[j] };
      }
    }
  }
  const supported = supportedFieldMetrics(g, field, rawMaxField, rawMaxLocation, dielectricPeaks);
  return {
    grid: g,
    field,
    maxField: supported.maxField,
    maxLocation: supported.maxLocation,
    rawMaxField,
    rawMaxLocation,
    dielectricPeaks: supported.dielectricPeaks,
    rawDielectricPeaks: dielectricPeaks,
    peakQuality: supported.peakQuality
  };
}

function addIntervalMidpoints(coords, values, index) {
  if (index > 0) values.push(0.5 * (coords[index - 1] + coords[index]));
  if (index < coords.length - 1) values.push(0.5 * (coords[index] + coords[index + 1]));
}

function adaptiveCoordsFromField(result, p) {
  if (!(result.maxField > 0)) return null;
  const g = result.grid;
  const threshold = result.maxField * FIELD_ADAPTIVE_THRESHOLD_FRACTION;
  const candidates = [];
  for (let i = 1; i < g.nr - 1; i += 1) {
    for (let j = 1; j < g.nz - 1; j += 1) {
      const e = result.field[i][j];
      if (g.labels[i][j] === "dielectric" && e >= threshold) {
        candidates.push({ i, j, e });
      }
    }
  }
  candidates.sort((a, b) => b.e - a.e);
  const r = [];
  const z = [];
  const accepted = [];
  const minimumSeparation = Math.max(edgeRadiusMm(p) * 0.5, 1e-6);
  for (const candidate of candidates) {
    if (accepted.length >= FIELD_ADAPTIVE_MAX_POINTS) break;
    const tooClose = accepted.some((prior) =>
      Math.abs(g.rCoords[prior.i] - g.rCoords[candidate.i]) < minimumSeparation
      && Math.abs(g.zCoords[prior.j] - g.zCoords[candidate.j]) < minimumSeparation
    );
    if (tooClose) continue;
    accepted.push(candidate);
    for (let di = -1; di <= 1; di += 1) {
      const ii = candidate.i + di;
      if (ii > 0 && ii < g.nr - 1) addIntervalMidpoints(g.rCoords, r, ii);
    }
    for (let dj = -1; dj <= 1; dj += 1) {
      const jj = candidate.j + dj;
      if (jj > 0 && jj < g.nz - 1) addIntervalMidpoints(g.zCoords, z, jj);
    }
  }
  return r.length || z.length ? { r, z, acceptedCount: accepted.length } : null;
}

function solveField(p) {
  // Browser-side fallback field solver.
  //
  // What it solves:
  //   Axisymmetric electrostatics with no theta dependence:
  //     div(epsilon * grad(V)) = 0
  //
  // How it solves:
  //   Repeated Gauss-Seidel-style relaxation sweeps over a structured r-z grid.
  //   The grid starts with base coordinates plus deterministic refinement near
  //   rounded conductor edges, dielectric-side edge probes, and washer gap
  //   probes between adjacent plates. A short probe solve then identifies
  //   high-field dielectric nodes, inserts midpoint coordinates around them,
  //   and runs the final relaxation on that refined grid.
  //
  // What the UI calls "Solver sweeps":
  //   One sweep means one full pass over all free grid nodes. It is not an FEA
  //   mesh count, and it is not a guarantee of convergence. The displayed count
  //   includes the probe sweeps plus the final refined solve sweeps.
  //
  // What this is good for:
  //   Fast qualitative field pictures and rough peak-field screening when the
  //   future backend is unavailable.
  //
  // What this is not good for:
  //   Qualification numbers near breakdown, accurate edge singularity/rounding
  //   behavior, extracted capacitance, tiny glue-line defects, or final design
  //   acceptance. Those need the planned axisymmetric FEA/backend workflow.
  const probeGrid = buildGrid(p);
  const probeLimit = Math.min(p.solver_iterations, FIELD_ADAPTIVE_PROBE_SWEEPS);
  const probeStats = relaxGrid(probeGrid, p, probeLimit);
  const adaptiveCoords = adaptiveCoordsFromField(fieldFromGrid(probeGrid), p);

  const remainingSweeps = Math.max(0, p.solver_iterations - probeStats.sweeps);
  const useAdaptiveGrid = Boolean(adaptiveCoords && remainingSweeps > 0);
  const g = useAdaptiveGrid ? buildGrid(p, adaptiveCoords) : probeGrid;
  if (useAdaptiveGrid) seedGridFromPrevious(g, probeGrid);
  const finalStats = useAdaptiveGrid
    ? relaxGrid(g, p, remainingSweeps)
    : { sweeps: 0, lastDelta: probeStats.lastDelta };
  return {
    ...fieldFromGrid(g),
    potential: g.v,
    iterations: probeStats.sweeps + finalStats.sweeps,
    lastDelta: finalStats.lastDelta,
    adaptive: {
      enabled: useAdaptiveGrid,
      probeSweeps: probeStats.sweeps,
      addedR: useAdaptiveGrid ? adaptiveCoords.r.length : 0,
      addedZ: useAdaptiveGrid ? adaptiveCoords.z.length : 0,
      highFieldPoints: useAdaptiveGrid ? adaptiveCoords.acceptedCount : 0
    }
  };
}

function fieldColor(value, max) {
  const t = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const stops = [
    [22, 32, 42],
    [31, 111, 120],
    [214, 183, 93],
    [183, 62, 62]
  ];
  const scaled = t * (stops.length - 1);
  const idx = Math.min(stops.length - 2, Math.floor(scaled));
  const u = scaled - idx;
  const rgb = stops[idx].map((v, n) => Math.round(v + (stops[idx + 1][n] - v) * u));
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

function percentileSorted(values, fraction) {
  if (!values.length) return 0;
  if (values.length === 1) return values[0];
  const x = Math.max(0, Math.min(1, fraction)) * (values.length - 1);
  const lower = Math.floor(x);
  const upper = Math.ceil(x);
  if (lower === upper) return values[lower];
  return values[lower] + (values[upper] - values[lower]) * (x - lower);
}

function supportedFieldMetrics(g, field, rawMaxField, rawMaxLocation, rawDielectricPeaks = null) {
  const dielectricPeaks = {
    washer: emptyDielectricPeak("washer"),
    epoxy: emptyDielectricPeak("epoxy")
  };
  let supportedMaxField = 0;
  let supportedMaxLocation = rawMaxLocation;
  for (let i = 1; i < g.nr - 1; i += 1) {
    for (let j = 1; j < g.nz - 1; j += 1) {
      if (g.labels?.[i]?.[j] !== "dielectric") continue;
      const value = field[i][j];
      if (!Number.isFinite(value) || !(value > 0)) continue;
      const material = g.materials?.[i]?.[j] || "epoxy";
      let neighbors = [];
      for (let di = -1; di <= 1; di += 1) {
        for (let dj = -1; dj <= 1; dj += 1) {
          const ni = i + di;
          const nj = j + dj;
          if (g.labels?.[ni]?.[nj] !== "dielectric") continue;
          if ((g.materials?.[ni]?.[nj] || "epoxy") !== material) continue;
          const neighborValue = field[ni][nj];
          if (Number.isFinite(neighborValue) && neighborValue > 0) neighbors.push(neighborValue);
        }
      }
      if (neighbors.length < 4) {
        neighbors = [];
        for (let ni = Math.max(1, i - 1); ni <= Math.min(g.nr - 2, i + 1); ni += 1) {
          for (let nj = Math.max(1, j - 1); nj <= Math.min(g.nz - 2, j + 1); nj += 1) {
            if (g.labels?.[ni]?.[nj] !== "dielectric") continue;
            const neighborValue = field[ni][nj];
            if (Number.isFinite(neighborValue) && neighborValue > 0) neighbors.push(neighborValue);
          }
        }
      }
      if (!neighbors.length) continue;
      neighbors.sort((a, b) => a - b);
      const supportedValue = Math.min(value, percentileSorted(neighbors, SUPPORTED_PEAK_PERCENTILE));
      if (supportedValue > supportedMaxField) {
        supportedMaxField = supportedValue;
        supportedMaxLocation = { r: gridR(g, i), z: gridZ(g, j) };
      }
      const peak = dielectricPeaks[material];
      if (peak && supportedValue > peak.maxField) {
        peak.maxField = supportedValue;
        peak.maxLocation = { r: gridR(g, i), z: gridZ(g, j) };
      }
    }
  }
  if (!(supportedMaxField > 0)) {
    supportedMaxField = rawMaxField;
    supportedMaxLocation = rawMaxLocation;
    if (rawDielectricPeaks) {
      for (const key of Object.keys(dielectricPeaks)) {
        dielectricPeaks[key] = rawDielectricPeaks[key] || dielectricPeaks[key];
      }
    }
  }
  const rawToSupportedRatio = supportedMaxField > 0 ? rawMaxField / supportedMaxField : 1;
  return {
    maxField: supportedMaxField,
    maxLocation: supportedMaxLocation,
    dielectricPeaks,
    peakQuality: {
      method: "same-material 3x3 neighborhood p75",
      percentile: SUPPORTED_PEAK_PERCENTILE,
      rawMaxField,
      rawMaxLocation,
      supportedMaxField,
      supportedMaxLocation,
      rawToSupportedRatio,
      outlierSuspected: rawToSupportedRatio > SUPPORTED_PEAK_OUTLIER_RATIO
    }
  };
}

function fieldDisplayColor(result, g, i, j, scaleMax = null) {
  const label = g.labels?.[i]?.[j] || "dielectric";
  if (label !== "dielectric") return "#fffdf8";
  return fieldColor(result.field[i][j], Number.isFinite(scaleMax) && scaleMax > 0 ? scaleMax : result.maxField);
}

function potentialColor(value, minimum, maximum) {
  const span = maximum - minimum || 1;
  const t = Math.max(0, Math.min(1, (value - minimum) / span));
  const stops = [
    [35, 78, 125],
    [49, 145, 137],
    [221, 190, 82],
    [183, 62, 62]
  ];
  const scaled = t * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.floor(scaled));
  const fraction = scaled - index;
  const a = stops[index];
  const b = stops[index + 1];
  return `rgb(${a.map((valueA, channel) => Math.round(valueA + (b[channel] - valueA) * fraction)).join(",")})`;
}

function formatPotentialV(value) {
  const magnitude = Math.abs(value);
  if (magnitude >= 1000) return `${(value / 1000).toFixed(magnitude >= 10000 ? 1 : 2)} kV`;
  return `${value.toFixed(magnitude >= 100 ? 0 : 1)} V`;
}

function modelBoundaryPotentials(result, p) {
  const boundary = result?.model?.boundaryConditions || {};
  return {
    bias: Number(boundary.biasPotentialV ?? result?.parameters?.bias_voltage_v ?? p.bias_voltage_v),
    ground: Number(boundary.groundPotentialV ?? 0)
  };
}

function boundaryColorForField(component) {
  return component.material === "ground" ? "#557a38" : "#b73e3e";
}

function drawBoundaryPotentialLegend(ctx, x, y, result, p) {
  const potentials = modelBoundaryPotentials(result, p);
  const rows = [
    { color: "#b73e3e", text: `Bias plates/core boundary: ${formatPotentialV(potentials.bias)}` },
    { color: "#557a38", text: `Ground plates/tube boundary: ${formatPotentialV(potentials.ground)}` }
  ];
  ctx.save();
  ctx.font = "12px Arial";
  ctx.textAlign = "left";
  rows.forEach((row, index) => {
    const rowY = y + index * 19;
    ctx.fillStyle = row.color;
    ctx.fillRect(x, rowY - 10, 11, 11);
    ctx.strokeStyle = "rgba(23, 32, 42, 0.4)";
    ctx.strokeRect(x, rowY - 10, 11, 11);
    ctx.fillStyle = "#37424c";
    ctx.fillText(row.text, x + 17, rowY);
  });
  ctx.restore();
}

function gridR(g, i) {
  return g.rCoords ? g.rCoords[i] : i * g.dr;
}

function gridZ(g, j) {
  return g.zCoords ? g.zCoords[j] : g.bounds.zMin + j * g.dz;
}

function nodeCellBounds(coords, index, lower, upper) {
  if (!coords) return null;
  const lo = index === 0 ? lower : 0.5 * (coords[index - 1] + coords[index]);
  const hi = index === coords.length - 1 ? upper : 0.5 * (coords[index] + coords[index + 1]);
  return { lo, hi };
}

function zoomCanvasMetrics(bounds, x, y, width, height) {
  const zSpan = Math.max(bounds.zMax - bounds.zMin, 0.001);
  const rSpan = Math.max(bounds.rMax - bounds.rMin, 0.001);
  return {
    bounds,
    sx: width / zSpan,
    sy: height / rSpan,
    x: (z) => x + (z - bounds.zMin) * width / zSpan,
    y: (r) => y + height - (r - bounds.rMin) * height / rSpan
  };
}

function clampedWindow(center, span, min, max) {
  const fullSpan = Math.max(max - min, 0.001);
  const windowSpan = Math.min(Math.max(span, 0.001), fullSpan);
  let lo = center - windowSpan / 2;
  let hi = center + windowSpan / 2;
  if (lo < min) {
    hi += min - lo;
    lo = min;
  }
  if (hi > max) {
    lo -= hi - max;
    hi = max;
  }
  return { min: Math.max(min, lo), max: Math.min(max, hi) };
}

function maxFieldZoomBounds(result, p) {
  if (!result.maxLocation) return null;
  const g = result.grid;
  const bounds = g.bounds;
  const edgeRadius = Math.max(edgeRadiusMm(p), 0.05);
  const localSpan = Math.max(1.2, p.plate_gap_mm * 2.6, edgeRadius * 5.0);
  const zWindow = clampedWindow(result.maxLocation.z, localSpan, bounds.zMin, bounds.zMax);
  const rWindow = clampedWindow(result.maxLocation.r, localSpan, 0, bounds.rMax);
  return {
    zMin: zWindow.min,
    zMax: zWindow.max,
    rMin: rWindow.min,
    rMax: rWindow.max
  };
}

function drawFieldZoomInset(ctx, result, p, components, x, y, width, height) {
  const zoomBounds = maxFieldZoomBounds(result, p);
  if (!zoomBounds) return;
  const g = result.grid;
  const m = zoomCanvasMetrics(zoomBounds, x, y, width, height);
  const scaleMax = fieldScaleMaxForDisplay(result, p);

  ctx.save();
  ctx.fillStyle = "rgba(255, 253, 248, 0.96)";
  ctx.fillRect(x - 8, y - 24, width + 16, height + 36);
  ctx.strokeStyle = "rgba(23, 32, 42, 0.35)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 8, y - 24, width + 16, height + 36);
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(x, y, width, height);

  for (let i = 1; i < g.nr - 1; i += 1) {
    const rBounds = nodeCellBounds(g.rCoords, i, 0, g.bounds.rMax);
    const r = gridR(g, i);
    const rLo = rBounds ? rBounds.lo : r - g.dr / 2;
    const rHi = rBounds ? rBounds.hi : r + g.dr / 2;
    if (rHi < zoomBounds.rMin || rLo > zoomBounds.rMax) continue;
    const yTop = m.y(rHi);
    const cellH = Math.max(1, (rHi - rLo) * m.sy + 0.5);
    for (let j = 1; j < g.nz - 1; j += 1) {
      const zBounds = nodeCellBounds(g.zCoords, j, g.bounds.zMin, g.bounds.zMax);
      const z = gridZ(g, j);
      const zLo = zBounds ? zBounds.lo : z - g.dz / 2;
      const zHi = zBounds ? zBounds.hi : z + g.dz / 2;
      if (zHi < zoomBounds.zMin || zLo > zoomBounds.zMax) continue;
      ctx.fillStyle = fieldDisplayColor(result, g, i, j, scaleMax);
      ctx.fillRect(m.x(zLo), yTop, Math.max(1, (zHi - zLo) * m.sx + 0.5), cellH);
    }
  }
  drawConductorFills(ctx, m, components, boundaryColorForField);
  drawComponentOutlines(ctx, m, components);
  drawMaxFieldMarker(ctx, m, result, 7);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "#17202a";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, width, height);
  ctx.fillStyle = "#17202a";
  ctx.font = "13px Arial";
  ctx.fillText("Max-E zoom", x, y - 8);
  ctx.fillStyle = "#5b6670";
  ctx.font = "11px Arial";
  ctx.fillText(`${(zoomBounds.zMax - zoomBounds.zMin).toFixed(2)} mm window`, x + width - 96, y - 8);
  ctx.restore();
}

function fieldZoomInsetPlacement(canvas) {
  const reservedLeftPx = Math.min(270, Math.max(225, canvas.width * 0.29));
  const width = Math.max(174, reservedLeftPx - 42);
  const height = Math.min(150, Math.max(124, canvas.height * 0.32));
  const legendHeight = Math.min(104, Math.max(86, canvas.height * 0.23));
  const legendY = Math.min(canvas.height - legendHeight - 38, 58 + height + 58);
  return {
    reservedLeftPx,
    x: 18,
    y: 58,
    width,
    height,
    legendX: 104,
    legendY,
    legendWidth: 14,
    legendHeight
  };
}

function dielectricPeaksFromResult(result, p) {
  if (result.dielectricPeaks) return normalizedDielectricPeaks(result.dielectricPeaks);
  const g = result.grid;
  const peaks = {
    washer: emptyDielectricPeak("washer"),
    epoxy: emptyDielectricPeak("epoxy")
  };
  for (let i = 1; i < g.nr - 1; i += 1) {
    const r = gridR(g, i);
    for (let j = 1; j < g.nz - 1; j += 1) {
      const z = gridZ(g, j);
      const label = g.labels?.[i]?.[j] || classifyPoint(p, r, z).kind;
      if (label !== "dielectric") continue;
      const material = g.materials?.[i]?.[j] || materialRegion(p, r, z);
      const peak = peaks[material];
      const e = result.field?.[i]?.[j] ?? 0;
      if (peak && e > peak.maxField) {
        peak.maxField = e;
        peak.maxLocation = { r, z };
      }
    }
  }
  const supported = supportedFieldMetrics(
    g,
    result.field,
    result.rawMaxField ?? result.maxField ?? 0,
    result.rawMaxLocation ?? result.maxLocation ?? { r: 0, z: 0 },
    peaks
  );
  return normalizedDielectricPeaks(supported.dielectricPeaks);
}

function dielectricMarginSummaries(result, p) {
  const peaks = dielectricPeaksFromResult(result, p);
  return Object.fromEntries(dielectricDefinitions(p).map((definition) => {
    const peak = peaks[definition.key] || emptyDielectricPeak(definition.key);
    const breakdownVPerMm = Number.isFinite(definition.breakdownKvPerMm)
      ? definition.breakdownKvPerMm * 1000
      : Number.NaN;
    return [definition.key, {
      ...definition,
      maxField: peak.maxField,
      maxLocation: peak.maxLocation,
      margin: peak.maxField > 0 && Number.isFinite(breakdownVPerMm)
        ? breakdownVPerMm / peak.maxField
        : Number.NaN
    }];
  }));
}

function drawField(result, canvas = document.getElementById("fieldCanvas"), p = params) {
  const ctx = canvas.getContext("2d");
  const g = result.grid;
  const components = modelComponents(p, result);
  const zoomInset = fieldZoomInsetPlacement(canvas);
  const m = canvasMetrics(canvas, p, {
    reservedLeftPx: zoomInset.reservedLeftPx,
    bounds: {
      length: g.bounds.zMax - g.bounds.zMin,
      zMin: g.bounds.zMin,
      zMax: g.bounds.zMax,
      rMax: g.bounds.rMax
    }
  });
  const scaleMax = fieldScaleMaxForDisplay(result, p);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 1; i < g.nr - 1; i += 1) {
    const rBounds = nodeCellBounds(g.rCoords, i, 0, g.bounds.rMax);
    const r = gridR(g, i);
    const yTop = rBounds ? m.y(rBounds.hi) : m.y(r);
    const cellH = rBounds ? Math.max(1, (rBounds.hi - rBounds.lo) * m.sy + 0.5) : Math.max(1, g.dr * m.sy + 0.5);
    for (let j = 1; j < g.nz - 1; j += 1) {
      const zBounds = nodeCellBounds(g.zCoords, j, g.bounds.zMin, g.bounds.zMax);
      const z = gridZ(g, j);
      const xLeft = zBounds ? m.x(zBounds.lo) : m.x(z);
      const cellW = zBounds ? Math.max(1, (zBounds.hi - zBounds.lo) * m.sx + 0.5) : Math.max(1, g.dz * m.sx + 0.5);
      ctx.fillStyle = fieldDisplayColor(result, g, i, j, scaleMax);
      ctx.fillRect(xLeft, yTop, cellW, cellH);
    }
  }
  drawConductorFills(ctx, m, components, boundaryColorForField);
  drawComponentOutlines(ctx, m, components);
  drawMaxFieldMarker(ctx, m, result, 9);
  drawAxes(ctx, canvas, m);
  drawFieldZoomInset(ctx, result, p, components, zoomInset.x, zoomInset.y, zoomInset.width, zoomInset.height);
  drawFieldColorbar(ctx, zoomInset.legendX, zoomInset.legendY, zoomInset.legendWidth, zoomInset.legendHeight, scaleMax, {
    breakdownDefinitions: fieldBreakdownDefinitions(p)
  });
  drawBoundaryPotentialLegend(
    ctx,
    18,
    Math.min(canvas.height - 38, zoomInset.legendY + zoomInset.legendHeight + 30),
    result,
    p
  );
}

function drawPotentialColorbar(ctx, x, y, width, height, minimum, maximum) {
  const gradient = ctx.createLinearGradient(x, y + height, x, y);
  [0, 0.33, 0.66, 1].forEach((stop) => {
    gradient.addColorStop(stop, potentialColor(minimum + stop * (maximum - minimum), minimum, maximum));
  });
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = "#c9c1b0";
  ctx.strokeRect(x, y, width, height);
  ctx.fillStyle = "#37424c";
  ctx.font = "13px Arial";
  ctx.textAlign = "right";
  ctx.fillText("V", x - 8, y - 8);
  ctx.fillText(formatPotentialV(maximum), x - 8, y + 4);
  ctx.fillText(formatPotentialV((minimum + maximum) / 2), x - 8, y + height / 2 + 4);
  ctx.fillText(formatPotentialV(minimum), x - 8, y + height);
  ctx.textAlign = "left";
}

function drawPotential(result, canvas = document.getElementById("potentialCanvas"), p = params) {
  if (!result?.potential) {
    clearPotential();
    return;
  }
  const ctx = canvas.getContext("2d");
  const g = result.grid;
  const potentials = modelBoundaryPotentials(result, p);
  const minimum = Math.min(potentials.bias, potentials.ground);
  const maximum = Math.max(potentials.bias, potentials.ground);
  const components = modelComponents(p, result);
  const reservedLeftPx = 235;
  const m = canvasMetrics(canvas, p, {
    reservedLeftPx,
    bounds: {
      length: g.bounds.zMax - g.bounds.zMin,
      zMin: g.bounds.zMin,
      zMax: g.bounds.zMax,
      rMax: g.bounds.rMax
    }
  });
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < g.nr; i += 1) {
    const rBounds = nodeCellBounds(g.rCoords, i, 0, g.bounds.rMax);
    const r = gridR(g, i);
    const rLo = rBounds?.lo ?? r - g.dr / 2;
    const rHi = rBounds?.hi ?? r + g.dr / 2;
    const yTop = m.y(rHi);
    const cellH = Math.max(1, (rHi - rLo) * m.sy + 0.5);
    for (let j = 0; j < g.nz; j += 1) {
      const rawValue = result.potential?.[i]?.[j];
      if (rawValue === null || rawValue === undefined) continue;
      const value = Number(rawValue);
      if (!Number.isFinite(value)) continue;
      const zBounds = nodeCellBounds(g.zCoords, j, g.bounds.zMin, g.bounds.zMax);
      const z = gridZ(g, j);
      const zLo = zBounds?.lo ?? z - g.dz / 2;
      const zHi = zBounds?.hi ?? z + g.dz / 2;
      ctx.fillStyle = potentialColor(value, minimum, maximum);
      ctx.fillRect(m.x(zLo), yTop, Math.max(1, (zHi - zLo) * m.sx + 0.5), cellH);
    }
  }

  drawConductorFills(ctx, m, components, (component) => potentialColor(
    component.material === "ground" ? potentials.ground : potentials.bias,
    minimum,
    maximum
  ));
  drawComponentOutlines(ctx, m, components);
  drawAxes(ctx, canvas, m);
  drawPotentialColorbar(ctx, 104, 86, 16, 190, minimum, maximum);
  ctx.fillStyle = "#17202a";
  ctx.font = "15px Arial";
  ctx.fillText("Solved potential", 22, 46);
  ctx.fillStyle = "#5b6670";
  ctx.font = "12px Arial";
  ctx.fillText(`${resultSolverLabel(result)} solution`, 22, 64);
  drawBoundaryPotentialLegend(ctx, 18, 326, result, p);
}

function clearPotential() {
  const canvas = document.getElementById("potentialCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#5b6670";
  ctx.font = "16px Arial";
  ctx.fillText("Solve field to update this view", 32, 42);
}

function clearField() {
  clearPotential();
  const canvas = document.getElementById("fieldCanvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#5b6670";
  ctx.font = "16px Arial";
  ctx.fillText("Solve field to update this view", 32, 42);
  document.getElementById("maxField").textContent = translateText("Not solved");
  document.getElementById("rawMaxField").textContent = translateText("raw point not solved");
  document.getElementById("maxLocation").textContent = "--";
  document.getElementById("iterations").textContent = "--";
  updateFeaResourceReadouts("fieldFea", null);
  setModelStatus("JS screening");
  updateEdgeEstimate();
  updateCircuitEstimates();
  updateDielectricMarginReadouts();
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Field backend returned HTTP ${response.status}`);
  }
  return response.json();
}

function backendResultFromPayload(payload) {
  // The future backend can be a real FEA or otherwise stronger solver, but the
  // browser wants the same result shape either way so the field canvas and
  // metric strip do not care where the solve came from.
  const raw = payload.result || payload;
  if (!raw?.grid || !raw?.field) {
    throw new Error("Field backend response did not include a grid and field.");
  }

  const sourceGrid = raw.grid;
  const bounds = sourceGrid.bounds || {
    zMin: sourceGrid.z_min,
    zMax: sourceGrid.z_max,
    rMax: sourceGrid.r_max
  };
  const result = {
    grid: { ...sourceGrid, bounds },
    field: raw.field,
    potential: raw.potential ?? sourceGrid.voltage ?? null,
    model: raw.model ?? null,
    parameters: raw.parameters ?? null,
    maxField: raw.maxField ?? raw.max_field_v_per_mm,
    maxLocation: raw.maxLocation ?? raw.max_location_mm,
    rawMaxField: raw.rawMaxField ?? raw.raw_max_field_v_per_mm ?? raw.maxField ?? raw.max_field_v_per_mm,
    rawMaxLocation: raw.rawMaxLocation ?? raw.raw_max_location_mm ?? raw.maxLocation ?? raw.max_location_mm,
    dielectricPeaks: raw.dielectricPeaks ?? raw.dielectric_peaks,
    rawDielectricPeaks: raw.rawDielectricPeaks ?? raw.raw_dielectric_peaks,
    peakQuality: raw.peakQuality ?? raw.peak_quality,
    iterations: raw.iterations ?? raw.iterations_run,
    lastDelta: raw.lastDelta ?? raw.last_delta_v,
    adaptive: raw.adaptive,
    capacitance: raw.capacitance,
    admittance: raw.admittance,
    solver: raw.solver,
    solverStatus: raw.solverStatus,
    resource_usage: raw.resource_usage,
    resource_log: raw.resource_log,
    source: payload.source || raw.source || "fea-backend"
  };

  if (!Number.isFinite(result.maxField) || !result.maxLocation) {
    throw new Error("Field backend response was missing peak-field metrics.");
  }
  return result;
}

async function pollBackendJob(jobId, startTimeMs) {
  const encodedJob = encodeURIComponent(jobId);
  while (Date.now() - startTimeMs < FIELD_SOLVER_JOB_TIMEOUT_MS) {
    await new Promise((resolve) => window.setTimeout(resolve, FIELD_SOLVER_POLL_MS));
    const payload = await fetchJson(`${FIELD_SOLVER_ENDPOINT}/${encodedJob}`);
    if (payload.status === "failed" || payload.error) {
      throw new Error(payload.error || "Field backend job failed.");
    }
    if (payload.status === "complete" || payload.result || payload.field) {
      return backendResultFromPayload(payload);
    }
  }
  throw new Error("Field backend job timed out.");
}

async function solveFieldWithBackend(p) {
  const backendSolver = backendSolverForRequest();
  if (!backendSolver) {
    throw new Error("Backend solver was not selected.");
  }
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), FIELD_SOLVER_CONNECT_TIMEOUT_MS);
  try {
    const payload = await fetchJson(FIELD_SOLVER_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId(),
        solver: backendSolver,
        parameters: backendParameters(p)
      }),
      signal: controller.signal
    });
    if (payload.job_id && payload.status !== "complete" && !payload.result) {
      return pollBackendJob(payload.job_id, Date.now());
    }
    return backendResultFromPayload(payload);
  } finally {
    window.clearTimeout(timeout);
  }
}

function rawMaxFieldSummary(result) {
  if (!Number.isFinite(result.rawMaxField)) return "raw point unavailable";
  const rawText = `raw point ${formatFieldVPerMm(result.rawMaxField)}`;
  const ratio = result.peakQuality?.rawToSupportedRatio;
  if (Number.isFinite(ratio) && ratio > SUPPORTED_PEAK_OUTLIER_RATIO) {
    return `${rawText}; outlier-suspect ${ratio.toFixed(2)}x`;
  }
  return rawText;
}

function drawSolvedResult(result) {
  drawField(result);
  drawPotential(result);
  const dielectricMargins = dielectricMarginSummaries(result, params);
  document.getElementById("maxField").textContent = `${(result.maxField / 1000).toFixed(3)} kV/mm`;
  document.getElementById("rawMaxField").textContent = rawMaxFieldSummary(result);
  document.getElementById("maxLocation").textContent = `r ${result.maxLocation.r.toFixed(2)} mm, z ${result.maxLocation.z.toFixed(2)} mm`;
  document.getElementById("iterations").textContent = Number.isFinite(result.iterations) ? `${result.iterations}` : "--";
  updateFeaResourceReadouts("fieldFea", result);
  updateDielectricMarginReadouts(dielectricMargins);
  updateCircuitEstimates();
  const jsModelLabel = result.adaptive?.enabled ? "JS adaptive" : "JS fallback";
  const solverEffective = result.solverStatus?.effective;
  const backendModelLabel = solverEffective === "fenicsx"
    ? "Backend FEniCSx"
    : result.adaptive?.enabled
      ? "Backend adaptive FD"
      : "Backend solver";
  setModelStatus(result.source?.startsWith("js") ? jsModelLabel : backendModelLabel);
  drawSlideGraphics();
}

function reportSolveFailure(error) {
  clearField();
  document.getElementById("maxField").textContent = "Solve failed";
  document.getElementById("maxLocation").textContent = error.message.slice(0, 96);
}

function solveAndDraw() {
  const solveButton = document.getElementById("solve");
  solveButton.disabled = true;
  solveButton.textContent = translateText("Solving...");
  const solver = selectedFieldSolver();
  setModelStatus(solver.modelLabel);
  window.setTimeout(async () => {
    try {
      if (!solver.backendSolver) {
        lastResult = solveField(params);
        lastResult.source = "js-local";
      } else {
        lastResult = await solveFieldWithBackend(params);
      }
      captureResultParameters(lastResult, params);
      drawSolvedResult(lastResult);
    } catch (error) {
      if (params.field_solver === "backend_fenicsx") {
        lastResult = null;
        reportSolveFailure(error);
        setModelStatus("FEniCSx unavailable");
      } else {
        lastResult = solveField(params);
        setModelStatus("Backend unavailable; JS fallback");
        lastResult.source = "js-fallback";
        captureResultParameters(lastResult, params);
        drawSolvedResult(lastResult);
      }
    } finally {
      solveButton.disabled = false;
      solveButton.textContent = translateText("Solve field");
    }
  }, 20);
}

function redrawActiveViewerPanel(panelId) {
  if (panelId === "cadPanel") {
    drawCadModel();
  } else if (panelId === "geometryPanel") {
    drawGeometry();
  } else if (panelId === "potentialPanel") {
    if (lastResult) drawPotential(lastResult);
    else clearPotential();
  } else if (panelId === "fieldPanel") {
    if (lastResult) drawField(lastResult);
    else clearField();
  } else if (panelId === "thermalFeaPanel") {
    drawThermalFeaViewer();
  }
}

function setupViewerTabs() {
  document.querySelectorAll(".viewer-tab").forEach((button) => {
    button.addEventListener("click", () => {
      const panelId = button.dataset.viewerPanel;
      document.querySelectorAll(".viewer-tab").forEach((tab) => {
        tab.classList.toggle("active", tab === button);
        tab.setAttribute("aria-selected", tab === button ? "true" : "false");
      });
      document.querySelectorAll(".viewer-panel").forEach((panel) => {
        const active = panel.id === panelId;
        panel.classList.toggle("active", active);
        panel.hidden = !active;
      });
      redrawActiveViewerPanel(panelId);
    });
  });
}

function setupTabs() {
  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("active"));
      document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
      button.classList.add("active");
      document.getElementById(button.dataset.view).classList.add("active");
      if (button.dataset.view === "artifacts") refreshArtifactDownloads();
      const activeViewer = document.querySelector(".viewer-panel.active");
      if (activeViewer) redrawActiveViewerPanel(activeViewer.id);
      drawSlideGraphics();
    });
  });
}

let currentSlideIndex = 0;

const SLIDE_SECTION_DEFINITIONS = [
  {
    id: "main",
    label: "Main presentation",
    titles: [
      "Discoidal Capacitor Bias Filter",
      "From Full-Geometry FEA to SPICE",
      "SPICE Simulation of the Complete Filter",
      "Bias Noise After the Energy Filter",
      "Reference Design",
      "Way Forward"
    ]
  },
  {
    id: "capacitance-fea",
    label: "Models & FEA results",
    titles: [
      "What Is Modeled",
      "Electrical Model for SPICE Simulation",
      "Bias-to-Ground Capacitance from FEA",
      "Bias-to-Bias Parasitic Capacitance from FEA",
      "Electroquasistatic FEA Checks the Distributed RC Model",
      "Full-Field Noise Transmission to First Resonance",
      "Peak Electric Field from FEA",
      "From Damped Resonances to Field-Derived Transfer"
    ]
  },
  {
    id: "validation",
    label: "Validation & limiting cases",
    titles: [
      "Verify the FEA Against Analytical and Limiting Cases",
      "One Section Matches; Stage Multiplication Does Not",
      "Full, Mirror, and Repeated Models Agree",
      "Cpar Converges Toward the Axial Approximation",
      "Cg Matrix: Two vs Three Bias Plates",
      "Cg Matrix Treatments Agree",
      "Cg Converges Toward Two Flat Washers",
      "The Limiting-Case Harness Needed Correction",
      "Total Capacitance Checks the FEA Scale",
      "Solvable Geometries Bound the Edge Field",
      "Radius and Gap Set a Conservative Field Bound",
      "Field-Limited Packing Has a Simple Shape Optimum"
    ]
  },
  {
    id: "engineering",
    label: "Engineering decisions",
    titles: [
      "Possible Thermal Limits of Heat-Cured Epoxy",
      "Compare Core and Potting Approaches",
      "Available MELF Resistance Falls Short at 50/60 Hz",
      "Ferrite Has the Larger Potential Payoff",
      "Discrete HV Capacitors Stay a Backup",
      "Partial Discharge Is a System Property",
      "Thin Epoxy Reduces Volume, Not Necessarily Local Stress",
      "Soft Metal Helps Only the Bulk-Epoxy Layout",
      "CTE-Matched Metal Trades Tension for Lower Shear",
      "Epoxy Choice",
      "Measure the Ferrite Before Trusting the Model"
    ]
  }
];

function slideTitle(slide) {
  return slide.querySelector("h2")?.textContent.replace(/\s+/g, " ").trim() || "Untitled slide";
}

function slideSourceTitle(slide) {
  return slide.querySelector("h2")?.dataset.i18nSource || slideTitle(slide);
}

function refreshSlideTocLanguage() {
  document.querySelectorAll(".slide-toc [data-i18n-source]").forEach((element) => {
    element.textContent = translateText(element.dataset.i18nSource);
  });
}

function slideIdForTitle(title) {
  return `slide-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function organizeSlideDeck() {
  const deck = document.getElementById("slides");
  const tocList = document.getElementById("slideTocList");
  const controls = document.querySelector(".slide-deck-controls");
  if (!deck || !tocList || !controls || deck.dataset.organized === "true") return;

  const originalSlides = Array.from(deck.children).filter((element) => element.classList.contains("slide"));
  const byTitle = new Map(originalSlides.map((slide) => [slideSourceTitle(slide), slide]));
  const orderedSlides = [];
  const assigned = new Set();
  SLIDE_SECTION_DEFINITIONS.forEach((section) => {
    section.titles.forEach((title) => {
      const slide = byTitle.get(title);
      if (!slide) return;
      slide.dataset.slideSection = section.id;
      orderedSlides.push(slide);
      assigned.add(slide);
    });
  });
  originalSlides.forEach((slide) => {
    if (assigned.has(slide)) return;
    slide.dataset.slideSection = "engineering";
    orderedSlides.push(slide);
  });
  orderedSlides.forEach((slide) => deck.insertBefore(slide, controls));

  tocList.replaceChildren();
  SLIDE_SECTION_DEFINITIONS.forEach((section) => {
    const sectionSlides = orderedSlides.filter((slide) => slide.dataset.slideSection === section.id);
    if (!sectionSlides.length) return;
    const group = document.createElement("section");
    group.className = "slide-toc-section";
    const heading = document.createElement("a");
    heading.className = "slide-toc-section-link";
    heading.dataset.i18nSource = section.label;
    heading.textContent = translateText(section.label);
    group.appendChild(heading);
    const list = document.createElement("ol");
    sectionSlides.forEach((slide) => {
      const index = orderedSlides.indexOf(slide);
      const sourceTitle = slideSourceTitle(slide);
      slide.id = slide.id || slideIdForTitle(sourceTitle);
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = `#${slide.id}`;
      link.dataset.slideIndex = String(index);
      link.dataset.slideNumber = String(index + 1);
      link.dataset.i18nSource = sourceTitle;
      link.textContent = translateText(sourceTitle);
      link.addEventListener("click", (event) => {
        event.preventDefault();
        showSlide(index);
        if (window.matchMedia("(max-width: 760px)").matches) {
          deck.classList.add("toc-collapsed");
          document.getElementById("slideTocToggle")?.setAttribute("aria-expanded", "false");
        }
      });
      item.appendChild(link);
      list.appendChild(item);
    });
    heading.href = `#${sectionSlides[0].id}`;
    heading.addEventListener("click", (event) => {
      event.preventDefault();
      showSlide(orderedSlides.indexOf(sectionSlides[0]));
      if (window.matchMedia("(max-width: 760px)").matches) {
        deck.classList.add("toc-collapsed");
        document.getElementById("slideTocToggle")?.setAttribute("aria-expanded", "false");
      }
    });
    group.appendChild(list);
    tocList.appendChild(group);
  });
  deck.dataset.organized = "true";
}

function updateSlideDeckHeight() {
  const topbar = document.querySelector(".topbar");
  const height = topbar ? Math.ceil(topbar.getBoundingClientRect().height) : 82;
  document.documentElement.style.setProperty("--topbar-height", `${height}px`);
}

function getSlideDeckElements() {
  const deck = document.getElementById("slides");
  const slides = deck
    ? Array.from(deck.children).filter((element) => element.classList.contains("slide"))
    : [];
  return {
    deck,
    slides,
    previous: document.getElementById("previousSlide"),
    next: document.getElementById("nextSlide"),
    scrubber: document.getElementById("slideScrubber"),
    counter: document.getElementById("slideCounter"),
  };
}

function showSlide(index) {
  const { deck, slides, previous, next, scrubber, counter } = getSlideDeckElements();
  if (!deck || slides.length === 0) return;

  currentSlideIndex = Math.max(0, Math.min(slides.length - 1, index));
  slides.forEach((slide, slideIndex) => {
    const active = slideIndex === currentSlideIndex;
    const title = slide.querySelector("h2")?.textContent.trim() || `Slide ${slideIndex + 1}`;
    slide.hidden = !active;
    slide.classList.toggle("deck-active", active);
    slide.setAttribute("role", "group");
    slide.setAttribute("aria-roledescription", "slide");
    slide.setAttribute("aria-label", `${slideIndex + 1} of ${slides.length}: ${title}`);
    if (active) slide.scrollTop = 0;
  });

  previous.disabled = currentSlideIndex === 0;
  next.disabled = currentSlideIndex === slides.length - 1;
  scrubber.max = String(slides.length);
  scrubber.value = String(currentSlideIndex + 1);
  const activeTitle = slides[currentSlideIndex].querySelector("h2")?.textContent.trim();
  scrubber.title = activeTitle
    ? `Slide ${currentSlideIndex + 1}: ${activeTitle}`
    : `Slide ${currentSlideIndex + 1}`;
  counter.value = `${currentSlideIndex + 1} / ${slides.length}`;
  counter.textContent = counter.value;
  const activeSlide = slides[currentSlideIndex];
  document.querySelectorAll("#slideTocList a[data-slide-index]").forEach((link) => {
    const active = Number(link.dataset.slideIndex) === currentSlideIndex;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  if (activeSlide?.id && window.location.hash !== `#${activeSlide.id}`) {
    window.history.replaceState(null, "", `#${activeSlide.id}`);
  }

  if (deck.classList.contains("active")) {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    drawSlideGraphics();
  }
}

function setupSlideDeck() {
  organizeSlideDeck();
  const { deck, slides, previous, next, scrubber } = getSlideDeckElements();
  if (!deck || slides.length === 0 || !previous || !next || !scrubber) return;

  deck.classList.add("deck-ready");
  previous.addEventListener("click", () => showSlide(currentSlideIndex - 1));
  next.addEventListener("click", () => showSlide(currentSlideIndex + 1));
  scrubber.addEventListener("input", () => showSlide(Number(scrubber.value) - 1));
  const tocToggle = document.getElementById("slideTocToggle");
  if (tocToggle && window.matchMedia("(max-width: 760px)").matches) {
    tocToggle.setAttribute("aria-expanded", "false");
    deck.classList.add("toc-collapsed");
  }
  tocToggle?.addEventListener("click", () => {
    const expanded = tocToggle.getAttribute("aria-expanded") !== "false";
    tocToggle.setAttribute("aria-expanded", String(!expanded));
    deck.classList.toggle("toc-collapsed", expanded);
  });

  document.addEventListener("keydown", (event) => {
    if (!deck.classList.contains("active")) return;
    const target = event.target;
    if (
      target instanceof HTMLInputElement
      || target instanceof HTMLSelectElement
      || target instanceof HTMLTextAreaElement
      || target?.isContentEditable
    ) return;

    const destinations = {
      ArrowLeft: currentSlideIndex - 1,
      PageUp: currentSlideIndex - 1,
      ArrowRight: currentSlideIndex + 1,
      PageDown: currentSlideIndex + 1,
      Home: 0,
      End: slides.length - 1,
    };
    if (!(event.key in destinations)) return;
    event.preventDefault();
    showSlide(destinations[event.key]);
  });

  updateSlideDeckHeight();
  window.addEventListener("resize", updateSlideDeckHeight);
  window.addEventListener("hashchange", () => {
    const { slides: currentSlides } = getSlideDeckElements();
    const destination = currentSlides.findIndex((slide) => `#${slide.id}` === window.location.hash);
    if (destination >= 0 && destination !== currentSlideIndex) showSlide(destination);
  });
  const hashIndex = slides.findIndex((slide) => `#${slide.id}` === window.location.hash);
  showSlide(hashIndex >= 0 ? hashIndex : 0);
}

async function initializeApp() {
  await loadLocaleCatalogs();
  await loadInstallationDefaults();
  setupLanguageSelector();
  setupThemeToggle();
  setupTabs();
  normalizeParams();
  loadBundledDefaultFieldResult();
  setupSlideDeck();
  installationDefaults = structuredClone(params);
  installationDefaultControlRanges = structuredClone(customControlRanges);
  loadBundledDefaultFullWaveResult();
  setupParameterTooltips();
  setupControls();
  resumeStoredFullWaveJob();
  setupCadViewer();
  setupViewerTabs();
  syncControls();
  localizationRuntimeReady = true;
  refreshDynamicLanguageLabels();
  updateInstallationDefaultLabels();
  drawCadModel();
  drawGeometry();
  if (lastResult) {
    drawSolvedResult(lastResult);
  } else {
    drawSlideGraphics();
    clearField();
    clearPotential();
  }
  drawThermalFeaViewer();
}

initializeApp();
