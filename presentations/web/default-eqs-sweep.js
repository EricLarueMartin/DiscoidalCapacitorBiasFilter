window.DISCOIDAL_DEFAULT_EQS_SWEEP = {
  format: "discoidal-capacitor-bias-filter-eqs-sweep",
  solver: "axisymmetric-electroquasistatic-multiport-fenicsx",
  meshMm: 0.30,
  cells: 20562,
  excitation: "input 1 V; interior ports floating; loaded output measured",
  intrinsicExcitation: "first bias plate 1 V; interior ports floating; final bias plate open-circuit; no external network",
  scope: "distributed electric field and resistive core; no magnetic induction, radiation, skin effect, or 3D MELF helix",
  samples: [
    { frequencyHz: 1, magnitudeDb: -0.027808, phaseDeg: -4.573368, intrinsicFieldDb: -0.000126, intrinsicSpiceDb: -0.000039 },
    { frequencyHz: 10, magnitudeDb: -2.148439, phaseDeg: -38.654809, intrinsicFieldDb: -0.004077, intrinsicSpiceDb: -0.003940 },
    { frequencyHz: 50, magnitudeDb: -12.304345, phaseDeg: -75.942603, intrinsicFieldDb: -0.098775, intrinsicSpiceDb: null },
    { frequencyHz: 100, magnitudeDb: -18.128979, phaseDeg: -82.833284, intrinsicFieldDb: -0.382060, intrinsicSpiceDb: -0.377274 },
    { frequencyHz: 1000, magnitudeDb: -38.062554, phaseDeg: -88.868892, intrinsicFieldDb: -10.083564, intrinsicSpiceDb: -10.032322 },
    { frequencyHz: 10000, magnitudeDb: -58.082536, phaseDeg: -85.703040, intrinsicFieldDb: -29.657525, intrinsicSpiceDb: -29.543311 },
    { frequencyHz: 100000, magnitudeDb: -75.805586, phaseDeg: -44.242654, intrinsicFieldDb: -47.339443, intrinsicSpiceDb: -46.721077 },
    { frequencyHz: 1000000, magnitudeDb: -78.268015, phaseDeg: -5.195596, intrinsicFieldDb: -49.796236, intrinsicSpiceDb: -49.843039 },
    { frequencyHz: 10000000, magnitudeDb: -78.298678, phaseDeg: -0.520544, intrinsicFieldDb: -49.826834, intrinsicSpiceDb: -49.888973 },
    { frequencyHz: 100000000, magnitudeDb: -78.298985, phaseDeg: -0.052055, intrinsicFieldDb: -49.827141, intrinsicSpiceDb: -49.889435 }
  ],
  validation: {
    maxReciprocityErrorS: 0,
    minRealAdmittanceEigenvalueS: 8.2777e-13,
    mesh1kHzDb: { "0.60": -38.062692, "0.45": -38.062610, "0.30": -38.062554 },
    capacitanceComparison: {
      eqsDiagonalPf: 39.9981,
      electrostaticDiagonalPf: 39.9556,
      diagonalDifferencePercent: 0.107,
      eqsMutualPf: 0.12903,
      electrostaticMutualPf: 0.12797,
      mutualDifferencePercent: 0.827
    },
    maxLumpedComparisonDifferenceDb: 0.618
  }
};
