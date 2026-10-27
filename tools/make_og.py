# 分享縮圖 og.jpg（1200×630）：用遊戲裡的背景、書法標題、月老、鼠軍師大頭、蝙蝠合成
# 執行：../huangquan-village/.venv/bin/python -I tools/make_og.py（在專案資料夾）
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageEnhance
import math

W, H = 1200, 630
F = '/System/Library/Fonts/Supplemental/Songti.ttc'   # index 2 = 宋體繁 粗

bg = Image.open('art/bg-street.webp').convert('RGB')
k = W / bg.width
bg = bg.resize((W, int(bg.height * k)), Image.LANCZOS)
y0 = int(bg.height * 0.04)
im = ImageEnhance.Brightness(bg.crop((0, y0, W, y0 + H))).enhance(0.82).convert('RGBA')

# 左側壓暗讓字清楚
sh = Image.new('RGBA', (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(sh)
for x in range(700):
    d.line([(x, 0), (x, H)], fill=(8, 6, 14, int(160 * (1 - x / 700))))
im.alpha_composite(sh)

# 月老
yl = Image.open('art/yuelao-smile.webp').convert('RGBA')
yh = 640
yl = yl.resize((int(yl.width * yh / yl.height), yh), Image.LANCZOS)
yx, yy = W - yl.width + 40, H - yh + 120
im.alpha_composite(yl, (yx, yy))
hand = (yx + int(yl.width * 0.40), yy + int(yh * 0.585))

# 紅線：從月老手上拉出來，拱住鼠軍師
rat = Image.open('art/head-scared.webp').convert('RGBA')
rh = 250
rat = rat.resize((int(rat.width * rh / rat.height), rh), Image.LANCZOS)
rx, ry = 600, H - rh - 28
cx, cy = rx + int(rat.width * 0.45), ry + int(rh * 0.6)
R = 150
arc = [(cx + R * 1.05 * math.cos(math.pi * (1 + t / 80)), cy + 12 + R * math.sin(math.pi * (1 + t / 80))) for t in range(81)]
s = arc[-1]
tail = [(s[0] + (hand[0] - s[0]) * u, s[1] + (hand[1] - s[1]) * u - math.sin(u * math.pi) * 40) for u in [j / 30 for j in range(31)]]
line = arc + tail
gl = Image.new('RGBA', (W, H), (0, 0, 0, 0))
ImageDraw.Draw(gl).line(line, fill=(255, 40, 70, 170), width=26, joint='curve')
im.alpha_composite(gl.filter(ImageFilter.GaussianBlur(9)))
d = ImageDraw.Draw(im)
d.line(line, fill=(212, 20, 47, 255), width=11, joint='curve')
d.line(line, fill=(255, 185, 190, 200), width=3, joint='curve')
im.alpha_composite(rat, (rx, ry))

# 撲過來的蝙蝠
bat = Image.open('art/bat.webp').convert('RGBA')
for bx, by, bw, rot in [(560, 250, 120, -12), (700, 215, 105, 8), (620, 160, 80, -5), (780, 150, 70, 12), (520, 340, 90, -25), (860, 250, 65, 15)]:
    b = bat.resize((bw, int(bat.height * bw / bat.width)), Image.LANCZOS).rotate(rot, expand=True, resample=Image.BICUBIC)
    im.alpha_composite(b, (bx - b.width // 2, by - b.height // 2))

# 書法標題＋淡淡的光暈
logo = Image.open('art/title-logo.webp').convert('RGBA')
lw = 540
logo = logo.resize((lw, int(logo.height * lw / logo.width)), Image.LANCZOS)
halo = Image.new('RGBA', (W, H), (0, 0, 0, 0))
halo.alpha_composite(logo, (24, 36))
glow = Image.new('RGBA', (W, H), (244, 227, 181, 0))
glow.putalpha(halo.split()[3].filter(ImageFilter.GaussianBlur(14)).point(lambda v: int(v * 0.55)))
im.alpha_composite(glow)
im.alpha_composite(logo, (24, 36))

# 副標
f, f2, f3 = (ImageFont.truetype(F, n, index=2) for n in (36, 28, 22))
d = ImageDraw.Draw(im)
def txt(p, s, font, fill):
    for dx, dy in [(-2, 0), (2, 0), (0, -2), (0, 2), (2, 2)]:
        d.text((p[0] + dx, p[1] + dy), s, font=font, fill=(10, 6, 12, 255))
    d.text(p, s, font=font, fill=fill)
txt((48, 345), '月老畫一條紅線，護住鼠軍師', f, (244, 227, 181, 255))
txt((48, 395), '擋住滿天蝙蝠！', f, (244, 227, 181, 255))
txt((48, 462), '手機免費玩，不用下載', f2, (227, 185, 100, 255))
d.rectangle((48, 528, 186, 580), fill=(196, 30, 58, 255), outline=(244, 227, 181, 255), width=3)
d.text((60, 540), '黃泉燒肉店', font=f3, fill=(244, 227, 181, 255))

im.convert('RGB').save('og.jpg', quality=86)
print('og.jpg', im.size)
