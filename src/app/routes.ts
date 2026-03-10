import { createBrowserRouter } from 'react-router';
import { RootLayout } from './components/RootLayout';

export const router = createBrowserRouter([
  { path: '*', Component: RootLayout },
]);
