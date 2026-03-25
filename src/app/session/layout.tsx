export default function SessionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black z-50 overflow-auto">
      {children}
    </div>
  );
}
