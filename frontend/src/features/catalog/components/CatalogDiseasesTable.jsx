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

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const FILTER_SELECT_CLASS = 'h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

function formatDateTime(value) {
  if (!value) {
    return 'N/A';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

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

function CatalogDiseasesTableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}

function RiskBadge({ value }) {
  return (
    <Badge variant="outline" className="border-border bg-background font-medium">
      {formatLabel(value)}
    </Badge>
  );
}

export default function CatalogDiseasesTable({
  diseases,
  totalCount,
  isLoading,
  isFetching,
  pageIndex,
  pageSize,
  sorting,
  organTypeFilter,
  selectedDiseaseId,
  onPaginationChange,
  onSortingChange,
  onOrganTypeFilterChange,
  onSelectDisease,
  onRefresh,
}) {
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const columns = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => <SortButton column={column}>Disease</SortButton>,
        cell: ({ row }) => (
          <div className="min-w-[12rem]">
            <div className="truncate font-semibold text-foreground">
              {row.original.name || 'N/A'}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {row.original.id}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'organ_type',
        header: ({ column }) => <SortButton column={column}>Organ</SortButton>,
        cell: ({ row }) => <RiskBadge value={row.original.organ_type} />,
      },
      {
        accessorKey: 'ai_label',
        header: ({ column }) => <SortButton column={column}>AI Label</SortButton>,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-foreground">
            {row.original.ai_label || 'N/A'}
          </span>
        ),
      },
      {
        accessorKey: 'slug',
        header: ({ column }) => <SortButton column={column}>Slug</SortButton>,
        cell: ({ row }) => (
          <span className="max-w-[14rem] truncate font-mono text-xs text-muted-foreground">
            {row.original.slug || 'N/A'}
          </span>
        ),
      },
      {
        id: 'risk_level',
        header: 'Risk',
        enableSorting: false,
        cell: ({ row }) => <RiskBadge value={row.original.map_profile?.risk_level} />,
      },
      {
        id: 'zone_type',
        header: 'Zone',
        enableSorting: false,
        cell: ({ row }) => <RiskBadge value={row.original.map_profile?.zone_type} />,
      },
      {
        accessorKey: 'updated_at',
        header: ({ column }) => <SortButton column={column}>Updated</SortButton>,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatDateTime(row.original.updated_at)}
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
              onSelectDisease(row.original);
            }}
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
            View
          </Button>
        ),
      },
    ],
    [onSelectDisease],
  );

  // TanStack Table intentionally returns non-memoizable helpers.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: diseases,
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
      <div className="flex flex-col gap-2 xl:flex-row xl:items-start xl:justify-between">
        <div className="grid gap-2 sm:grid-cols-[minmax(11rem,12rem)]">
          <select
            value={organTypeFilter}
            onChange={(event) => onOrganTypeFilterChange(event.target.value)}
            className={FILTER_SELECT_CLASS}
          >
            <option value="">All organs</option>
            <option value="fruit">Fruit</option>
            <option value="leaf">Leaf</option>
          </select>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 self-start xl:self-auto"
          onClick={onRefresh}
          disabled={isFetching}
        >
          <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <CatalogDiseasesTableSkeleton />
      ) : (
        <div className="rounded-md border border-border bg-card">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent">
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="h-10 whitespace-nowrap px-3">
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
                    data-state={selectedDiseaseId === row.original.id ? 'selected' : undefined}
                    className="cursor-pointer"
                    onClick={() => onSelectDisease(row.original)}
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
                    No diseases match the current catalog filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
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
