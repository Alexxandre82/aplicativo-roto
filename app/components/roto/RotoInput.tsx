type RotoInputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function RotoInput({ className = "", ...props }: RotoInputProps) {
  return <input className={`roto-input ${className}`} {...props} />;
}