import { useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useThemeMode } from '@/theme-mode-context';
import {
  formatReviewDateTime,
  resolveReviewerLabel,
} from '@/features/review/utils';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

function formatLabel(value, fallback = 'N/A') {
  if (!value) {
    return fallback;
  }

  return String(value)
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatConfidencePercent(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'N/A';
  }

  return `${Math.round(value * 100)}%`;
}

function resolveHistoryDiseaseLabel(inspection, diseaseMap) {
  if (inspection?.top1_label) {
    return inspection.top1_label;
  }

  if (inspection?.predicted_disease) {
    return diseaseMap.get(inspection.predicted_disease)?.name || inspection.predicted_disease;
  }

  return 'Unknown disease';
}

function resolveHistoryDeviceLabel(inspection, deviceMap) {
  if (!inspection?.device) {
    return 'Unknown device';
  }

  const device = deviceMap.get(inspection.device);
  if (!device) {
    return inspection.device;
  }

  return device.identifier ? `${device.name} (${device.identifier})` : device.name;
}

function SortButton({ column, children }) {
  const sorted = column.getIsSorted();

  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 font-semibold text-foreground hover:text-primary"
      onClick={column.getToggleSortingHandler()}
    >
      {children}
      <span className="w-3 text-xs text-muted-foreground">
        {sorted === 'asc' ? '^' : sorted === 'desc' ? 'v' : ''}
      </span>
    </button>
  );
}

function HistoryTableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}

function DecisionBadge({ decision }) {
  const toneClassName = {
    accepted: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    corrected: 'border-amber-200 bg-amber-50 text-amber-700',
    rejected: 'border-rose-200 bg-rose-50 text-rose-700',
  }[decision] || 'border-border bg-background text-foreground';

  return (
    <Badge variant="outline" className={cn('font-medium', toneClassName)}>
      {formatLabel(decision)}
    </Badge>
  );
}

function OrganBadge({ organType }) {
  return (
    <Badge variant="outline" className="bg-background font-medium">
      {formatLabel(organType)}
    </Badge>
  );
}

export default function ReviewedHistoryTable({
  items,
  isLoading,
  isFetching,
  selectedReviewId,
  diseaseMap,
  deviceMap,
  onSelectItem,
  onRefresh,
}) {
  const { mode } = useThemeMode();
  const isLightMode = mode === 'light';
  const [sorting, setSorting] = useState([
    {
      id: 'reviewed_at',
      desc: true,
    },
  ]);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });

  const columns = useMemo(
    () => [
      {
        id: 'disease',
        accessorFn: (row) => resolveHistoryDiseaseLabel(row.inspection, diseaseMap),
        header: 'Disease',
        cell: ({ row }) => (
          <div className="min-w-[12rem]">
            <div className="truncate font-semibold text-foreground">
              {resolveHistoryDiseaseLabel(row.original.inspection, diseaseMap)}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {row.original.inspection?.id || row.original.review.inspection}
            </div>
          </div>
        ),
      },
      {
        id: 'decision',
        accessorKey: 'review.decision',
        header: 'Decision',
        cell: ({ row }) => <DecisionBadge decision={row.original.review.decision} />,
      },
      {
        id: 'organ',
        accessorFn: (row) => row.inspection?.organ_type || '',
        header: 'Organ',
        cell: ({ row }) => <OrganBadge organType={row.original.inspection?.organ_type} />,
      },
      {
        id: 'confidence',
        accessorFn: (row) => row.inspection?.confidence_score ?? -1,
        header: ({ column }) => <SortButton column={column}>Confidence</SortButton>,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm text-muted-foreground">
            {formatConfidencePercent(row.original.inspection?.confidence_score)}
          </span>
        ),
      },
      {
        id: 'device',
        accessorFn: (row) => resolveHistoryDeviceLabel(row.inspection, deviceMap),
        header: 'Device',
        cell: ({ row }) => (
          <span className="block max-w-[15rem] truncate text-sm text-foreground">
            {resolveHistoryDeviceLabel(row.original.inspection, deviceMap)}
          </span>
        ),
      },
      {
        id: 'reviewed_by',
        accessorFn: (row) => resolveReviewerLabel(row.review),
        header: 'Reviewed by',
        cell: ({ row }) => (
          <span className="block max-w-[12rem] truncate text-sm text-foreground">
            {resolveReviewerLabel(row.original.review)}
          </span>
        ),
      },
      {
        id: 'reviewed_at',
        accessorFn: (row) => row.review.reviewed_at || row.review.created_at || '',
        header: ({ column }) => <SortButton column={column}>Reviewed at</SortButton>,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatReviewDateTime(row.original.review.reviewed_at || row.original.review.created_at)}
          </span>
        ),
      },
    ],
    [deviceMap, diseaseMap],
  );

  // TanStack Table intentionally returns non-memoizable helpers.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: items,
    columns,
    state: {
      sorting,
      pagination,
    },
    enableMultiSort: false,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const totalCount = items.length;
  const pageCount = Math.max(1, table.getPageCount());
  const firstRow = totalCount === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
  const lastRow = totalCount === 0
    ? 0
    : Math.min(totalCount, (pagination.pageIndex + 1) * pagination.pageSize);
  const toolbarClassName = isLightMode
    ? 'rounded-xl border border-slate-200 bg-white/72 px-2.5 py-2 shadow-[0_10px_24px_rgba(15,23,42,0.04)]'
    : '';
  const tableShellClassName = isLightMode
    ? 'overflow-x-auto rounded-xl border border-slate-200 bg-white/84 shadow-[0_14px_30px_rgba(15,23,42,0.05)]'
    : 'overflow-x-auto rounded-md border border-border bg-card';
  const footerClassName = isLightMode
    ? 'rounded-xl border border-slate-200 bg-white/72 px-3 py-2.5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]'
    : '';

  return (
    <div className="space-y-3">
      <div className={cn('flex items-start justify-end', toolbarClassName)}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={onRefresh}
          disabled={isFetching}
        >
          <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <HistoryTableSkeleton />
      ) : (
        <div className={tableShellClassName}>
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent">
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className={cn('h-10 whitespace-nowrap px-3', isLightMode && 'bg-slate-50/80 text-slate-600')}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.original.review.id}
                    data-state={selectedReviewId === row.original.review.id ? 'selected' : undefined}
                    className={cn(
                      'cursor-pointer transition-colors',
                      isLightMode
                        ? 'hover:bg-emerald-50/55 focus-visible:bg-emerald-50/55 data-[state=selected]:bg-emerald-50/80'
                        : 'hover:bg-muted/40 focus-visible:bg-muted/40',
                    )}
                    onClick={() => onSelectItem(row.original)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSelectItem(row.original);
                      }
                    }}
                    tabIndex={0}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="px-3 py-2.5">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-28 text-center text-muted-foreground">
                    No reviewed history records are available yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <div className={cn('flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between', footerClassName)}>
        <span>
          Showing {firstRow}-{lastRow} of {totalCount}
        </span>
        <div className="flex items-center gap-2">
          <select
            value={pagination.pageSize}
            onChange={(event) => table.setPageSize(Number(event.target.value))}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option} rows
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <span className="whitespace-nowrap">
            Page {pagination.pageIndex + 1} of {pageCount}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
