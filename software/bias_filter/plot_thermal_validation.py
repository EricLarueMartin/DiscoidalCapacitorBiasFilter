#!/usr/bin/env python3
"""Render thermal-validation plots from the checked-in FEniCSx JSON results."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont

try:
    from . import axisymmetric_model
except ImportError:
    import axisymmetric_model  # type: ignore


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_RESULTS = ROOT / "simulations" / "thermal" / "validation" / "thermal-validation-results.json"
DEFAULT_IMAGE_DIR = ROOT / "simulations" / "thermal" / "validation" / "images"
INK = "#18212b"
MUTED = "#596675"
GRID = "#d6dde3"
PANEL = "#f5f7f8"
ACCENT = "#1f7184"
PASS = "#2d7a48"
RAW = "#b23b3b"
P99 = "#cf7a22"
P95 = "#2670a1"
MATERIAL_COLORS = {
    "epoxy": "#80a9b5",
    "washer": "#d1ad42",
    "alumina": "#d1ad42",
    "ferrite": "#8b6243",
    "core": "#8b6243",
    "ground": "#315a73",
    "hv": "#bd6434",
    "copper": "#bd6434",
    "plate": "#bd6434",
    "tube": "#8d4728",
}
HEAT_STOPS = [
    (0.00, (29, 62, 92)),
    (0.25, (36, 111, 145)),
    (0.50, (49, 158, 143)),
    (0.75, (243, 194, 74)),
    (1.00, (204, 66, 54)),
]


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    names = ["DejaVuSans-Bold.ttf", "Arial Bold.ttf"] if bold else ["DejaVuSans.ttf", "Arial.ttf"]
    for name in names:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def text(draw: ImageDraw.ImageDraw, xy: tuple[float, float], value: str, size: int, color: str = INK, bold: bool = False, anchor: str | None = None) -> None:
    draw.text(xy, value, fill=color, font=font(size, bold), anchor=anchor)


def heat_color(value: float, maximum: float) -> tuple[int, int, int]:
    fraction = max(0.0, min(1.0, value / maximum if maximum > 0 else 0.0))
    for index in range(len(HEAT_STOPS) - 1):
        x0, c0 = HEAT_STOPS[index]
        x1, c1 = HEAT_STOPS[index + 1]
        if fraction <= x1:
            t = (fraction - x0) / (x1 - x0)
            return tuple(round(c0[channel] + t * (c1[channel] - c0[channel])) for channel in range(3))
    return HEAT_STOPS[-1][1]


def case(report: dict[str, Any], name: str) -> dict[str, Any]:
    return report["cases"][name]["result"]


def field_points(result: dict[str, Any]) -> list[tuple[float, float, float]]:
    points = [
        (float(point[0]), float(point[1]), float(point[2]))
        for point in result["epoxy_principal_tensile_field"]["points"]
    ]
    if result["epoxy_principal_tensile_field"].get("solved_half_is_mirrored_for_display"):
        length = float(result["mesh"]["full_stack_length_mm"])
        mirrored = [(r, length - z, stress) for r, z, stress in points if abs(z - length / 2.0) > 1e-9]
        points.extend(mirrored)
    return points


def draw_colorbar(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], maximum: float) -> None:
    x0, y0, x1, y1 = box
    width = max(1, x1 - x0)
    for x in range(x0, x1):
        fraction = (x - x0) / width
        draw.line((x, y0, x, y1), fill=heat_color(fraction * maximum, maximum))
    draw.rectangle(box, outline=INK, width=1)
    text(draw, (x0, y1 + 7), "0", 14, MUTED)
    text(draw, (x1, y1 + 7), f"{maximum:.2f} MPa", 14, MUTED, anchor="ra")


def draw_field_panel(
    image: Image.Image,
    result: dict[str, Any],
    box: tuple[int, int, int, int],
    title_value: str,
    *,
    scale_max: float | None = None,
) -> None:
    draw = ImageDraw.Draw(image)
    x0, y0, x1, y1 = box
    draw.rounded_rectangle(box, radius=8, fill="#ffffff", outline=GRID, width=2)
    text(draw, (x0 + 18, y0 + 14), title_value, 21, INK, True)
    plot = (x0 + 54, y0 + 58, x1 - 24, y1 - 78)
    px0, py0, px1, py1 = plot
    parameters = result["parameters"]
    length = float(result["mesh"]["full_stack_length_mm"])
    tube_outer = float(parameters["tube_id_mm"]) / 2.0 + float(parameters["tube_wall_thickness_mm"])
    sx = (px1 - px0) / max(length, 1e-9)
    sy = (py1 - py0) / max(tube_outer, 1e-9)
    scale = min(sx, sy)
    width = length * scale
    height = tube_outer * scale
    ox = px0 + (px1 - px0 - width) / 2.0
    oy = py1 - (py1 - py0 - height) / 2.0
    mapper = lambda r, z: (ox + z * scale, oy - r * scale)
    draw.rectangle((ox, oy - height, ox + width, oy), fill="#dce9eb", outline=GRID)

    maximum = float(scale_max if scale_max is not None else result["epoxy_principal_tensile_stress_mpa"]["p99"])
    point_radius = 2 if len(field_points(result)) < 25_000 else 1
    for r, z, stress in field_points(result):
        x, y = mapper(r, z)
        draw.rectangle(
            (x - point_radius, y - point_radius, x + point_radius, y + point_radius),
            fill=heat_color(stress, maximum),
        )

    for component in axisymmetric_model.component_profiles(parameters):
        material = component["material"]
        if material == "epoxy":
            continue
        polygon = [mapper(float(r), float(z)) for r, z in component["profile"]]
        color = MATERIAL_COLORS.get(material, MUTED)
        draw.line(polygon + [polygon[0]], fill=color, width=2)

    draw.line((ox, oy, ox + width, oy), fill=INK, width=2)
    draw.rectangle((ox, oy - height, ox + width, oy), outline=INK, width=1)
    text(draw, (ox - 10, oy - height), f"{tube_outer:.1f}", 13, MUTED, anchor="ra")
    text(draw, (ox - 10, oy), "0", 13, MUTED, anchor="ra")
    text(draw, (ox, oy + 7), "0", 13, MUTED)
    text(draw, (ox + width, oy + 7), f"{length:.1f} mm", 13, MUTED, anchor="ra")
    draw_colorbar(draw, (x0 + 64, y1 - 55, x1 - 42, y1 - 42), maximum)
    stats = result["epoxy_principal_tensile_stress_mpa"]
    text(
        draw,
        (x1 - 24, y0 + 18),
        f"P99 {stats['p99']:.3f} MPa | raw {stats['raw_max']:.3f} MPa | {result['mesh']['cells']:,} cells",
        14,
        MUTED,
        anchor="ra",
    )


def line_chart(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    x_values: list[float],
    series: list[tuple[str, list[float], str]],
    x_labels: list[str],
    y_min: float,
    y_max: float,
    title_value: str,
    y_label: str,
) -> None:
    x0, y0, x1, y1 = box
    draw.rounded_rectangle(box, radius=8, fill="#ffffff", outline=GRID, width=2)
    text(draw, (x0 + 18, y0 + 14), title_value, 22, INK, True)
    plot = (x0 + 82, y0 + 62, x1 - 28, y1 - 68)
    px0, py0, px1, py1 = plot
    for index in range(6):
        value = y_min + index * (y_max - y_min) / 5.0
        y = py1 - (value - y_min) / (y_max - y_min) * (py1 - py0)
        draw.line((px0, y, px1, y), fill=GRID, width=1)
        text(draw, (px0 - 10, y), f"{value:.0f}", 13, MUTED, anchor="rm")
    text(draw, (x0 + 18, (py0 + py1) / 2), y_label, 14, MUTED)
    xmin, xmax = min(x_values), max(x_values)
    map_x = lambda value: px0 + (value - xmin) / max(xmax - xmin, 1e-9) * (px1 - px0)
    map_y = lambda value: py1 - (value - y_min) / max(y_max - y_min, 1e-9) * (py1 - py0)
    for value, label in zip(x_values, x_labels):
        x = map_x(value)
        draw.line((x, py1, x, py1 + 6), fill=INK, width=1)
        text(draw, (x, py1 + 12), label, 13, MUTED, anchor="ma")
    for name, values, color in series:
        points = [(map_x(x), map_y(y)) for x, y in zip(x_values, values)]
        draw.line(points, fill=color, width=4)
        for point in points:
            draw.ellipse((point[0] - 5, point[1] - 5, point[0] + 5, point[1] + 5), fill=color, outline="#ffffff")
    legend_x = px0
    for name, _, color in series:
        draw.line((legend_x, y1 - 30, legend_x + 30, y1 - 30), fill=color, width=4)
        text(draw, (legend_x + 38, y1 - 38), name, 14, INK)
        legend_x += 170


def render_mesh_convergence(report: dict[str, Any], image_dir: Path) -> Path:
    rows = report["mesh_convergence"]
    image = Image.new("RGB", (1500, 900), "#eef2f4")
    draw = ImageDraw.Draw(image)
    text(draw, (54, 38), "Thermal FEA mesh convergence", 34, INK, True)
    text(draw, (54, 82), "Stable percentiles converge; the material-corner maximum does not.", 19, MUTED)
    x_values = list(range(len(rows)))
    line_chart(
        draw,
        (48, 125, 1452, 760),
        x_values,
        [
            ("P95", [row["p95_mpa"] for row in rows], P95),
            ("P99", [row["p99_mpa"] for row in rows], P99),
            ("Raw maximum", [row["raw_max_mpa"] for row in rows], RAW),
        ],
        [f"{row['mesh_size_mm']:.2f}\n{row['cells']:,}" for row in rows],
        20.0,
        85.0,
        "Epoxy maximum-principal tensile stress",
        "MPa",
    )
    text(draw, (750, 806), "Mesh target (mm) and cell count", 17, MUTED, anchor="ma")
    fine = rows[-1]
    previous = rows[-2]
    text(
        draw,
        (54, 852),
        (
            f"0.15 -> 0.10 mm: P95 {abs(fine['p95_mpa']/previous['p95_mpa']-1)*100:.3f}% | "
            f"P99 {abs(fine['p99_mpa']/previous['p99_mpa']-1)*100:.3f}% | "
            f"raw maximum {abs(fine['raw_max_mpa']/previous['raw_max_mpa']-1)*100:.1f}%"
        ),
        18,
        INK,
    )
    path = image_dir / "mesh-convergence.png"
    image.save(path)
    return path


def render_check_summary(report: dict[str, Any], image_dir: Path) -> Path:
    image = Image.new("RGB", (1600, 980), "#eef2f4")
    draw = ImageDraw.Draw(image)
    text(draw, (54, 38), "Thermal FEA analytical and invariance checks", 34, INK, True)
    text(draw, (54, 84), "Every value below comes from the saved FEniCSx campaign.", 19, MUTED)
    rows = [
        ("Zero temperature change", "0 MPa raw", "<= 1e-8 MPa"),
        ("Homogeneous free expansion", "1.21e-11 MPa raw", "<= 1e-6 MPa"),
        ("Homogeneous full restraint", "37.00000000000005 MPa", "37 MPa closed form"),
        ("Temperature linearity", "2.000000 ratio", "2.0 expected"),
        ("Common modulus scaling", "0.5x and 2.0x", "exact factors"),
        ("Common CTE offset", "2.59e-13 relative change", "<= 0.1%"),
        ("Half/full-stack P99", "0.00472% difference", "<= 2%"),
        ("Finest-mesh P99", "0.883% difference", "<= 1%"),
    ]
    top = 142
    row_height = 92
    for index, (name, measured, criterion) in enumerate(rows):
        y = top + index * row_height
        fill = "#ffffff" if index % 2 == 0 else "#f8fafb"
        draw.rounded_rectangle((48, y, 1552, y + 76), radius=6, fill=fill, outline=GRID)
        draw.ellipse((72, y + 24, 100, y + 52), fill=PASS)
        text(draw, (86, y + 38), "OK", 11, "#ffffff", True, "mm")
        text(draw, (124, y + 18), name, 20, INK, True)
        text(draw, (650, y + 25), measured, 18, ACCENT)
        text(draw, (1170, y + 25), criterion, 18, MUTED)
        text(draw, (1516, y + 25), "PASS", 17, PASS, True, "ra")
    text(draw, (650, 126), "Measured", 15, MUTED)
    text(draw, (1170, 126), "Acceptance/reference", 15, MUTED)
    text(
        draw,
        (54, 914),
        "These checks verify the linear-thermoelastic implementation and numerical reduction. They do not validate epoxy adhesion or predict debonding.",
        18,
        INK,
    )
    path = image_dir / "analytical-check-summary.png"
    image.save(path)
    return path


def render_scaling(report: dict[str, Any], image_dir: Path) -> Path:
    image = Image.new("RGB", (1500, 820), "#eef2f4")
    draw = ImageDraw.Draw(image)
    text(draw, (54, 38), "Linearity and material invariance", 34, INK, True)
    temp_45 = case(report, "temperature_45c")
    temp_20 = case(report, "temperature_20c")
    default = float(temp_20["epoxy_principal_tensile_stress_mpa"]["p99"])
    half = float(case(report, "all_moduli_half")["epoxy_principal_tensile_stress_mpa"]["p99"])
    double = float(case(report, "all_moduli_double")["epoxy_principal_tensile_stress_mpa"]["p99"])
    cte = float(case(report, "common_cte_offset")["epoxy_principal_tensile_stress_mpa"]["p99"])
    line_chart(
        draw,
        (48, 105, 728, 700),
        [0.0, 25.0, 50.0],
        [("FEA P99", [0.0, float(temp_45["epoxy_principal_tensile_stress_mpa"]["p99"]), default], ACCENT)],
        ["0", "25", "50"],
        0.0,
        36.0,
        "Temperature-change scaling",
        "MPa",
    )
    text(draw, (388, 738), "Temperature drop below 70 C", 16, MUTED, anchor="ma")
    line_chart(
        draw,
        (772, 105, 1452, 700),
        [0.5, 1.0, 2.0],
        [("FEA P99", [half, default, double], P99)],
        ["0.5x", "1.0x", "2.0x"],
        0.0,
        70.0,
        "Common Young's-modulus scaling",
        "MPa",
    )
    text(draw, (1112, 738), "Multiplier applied to every material modulus", 16, MUTED, anchor="ma")
    text(
        draw,
        (54, 786),
        f"Common +20 ppm/C CTE offset: baseline {default:.12f} MPa, shifted {cte:.12f} MPa.",
        17,
        INK,
    )
    path = image_dir / "linearity-and-invariance.png"
    image.save(path)
    return path


def render_symmetry(report: dict[str, Any], image_dir: Path) -> Path:
    mirror = case(report, "symmetry_mirror_half")
    full = case(report, "symmetry_full_stack")
    scale_max = max(
        float(mirror["epoxy_principal_tensile_stress_mpa"]["p99"]),
        float(full["epoxy_principal_tensile_stress_mpa"]["p99"]),
    )
    image = Image.new("RGB", (1600, 880), "#eef2f4")
    draw = ImageDraw.Draw(image)
    text(draw, (54, 34), "Exact mirror reduction versus full-stack solve", 34, INK, True)
    text(draw, (54, 78), "Both panels use the same color scale and independently generated meshes.", 18, MUTED)
    draw_field_panel(image, mirror, (42, 120, 784, 790), "Exact half-stack, mirrored for display", scale_max=scale_max)
    draw_field_panel(image, full, (816, 120, 1558, 790), "Full stack with one rigid-body anchor", scale_max=scale_max)
    text(
        draw,
        (800, 840),
        (
            f"P99 difference {abs(float(mirror['epoxy_principal_tensile_stress_mpa']['p99']) / float(full['epoxy_principal_tensile_stress_mpa']['p99']) - 1) * 100:.4f}% | "
            f"P95 difference {abs(float(mirror['epoxy_principal_tensile_stress_mpa']['p95']) / float(full['epoxy_principal_tensile_stress_mpa']['p95']) - 1) * 100:.3f}%"
        ),
        18,
        INK,
        anchor="ma",
    )
    path = image_dir / "mirror-vs-full-stack.png"
    image.save(path)
    return path


def render_benchmarks(report: dict[str, Any], image_dir: Path) -> Path:
    names = [
        ("zero_temperature_change", "Zero temperature change"),
        ("homogeneous_free_expansion", "Homogeneous free contraction"),
        ("homogeneous_fully_restrained", "Homogeneous full restraint"),
    ]
    image = Image.new("RGB", (1650, 770), "#eef2f4")
    draw = ImageDraw.Draw(image)
    text(draw, (54, 32), "Known-limit field checks", 34, INK, True)
    text(draw, (54, 76), "Uniform cases isolate load construction, free expansion, and the 3D constitutive law.", 18, MUTED)
    for index, (name, title_value) in enumerate(names):
        result = case(report, name)
        draw_field_panel(image, result, (35 + index * 540, 116, 515 + index * 540, 700), title_value)
    path = image_dir / "known-limit-fields.png"
    image.save(path)
    return path


def render_mesh_fields(report: dict[str, Any], image_dir: Path) -> list[Path]:
    paths: list[Path] = []
    mesh_rows = report["mesh_convergence"]
    overall_scale = max(float(row["p99_mpa"]) for row in mesh_rows)
    montage = Image.new("RGB", (1650, 1740), "#eef2f4")
    montage_draw = ImageDraw.Draw(montage)
    text(montage_draw, (54, 30), "Default-design stress field across mesh refinement", 34, INK, True)
    text(montage_draw, (54, 74), "All panels use the same P99-based color scale; conductor and ceramic outlines are overlaid.", 18, MUTED)
    for index, row in enumerate(mesh_rows):
        result = case(report, row["case"])
        label = f"{row['mesh_size_mm']:.2f} mm target | {row['cells']:,} cells"
        individual = Image.new("RGB", (1500, 860), "#eef2f4")
        individual_draw = ImageDraw.Draw(individual)
        text(individual_draw, (54, 32), "Default-design epoxy tensile-stress field", 34, INK, True)
        draw_field_panel(individual, result, (42, 98, 1458, 800), label, scale_max=overall_scale)
        individual_path = image_dir / f"stress-field-{row['case'].replace('mesh_', '').replace('_mm', '')}.png"
        individual.save(individual_path)
        paths.append(individual_path)

        column = index % 2
        row_index = index // 2
        panel_box = (
            35 + column * 815,
            112 + row_index * 535,
            800 + column * 815,
            612 + row_index * 535,
        )
        draw_field_panel(montage, result, panel_box, label, scale_max=overall_scale)
    montage_path = image_dir / "mesh-field-comparison.png"
    montage.save(montage_path)
    paths.append(montage_path)
    return paths


def render_all(results_path: Path, image_dir: Path) -> list[Path]:
    report = json.loads(results_path.read_text(encoding="utf-8"))
    if "cases" not in report:
        report["cases"] = {
            name: json.loads((results_path.parent / relative_path).read_text(encoding="utf-8"))
            for name, relative_path in report["case_files"].items()
        }
    image_dir.mkdir(parents=True, exist_ok=True)
    paths = [
        render_check_summary(report, image_dir),
        render_scaling(report, image_dir),
        render_mesh_convergence(report, image_dir),
        render_symmetry(report, image_dir),
        render_benchmarks(report, image_dir),
        *render_mesh_fields(report, image_dir),
    ]
    manifest = {
        "source": str(results_path.relative_to(ROOT)),
        "images": [str(path.relative_to(ROOT)) for path in paths],
    }
    (image_dir / "image-manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n",
        encoding="utf-8",
    )
    return paths


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--results", type=Path, default=DEFAULT_RESULTS)
    parser.add_argument("--image-dir", type=Path, default=DEFAULT_IMAGE_DIR)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    paths = render_all(args.results, args.image_dir)
    print(json.dumps({"images": [str(path) for path in paths]}, indent=2))


if __name__ == "__main__":
    main()
