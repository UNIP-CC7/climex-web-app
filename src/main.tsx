import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { ThemeProvider } from 'styled-components'
import 'leaflet/dist/leaflet.css'
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css'
import 'react-leaflet-cluster/dist/assets/MarkerCluster.Default.css'
import { GlobalStyle } from '@/components/GlobalStyle'
import { CACHE_MAX_AGE, persistOptions } from '@/lib/persist'
import { router } from '@/routes'
import { theme } from '@/theme'

// gcTime precisa ser pelo menos o tempo do cache salvo, senão a memória descarta antes de o disco expirar.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15_000, gcTime: CACHE_MAX_AGE, retry: 2, retryDelay: (n) => Math.min(1000 * 2 ** n, 8000), refetchOnWindowFocus: true },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <RouterProvider router={router} />
      </PersistQueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
