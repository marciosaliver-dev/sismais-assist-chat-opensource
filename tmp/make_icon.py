from PIL import Image, ImageDraw, ImageFont

SIZE = 1024
NAVY = (16, 41, 63)
CYAN = (69, 229, 229)

img = Image.new("RGB", (SIZE, SIZE), NAVY)
d = ImageDraw.Draw(img)

# Subtle rounded square feel via inner accent: thin cyan frame inset
inset = 56
d.rounded_rectangle(
    [inset, inset, SIZE - inset, SIZE - inset],
    radius=72,
    outline=CYAN,
    width=6,
)

# Load a bold font; fall back gracefully
font_path = "C:/Windows/Fonts/arialbd.ttf"
# Fit "GMS" to roughly 55% of width
text = "GMS"
target_w = int(SIZE * 0.56)
size = 10
font = ImageFont.truetype(font_path, size)
while True:
    bbox = d.textbbox((0, 0), text, font=font)
    w = bbox[2] - bbox[0]
    if w >= target_w or size > 900:
        break
    size += 4
    font = ImageFont.truetype(font_path, size)

bbox = d.textbbox((0, 0), text, font=font)
w = bbox[2] - bbox[0]
h = bbox[3] - bbox[1]
x = (SIZE - w) / 2 - bbox[0]
y = (SIZE - h) / 2 - bbox[1] - 90

d.text((x, y), text, font=font, fill=CYAN)

# Subtitle
sub_font = ImageFont.truetype("C:/Windows/Fonts/seguisb.ttf", 62)
sub = "GESTÃO MAIS SIMPLES"
sbbox = d.textbbox((0, 0), sub, font=sub_font)
sw = sbbox[2] - sbbox[0]
sx = (SIZE - sw) / 2 - sbbox[0]
sy = y + h + 90
d.text((sx, sy), sub, font=sub_font, fill=(255, 255, 255))

out = "tmp/gms_app_icon_1024.png"
img.save(out, "PNG", optimize=True)
print("saved", out)
