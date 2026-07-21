import { Navigate, useParams } from 'react-router-dom';

export function OrderDetailsPage() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={id ? `/orders?orderId=${id}` : '/orders'} replace />;
}
