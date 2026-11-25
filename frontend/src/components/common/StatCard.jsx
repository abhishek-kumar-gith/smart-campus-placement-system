function StatCard({ label, value, tone = 'blue' }) {
  const tones = {
    blue: 'text-primary-700',
    green: 'text-emerald-700',
    amber: 'text-amber-700',
    slate: 'text-slate-700',
  };
  return <div className="card">
    <p className="text-sm text-gray-500">{label}</p>
    <p className={`mt-2 text-3xl font-bold ${tones[tone] || tones.blue}`}>{value ?? 0}</p>
  </div>;
}

export default StatCard;
