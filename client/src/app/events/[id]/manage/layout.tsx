import ProtectedRoute from '@/components/protected-routes';

export default function ManageEventLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
