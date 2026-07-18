import { type ActivityItem } from '@oh/contracts';
export interface ActivityFeedProps {
    items: ActivityItem[];
    loading?: boolean;
    emptyText?: string;
    className?: string;
}
export declare function ActivityFeed({ items, loading, emptyText, className }: ActivityFeedProps): import("react").JSX.Element;
//# sourceMappingURL=activity-feed.d.ts.map