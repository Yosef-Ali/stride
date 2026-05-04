#!/usr/bin/env python3
"""
Generate Stride icons - even wider lines, bigger head. Target ~18% fill.
"""

from PIL import Image, ImageDraw
import os

SIZE = 1024
OUT_DIR = os.path.join(os.path.dirname(__file__), 'assets')

TEAL = (59, 184, 155)
CREAM = (239, 238, 234)
WHITE = (255, 255, 255)


def gen_bg_filled(draw, cx, cy, color, w=1.0):
    """Bold walking figure on colored bg (simple, fast)."""
    f = lambda x: int(x * w)
    
    # Head
    draw.ellipse([cx-120, cy-390, cx+120, cy-150], fill=color)
    
    # Body 
    draw.line([(cx, cy-170), (cx+70, cy-20)], fill=color, width=120)
    
    # Back leg
    draw.line([(cx+30, cy-30), (cx-240, cy+130)], fill=color, width=100)
    draw.ellipse([cx-280, cy+90, cx-150, cy+200], fill=color)
    
    # Front leg
    draw.line([(cx+50, cy-30), (cx+260, cy+120)], fill=color, width=100)
    draw.ellipse([cx+180, cy+80, cx+310, cy+190], fill=color)
    
    # Arm
    draw.line([(cx+15, cy-160), (cx+180, cy-50)], fill=color, width=85)
    draw.ellipse([cx+140, cy-90, cx+230, cy+10], fill=color)


def generate_icon():
    img = Image.new('RGB', (SIZE, SIZE), TEAL)
    draw = ImageDraw.Draw(img)
    gen_bg_filled(draw, SIZE//2+10, SIZE//2+80, WHITE, 1.0)
    out = os.path.join(OUT_DIR, 'icon.png')
    img.save(out, 'PNG')
    px = list(img.getdata())
    fg = sum(1 for p in px if p == WHITE)
    print(f"icon.png: {os.path.getsize(out)} bytes, {fg} fg px ({fg*100//(SIZE*SIZE)}%)")


def generate_adaptive_icon():
    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    gen_bg_filled(draw, SIZE//2+10, SIZE//2+80, WHITE)
    out = os.path.join(OUT_DIR, 'adaptive-icon.png')
    img.save(out, 'PNG')
    px = list(img.getdata())
    fg = sum(1 for p in px if p[3] > 0)
    print(f"adaptive-icon.png: {os.path.getsize(out)} bytes, {fg} fg px ({fg*100//(SIZE*SIZE)}%)")


def generate_splash():
    img = Image.new('RGB', (SIZE, SIZE), CREAM)
    draw = ImageDraw.Draw(img)
    gen_bg_filled(draw, SIZE//2+10, SIZE//2+80, TEAL)
    out = os.path.join(OUT_DIR, 'splash-icon.png')
    img.save(out, 'PNG')
    px = list(img.getdata())
    fg = sum(1 for p in px if p == TEAL)
    print(f"splash-icon.png: {os.path.getsize(out)} bytes, {fg} fg px ({fg*100//(SIZE*SIZE)}%)")


def generate_favicon():
    s = 48
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx, cy = s//2+1, s//2+3
    
    draw.ellipse([cx-7, cy-19, cx+7, cy-5], fill=TEAL)
    draw.line([(cx, cy-6), (cx+3, cy+1)], fill=TEAL, width=7)
    draw.line([(cx+1, cy), (cx-12, cy+7)], fill=TEAL, width=6)
    draw.ellipse([cx-14, cy+5, cx-9, cy+10], fill=TEAL)
    draw.line([(cx+3, cy), (cx+13, cy+7)], fill=TEAL, width=6)
    draw.ellipse([cx+11, cy+4, cx+16, cy+9], fill=TEAL)
    draw.line([(cx, cy-5), (cx+9, cy+1)], fill=TEAL, width=5)
    
    out = os.path.join(OUT_DIR, 'favicon.png')
    img.save(out, 'PNG')
    px = list(img.getdata())
    fg = sum(1 for p in px if p[3] > 0)
    print(f"favicon.png: {os.path.getsize(out)} bytes, {fg} fg px ({fg*100//(s*s)}%)")


if __name__ == '__main__':
    generate_icon()
    generate_adaptive_icon()
    generate_splash()
    generate_favicon()
    print("Done!")