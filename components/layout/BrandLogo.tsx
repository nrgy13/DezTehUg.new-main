export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center ${className}`}>
      <span className="text-2xl font-orbitron font-bold">
        <span className="text-red-500">ДЕЗ</span>
        <span className="text-green-500">ТЕХ</span>
        <span className="text-red-500">ЮГ</span>
      </span>
    </div>
  );
}