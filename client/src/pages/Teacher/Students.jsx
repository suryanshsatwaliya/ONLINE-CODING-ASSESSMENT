import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { studentService as service } from "../../services/studentService";
import { errorMessage } from "../../services/api";
import { useToast } from "../../components/common/Toast";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import Modal from "../../components/common/Modal";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import StudentTable from "../../components/teacher/StudentTable";
import BulkStudentModal from "../../components/teacher/BulkStudentModal";
import { makeStudentWorkbook } from "../../utils/studentWorkbook";
export default function Students() {
  const [rows, R] = useState([]),
    [form, F] = useState(null),
    [bulkOpen, setBulkOpen] = useState(false),
    [search, S] = useState(""),
    [course, C] = useState(""),
    [section, Sec] = useState(""),
    [status, St] = useState(""),
    [del, D] = useState(null);
  const toast = useToast();
  const load = () =>
    service
      .list()
      .then((r) => R(r.data))
      .catch((e) => toast(errorMessage(e)));
  useEffect(() => {
    load();
  }, []);
  async function save(e) {
    e.preventDefault();
    try {
      form._id
        ? await service.update(form._id, form)
        : await service.create(form);
      F(null);
      load();
      toast("Student saved");
    } catch (e) {
      toast(errorMessage(e));
    }
  }
  const sectionStudents = rows
    .filter((student) => student.section === section)
    .sort((a, b) => a.uid.localeCompare(b.uid, undefined, { numeric: true, sensitivity: "base" }));
  const visibleSectionStudents = sectionStudents
    .filter((student) => (student.name + student.uid).toLowerCase().includes(search.toLowerCase()) && (!course || student.course === course) && (!status || student.status === status));
  function downloadSectionCsv() {
    const url = URL.createObjectURL(makeStudentWorkbook(sectionStudents));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `students-${section.replace(/[^a-z0-9_-]+/gi, "-")}.xlsx`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  return (
    <>
      <div className="page-title">
        <div>
          <h1>Students</h1>
          <p>Manage identities and assessment access.</p>
        </div>
        <div className="students-page-actions">
          <Button type="button" onClick={() => setBulkOpen(true)}>Add student</Button>
        </div>
      </div>
      <div className="filters">
        <input
          placeholder="Search name or UID…"
          value={search}
          onChange={(e) => S(e.target.value)}
        />
        <select
          aria-label="Filter by section"
          value={section}
          onChange={(e) => Sec(e.target.value)}
        >
          <option value="">No section selected</option>
          {[...new Set(rows.map((s) => s.section).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
            .map((x) => (
              <option key={x} value={x}>{x}</option>
            ))}
        </select>
        <select value={course} onChange={(e) => C(e.target.value)}>
          <option value="">All courses</option>
          {[...new Set(rows.map((s) => s.course))].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => St(e.target.value)}>
          <option value="">All statuses</option>
          <option>ACTIVE</option>
          <option>INACTIVE</option>
        </select>
      </div>
      <div className="card">
        {section ? (
          <div className="student-results-transition" key={section}>
            <div className="student-section-toolbar"><div><strong>{section}</strong><span>{sectionStudents.length} student{sectionStudents.length === 1 ? "" : "s"}</span></div><Button type="button" variant="secondary" onClick={downloadSectionCsv}><Download size={15} />Download Excel</Button></div>
            <StudentTable
              students={visibleSectionStudents}
              onEdit={F}
              onDelete={D}
            />
          </div>
        ) : (
          <div className="empty">Select a section to view its students.</div>
        )}
      </div>
      {form && (
        <Modal
          title={form._id ? "Edit student" : "Add student"}
          onClose={() => F(null)}
          className="student-editor-modal"
        >
          <form onSubmit={save}>
            <div className="form-grid">
              {[["uid", "UID", "24BCS10000"], ["name", "NAME", "e.g. Aarav Sharma"], ["course", "COURSE", "e.g. B.Tech CSE"], ["section", "SECTION", "e.g. CSE-A"], ["email", "EMAIL", "e.g. student@example.com"]].map(([k, label, placeholder]) => (
                <Input
                  key={k}
                  label={label}
                  placeholder={placeholder}
                  required={k !== "email"}
                  type={k === "email" ? "email" : "text"}
                  value={form[k] || ""}
                  onChange={(e) => F({ ...form, [k]: e.target.value })}
                />
              ))}
            </div>
            <label className="field">
              Status
              <select
                value={form.status}
                onChange={(e) => F({ ...form, status: e.target.value })}
              >
                <option>ACTIVE</option>
                <option>INACTIVE</option>
              </select>
            </label>
            <Button>Save student</Button>
          </form>
        </Modal>
      )}
      {bulkOpen && <BulkStudentModal onClose={() => setBulkOpen(false)} onSaved={(count) => { setBulkOpen(false); load(); toast(`${count} students added successfully`); }} />}
      {del && (
        <ConfirmDialog
          onClose={() => D(null)}
          onConfirm={async () => {
            try {
              await service.remove(del._id);
              D(null);
              load();
            } catch (e) {
              toast(errorMessage(e));
            }
          }}
        >
          Delete {del.name}? Students with history must be deactivated instead.
        </ConfirmDialog>
      )}
    </>
  );
}
