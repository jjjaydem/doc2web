"""Deterministic OOXML fixtures. Python standard library only; no Office needed."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from xml.sax.saxutils import escape
import base64

ROOT = Path(__file__).resolve().parent
W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
P = 'http://schemas.openxmlformats.org/package/2006/relationships'
S = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'

def write_zip(name, files):
    with ZipFile(ROOT / name, 'w', ZIP_DEFLATED) as z:
        for path, data in files.items():
            z.writestr(path, data)

def run(text, bold=False):
    return '<w:r>' + ('<w:rPr><w:b/></w:rPr>' if bold else '') + '<w:t xml:space="preserve">' + escape(text) + '</w:t></w:r>'

def para(text, bold=False):
    return '<w:p>' + run(text, bold) + '</w:p>'

def listing(text, num=1, level=0):
    return f'<w:p><w:pPr><w:numPr><w:ilvl w:val="{level}"/><w:numId w:val="{num}"/></w:numPr></w:pPr>{run(text)}</w:p>'

def cell(text, props=''):
    return '<w:tc><w:tcPr>' + props + '</w:tcPr>' + para(text) + '</w:tc>'

def image():
    return '<w:p><w:r><w:drawing><wp:inline><a:graphic><a:graphicData><pic:pic><pic:blipFill><a:blip r:embed="rImg"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>'

body = para('ทดสอบภาษาไทย English & < > " \'')
body += para('ทั้งย่อหน้า Bold', True)
body += '<w:p>' + run('ก่อน ') + run('ตัว', True) + run('หนา', True) + run(' หลัง') + '</w:p>'
body += '<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>  </w:t></w:r></w:p>'
body += para('https://example.com/path?a=1&b=2 และ team@example.com หมายเลข 123456')
body += '<w:p>' + ''.join(f'<w:hyperlink r:id="{rid}">{run(label)}</w:hyperlink>' for rid, label in [('web', 'เว็บไซต์'), ('tel', '02-123-4567'), ('mail', 'ส่งอีเมล'), ('evil', 'unsafe')]) + '</w:p>'
body += listing('Bullet 1') + listing('Bullet nested', 1, 1) + listing('Bullet 2') + listing('Number 1', 2) + listing('Number nested', 2, 1) + listing('Number 2', 2) + listing('Special starts 4', 3)
body += '<w:tbl><w:tblGrid><w:gridCol/><w:gridCol/><w:gridCol/></w:tblGrid><w:tr>' + cell('H1') + cell('H2') + cell('H3') + '</w:tr><w:tr>' + cell('Merged', '<w:gridSpan w:val="2"/><w:vMerge w:val="restart"/>') + cell('Value') + '</w:tr><w:tr>' + cell('', '<w:gridSpan w:val="2"/><w:vMerge/>') + cell('End') + '</w:tr></w:tbl>'
body += '<w:tbl><w:tr>' + cell('Only header') + '</w:tr></w:tbl>'
body += image() * 3 + para('ข้อความคั่นรูป') + image()
body += '<w:p>' + run('บรรทัดหนึ่ง') + '<w:r><w:br/></w:r>' + run('บรรทัดสอง') + '</w:p>'
numbering = f'<w:numbering xmlns:w="{W}">'
for n, fmt, start in [(1, 'bullet', 1), (2, 'decimal', 1), (3, 'upperRoman', 4)]:
    numbering += f'<w:abstractNum w:abstractNumId="{n}">'
    for level in range(2):
        numbering += f'<w:lvl w:ilvl="{level}"><w:start w:val="{start}"/><w:numFmt w:val="{fmt}"/><w:lvlText w:val="%{level + 1}."/></w:lvl>'
    numbering += f'</w:abstractNum><w:num w:numId="{n}"><w:abstractNumId w:val="{n}"/></w:num>'
numbering += '</w:numbering>'
rels = f'<Relationships xmlns="{P}">' + ''.join(f'<Relationship Id="{rid}" Type="{R}/hyperlink" Target="{escape(target)}" TargetMode="External"/>' for rid, target in [('web', 'https://example.com/?a=1&b=2'), ('tel', 'tel:02-123 4567'), ('mail', 'mailto:team@example.com'), ('evil', 'javascript:alert(1)')]) + f'<Relationship Id="rImg" Type="{R}/image" Target="media/pixel.png"/></Relationships>'
content_types = '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>'
write_zip('sample.docx', {
    '[Content_Types].xml': content_types,
    '_rels/.rels': f'<Relationships xmlns="{P}"><Relationship Id="rId1" Type="{R}/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml': f'<w:document xmlns:w="{W}" xmlns:r="{R}" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>{body}</w:body></w:document>',
    'word/_rels/document.xml.rels': rels,
    'word/numbering.xml': numbering,
    'word/media/pixel.png': base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII='),
})

def inline(addr, text, style=''):
    return f'<c r="{addr}" t="inlineStr" {style}><is><t>{escape(text)}</t></is></c>'

headers = ''.join(inline(f'{col}3', text, 's="1"') for col, text in zip('BCDEFGH', ['ชื่อ', 'วันที่', 'เปอร์เซ็นต์', 'รหัส', 'สูตร', 'ไม่มีผลสูตร', 'Link']))
rows = f'<row r="3">{headers}</row>'
rows += '<row r="4">' + inline('B4', 'ไทย & English < > " \'') + '<c r="C4" s="2"><v>45292</v></c><c r="D4" s="3"><v>0.125</v></c><c r="E4" s="4"><v>7</v></c><c r="F4"><f>1+2</f><v>3</v></c><c r="G4"><f>SUM(1,2)</f></c>' + inline('H4', 'เว็บไซต์') + '</row>'
rows += '<row r="6"><c r="B6" t="inlineStr"><is><r><t xml:space="preserve">normal </t></r><r><rPr><b/></rPr><t>bold</t></r></is></c></row>'
rows += '<row r="7">' + inline('B7', 'merged') + '</row>'
styles = f'<styleSheet xmlns="{S}"><numFmts count="2"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/><numFmt numFmtId="165" formatCode="00000"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5">' + ''.join(f'<xf numFmtId="{fmt}" fontId="{font}" fillId="0" borderId="0" xfId="0"/>' for fmt, font in [(0,0),(0,1),(164,0),(10,0),(165,0)]) + '</cellXfs></styleSheet>'
files = {
    '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + ''.join(f'<Override PartName="/xl/worksheets/sheet{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' for i in range(1,4)) + '</Types>',
    '_rels/.rels': f'<Relationships xmlns="{P}"><Relationship Id="rId1" Type="{R}/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': f'<workbook xmlns="{S}" xmlns:r="{R}"><sheets><sheet name="ข้อมูลหลัก" sheetId="1" r:id="r1"/><sheet name="Single row" sheetId="2" r:id="r2"/><sheet name="Empty" sheetId="3" r:id="r3"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': f'<Relationships xmlns="{P}">' + ''.join(f'<Relationship Id="r{i}" Type="{R}/worksheet" Target="worksheets/sheet{i}.xml"/>' for i in range(1,4)) + f'<Relationship Id="styles" Type="{R}/styles" Target="styles.xml"/></Relationships>',
    'xl/styles.xml': styles,
    'xl/worksheets/sheet1.xml': f'<worksheet xmlns="{S}" xmlns:r="{R}"><dimension ref="A1:K20"/><sheetData>{rows}</sheetData><mergeCells count="1"><mergeCell ref="B7:D8"/></mergeCells><hyperlinks><hyperlink ref="H4" r:id="web"/></hyperlinks></worksheet>',
    'xl/worksheets/_rels/sheet1.xml.rels': f'<Relationships xmlns="{P}"><Relationship Id="web" Type="{R}/hyperlink" Target="https://example.com/?a=1&amp;b=2" TargetMode="External"/></Relationships>',
    'xl/worksheets/sheet2.xml': f'<worksheet xmlns="{S}"><sheetData><row r="5">{inline("D5", "Only header")}</row></sheetData></worksheet>',
    'xl/worksheets/sheet3.xml': f'<worksheet xmlns="{S}"><sheetData/></worksheet>',
}
write_zip('sample.xlsx', files)
(ROOT / 'corrupt.docx').write_text('not a zip file', encoding='utf-8')
print('Created sample.docx, sample.xlsx, corrupt.docx')
