import { useInfiniteQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { SCPage } from '@shared/types'
import { nextPage } from './api'

/** Infinite list over any api-v2 endpoint that paginates with `next_href`. */
export function usePaged<T>(key: unknown[], first: () => Promise<SCPage<T>>, enabled = true) {
  const query = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => (pageParam ? nextPage<T>(pageParam) : first()),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_href ?? undefined,
    enabled
  })
  const items = useMemo(() => query.data?.pages.flatMap((p) => p.collection) ?? [], [query.data])
  return { ...query, items }
}
