import { createHashRouter } from 'react-router';
import { RootLayout } from './components/RootLayout';

// Hash router (not browser router): works under a GitHub Pages project sub-path
// (/Marketingtools/) and from a local file:// single-file build, where the
// History API path routing would 404 / break. Routes become #/guidelines etc.;
// RootLayout's `location.pathname === '/guidelines'` check still holds.
export const router = createHashRouter([
  { path: '*', Component: RootLayout },
]);
