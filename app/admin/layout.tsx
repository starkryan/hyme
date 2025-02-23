import { ClerkProvider } from '@clerk/nextjs';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <div className="min-h-screen bg-background">
        {children}
      </div>
    </ClerkProvider>
  );
}
