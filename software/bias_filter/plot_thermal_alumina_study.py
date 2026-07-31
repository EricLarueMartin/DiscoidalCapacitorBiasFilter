#!/usr/bin/env python3
"""Render the checked-in fitted-alumina thermal comparison."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_RESULTS = ROOT / "simulations" / "thermal" / "alumina-insert-study" / "thermal-alumina-insert-study.json"
DEFAULT_OUTPUT = ROOT / "simulations" / "thermal" / "alumina-insert-study" / "thermal-alumina-insert-comparison.png"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = ["DejaVuSans-Bold.ttf", "Arial Bold.ttf"] if bold else ["DejaVuSans.ttf", "Arial.ttf"]
    for name in candidates:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def label(draw: ImageDraw.ImageDraw, xy: tuple[float, float], value: str, size: int, color: str = "#18212b", *, bold: bool = False, anchor: str | None = None) -> None:
    draw.text(xy, value, fill=color, font=font(size, bold), anchor=anchor)


def render(results_path: Path, output_path: Path) -> None:
    report = json.loads(results_path.read_text(encoding="utf-8"))
    cases = report["cases"]
    image = Image.new("RGB", (1600, 900), "#fffdf8")
    draw = ImageDraw.Draw(image)
    label(draw, (72, 48), "Fitted-alumina thermal comparison", 40, bold=True)
    label(draw, (72, 102), "Axisymmetric FEniCSx, 70 C stress-free to 20 C, perfect bonds", 22, "#596675")

    plot = (100, 190, 1035, 700)
    x0, y0, x1, y1 = plot
    maximum = 45.0
    draw.rectangle(plot, fill="#ffffff", outline="#cbd4dc", width=2)
    for tick in range(0, 46, 5):
        y = y1 - (tick / maximum) * (y1 - y0)
        draw.line((x0, y, x1, y), fill="#e0e6eb", width=1)
        label(draw, (x0 - 16, y), str(tick), 17, "#596675", anchor="rm")
    label(draw, (34, (y0 + y1) / 2), "Stress (MPa)", 20, "#18212b", anchor="mm")

    series = [
        ("epoxy_principal_tensile_p99_mpa", "P99 principal tension", "#b73e3e"),
        ("epoxy_axial_tensile_p99_mpa", "P99 axial tension", "#8a6a18"),
        ("epoxy_rz_shear_p99_abs_mpa", "P99 |r-z shear|", "#1f6f78"),
    ]
    centers: list[float] = []
    for index, case in enumerate(cases):
        x = x0 + (index + 0.5) * (x1 - x0) / len(cases)
        centers.append(x)
        case_label = "Bulk\nepoxy" if case["bondline_mm"] is None else f'{case["bondline_mm"]:.2f} mm\nbondline'
        for line_index, line in enumerate(case_label.splitlines()):
            label(draw, (x, y1 + 25 + line_index * 22), line, 17, "#18212b", anchor="ma")
    for key, series_label, color in series:
        points = []
        for x, case in zip(centers, cases):
            value = float(case[key])
            y = y1 - min(maximum, value) / maximum * (y1 - y0)
            points.append((x, y))
        draw.line(points, fill=color, width=5)
        for (x, y), case in zip(points, cases):
            value = float(case[key])
            draw.ellipse((x - 7, y - 7, x + 7, y + 7), fill=color, outline="#ffffff", width=2)
            label(draw, (x, y - 15), f"{value:.1f}", 15, color, bold=True, anchor="ms")

    panel = (1110, 190, 1530, 700)
    draw.rounded_rectangle(panel, radius=8, fill="#f3f6f6", outline="#cbd4dc", width=2)
    label(draw, (1140, 222), "What changes", 24, bold=True)
    label(draw, (1140, 267), "Epoxy cell fraction", 18, "#596675")
    for index, case in enumerate(cases):
        y = 303 + index * 64
        fraction = float(case["epoxy_cell_fraction_of_epoxy_plus_alumina"])
        name = "Bulk" if case["bondline_mm"] is None else f'{case["bondline_mm"]:.2f} mm'
        label(draw, (1140, y), name, 17)
        draw.rectangle((1245, y + 2, 1450, y + 20), fill="#d9e4e2", outline="#aab7bd")
        draw.rectangle((1245, y + 2, 1245 + 205 * fraction, y + 20), fill="#468597")
        label(draw, (1478, y + 1), f"{fraction * 100:.1f}%", 17, "#18212b", anchor="ra")
    label(draw, (1140, 635), "Less epoxy does not mean", 17, "#596675")
    label(draw, (1140, 661), "lower local tensile stress.", 20, "#b73e3e", bold=True)

    legend_y = 785
    for index, (_, series_label, color) in enumerate(series):
        x = 135 + index * 420
        draw.line((x, legend_y, x + 45, legend_y), fill=color, width=6)
        label(draw, (x + 60, legend_y), series_label, 19, anchor="lm")
    label(draw, (80, 850), "Raw corner peaks are intentionally omitted because they remain mesh-sensitive.", 17, "#596675")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(output_path)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--results", type=Path, default=DEFAULT_RESULTS)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    render(args.results.resolve(), args.output.resolve())


if __name__ == "__main__":
    main()
