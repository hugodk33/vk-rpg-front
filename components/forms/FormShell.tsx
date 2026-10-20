"use client";

import Link from "next/link";
import TableTabs from "@/components/TableTabs";
import { useTranslation } from "@/lib/i18n";

/* ============================================================
   Moldura única das telas de criar/editar do Narrador.

   Antes cada form repetia `max-w-2xl mx-auto p-6` + cartão
   + título, sem nenhum caminho de volta: quem abria /advantage/new
   direto não tinha como saber de onde veio nem voltar. Aqui a
   trilha é sempre a mesma das listagens:

     Mesas › <mesa> › <recurso> › Novo | Editar

   Com `tableId` a moldura também assume a trilha de mesa
   (TableTabs); sem ele, fica só a trilha curta — usado quando o
   recurso ainda não tem mesa e a mesa é escolhida no próprio form.
   ============================================================ */

export interface FormCrumb {
  label: string;
  href?: string;
}

const chevron = (
  <svg className="w-3.5 h-3.5 text-zinc-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
  </svg>
);

export function FormBreadcrumbs({ crumbs }: { crumbs: FormCrumb[] }) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t("nav.breadcrumb")} className="flex items-center gap-1.5 text-sm mb-4 flex-wrap">
      {crumbs.map((crumb, index) => {
        const last = index === crumbs.length - 1;
        return (
          <span key={`${crumb.label}-${index}`} className="inline-flex items-center gap-1.5">
            {index > 0 ? chevron : null}
            {crumb.href && !last ? (
              <Link href={crumb.href} className="text-zinc-500 hover:text-zinc-200 transition-colors">
                {crumb.label}
              </Link>
            ) : (
              <span className={last ? "text-zinc-200" : "text-zinc-500"} aria-current={last ? "page" : undefined}>
                {crumb.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

interface FormShellProps {
  /** Ausente quando o recurso ainda não está ligado a uma mesa. */
  tableId?: string;
  tableTitle?: string;
  /** Chave i18n do recurso (ex.: "nav.advantages"). */
  resourceLabel: string;
  /** Chave i18n da ação: "fr.adv.newTitle" / "fr.adv.editTitle". */
  actionLabel: string;
  /** Título já pronto para exibição (normalmente `t(actionLabel)`). */
  title: string;
  subtitle?: string;
  /** Sobrescreve/estende a trilha automática. */
  extraCrumbs?: FormCrumb[];
  /** Campos mais largos que o padrão de leitura. */
  wide?: boolean;
  /** Modo embutido: sem breadcrumbs/título/card — usado dentro de outra tela. */
  embedded?: boolean;
  children: React.ReactNode;
}

export default function FormShell({
  tableId,
  tableTitle,
  resourceLabel,
  actionLabel,
  title,
  subtitle,
  extraCrumbs,
  wide,
  embedded = false,
  children,
}: FormShellProps) {
  const { t } = useTranslation();

  if (embedded) return <>{children}</>;

  const crumbs: FormCrumb[] = tableId
    ? [
        { label: t("nav.tables"), href: "/narrator" },
        { label: tableTitle || t("nav.table"), href: `/table/${tableId}` },
        { label: t(resourceLabel), href: `/table/${tableId}/${resourceHref(resourceLabel)}` },
        ...(extraCrumbs ?? []),
        { label: t(actionLabel) },
      ]
    : [
        { label: t("nav.tables"), href: "/narrator" },
        ...(extraCrumbs ?? []),
        { label: t(actionLabel) },
      ];

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* A trilha sobe para cima da barra e o link "voltar" do TableTabs
         sai: "Mesas" ja e o primeiro crumb, entao os dois diziam a mesma
         coisa em posicoes opostas. */}
      <FormBreadcrumbs crumbs={crumbs} />

      {tableId ? <TableTabs tableId={tableId} hideBreadcrumb /> : null}

      {/* Mesma moldura do formulário de personagem: cabeçalho com filete
         verde, sem o cartão envolvendo os campos. */}
      <header className="mt-8 border-l-2 border-green-600 pl-5">
        <p className="font-mono uppercase tracking-[0.14em] text-[11px] text-green-400">
          {t(resourceLabel)}
        </p>
        <div className="mt-2 flex items-baseline gap-3 flex-wrap">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100">{title}</h1>
          {tableTitle ? <span className="text-sm text-zinc-500">{tableTitle}</span> : null}
        </div>
        {subtitle ? <p className="mt-1 text-sm text-zinc-500">{subtitle}</p> : null}
      </header>

      <div className={wide ? "mt-6" : "mt-6 max-w-2xl"}>{children}</div>
    </div>
  );
}

/** Deriva o segmento de rota da listagem a partir da chave i18n do recurso. */
function resourceHref(resourceLabel: string): string {
  switch (resourceLabel) {
    case "nav.advantages":
      return "advantages";
    case "nav.disadvantages":
      return "disadvantages";
    case "nav.skills":
      return "skills";
    case "nav.items":
      return "items";
    case "nav.characters":
      return "characters";
    case "nav.locations":
      return "locations";
    default:
      return "";
  }
}
