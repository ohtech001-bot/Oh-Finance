import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { History } from 'lucide-react';
import { Card, CardBody, ErrorState, PageHeader, Pagination } from '@oh/ui';
import { ApiRequestError } from '@/lib/api';
import { ActivityFeed } from './activity-feed';
import { useStoreActivityFeed } from './api';

export function ActivityPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const activity = useStoreActivityFeed({ page, pageSize });

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('nav.activity')}
        icon={History}
        breadcrumbs={[{ label: t('nav.dashboard'), href: '/' }, { label: t('nav.activity') }]}
        linkAs={Link}
      />

      <Card>
        <CardBody>
          {activity.isError ? (
            <ErrorState
              message={
                activity.error instanceof ApiRequestError
                  ? activity.error.message
                  : 'تعذّر تحميل سجل النشاط.'
              }
              requestId={
                activity.error instanceof ApiRequestError ? activity.error.requestId : undefined
              }
              onRetry={() => void activity.refetch()}
            />
          ) : (
            <ActivityFeed
              items={activity.data?.items ?? []}
              loading={activity.isLoading}
              emptyText="لا يوجد نشاط مسجل بعد."
            />
          )}
        </CardBody>
      </Card>

      {activity.data && activity.data.total > 0 ? (
        <Pagination
          page={activity.data.page}
          pageSize={activity.data.pageSize}
          total={activity.data.total}
          totalPages={activity.data.totalPages}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          itemLabel="نشاط"
        />
      ) : null}
    </div>
  );
}
