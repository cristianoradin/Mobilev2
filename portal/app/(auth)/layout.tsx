export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
      {children}
    </div>
  )
}
