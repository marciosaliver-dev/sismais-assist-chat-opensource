import resvg_py
from PIL import Image, ImageDraw, ImageFont
from io import BytesIO

SIZE = 1024
NAVY = (16, 41, 63)
CYAN = (69, 229, 229)
WHITE = (255, 255, 255)

bg = Image.new("RGB", (SIZE, SIZE), NAVY)

# Render symbol
png_bytes = resvg_py.svg_to_bytes(svg_path="tmp/p7.svg", width=600)
sym = Image.open(BytesIO(bytes(png_bytes))).convert("RGBA")
sym = sym.crop(sym.getbbox())

# Fit symbol to ~42% width, place upper area
target = int(SIZE * 0.42)
ratio = min(target / sym.width, target / sym.height)
sym = sym.resize((int(sym.width * ratio), int(sym.height * ratio)), Image.LANCZOS)
sx = (SIZE - sym.width) // 2
sy = int(SIZE * 0.14)
bg.paste(sym, (sx, sy), sym)

d = ImageDraw.Draw(bg)

# "SisCRM" wordmark
font_path = "C:/Windows/Fonts/seguisb.ttf"  # Segoe UI Semibold
# Fit to ~62% width
text = "SisCRM"
target_w = int(SIZE * 0.64)
size = 20
font = ImageFont.truetype(font_path, size)
while True:
    bbox = d.textbbox((0, 0), text, font=font)
    w = bbox[2] - bbox[0]
    if w >= target_w or size > 600:
        break
    size += 4
    font = ImageFont.truetype(font_path, size)

bbox = d.textbbox((0, 0), text, font=font)
w = bbox[2] - bbox[0]
h = bbox[3] - bbox[1]
tx = (SIZE - w) / 2 - bbox[0]
ty = sy + sym.height + 60
d.text((tx, ty), text, font=font, fill=WHITE)


out = "tmp/siscrm_app_icon_1024.png"
bg.save(out, "PNG", optimize=True)
print("saved", out)
