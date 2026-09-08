export default function DashboardFooter() {
  return (
    <footer className="border-t border-gray-200 bg-white px-6 py-3 print:hidden">
      <div className="flex flex-col gap-1 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between">
        <p>
          <span className="font-medium text-gray-700">Powered Data leap technologies</span>
        </p>
        <p>Authorized personnel only · All actions are logged</p>
      </div>
    </footer>
  );
}
