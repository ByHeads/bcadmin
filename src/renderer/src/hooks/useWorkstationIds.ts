import { useQuery } from '@tanstack/react-query'
import { useConnectionStore } from '@/stores/connection'

export function useWorkstationIds() {
  const { client } = useConnectionStore()

  return useQuery({
    queryKey: ['workstation-ids'],
    queryFn: async ({ signal }) => {
      if (!client) throw new Error('No client')
      const results = await client.get<{ WorkstationId: string }>(
        'Broadcaster.Admin.ReceiverLog',
        undefined,
        { select: 'WorkstationId' },
        signal
      )
      return results.map((r) => r.WorkstationId).sort()
    },
    enabled: !!client
  })
}
