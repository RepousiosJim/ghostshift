#!/usr/bin/env python3
"""Generate GhostShift favicon assets: ghost mask + neon eye."""

from PIL import Image, ImageDraw
import math

# Colors
BG_COLOR = (10, 10, 15)  # Dark stealth #0a0a0f
GHOST_COLOR = (40, 40, 60)  # Dark purple-gray for ghost silhouette
NEON_COLOR = (0, 255, 170)  # #00ffaa - neon cyan-green
NEON_GLOW = (0, 255, 170, 128)  # Semi-transparent for glow effect

def create_ghost_mask(size):
    """Create a ghost mask silhouette with neon eye."""
    img = Image.new('RGBA', (size, size), BG_COLOR + (255,))
    draw = ImageDraw.Draw(img)
    
    # Scale factors - minimum size handling
    s = max(size / 64, 0.5)
    
    # Ensure minimum useful size
    if size < 8:
        return img
    
    # Ghost head - rounded top oval
    center_x, center_y = size // 2, size // 2 - max(1, int(4 * s))
    head_width = max(2, int(24 * s))
    head_height = max(2, int(22 * s))
    
    # Draw ghost body (main silhouette)
    ghost_points = [
        # Left side
        (center_x - max(1, int(20 * s)), center_y + max(1, int(10 * s))),
        (center_x - max(1, int(22 * s)), center_y + max(1, int(20 * s))),
        (center_x - max(1, int(18 * s)), center_y + max(1, int(26 * s))),
        # Bottom wavy edge
        (center_x - max(1, int(14 * s)), center_y + max(1, int(28 * s))),
        (center_x - max(1, int(8 * s)), center_y + max(1, int(24 * s))),
        (center_x, center_y + max(1, int(28 * s))),
        (center_x + max(1, int(8 * s)), center_y + max(1, int(24 * s))),
        (center_x + max(1, int(14 * s)), center_y + max(1, int(28 * s))),
        # Right side
        (center_x + max(1, int(18 * s)), center_y + max(1, int(26 * s))),
        (center_x + max(1, int(22 * s)), center_y + max(1, int(20 * s))),
        (center_x + max(1, int(20 * s)), center_y + max(1, int(10 * s))),
    ]
    
    # Draw ghost body filled
    draw.polygon(ghost_points, fill=GHOST_COLOR + (255,))
    
    # Draw head (circle on top) - ensure valid coordinates
    draw.ellipse(
        [center_x - head_width, center_y - head_height,
         center_x + head_width, center_y + head_height // 2],
        fill=GHOST_COLOR + (255,)
    )
    
    # Eye socket (dark) - ensure valid coordinates
    eye_offset_x = max(1, int(8 * s))
    eye_y = center_y - max(1, int(2 * s))
    eye_radius = max(1, int(6 * s))
    
    draw.ellipse(
        [center_x - eye_offset_x - eye_radius, eye_y - eye_radius,
         center_x - eye_offset_x + eye_radius, eye_y + eye_radius],
        fill=BG_COLOR + (255,)
    )
    
    # Neon eye glow (outer)
    glow_radius = max(2, int(9 * s))
    for i in range(3):
        alpha = 60 - i * 15
        draw.ellipse(
            [center_x - eye_offset_x - glow_radius + i*2, eye_y - glow_radius + i*2,
             center_x - eye_offset_x + glow_radius - i*2, eye_y + glow_radius - i*2],
            fill=NEON_COLOR + (alpha,)
        )
    
    # Neon eye (bright center)
    pupil_radius = max(1, int(4 * s))
    draw.ellipse(
        [center_x - eye_offset_x - pupil_radius, eye_y - pupil_radius,
         center_x - eye_offset_x + pupil_radius, eye_y + pupil_radius],
        fill=NEON_COLOR
    )
    
    # Eye highlight (tiny white dot)
    highlight_radius = max(1, int(1.5 * s))
    draw.ellipse(
        [center_x - eye_offset_x - int(2*s), eye_y - int(2*s),
         center_x - eye_offset_x - max(1, int(0.5*s)), eye_y - max(1, int(0.5*s))],
        fill=(200, 255, 230)
    )
    
    return img

def create_favicon_ico(sizes=[16, 32, 48, 64, 128, 256]):
    """Create multi-size ICO file."""
    images = []
    for size in sizes:
        img = create_ghost_mask(size)
        images.append(img.resize((size, size), Image.LANCZOS))
    
    # Save as ICO
    ico_path = '/root/.openclaw/workspace/ghostshift/public/favicon.ico'
    images[0].save(ico_path, format='ICO', sizes=[(i.width, i.height) for i in images], append_images=images[1:])
    print(f"Created {ico_path}")
    return ico_path

def create_png(size, filename):
    """Create a PNG favicon."""
    img = create_ghost_mask(size)
    path = f'/root/.openclaw/workspace/ghostshift/public/{filename}'
    img.save(path, 'PNG')
    print(f"Created {path}")
    return path

if __name__ == '__main__':
    print("Generating GhostShift favicon assets...")
    
    # Create all sizes
    create_favicon_ico()
    create_png(16, 'favicon-16x16.png')
    create_png(32, 'favicon-32x32.png')
    create_png(180, 'apple-touch-icon.png')
    
    print("\nAll favicon assets created successfully!")
