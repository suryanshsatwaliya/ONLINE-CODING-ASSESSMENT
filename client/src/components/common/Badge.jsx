export default function Badge({ children }) {
  return (
    <span className={`badge ${String(children).toLowerCase()}`}>
      {children}
    </span>
  );
}
