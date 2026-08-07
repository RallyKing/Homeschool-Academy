export default function OfflinePage() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col justify-center gap-3 text-center">
      <h1 className="text-2xl font-semibold text-neutral-900">You&apos;re offline</h1>
      <p className="text-neutral-600">
        Homeschool Academy needs a connection for live data. Check your network
        and try again.
      </p>
    </div>
  );
}
