export function SetupPage() {
  return (
    <div className="min-h-dvh grid place-items-center px-4">
      <div className="max-w-lg rounded-3xl bg-zinc-900 border border-zinc-800 p-6 space-y-3 text-sm text-zinc-300">
        <h1 className="text-xl font-bold text-zinc-100">Connect Supabase</h1>
        <p>SetSmart needs a Supabase project. To finish setup:</p>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Create a project at supabase.com.</li>
          <li>
            Run the SQL files in <code className="text-accent">supabase/migrations</code> in the SQL editor, in
            order.
          </li>
          <li>
            Copy <code className="text-accent">apps/web/.env.example</code> to{' '}
            <code className="text-accent">apps/web/.env.local</code> and fill in your project URL and anon key.
          </li>
          <li>Restart the dev server.</li>
        </ol>
      </div>
    </div>
  )
}
