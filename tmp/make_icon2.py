import resvg_py
from PIL import Image
from io import BytesIO

SIZE = 1024
NAVY = (16, 41, 63)

# Render symbol large
sym_size = 640
png_bytes = resvg_py.svg_to_bytes(svg_path="tmp/p7.svg", width=sym_size)
sym = Image.open(BytesIO(bytes(png_bytes))).convert("RGBA")

# Trim transparent padding
bbox = sym.getbbox()
sym = sym.crop(bbox)

# Fit inside 58% of canvas
target = int(SIZE * 0.58)
ratio = min(target / sym.width, target / sym.height)
new_w = int(sym.width * ratio)
new_h = int(sym.height * ratio)
sym = sym.resize((new_w, new_h), Image.LANCZOS)

# Navy background
bg = Image.new("RGB", (SIZE, SIZE), NAVY)
x = (SIZE - new_w) // 2
y = (SIZE - new_h) // 2
bg.paste(sym, (x, y), sym)

out = "tmp/gms_app_icon_1024.png"
bg.save(out, "PNG", optimize=True)
print("saved", out)
