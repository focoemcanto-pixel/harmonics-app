import Sidebar from './Sidebar';
import Header from './Header';

export default function AppShell({ title, children }) {
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="flex min-h-screen">
        <div className="hidden md:block">
          <Sidebar />
        </div>

        <main className="flex-1">
          <div className="mx-auto max-w-7xl px-4 py-4 md:px-8 md:py-8">
            <Header title={title} />
            <div className="space-y-5 md:space-y-6">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}