import { useRef, useState } from "react";
import { FileSpreadsheet, Plus, Trash2, Upload, Download, Maximize2, Minimize2 } from "lucide-react";
import { studentService } from "../../services/studentService";
import { errorMessage } from "../../services/api";
import Button from "../common/Button";
import Modal from "../common/Modal";

const emptyStudent = () => ({ uid: "", name: "", course: "", section: "", email: "", status: "ACTIVE" });

function parseCsv(source) {
  const records = [];
  let row = [], value = "", quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '"' && quoted && source[i + 1] === '"') { value += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(value.trim()); value = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && source[i + 1] === "\n") i++;
      row.push(value.trim());
      if (row.some(Boolean)) records.push(row);
      row = []; value = "";
    } else value += char;
  }
  row.push(value.trim());
  if (row.some(Boolean)) records.push(row);
  if (records.length < 2) throw new Error("CSV needs a header row and at least one student row.");
  const headers = records[0].map((header) => header.toLowerCase().replace(/\s+/g, ""));
  const required = ["uid", "name", "course", "section"];
  const missing = required.filter((header) => !headers.includes(header));
  if (missing.length) throw new Error(`CSV is missing required columns: ${missing.join(", ")}.`);
  return records.slice(1).map((cells) => {
    const record = Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""]));
    return { ...emptyStudent(), uid: record.uid || "", name: record.name || "", course: record.course || "", section: record.section || "", email: record.email || "", status: (record.status || "ACTIVE").toUpperCase() };
  });
}

