import type { ReactNode } from 'react'
import type { CacheNode } from '../../../shared/lib/app-router-context'
import type { FlightRouterState } from '../../../server/app-render'

import { CacheStates } from '../../../shared/lib/app-router-context'
import { createHrefFromUrl } from './create-href-from-url'

export interface InitialRouterStateParameters {
  initialTree: FlightRouterState
  initialCanonicalUrl: string
  children: ReactNode
  initialParallelRoutes: CacheNode['parallelRoutes']
  isServer: boolean
  location: Location | null
}

export function createInitialRouterState({
  initialTree,
  children,
  initialCanonicalUrl,
  initialParallelRoutes,
  isServer,
  location,
}: InitialRouterStateParameters) {
  return {
    tree: initialTree,
    cache: {
      status: CacheStates.READY,
      data: null,
      subTreeData: children,
      parallelRoutes: isServer ? new Map() : initialParallelRoutes,
    } as CacheNode,
    prefetchCache: new Map(),
    pushRef: { pendingPush: false, mpaNavigation: false },
    focusAndScrollRef: { apply: false },
    canonicalUrl:
      // location.href is read as the initial value for canonicalUrl in the browser
      // This is safe to do as canonicalUrl can't be rendered, it's only used to control the history updates in the useEffect further down in this file.
      location
        ? // window.location does not have the same type as URL but has all the fields createHrefFromUrl needs.
          createHrefFromUrl(location)
        : initialCanonicalUrl,
  }
}
