import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';

// Re-export FORMATS so existing imports from './App' still work
export { FORMATS } from './formats';

const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="32" fill="#ff3b30"/>
  <g transform="translate(14,14)" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M28.5 7.5a7.07 7.07 0 0 0-11.46 1.73L24 16.18l-3.54 3.54-6.95-6.95A7.07 7.07 0 0 0 7.5 28.5l12-12"/>
    <path d="M14 21l-7.5 7.5a2.5 2.5 0 0 0 3.54 3.54L17.5 24.5"/>
    <path d="M22 15l7.5-7.5a2.5 2.5 0 0 1 3.54 3.54L25.5 18.5"/>
  </g>
</svg>`;

export default function App() {
  useEffect(() => {
    const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement
      || document.createElement('link');
    link.type = 'image/svg+xml';
    link.rel = 'icon';
    link.href = `data:image/svg+xml,${encodeURIComponent(FAVICON_SVG)}`;
    document.head.appendChild(link);
  }, []);

  return <RouterProvider router={router} />;
}