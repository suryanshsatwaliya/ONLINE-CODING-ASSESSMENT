import { useEffect, useState } from "react";
import { studentService as service } from "../../services/studentService";
import { errorMessage } from "../../services/api";
import { useToast } from "../../components/common/Toast";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import Modal from "../../components/common/Modal";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import StudentTable from "../../components/teacher/StudentTable";
const blank = {
  uid: "",
  name: "",
  course: "",
  section: "",
  email: "",
  status: "ACTIVE",
};
export default function Students() {
  const [rows, R] = useState([]),
    [form, F] = useState(null),
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
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">YOUR COMMUNITY</span>
          <h1>Students</h1>
          <p>Manage identities and assessment access.</p>
        </div>
        <Button onClick={() => F({ ...blank })}>+ Add student</Button>
      </div>
      <div className="filters">
        <input
          placeholder="Search name or UID…"
          value={search}
          onChange={(e) => S(e.target.value)}
        />
        <select value={course} onChange={(e) => C(e.target.value)}>
          <option value="">All courses</option>
          {[...new Set(rows.map((s) => s.course))].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <input
          placeholder="Filter section"
          value={section}
          onChange={(e) => Sec(e.target.value)}
        />
        <select value={status} onChange={(e) => St(e.target.value)}>
          <option value="">All statuses</option>
          <option>ACTIVE</option>
          <option>INACTIVE</option>
        </select>
      </div>
      <div className="card">
        <StudentTable
          students={rows.filter(
            (s) =>
              (s.name + s.uid).toLowerCase().includes(search.toLowerCase()) &&
              (!course || s.course === course) &&
              s.section.toLowerCase().includes(section.toLowerCase()) &&
              (!status || s.status === status),
          )}
          onEdit={F}
          onDelete={D}
        />
      </div>
      {form && (
        <Modal
          title={form._id ? "Edit student" : "Add student"}
          onClose={() => F(null)}
        >
          <form onSubmit={save}>
            <div className="form-grid">
              {["uid", "name", "course", "section", "email"].map((k) => (
                <Input
                  key={k}
                  label={k.toUpperCase()}
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
