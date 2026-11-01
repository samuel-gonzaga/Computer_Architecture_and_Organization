import type { ExecutionStats } from "./stats";

const percent = (value: number) => `${(value * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const decimal = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

/** Estatísticas: ciclos, instruções e o ganho da cache em relação a uma execução sem cache. */
export function StatsPanel({ stats }: { stats: ExecutionStats }) {
  const tiles = [
    { label: "Ciclos de clock", value: String(stats.totalCycles) },
    { label: "Instruções executadas", value: String(stats.instructions) },
    { label: "Microetapas", value: String(stats.microSteps) },
    { label: "Ciclos por instrução (CPI)", value: stats.cyclesPerInstruction === undefined ? "—" : decimal(stats.cyclesPerInstruction) },
    { label: "Acertos na cache (HIT)", value: String(stats.hits) },
    { label: "Faltas na cache (MISS)", value: String(stats.misses) },
    { label: "Taxa de acerto", value: stats.hits + stats.misses === 0 ? "—" : percent(stats.hitRate) },
    { label: "Ciclos economizados pela cache", value: String(stats.savedCycles) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-md border border-line p-3">
            <dt className="text-xs text-ink-muted">{tile.label}</dt>
            <dd className="font-mono text-2xl font-semibold">{tile.value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-ink-muted">
        Sem a cache, esta mesma execução levaria <strong className="text-ink">{stats.cyclesWithoutCache}</strong> ciclos:
        cada acerto evita os 4 ciclos de espera da RAM. Leituras de E/S e escritas não entram na taxa de acerto.
      </p>
    </div>
  );
}
