import { useMemo } from 'react';
import {
  DeleteOutlineRounded as DeleteOutlineRoundedIcon,
  EditOutlined as EditOutlinedIcon,
  RoomOutlined as RoomOutlinedIcon,
} from '@mui/icons-material';
import { IconButton, Tooltip } from '@mui/material';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { RefreshCw } from 'lucide-react';
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
import { useThemeMode } from '@/theme-mode-context';

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

function ActionIconButton({
  icon,
  title,
  ariaLabel,
  onClick,
  isLightMode,
}) {
  return (
    <Tooltip title={title} arrow>
      <IconButton
        size="small"
        aria-label={ariaLabel}
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        sx={{
          width: 30,
          height: 30,
          borderRadius: 1.5,
          color: isLightMode ? '#475569' : 'rgba(226, 232, 240, 0.92)',
          border: '1px solid',
          borderColor: isLightMode ? 'rgba(203, 213, 225, 0.92)' : 'rgba(255, 255, 255, 0.12)',
          bgcolor: isLightMode ? 'rgba(255, 255, 255, 0.92)' : 'rgba(255, 255, 255, 0.04)',
          '&:hover': {
            borderColor: isLightMode ? 'rgba(148, 163, 184, 0.4)' : 'rgba(255, 255, 255, 0.2)',
            bgcolor: isLightMode ? 'rgba(248, 250, 252, 0.98)' : 'rgba(255, 255, 255, 0.08)',
          },
        }}
      >
        {icon}
      </IconButton>
    </Tooltip>
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
  isAdmin,
  onEditDevice,
  onDeleteDevice,
  onShowDeviceOnMap,
}) {
  const { mode } = useThemeMode();
  const isLightMode = mode === 'light';
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const toolbarClassName = isLightMode
    ? 'rounded-xl border border-slate-200 bg-white/72 p-2.5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]'
    : '';
  const tableShellClassName = isLightMode
    ? 'rounded-xl border border-slate-200 bg-white/84 shadow-[0_14px_30px_rgba(15,23,42,0.05)]'
    : 'rounded-md border border-border bg-card';
  const footerClassName = isLightMode
    ? 'rounded-xl border border-slate-200 bg-white/72 px-3 py-2.5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]'
    : '';
  const stickyActionCellClassName = isLightMode
    ? 'sticky right-0 z-10 border-l border-slate-200/90 bg-white/96'
    : 'sticky right-0 z-10 border-l border-border/80 bg-card';
  const stickyActionHeaderClassName = isLightMode
    ? 'sticky right-0 z-20 border-l border-slate-200/90 bg-slate-50/95'
    : 'sticky right-0 z-20 border-l border-border/80 bg-card';
  const columns = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => <SortButton column={column}>Device</SortButton>,
        cell: ({ row }) => (
          <div className="max-w-[11rem]">
            <div className="truncate text-sm font-semibold text-foreground">
              {row.original.name || <EmptyValue />}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'identifier',
        header: ({ column }) => <SortButton column={column}>Identifier</SortButton>,
        cell: ({ row }) => (
          <span className="block max-w-[11rem] truncate font-mono text-xs text-foreground">
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
          <span className="block max-w-[12rem] truncate text-sm text-muted-foreground xl:max-w-[14rem]">
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
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => (
          <div className="flex min-w-[6.75rem] items-center justify-end gap-1">
            {isAdmin ? (
              <>
                <ActionIconButton
                  title="Edit device"
                  ariaLabel={`Edit device ${row.original.name || row.original.identifier || row.original.id}`}
                  icon={<EditOutlinedIcon sx={{ fontSize: 17 }} />}
                  onClick={() => onEditDevice(row.original)}
                  isLightMode={isLightMode}
                />
                <ActionIconButton
                  title="Delete device"
                  ariaLabel={`Delete device ${row.original.name || row.original.identifier || row.original.id}`}
                  icon={<DeleteOutlineRoundedIcon sx={{ fontSize: 17 }} />}
                  onClick={() => onDeleteDevice(row.original)}
                  isLightMode={isLightMode}
                />
              </>
            ) : null}
            <ActionIconButton
              title="Show on map"
              ariaLabel={`Show device ${row.original.name || row.original.identifier || row.original.id} on map`}
              icon={<RoomOutlinedIcon sx={{ fontSize: 17 }} />}
              onClick={() => onShowDeviceOnMap(row.original)}
              isLightMode={isLightMode}
            />
          </div>
        ),
      },
    ],
    [isAdmin, isLightMode, onDeleteDevice, onEditDevice, onShowDeviceOnMap],
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
      <div className={cn('flex flex-col gap-2 xl:flex-row xl:items-start xl:justify-between', toolbarClassName)}>
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
        <div className={tableShellClassName}>
          <Table className="min-w-full">
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent">
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className={cn(
                        'h-10 whitespace-nowrap px-2.5',
                        header.column.id === 'actions' && 'text-right',
                        header.column.id === 'name' && 'w-[13%] min-w-[9rem]',
                        header.column.id === 'identifier' && 'w-[14%] min-w-[9rem]',
                        header.column.id === 'site_name' && 'w-[10%] min-w-[7rem]',
                        header.column.id === 'greenhouse_name' && 'w-[11%] min-w-[7.5rem]',
                        header.column.id === 'zone_name' && 'w-[10%] min-w-[7rem]',
                        header.column.id === 'line_name' && 'w-[10%] min-w-[7rem]',
                        header.column.id === 'description' && 'w-[17%] min-w-[9rem]',
                        header.column.id === 'updated_at' && 'w-[11%] min-w-[8.5rem]',
                        header.column.id === 'actions' && cn('w-[8rem] min-w-[8rem]', stickyActionHeaderClassName),
                        isLightMode && 'bg-slate-50/80 text-slate-600',
                      )}
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
                    data-state={selectedDeviceId === row.original.id ? 'selected' : undefined}
                    className={cn(
                      'cursor-pointer transition-colors',
                      isLightMode
                        ? 'hover:bg-emerald-50/55 focus-visible:bg-emerald-50/55 data-[state=selected]:bg-emerald-50/80'
                        : 'hover:bg-muted/40 focus-visible:bg-muted/40',
                    )}
                    onClick={() => onSelectDevice(row.original)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSelectDevice(row.original);
                      }
                    }}
                    tabIndex={0}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          'px-2.5 py-2.5',
                          cell.column.id === 'actions' && stickyActionCellClassName,
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={table.getAllLeafColumns().length} className="h-28 text-center text-muted-foreground">
                    No devices match the current table filters.
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
