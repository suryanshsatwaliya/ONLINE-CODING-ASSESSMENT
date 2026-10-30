import { useCallback, useEffect, useRef, useState } from "react";
import { GripVertical, RefreshCw } from "lucide-react";
import { errorMessage } from "../../services/api";
import Badge from "../common/Badge";

export const assessmentForm = (data) => ({
  ...data,
  questionSetIds: (data.questionSets || []).map((set) => String(set.setId)),
  questionIds: data.questions.filter((q) => !q.sourceSetId).map((q) => q._id),
});
export function availableSets(sets, form) {
  return [...sets, ...(form.questionSets || []).filter((saved) => !sets.some((set) => set._id === saved.setId))
    .map((saved) => ({ ...saved, _id: saved.setId, description: "Saved assessment copy · removed from bank", readyForAssessment: true }))];
}
export function questionCount(sets, form) {
  return form.questionIds.length + form.questionSetIds.reduce((sum, id) => sum +
    ((form.questionSets || []).find((set) => set.setId === id)?.questionCount || sets.find((set) => set._id === id)?.questionCount || 0), 0);
}
export default function AssessmentQuestionPicker({ sets, bank, form, onChange, onRefresh, showHeading = true }) {
  const [search, setSearch] = useState("");
  const [draggedSetId, setDraggedSetId] = useState(null), [dropTargetSetId, setDropTargetSetId] = useState(null);
  const [draggedQuestionId, setDraggedQuestionId] = useState(null), [dropTargetQuestionId, setDropTargetQuestionId] = useState(null);
  const [refreshing, setRefreshing] = useState(false), [refreshError, setRefreshError] = useState("");
  const pending = useRef(false);
  const refresh = useCallback(async () => {
    if (!onRefresh || pending.current) return;
    pending.current = true; setRefreshing(true); setRefreshError("");
    try { await onRefresh(); }
    catch (e) { setRefreshError("Could not refresh the Question Bank. " + errorMessage(e)); }
    finally { pending.current = false; setRefreshing(false); }
  }, [onRefresh]);
  useEffect(() => {
    refresh();
    const whenVisible = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", whenVisible);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", whenVisible);
    };
  }, [refresh]);
  const allSets = availableSets(sets, form);
  const matchesAssessmentType = (type) =>
    form.type === "MIXED" ||
    (form.type === "CODING" ? type === "CODING" : type !== "CODING");
  const compatibleSets = allSets.filter((set) => matchesAssessmentType(set.type));
  const visible = compatibleSets.filter((set) => set.title.toLowerCase().includes(search.toLowerCase()));
  const individual = [...bank, ...(form.questions || []).filter((q) => !q.sourceSetId && !bank.some((item) => item._id === q._id))];
  const compatibleIndividual = individual.filter((question) => matchesAssessmentType(question.type));
  const canReorderSets = form.questionSetIds.length > 1;
  const canReorderIndividual = form.questionIds.length > 1;
  const toggle = (key, id, checked) => {
    const next = {
      ...form,
      [key]: checked ? [...form[key], id] : form[key].filter((item) => item !== id),
    };
    onChange(next);
  };
  const reorderIds = (key, sourceId, targetId) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const ids = [...form[key]];
    const from = ids.indexOf(sourceId), to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ...ids.splice(from, 1));
    onChange({ ...form, [key]: ids });
  };
  return (
    <>
      {showHeading && <><h2>02 / Choose saved question sets</h2>
      <p>Select saved sets or individual questions for this {form.type === "MIXED" ? "mixed" : form.type === "CODING" ? "coding" : "quiz"} assessment.</p></>}
      <div className="as-question-library-heading"><h3>Available question sets</h3><span>{visible.length} shown</span></div>
      <div className="question-picker-toolbar">
        <input className="search" aria-label="Search saved question sets" placeholder="Search saved sets…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {onRefresh && <button type="button" className="btn secondary" aria-label="Refresh question bank" disabled={refreshing} onClick={refresh}><RefreshCw size={16} />{refreshing ? "Refreshing…" : "Refresh"}</button>}
      </div>
      {refreshError && <p className="notice error" role="alert">{refreshError}</p>}
      <div className="saved-set-options">
        {visible.map((set) => {
          const selected = form.questionSetIds.includes(set._id);
          const retained = form.questionSets?.some((item) => item.setId === set._id);
          return <label className={`saved-set-option is-${set.type === "QUIZ" ? "quiz" : "coding"} ${selected ? "selected" : ""}`} key={set._id}>
            <input type="checkbox" checked={selected} disabled={!set.readyForAssessment && !retained}
              onChange={(e) => toggle("questionSetIds", set._id, e.target.checked)} />
            <span><strong>{set.title}</strong><small>{set.questionCount} questions · {set.totalMarks != null ? `${set.totalMarks} points · ` : ""}{set.type === "QUIZ" ? "Quiz" : "Coding"}</small>
              {!set.readyForAssessment && !retained && <small>Each coding question needs a hidden grading test. Save the tests in Question Bank, then click Refresh here.</small>}
            </span><Badge>{set.type}</Badge>
          </label>;
        })}
      </div>
      {!visible.length && <div className="empty">{compatibleSets.length ? "No sets match your search." : compatibleIndividual.length ? "No matching saved sets. Individual questions are listed below." : `No ${form.type === "CODING" ? "coding" : form.type === "QUIZ" ? "quiz" : "matching"} questions available. Create them in the Question Bank first.`}</div>}
      {!!compatibleIndividual.length && <details className="existing-question-picker">
        <summary>Individual Question Bank questions ({compatibleIndividual.length} available · {form.questionIds.length} selected)</summary>
        <p>Individual questions appear before saved sets.</p>
        {compatibleIndividual.map((q) => <label className="question-select" key={q._id}><input type="checkbox" checked={form.questionIds.includes(q._id)} onChange={(e) => toggle("questionIds", q._id, e.target.checked)} /><strong>{q.title}</strong><Badge>{q.type}</Badge></label>)}
      </details>}
      {form.questionSetIds.length > 0 && <section className="selected-set-order"><div className="selected-set-order-heading"><h3>Selected sets <span>{form.questionSetIds.length}</span></h3>{canReorderSets && <small>Drag to set the order students see them</small>}</div>
        {form.questionSetIds.map((id, index) => <div className={`selected-set-order-row row between${!canReorderSets ? " is-static" : ""}${draggedSetId === id ? " is-dragging" : ""}${dropTargetSetId === id ? " is-drop-target" : ""}`} key={id}
          draggable={canReorderSets}
          onDragStart={canReorderSets ? (event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", id); setDraggedSetId(id); } : undefined}
          onDragOver={canReorderSets ? (event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDropTargetSetId(id); } : undefined}
          onDrop={canReorderSets ? (event) => { event.preventDefault(); reorderIds("questionSetIds", event.dataTransfer.getData("text/plain") || draggedSetId, id); setDraggedSetId(null); setDropTargetSetId(null); } : undefined}
          onDragEnd={canReorderSets ? () => { setDraggedSetId(null); setDropTargetSetId(null); } : undefined}>
          <span className="selected-set-order-title">{canReorderSets && <GripVertical size={17} aria-hidden="true" />}<span>{index + 1}. {allSets.find((set) => set._id === id)?.title || "Unavailable set"}</span></span>
          <span className="selected-set-order-actions">{canReorderSets && [-1, 1].map((direction) => <button type="button" key={direction}
            aria-label={`Move set ${index + 1} ${direction < 0 ? "up" : "down"}`} disabled={index + direction < 0 || index + direction >= form.questionSetIds.length}
            onClick={() => { const ids = [...form.questionSetIds]; [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]]; onChange({ ...form, questionSetIds: ids }); }}>
            {direction < 0 ? "↑" : "↓"}</button>)}<button type="button" onClick={() => toggle("questionSetIds", id, false)}>Remove</button></span>
        </div>)}
      </section>}
      {form.questionIds.length > 0 && <section className="selected-set-order selected-question-order"><div className="selected-set-order-heading"><h3>Selected individual questions <span>{form.questionIds.length}</span></h3>{canReorderIndividual && <small>Drag to set the order students see them</small>}</div>
        {form.questionIds.map((id, index) => {
          const question = individual.find((item) => item._id === id);
          return <div className={`selected-set-order-row row between${!canReorderIndividual ? " is-static" : ""}${draggedQuestionId === id ? " is-dragging" : ""}${dropTargetQuestionId === id ? " is-drop-target" : ""}`} key={id}
            draggable={canReorderIndividual}
            onDragStart={canReorderIndividual ? (event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", id); setDraggedQuestionId(id); } : undefined}
            onDragOver={canReorderIndividual ? (event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDropTargetQuestionId(id); } : undefined}
            onDrop={canReorderIndividual ? (event) => { event.preventDefault(); reorderIds("questionIds", event.dataTransfer.getData("text/plain") || draggedQuestionId, id); setDraggedQuestionId(null); setDropTargetQuestionId(null); } : undefined}
            onDragEnd={canReorderIndividual ? () => { setDraggedQuestionId(null); setDropTargetQuestionId(null); } : undefined}>
            <span className="selected-set-order-title">{canReorderIndividual && <GripVertical size={17} aria-hidden="true" />}<span>{index + 1}. {question?.title || "Selected question"}</span></span>
            <span className="selected-set-order-actions">{canReorderIndividual && [-1, 1].map((direction) => <button type="button" key={direction}
              aria-label={`Move question ${index + 1} ${direction < 0 ? "up" : "down"}`} disabled={index + direction < 0 || index + direction >= form.questionIds.length}
              onClick={() => { const ids = [...form.questionIds]; [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]]; onChange({ ...form, questionIds: ids }); }}>
              {direction < 0 ? "↑" : "↓"}</button>)}<button type="button" onClick={() => toggle("questionIds", id, false)}>Remove</button></span>
          </div>;
        })}
      </section>}
      <p className="selection-total">{questionCount(allSets, form)} / 100 questions selected</p>
      {form.questionSets?.length > 0 && <small>Retained sets use this assessment’s saved version. To use a newer bank version, remove the set, save, then select it again.</small>}
    </>
  );
}
