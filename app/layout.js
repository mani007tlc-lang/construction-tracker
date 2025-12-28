export const metadata = { title: 'Construction Project Manager' };
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, Arial', background:'#f9fafb' }}>{children}</body>
    </html>
  );
}
