// Чистый layout для страниц авторизации (логин и т.п.)
// Не подгружает sidebar и не требует авторизации

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
