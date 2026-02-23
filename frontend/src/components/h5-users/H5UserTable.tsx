"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import {
  type ColumnDef,
  type OnChangeFn,
  type SortingState,
  type Updater,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import {
  DataTable,
  type DataTableEmptyState,
} from "@/components/tables/DataTable";
import { dateCell } from "@/components/tables/cell-formatters";
import { useTranslation } from "@/lib/i18n";

export type H5UserRow = {
  id: string;
  username: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

type H5UserTableProps = {
  users: H5UserRow[];
  isLoading?: boolean;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  stickyHeader?: boolean;
  emptyState?: Omit<DataTableEmptyState, "icon"> & {
    icon?: DataTableEmptyState["icon"];
  };
};

const DEFAULT_EMPTY_ICON = (
  <svg
    className="h-16 w-16 text-slate-300"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700",
  suspended: "bg-amber-50 text-amber-700",
  deleted: "bg-rose-50 text-rose-700",
};

export function H5UserTable({
  users,
  isLoading = false,
  sorting,
  onSortingChange,
  stickyHeader = false,
  emptyState,
}: H5UserTableProps) {
  const { t } = useTranslation();
  const [internalSorting, setInternalSorting] = useState<SortingState>([
    { id: "created_at", desc: true },
  ]);
  const resolvedSorting = sorting ?? internalSorting;
  const handleSortingChange: OnChangeFn<SortingState> =
    onSortingChange ??
    ((updater: Updater<SortingState>) => {
      setInternalSorting(updater);
    });

  const columns = useMemo<ColumnDef<H5UserRow>[]>(
    () => [
      {
        accessorKey: "username",
        header: t("h5Users.username"),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <Link
              href={`/h5-users/${row.original.id}`}
              className="text-sm font-medium text-slate-900 hover:underline"
            >
              {row.original.username}
            </Link>
            {row.original.display_name ? (
              <p className="text-xs text-slate-500">
                {row.original.display_name}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "email",
        header: t("common.email"),
        cell: ({ row }) => (
          <span className="text-sm text-slate-600">
            {row.original.email ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: t("common.status"),
        cell: ({ row }) => {
          const style =
            STATUS_STYLES[row.original.status] ?? "bg-slate-100 text-slate-600";
          return (
            <span
              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}
            >
              {t(`h5Users.status.${row.original.status}`) !== `h5Users.status.${row.original.status}`
                ? t(`h5Users.status.${row.original.status}`)
                : row.original.status}
            </span>
          );
        },
      },
      {
        accessorKey: "last_login_at",
        header: t("h5Users.lastLogin"),
        cell: ({ row }) =>
          row.original.last_login_at
            ? dateCell(row.original.last_login_at)
            : <span className="text-slate-400">—</span>,
      },
      {
        accessorKey: "created_at",
        header: t("common.created"),
        cell: ({ row }) => dateCell(row.original.created_at),
      },
    ],
    [t],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: users,
    columns,
    state: { sorting: resolvedSorting },
    onSortingChange: handleSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <DataTable
      table={table}
      isLoading={isLoading}
      stickyHeader={stickyHeader}
      rowClassName="transition hover:bg-slate-50"
      cellClassName="px-6 py-4 align-top"
      rowActions={{
        getEditHref: (row) => `/h5-users/${row.id}`,
      }}
      emptyState={
        emptyState
          ? {
              icon: emptyState.icon ?? DEFAULT_EMPTY_ICON,
              title: emptyState.title,
              description: emptyState.description,
              actionHref: emptyState.actionHref,
              actionLabel: emptyState.actionLabel,
            }
          : undefined
      }
    />
  );
}
