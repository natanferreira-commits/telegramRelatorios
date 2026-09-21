"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = {
  href: string;
  label: string;
  icon: React.ReactNode;
  soon?: boolean;
};

function Icon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[17px] w-[17px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

const FERRAMENTAS: Item[] = [
  {
    href: "/conteudo",
    label: "Conteúdo",
    icon: <Icon d="M4 4h16v4H4zM4 12h10v8H4zM17 12h3v8h-3z" />,
  },
  {
    href: "/comparar",
    label: "Comparar períodos",
    icon: <Icon d="M3 3v18h18M7 14l3-4 3 3 4-6" />,
  },
  {
    href: "/perfis",
    label: "Perfis",
    icon: (
      <Icon d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    ),
  },
];

const GESTAO: Item[] = [
  {
    href: "/fontes",
    label: "Fontes",
    icon: <Icon d="M21 6H3M18 12H6M14 18h-4" />,
  },
  {
    href: "/status",
    label: "Status da coleta",
    icon: <Icon d="M12 3v3M12 18v3M5 12H2M22 12h-3M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />,
  },
];

function NavLink({ item, active }: { item: Item; active: boolean }) {
  const inner = (
    <>
      <span className={active ? "text-lime" : "text-faint"}>{item.icon}</span>
      <span className="flex-1 truncate">{item.label}</span>
      {item.soon && (
        <span className="rounded-full border border-line px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-faint">
          em breve
        </span>
      )}
    </>
  );

  const base =
    "relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors";

  if (item.soon) {
    return (
      <div className={`${base} cursor-default text-faint`} aria-disabled>
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={`${base} ${
        active
          ? "bg-lime/10 text-ink before:absolute before:-left-3 before:top-2 before:bottom-2 before:w-[3px] before:rounded-r before:bg-lime before:content-['']"
          : "text-muted hover:bg-raise hover:text-ink"
      }`}
    >
      {inner}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside className="sticky top-0 hidden h-screen w-[236px] shrink-0 flex-col border-r border-line bg-[#0c110e] px-3.5 py-[18px] md:flex">
      <div className="flex items-center gap-2.5 px-2 pb-5">
        <div className="grid h-7 w-7 place-items-center rounded-lg bg-lime">
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="#06120c"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 7h18M3 7l1.5 12a2 2 0 0 0 2 1.7h11a2 2 0 0 0 2-1.7L21 7M9 7V5a3 3 0 0 1 6 0v2" />
          </svg>
        </div>
        <span className="text-[15px] font-bold tracking-tight">
          Radar <span className="text-lime">de Conteúdo</span>
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5">
        <p className="px-2.5 pb-1.5 pt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-faint">
          Ferramentas
        </p>
        {FERRAMENTAS.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} />
        ))}

        <p className="px-2.5 pb-1.5 pt-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-faint">
          Gestão
        </p>
        {GESTAO.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} />
        ))}
      </nav>

      <div className="mt-auto space-y-1 border-t border-linesoft pt-3.5">
        <div className="flex items-center gap-2 px-2.5 py-2 text-xs text-faint">
          <span className="inline-flex h-2 w-2 rounded-full bg-ok" />
          Coleta agendada
        </div>
        <a
          href="/api/logout"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium text-muted transition-colors hover:bg-raise hover:text-ink"
        >
          <span className="text-faint">
            <Icon d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </span>
          Sair
        </a>
      </div>
    </aside>
  );
}
