import { createBrowserRouter } from 'react-router-dom';
import LocalModePage from './pages/LocalModePage';
import SupabaseAuthPage from './pages/SupabaseAuthPage';
import SupabaseCustomerPage from './pages/SupabaseCustomerPage';
import SupabaseAdminPage from './pages/SupabaseAdminPage';

const router = createBrowserRouter([
  {
    path: '/',
    element: <LocalModePage />,
  },
  {
    path: '/supabase',
    element: <SupabaseAuthPage />,
  },
  {
    path: '/supabase/signup',
    element: <SupabaseAuthPage mode="signup" />,
  },
  {
    path: '/supabase/customer',
    element: <SupabaseCustomerPage />,
  },
  {
    path: '/supabase/admin',
    element: <SupabaseAdminPage />,
  },
]);

export default router;
