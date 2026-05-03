type RotoCardProps = {
  children: React.ReactNode;
  className?: string;
};

export function RotoCard({ children, className = "" }: RotoCardProps) {
  return <div className={`roto-card ${className}`}>{children}</div>;
}