import { useMemo } from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Eye, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

function EmptyValue() {
  return <span className="text-muted-foreground">N/A</span>;
}

function HierarchyBadge({ children }) {
  return (
    <Badge variant="outline" className="max-w-[12rem] truncate border-border bg-background font-medium">
      {children || 'N/A'}
    </Badge>
  );
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

function DevicesTableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}

export default function DevicesTable({
  devices,
  totalCount,
  isLoading,
  isFetching,
  pageIndex,
  pageSize,
  sorting,
  search,
  siteFilter,
  greenhouseFilter,
  zoneFilter,
  lineFilter,
  siteOptions,
  greenhouseOptions,
  zoneOptions,
  lineOptions,
  selectedDeviceId,
  onPaginationChange,
  onSortingChange,
  onSearchChange,
  onSiteFilterChange,
  onGreenhouseFilterChange,
  onZoneFilterChange,
  onLineFilterChange,
  onSelectDevice,
  onRefresh,
}) {
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const columns = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => <SortButton column={column}>Device</SortButton>,
        cell: ({ row }) => (
          <div className="min-w-[12rem]">
            <div className="truncate font-semibold text-foreground">
              {row.original.name || <EmptyValue />}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {row.original.id}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'identifier',
        header: ({ column }) => <SortButton column={column}>Identifier</SortButton>,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-foreground">
            {row.original.identifier || 'N/A'}
          </span>
        ),
      },
      {
        accessorKey: 'site_name',
        header: ({ column }) => <SortButton column={column}>Site</SortButton>,
        cell: ({ row }) => <HierarchyBadge>{row.original.site_name}</HierarchyBadge>,
      },
      {
        accessorKey: 'greenhouse_name',
        header: ({ column }) => <SortButton column={column}>Greenhouse</SortButton>,
        cell: ({ row }) => <HierarchyBadge>{row.original.greenhouse_name}</HierarchyBadge>,
      },
      {
        accessorKey: 'zone_name',
        header: ({ column }) => <SortButton column={column}>Zone</SortButton>,
        cell: ({ row }) => <HierarchyBadge>{row.original.zone_name}</HierarchyBadge>,
      },
      {
        accessorKey: 'line_name',
        header: ({ column }) => <SortButton column={column}>Line</SortButton>,
        cell: ({ row }) => <HierarchyBadge>{row.original.line_name}</HierarchyBadge>,
      },
      {
        accessorKey: 'description',
        enableSorting: false,
        header: 'Description',
        cell: ({ row }) => (
          <span className="line-clamp-2 max-w-[16rem] text-sm text-muted-foreground">
            {row.original.description || 'No description'}
          </span>
        ),
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
              onSelectDevice(row.original);
            }}
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
            View
          </Button>
        ),
      },
    ],
    [onSelectDevice],
  );
  // TanStack Table intentionally returns non-memoizable helpers.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: devices,
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
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(16rem,1.2fr)_repeat(4,minmax(9rem,12rem))]">
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search name or identifier..."
            className="h-9"
          />
          <select
            value={siteFilter}
            onChange={(event) => onSiteFilterChange(event.target.value)}
            className={FILTER_SELECT_CLASS}
          >
            <option value="">All sites</option>
            {siteOptions.map((site) => (
              <option key={site.id} value={site.id}>
                {site.label}
              </option>
            ))}
          </select>
          <select
            value={greenhouseFilter}
            onChange={(event) => onGreenhouseFilterChange(event.target.value)}
            className={FILTER_SELECT_CLASS}
          >
            <option value="">All greenhouses</option>
            {greenhouseOptions.map((greenhouse) => (
              <option key={greenhouse.id} value={greenhouse.id}>
                {greenhouse.label}
              </option>
            ))}
          </select>
          <select
            value={zoneFilter}
            onChange={(event) => onZoneFilterChange(event.target.value)}
            className={FILTER_SELECT_CLASS}
          >
            <option value="">All zones</option>
            {zoneOptions.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.label}
              </option>
            ))}
          </select>
          <select
            value={lineFilter}
            onChange={(event) => onLineFilterChange(event.target.value)}
            className={FILTER_SELECT_CLASS}
          >
            <option value="">All lines</option>
            {lineOptions.map((line) => (
              <option key={line.id} value={line.id}>
                {line.label}
              </option>
            ))}
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
        <DevicesTableSkeleton />
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
                    data-state={selectedDeviceId === row.original.id ? 'selected' : undefined}
                    className="cursor-pointer"
                    onClick={() => onSelectDevice(row.original)}
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
                    No devices match the current table filters.
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
