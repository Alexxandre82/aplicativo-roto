type RotoButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "danger" | "secondary";
};

export function RotoButton({
  children,
  className = "",
  variant = "primary",
  ...props
}: RotoButtonProps) {
  const variantClass =
    variant === "danger"
      ? "roto-button-danger"
      : variant === "secondary"
      ? "roto-button-secondary"
      : "roto-button";

  return (
    <button className={`${variantClass} ${className}`} {...props}>
      {children}
    </button>
  );
}