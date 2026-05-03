type RotoSelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export function RotoSelect({ className = "", children, ...props }: RotoSelectProps) {
  return (
    <select className={`roto-input ${className}`} {...props}>
      {children}
    </select>
  );
}