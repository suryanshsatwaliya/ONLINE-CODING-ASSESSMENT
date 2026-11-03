const encoder = new TextEncoder();

function crc32(bytes) {
  let crc = -1;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ -1) >>> 0;
}

function zipStored(files) {
  const localParts = [], centralParts = [];
  let offset = 0;
  const u16 = (view, at, value) => view.setUint16(at, value, true);
  const u32 = (view, at, value) => view.setUint32(at, value, true);
  for (const [name, contents] of Object.entries(files)) {
    const filename = encoder.encode(name), data = encoder.encode(contents), checksum = crc32(data);
    const local = new Uint8Array(30 + filename.length + data.length), localView = new DataView(local.buffer);
    u32(localView, 0, 0x04034b50); u16(localView, 4, 20); u32(localView, 14, checksum);
    u32(localView, 18, data.length); u32(localView, 22, data.length); u16(localView, 26, filename.length);
    local.set(filename, 30); local.set(data, 30 + filename.length); localParts.push(local);
    const central = new Uint8Array(46 + filename.length), centralView = new DataView(central.buffer);
    u32(centralView, 0, 0x02014b50); u16(centralView, 4, 20); u16(centralView, 6, 20); u32(centralView, 16, checksum);
    u32(centralView, 20, data.length); u32(centralView, 24, data.length); u16(centralView, 28, filename.length); u32(centralView, 42, offset);
    central.set(filename, 46); centralParts.push(central); offset += local.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22), endView = new DataView(end.buffer);
  u32(endView, 0, 0x06054b50); u16(endView, 8, centralParts.length); u16(endView, 10, centralParts.length);
  u32(endView, 12, centralSize); u32(endView, 16, offset);
  return new Blob([...localParts, ...centralParts, end], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

const xml = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const columnName = (index) => {
  let name = "";
  for (let number = index + 1; number; number = Math.floor((number - 1) / 26)) name = String.fromCharCode(65 + (number - 1) % 26) + name;
  return name;
};

export function makeStudentWorkbook(students) {
  const headings = ["UID", "Name", "Course", "Section", "Email", "Status"];
  const records = [headings, ...students.map(({ uid, name, course, section, email, status }) => [uid, name, course, section, email, status])];
  const widths = [20, 30, 24, 20, 36, 16];
  const columns = widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("");
  const rows = records.map((record, rowIndex) => {
    const cells = record.map((value, columnIndex) => `<c r="${columnName(columnIndex)}${rowIndex + 1}" s="${rowIndex === 0 ? 1 : rowIndex % 2 ? 2 : 3}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`).join("");
    return `<row r="${rowIndex + 1}" ht="${rowIndex === 0 ? 30 : 24}" customHeight="1">${cells}</row>`;
  }).join("");
  const lastRow = records.length, lastColumn = columnName(headings.length - 1);
  return zipStored({
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Student roster" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    "xl/styles.xml": `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Aptos"/><color rgb="FF26334D"/></font><font><b/><sz val="11"/><name val="Aptos Display"/><color rgb="FFFFFFFF"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF5147CD"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF2F4FA"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFE2E7F0"/></left><right style="thin"><color rgb="FFE2E7F0"/></right><top style="thin"><color rgb="FFE2E7F0"/></top><bottom style="thin"><color rgb="FFE2E7F0"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" indent="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" indent="1"/></xf><xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" indent="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" indent="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    "xl/worksheets/sheet1.xml": `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${lastColumn}${lastRow}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${columns}</cols><sheetData>${rows}</sheetData><autoFilter ref="A1:${lastColumn}${lastRow}"/></worksheet>`,
  });
}
