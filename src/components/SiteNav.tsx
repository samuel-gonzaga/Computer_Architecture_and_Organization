import Link from "next/link";

const PAGES = [
  { href: "/", label: "Simulador" },
  { href: "/tour", label: "Tour guiado" },
  { href: "/sobre", label: "Sobre" },
] as const;

/** Navegação entre as páginas do app. */
export function SiteNav({ current }: { current: (typeof PAGES)[number]["href"] }) {
  return (
    <nav aria-label="Páginas">
      <ul className="flex flex-wrap gap-1">
        {PAGES.map((page) => {
          const isCurrent = page.href === current;
          return (
            <li key={page.href}>
              <Link
                href={page.href}
                aria-current={isCurrent ? "page" : undefined}
                className={`block rounded-md px-3 py-1.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                  isCurrent ? "bg-ink text-paper" : "text-ink-muted hover:text-ink"
                }`}
              >
                {page.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
