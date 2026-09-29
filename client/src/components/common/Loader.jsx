export default function Loader() {
  return (
    <div aria-busy="true" className="loading">
      <div className="skeleton" />
      <div className="skeleton" />
      <p>Loading your workspace…</p>
    </div>
  );
}
