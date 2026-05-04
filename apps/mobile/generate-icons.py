#!/usr/bin/env python3
"""
Stride icons — white circle badge with teal stride marks on teal bg.
Bold, visible design.
"""

from PIL import Image, ImageDraw
import os

SIZE = 1024
OUT_DIR = os.path.join(os.path.dirname(__file__), 'assets')
TEAL = (59, 184, 155)
DARK_TEAL = (30, 140, 115)
CREAM = (239, 238, 234)
WHITE = (255, 255, 255)


def generate_icon():
    """Teal bg, white circle badge, teal stride marks."""
    img = Image.new('RGB', (SIZE, SIZE), DARK_TEAL)
    draw = ImageDraw.Draw(img)
    cx, cy = SIZE//2, SIZE//2
    
    # White circle badge (fills ~40%)
    r = 360
    draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=WHITE)
    
    # Teal stride marks
    w = 42
    pts1 = [(cx-140, cy), (cx-20, cy-70), (cx+100, cy)]
    draw.line(pts1, fill=TEAL, width=w, joint='curve')
    pts2 = [(cx-140, cy+70), (cx-20, cy), (cx+100, cy+70)]
    draw.line(pts2, fill=TEAL, width=w, joint='curve')
    
    out = os.path.join(OUT_DIR, 'icon.png')
    img.save(out, 'PNG')
    px = list(img.getdata())
    white = sum(1 for p in px if p == WHITE)
    teal = sum(1 for p in px if p == TEAL)
    print(f"icon.png: white={white}px ({white*100//(SIZE*SIZE)}%), teal={teal}px ({teal*100//(SIZE*SIZE)}%)")


def generate_adaptive_icon():
    """Transparent, smaller white badge with teal marks."""
    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx, cy = SIZE//2, SIZE//2
    
    r = 320
    draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=WHITE)
    
    w = 34
    pts1 = [(cx-120, cy), (cx-15, cy-60), (cx+90, cy)]
    draw.line(pts1, fill=TEAL, width=w, joint='curve')
    pts2 = [(cx-120, cy+60), (cx-15, cy), (cx+90, cy+60)]
    draw.line(pts2, fill=TEAL, width=w, joint='curve')
    
    out = os.path.join(OUT_DIR, 'adaptive-icon.png')
    img.save(out, 'PNG')
    px = list(img.getdata())
    fg = sum(1 for p in px if p[3] > 0)
    print(f"adaptive-icon.png: {fg}px ({fg*100//(SIZE*SIZE)}%)")


def generate_splash():
    """Cream bg, white badge with teal marks."""
    img = Image.new('RGB', (SIZE, SIZE), CREAM)
    draw = ImageDraw.Draw(img)
    cx, cy = SIZE//2, SIZE//2
    
    r = 360
    draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=WHITE)
    
    w = 42
    pts1 = [(cx-140, cy), (cx-20, cy-70), (cx+100, cy)]
    draw.line(pts1, fill=TEAL, width=w, joint='curve')
    pts2 = [(cx-140, cy+70), (cx-20, cy), (cx+100, cy+70)]
    draw.line(pts2, fill=TEAL, width=w, joint='curve')
    
    out = os.path.join(OUT_DIR, 'splash-icon.png')
    img.save(out, 'PNG')
    white = sum(1 for p in list(img.getdata()) if p == WHITE)
    print(f"splash-icon.png: white={white}px ({white*100//(SIZE*SIZE)}%)")


def generate_favicon():
    s = 48
    img = Image.new('RGB', (s, s), DARK_TEAL)
    draw = ImageDraw.Draw(img)
    cx, cy = s//2, s//2
    
    draw.ellipse([cx-17, cy-17, cx+17, cy+17], fill=WHITE)
    w = 3
    pts1 = [(cx-8, cy+1), (cx-1, cy-3), (cx+5, cy+1)]
    draw.line(pts1, fill=TEAL, width=w)
    pts2 = [(cx-8, cy+4), (cx-1, cy), (cx+5, cy+4)]
    draw.line(pts2, fill=TEAL, width=w)
    
    out = os.path.join(OUT_DIR, 'favicon.png')
    img.save(out, 'PNG')
    print(f"favicon.png: {os.path.getsize(out)}B")


if __name__ == '__main__':
    generate_icon()
    generate_adaptive_icon()
    generate_splash()
    generate_favicon()
    print("Done!")