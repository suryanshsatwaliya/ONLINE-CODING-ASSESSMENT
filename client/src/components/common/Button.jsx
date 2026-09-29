export default function Button({
  children,
  variant = "",
  className = "",
  ...props
}) {
  return (
    <button className={`btn ${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
