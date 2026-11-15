export default function Loader({ message = "Loading your workspace…" }) {
  return (
    <div aria-busy="true" className="loading" role="status">
      <div className="skeleton" />
      <div className="skeleton" />
      <p>{message}</p>
    </div>
  );
}