const utf8 = new TextEncoder();
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
  const u16 = (view, at, n) => view.setUint16(at, n, true);
  const u32 = (view, at, n) => view.setUint32(at, n, true);
  for (const [name, contents] of Object.entries(files)) {
    const filename = utf8.encode(name), data = utf8.encode(contents), checksum = crc32(data);
    const local = new Uint8Array(30 + filename.length + data.length), lv = new DataView(local.buffer);
    u32(lv, 0, 0x04034b50); u16(lv, 4, 20); u16(lv, 6, 0); u16(lv, 8, 0);
    u32(lv, 14, checksum); u32(lv, 18, data.length); u32(lv, 22, data.length); u16(lv, 26, filename.length);
    local.set(filename, 30); local.set(data, 30 + filename.length); localParts.push(local);
    const central = new Uint8Array(46 + filename.length), cv = new DataView(central.buffer);
    u32(cv, 0, 0x02014b50); u16(cv, 4, 20); u16(cv, 6, 20); u16(cv, 8, 0); u16(cv, 10, 0);
    u32(cv, 16, checksum); u32(cv, 20, data.length); u32(cv, 24, data.length); u16(cv, 28, filename.length); u32(cv, 42, offset);
    central.set(filename, 46); centralParts.push(central); offset += local.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22), ev = new DataView(end.buffer);
  u32(ev, 0, 0x06054b50); u16(ev, 8, centralParts.length); u16(ev, 10, centralParts.length); u32(ev, 12, centralSize); u32(ev, 16, offset);
  return new Blob([...localParts, ...centralParts, end], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function makeExcelTemplate() {
  const columns = [
    ["UID *", 20], ["Name *", 28], ["Course *", 26],
    ["Section *", 20], ["Email *", 34], ["Status *", 16],
  ];
  const colXml = columns.map(([_, width], index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("");
  const headers = columns.map(([heading], index) => `<c r="${String.fromCharCode(65 + index)}1" s="1" t="inlineStr"><is><t>${heading}</t></is></c>`).join("");
  return zipStored({
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Student roster" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    "xl/styles.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF5B50D6"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD9D6F4"/></left><right style="thin"><color rgb="FFD9D6F4"/></right><top style="thin"><color rgb="FFD9D6F4"/></top><bottom style="thin"><color rgb="FFD9D6F4"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    "xl/worksheets/sheet1.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:F1"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${colXml}</cols><sheetData><row r="1" ht="26" customHeight="1">${headers}</row></sheetData><autoFilter ref="A1:F1"/></worksheet>`,
  });
}

function downloadTemplate() {
  const url = URL.createObjectURL(makeExcelTemplate());
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = "student-roster-template.xlsx"; anchor.click();
  URL.revokeObjectURL(url);
}

async function parseExcel(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer);
  let endOffset = bytes.length - 22;
  while (endOffset >= 0 && view.getUint32(endOffset, true) !== 0x06054b50) endOffset--;
  if (endOffset < 0) throw new Error("This Excel file is not a valid .xlsx workbook.");
  const count = view.getUint16(endOffset + 10, true), centralOffset = view.getUint32(endOffset + 16, true), files = new Map();
  let cursor = centralOffset;
  for (let i = 0; i < count; i++) {
    if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error("Could not read this Excel workbook.");
    const method = view.getUint16(cursor + 10, true), compressedSize = view.getUint32(cursor + 20, true);
    const nameLength = view.getUint16(cursor + 28, true), extraLength = view.getUint16(cursor + 30, true), commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true), name = new TextDecoder().decode(bytes.slice(cursor + 46, cursor + 46 + nameLength));
    const localNameLength = view.getUint16(localOffset + 26, true), localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    let contents = bytes.slice(dataStart, dataStart + compressedSize);
    if (method === 8) contents = new Uint8Array(await new Response(new Blob([contents]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());
    else if (method !== 0) throw new Error("This Excel compression format is not supported.");
    files.set(name, new TextDecoder().decode(contents));
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  const sheetName = [...files.keys()].find((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
  if (!sheetName) throw new Error("No worksheet was found in this Excel file.");
  const parser = new DOMParser(), sheet = parser.parseFromString(files.get(sheetName), "application/xml");
  const sharedXml = files.get("xl/sharedStrings.xml");
  const shared = sharedXml ? [...parser.parseFromString(sharedXml, "application/xml").getElementsByTagNameNS("*", "si")].map((item) => [...item.getElementsByTagNameNS("*", "t")].map((node) => node.textContent).join("")) : [];
  const grid = [...sheet.getElementsByTagNameNS("*", "row")].map((row) => {
    const cells = [];
    for (const cell of row.getElementsByTagNameNS("*", "c")) {
      const ref = cell.getAttribute("r"), col = ref.replace(/\d/g, "");
      const index = [...col].reduce((sum, char) => sum * 26 + char.toUpperCase().charCodeAt(0) - 64, 0) - 1;
      const type = cell.getAttribute("t"), raw = cell.getElementsByTagNameNS("*", type === "inlineStr" ? "t" : "v")[0]?.textContent || "";
      cells[index] = type === "s" ? shared[Number(raw)] || "" : raw;
    }
    return cells;
  }).filter((row) => row.some((cell) => cell !== undefined && String(cell).trim()));
  if (grid.length < 2) throw new Error("Add student rows below the colored heading row before uploading.");
  const headers = grid[0].map((header) => String(header || "").replace(/\s*\*\s*$/, "").toLowerCase().replace(/\s+/g, ""));
  return grid.slice(1).map((cells) => {
    const record = Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""]));
    return { ...emptyStudent(), uid: String(record.uid || ""), name: String(record.name || ""), course: String(record.course || ""), section: String(record.section || ""), email: String(record.email || ""), status: String(record.status || "ACTIVE").toUpperCase() };
  }).filter((student) => Object.values(student).some((value) => String(value).trim()));
}

export default function BulkStudentModal({ onClose, onSaved }) {
  const [students, setStudents] = useState([emptyStudent()]);
  const [busy, setBusy] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);
  const cellRefs = useRef([]);
  const emailForUid = (uid, template) => {
    const domain = String(template || "").trim().split("@")[1];
    return uid?.trim() && domain ? `${uid.trim()}@${domain}` : "";
  };
  const update = (index, field, value) => setStudents((rows) => {
    const next = rows.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row);
    if (index === 0) {
      const first = next[0];
      if (field === "email") first.email = emailForUid(first.uid, value) || value;
      else if (field === "uid") first.email = emailForUid(value, first.email) || first.email;
      return next.map((row, rowIndex) => rowIndex === 0 ? first : {
        ...row,
        course: first.course,
        section: first.section,
        email: emailForUid(row.uid, first.email),
      });
    }
    if (field === "uid") next[index].email = emailForUid(value, next[0].email);
    return next;
  });
  const firstRowFieldOrder = ["uid", "name", "course", "section", "email", "status"];
  const laterRowFieldOrder = ["uid", "name"];
  function addRowAndFocus() {
    if (students.length >= 500) {
      setError("You can add up to 500 students at a time.");
      return;
    }
    const index = students.length;
    const first = students[0] || emptyStudent();
    setStudents((rows) => [...rows, { ...emptyStudent(), course: first.course, section: first.section }]);
    requestAnimationFrame(() => cellRefs.current[index]?.[0]?.focus());
  }
  function advanceCell(event, rowIndex, field) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const order = rowIndex === 0 ? firstRowFieldOrder : laterRowFieldOrder;
    const fieldIndex = order.indexOf(field);
    if (fieldIndex < order.length - 1) {
      const nextField = order[fieldIndex + 1];
      const nextIndex = nextField === "status" ? 5 : ["uid", "name", "course", "section", "email"].indexOf(nextField);
      cellRefs.current[rowIndex]?.[nextIndex]?.focus();
    }
    else if (students[rowIndex + 1]) cellRefs.current[rowIndex + 1]?.[0]?.focus();
    else addRowAndFocus();
  }

  async function loadFile(file) {
    if (!file) return;
    try {
      const parsed = /\.xlsx$/i.test(file.name) ? await parseExcel(file) : parseCsv(await file.text());
      if (parsed.length > 500) throw new Error("Upload up to 500 students at a time.");
      const first = parsed[0];
      first.email = emailForUid(first.uid, first.email) || first.email;
      setStudents(parsed.map((student, index) => index === 0 ? first : ({
        ...student,
        course: first.course,
        section: first.section,
        email: emailForUid(student.uid, first.email),
      })));
      setError("");
    } catch (cause) { setError(cause.message || "Could not read this spreadsheet."); }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function save(event) {
    event.preventDefault();
    const rows = students.filter((student) => Object.values(student).some((value) => String(value).trim()));
    if (!rows.length) { setError("Add at least one student before saving."); return; }
    setBusy(true); setError("");
    try {
      const { data } = await studentService.createMany(rows.map((row) => ({ ...row, uid: row.uid.trim(), name: row.name.trim(), course: row.course.trim(), section: row.section.trim(), email: row.email.trim() })));
      onSaved(data.length);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  return <Modal
    title="Student roster"
    onClose={busy ? undefined : onClose}
    className={`bulk-student-modal${fullScreen ? " is-fullscreen" : ""}`}
    headerActions={<button type="button" className="bulk-student-fullscreen" aria-label={fullScreen ? "Exit full screen" : "Enter full screen"} title={fullScreen ? "Exit full screen" : "Full screen"} onClick={() => setFullScreen((value) => !value)}>{fullScreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button>}
  >
    <form onSubmit={save}>
      <div className="bulk-student-intro"><span className="bulk-student-icon"><FileSpreadsheet size={18} /></span><div><strong>Add your class roster in one go</strong><small>Complete the first row; later rows need only UID and name. Up to 500 students per upload.</small></div></div>
      <div className="bulk-student-actions">
        <Button type="button" variant="secondary" onClick={downloadTemplate}><Download size={15} />Download Excel template</Button>
        <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}><Upload size={15} />Upload spreadsheet</Button>
        <input ref={fileRef} className="bulk-student-file" type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" onChange={(event) => loadFile(event.target.files?.[0])} />
      </div>
      <div className="bulk-student-grid-wrap">
        <table className="bulk-student-grid">
          <thead><tr>{["UID *", "Name *", "Course *", "Section *", "Email *", "Status *", ""].map((heading, i) => <th key={i}>{heading}</th>)}</tr></thead>
          <tbody>{students.map((student, index) => <tr key={index}>
            {[["uid", "e.g. 24BCS10000"], ["name", "e.g. Aarav Sharma"], ["course", "e.g. B.Tech CSE"], ["section", "e.g. CSE-A"], ["email", "e.g. 24BCS10000@school.edu"]].map(([field, placeholder], fieldIndex) => <td key={field}><input ref={(node) => { cellRefs.current[index] ||= []; cellRefs.current[index][fieldIndex] = node; }} onKeyDown={index === 0 || fieldIndex < 2 ? (event) => advanceCell(event, index, field) : undefined} aria-label={`${field}, row ${index + 1}`} placeholder={placeholder} type={field === "email" ? "email" : "text"} required={index === 0} readOnly={index > 0 && field !== "uid" && field !== "name"} value={student[field]} onChange={(event) => update(index, field, event.target.value)} /></td>)}
            <td><select ref={(node) => { cellRefs.current[index] ||= []; cellRefs.current[index][5] = node; }} onKeyDown={index === 0 ? (event) => advanceCell(event, index, "status") : undefined} aria-label={`Status, row ${index + 1}`} value={student.status} onChange={(event) => update(index, "status", event.target.value)}><option>ACTIVE</option><option>INACTIVE</option></select></td>
            <td><button className="bulk-student-remove" type="button" aria-label={`Remove row ${index + 1}`} disabled={students.length === 1} onClick={() => setStudents((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}><Trash2 size={15} /></button></td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="bulk-student-footer">
          <button className="bulk-student-add-row" type="button" disabled={students.length >= 500} onClick={addRowAndFocus}><Plus size={15} />Add row</button>
        <span>{students.length} row{students.length === 1 ? "" : "s"}</span>
      </div>
      {error && <p className="error bulk-student-error" role="alert">{error}</p>}
      <div className="bulk-student-submit"><Button type="button" variant="secondary" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Saving students…" : `Save ${students.length} students`}</Button></div>
    </form>
  </Modal>;
}

