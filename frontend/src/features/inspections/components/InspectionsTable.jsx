import { useMemo } from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Eye, RefreshCw } from 'lucide-react';
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
  formatInspectionConfidence,
  formatInspectionDateTime,
  resolveInspectionDeviceLabel,
  resolveInspectionDiseaseLabel,
} from '@/features/inspections/utils';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

function formatLabel(value) {
  if (!value) {
    return 'N/A';
  }

  return String(value)
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
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

function InspectionsTableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}

function ToneBadge({ label, tone = 'neutral' }) {
  const toneClassName = {
    new: 'border-sky-200 bg-sky-50 text-sky-700',
    reviewed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    closed: 'border-slate-200 bg-slate-100 text-slate-700',
    pending: 'border-amber-200 bg-amber-50 text-amber-700',
    processing: 'border-blue-200 bg-blue-50 text-blue-700',
    completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    failed: 'border-rose-200 bg-rose-50 text-rose-700',
    neutral: 'border-border bg-background text-foreground',
  }[tone] || 'border-border bg-background text-foreground';

  return (
    <Badge variant="outline" className={cn('font-medium', toneClassName)}>
      {formatLabel(label)}
    </Badge>
  );
}

function resolveStatusTone(status) {
  if (status === 'new') {
    return 'new';
  }

  if (status === 'reviewed') {
    return 'reviewed';
  }

  if (status === 'closed') {
    return 'closed';
  }

  return 'neutral';
}

function resolveProcessingTone(status) {
  if (status === 'pending') {
    return 'pending';
  }

  if (status === 'processing') {
    return 'processing';
  }

  if (status === 'completed') {
    return 'completed';
  }

  if (status === 'failed') {
    return 'failed';
  }

  return 'neutral';
}

export default function InspectionsTable({
  inspections,
  totalCount,
  isLoading,
  isFetching,
  pageIndex,
  pageSize,
  sorting,
  selectedInspectionId,
  deviceMap,
  diseaseMap,
  onPaginationChange,
  onSortingChange,
  onSelectInspection,
  onRefresh,
}) {
  const { mode } = useThemeMode();
  const isLightMode = mode === 'light';
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const toolbarClassName = isLightMode
    ? 'rounded-xl border border-slate-200 bg-white/72 px-2.5 py-2 shadow-[0_10px_24px_rgba(15,23,42,0.04)]'
    : '';
  const tableShellClassName = isLightMode
    ? 'rounded-xl border border-slate-200 bg-white/84 shadow-[0_14px_30px_rgba(15,23,42,0.05)]'
    : 'rounded-md border border-border bg-card';
  const footerClassName = isLightMode
    ? 'rounded-xl border border-slate-200 bg-white/72 px-3 py-2.5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]'
    : '';
  const columns = useMemo(
    () => [
      {
        id: 'prediction',
        accessorFn: (row) => row.top1_label || resolveInspectionDiseaseLabel(row.predicted_disease, diseaseMap),
        header: 'Disease',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="min-w-[12rem]">
            <div className="truncate font-semibold text-foreground">
              {row.original.top1_label || resolveInspectionDiseaseLabel(row.original.predicted_disease, diseaseMap)}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {row.original.source_message_id || row.original.id}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'organ_type',
        header: 'Organ',
        enableSorting: false,
        cell: ({ row }) => (
          <Badge variant="outline" className="bg-background font-medium">
            {formatLabel(row.original.organ_type)}
          </Badge>
        ),
      },
      {
        id: 'device',
        header: 'Device',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="max-w-[15rem] truncate text-sm text-foreground">
            {resolveInspectionDeviceLabel(row.original.device, deviceMap)}
          </span>
        ),
      },
      {
        accessorKey: 'confidence_score',
        header: ({ column }) => <SortButton column={column}>Confidence</SortButton>,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm text-muted-foreground">
            {formatInspectionConfidence(row.original.confidence_score)}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        enableSorting: false,
        cell: ({ row }) => (
          <ToneBadge label={row.original.status} tone={resolveStatusTone(row.original.status)} />
        ),
      },
      {
        accessorKey: 'processing_status',
        header: 'Processing',
        enableSorting: false,
        cell: ({ row }) => (
          <ToneBadge
            label={row.original.processing_status}
            tone={resolveProcessingTone(row.original.processing_status)}
          />
        ),
      },
      {
        accessorKey: 'captured_at',
        header: ({ column }) => <SortButton column={column}>Captured</SortButton>,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatInspectionDateTime(row.original.captured_at)}
          </span>
        ),
      },
      {
        id: 'processed_or_updated',
        accessorFn: (row) => row.processed_at || row.updated_at,
        header: ({ column }) => <SortButton column={column}>Processed</SortButton>,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatInspectionDateTime(row.original.processed_at || row.original.updated_at)}
          </span>
        ),
      },
      {
        id: 'actions',
        enableSorting: false,
        header: 'Actions',
        cell: ({ row }) => (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={(event) => {
              event.stopPropagation();
              onSelectInspection(row.original);
            }}
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
            View
          </Button>
        ),
      },
    ],
    [deviceMap, diseaseMap, onSelectInspection],
  );

  // TanStack Table intentionally returns non-memoizable helpers.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: inspections,
    columns,
    pageCount,
    state: {
      pagination: { pageIndex, pageSize },
      sorting,
    },
    manualPagination: true,
    manualSorting: true,
    enableMultiSort: false,
    onPaginationChange,
    onSortingChange,
    getCoreRowModel: getCoreRowModel(),
  });
  const firstRow = totalCount === 0 ? 0 : pageIndex * pageSize + 1;
  const lastRow = Math.min(totalCount, (pageIndex + 1) * pageSize);

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
        <InspectionsTableSkeleton />
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
                    key={row.id}
                    data-state={selectedInspectionId === row.original.id ? 'selected' : undefined}
                    className={cn(
                      'cursor-pointer transition-colors',
                      isLightMode
                        ? 'hover:bg-emerald-50/55 data-[state=selected]:bg-emerald-50/80'
                        : '',
                    )}
                    onClick={() => onSelectInspection(row.original)}
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
                    No inspections match the current registry state.
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
            value={pageSize}
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
            Page {pageIndex + 1} of {pageCount}
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
