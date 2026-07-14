// ── الأدوات ──────────────────────────────────────────────────────────────────
export { cn } from './lib/cn.js';

// ── البدائيات ────────────────────────────────────────────────────────────────
export { Button, buttonVariants, type ButtonProps } from './primitives/button.js';
export { Input, Field, type InputProps, type FieldProps } from './primitives/input.js';
export {
  Skeleton,
  TableSkeleton,
  StatCardsSkeleton,
  CardSkeleton,
} from './primitives/skeleton.js';
export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  Drawer,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  ConfirmDialog,
  type ConfirmDialogProps,
} from './primitives/dialog.js';
export {
  Card,
  CardHeader,
  CardBody,
  Avatar,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  Separator,
  Switch,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  type AvatarProps,
} from './primitives/misc.js';

// ── الأنماط ──────────────────────────────────────────────────────────────────
export { MoneyText, type MoneyTextProps, type MoneyTone } from './patterns/money-text.js';
export {
  StatusBadge,
  TENANT_STATUS_BADGE,
  SUBSCRIPTION_STATUS_BADGE,
  USER_STATUS_BADGE,
  ORDER_STATUS_BADGE,
  ACCOUNT_STATUS_BADGE,
  type StatusBadgeProps,
} from './patterns/status-badge.js';
export { StatCard, type StatCardProps, type StatTone } from './patterns/stat-card.js';
export {
  EmptyState,
  NoResultsState,
  ErrorState,
  PendingFeatureState,
  type EmptyStateProps,
  type ErrorStateProps,
  type PendingFeatureStateProps,
} from './patterns/states.js';
export { DataTable, type Column, type DataTableProps } from './patterns/data-table.js';
export { Pagination, type PaginationProps } from './patterns/pagination.js';
export {
  FilterBar,
  SearchFilter,
  SelectFilter,
  DateRangeFilter,
  AdvancedFilterButton,
} from './patterns/filter-bar.js';
export {
  Breadcrumbs,
  PageHeader,
  type Crumb,
  type BreadcrumbsProps,
  type PageHeaderProps,
} from './patterns/breadcrumbs.js';

// ── الإشعارات ────────────────────────────────────────────────────────────────
export { toast, Toaster } from './patterns/toast.js';
