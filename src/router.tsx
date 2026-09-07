import { createBrowserRouter } from 'react-router-dom';
import LocalModePage from './pages/LocalModePage';
import SupabaseModePage from './pages/SupabaseModePage';

const router = createBrowserRouter([
  {
    path: '/',
    element: <LocalModePage />,
  },
  {
    path: '/supabase',
    element: <SupabaseModePage />,
  },
]);

export default router;
