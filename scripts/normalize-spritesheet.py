"""Normaliza una tira horizontal con alpha a celdas cuadradas uniformes."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--frames", type=int, default=4)
    parser.add_argument("--cell", type=int, default=256)
    parser.add_argument("--padding", type=int, default=12)
    args = parser.parse_args()

    source = Image.open(args.input).convert("RGBA")
    sheet = Image.new("RGBA", (args.cell * args.frames, args.cell), (0, 0, 0, 0))
    inner = args.cell - args.padding * 2

    for index in range(args.frames):
        left = round(index * source.width / args.frames)
        right = round((index + 1) * source.width / args.frames)
        frame = source.crop((left, 0, right, source.height))
        bbox = frame.getchannel("A").getbbox()
        if bbox is None:
            continue
        subject = frame.crop(bbox)
        scale = min(inner / subject.width, inner / subject.height)
        size = (
            max(1, round(subject.width * scale)),
            max(1, round(subject.height * scale)),
        )
        subject = subject.resize(size, Image.Resampling.LANCZOS)
        x = index * args.cell + (args.cell - subject.width) // 2
        y = args.cell - args.padding - subject.height
        sheet.alpha_composite(subject, (x, y))

    args.output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(args.output, optimize=True)


if __name__ == "__main__":
    main()
