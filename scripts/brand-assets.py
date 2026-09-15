"""Reproduce the existing DocToWeb document/code mark and social card."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1]
assets = root / 'assets'
assets.mkdir(exist_ok=True)
navy, blue = '#172c56', '#305edb'
icon = Image.new('RGBA', (256, 256))
d = ImageDraw.Draw(icon)
d.rounded_rectangle((0, 0, 255, 255), radius=58, fill=navy)
# Same folded document and angle brackets used in the application header.
points = [(68, 40), (144, 40), (191, 87), (191, 213), (65, 213), (65, 40)]
d.line(points, fill='white', width=11, joint='curve')
d.line([(144, 40), (144, 87), (191, 87)], fill='white', width=10, joint='curve')
d.line([(111, 119), (87, 147), (111, 175)], fill='white', width=10, joint='curve')
d.line([(146, 119), (170, 147), (146, 175)], fill='white', width=10, joint='curve')
icon.save(root / 'favicon.ico', sizes=[(16,16), (32,32), (48,48), (64,64)])
icon.resize((180,180), Image.Resampling.LANCZOS).save(assets / 'apple-touch-icon.png')
icon.resize((32,32), Image.Resampling.LANCZOS).save(assets / 'favicon-32.png')
card = Image.new('RGB', (1200, 630), '#101d34')
d = ImageDraw.Draw(card)
regular = 'C:/Windows/Fonts/segoeui.ttf'
bold = 'C:/Windows/Fonts/segoeuib.ttf'
def text(x, y, value, size, color, heavy=False):
    d.text((x,y), value, font=ImageFont.truetype(bold if heavy else regular, size), fill=color)
d.rectangle((0, 0, 1199, 8), fill=blue)
card.paste(icon.resize((82,82), Image.Resampling.LANCZOS), (76,68), icon.resize((82,82), Image.Resampling.LANCZOS))
text(180,72,'DocToWeb',54,'#ffffff',True)
text(78,218,'Clean HTML',76,'#ffffff',True)
text(78,308,'starts here.',76,'#81a8ff',True)
text(82,429,'Word & Excel to CMS-ready HTML.',29,'#c2cee3')
text(82,536,'Private by design. Runs in your browser.',23,'#94a7c5')
for x, y, label, color in [(896,235,'DOCX','#8ab9ff'),(896,303,'XLSX','#87d6b7'),(896,408,'</> HTML','#ffffff')]:
    d.rounded_rectangle((x,y,x+213,y+55),radius=10,fill=blue if 'HTML' in label else '#1d304e',outline='#34496b')
    text(x+24,y+10,label,24,color,True)
card.save(assets / 'social-preview.png', optimize=True)
print('Generated favicon.ico and three PNG assets.')
