import { useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { Users, Monitor, Plus, Trash2, UserPlus, UserMinus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useConnectionStore } from '@/stores/connection'
import { useWorkstationIds } from '@/hooks/useWorkstationIds'

type WorkstationGroups = Record<string, string[]>

export function GroupsTab(): React.ReactNode {
  const { t } = useTranslation('replication')
  const { client, activeConnection, hasAccess } = useConnectionStore()
  const queryClient = useQueryClient()
  const canEdit = hasAccess('Broadcaster.Replication.WorkstationGroups', 'PATCH')

  const [newGroupName, setNewGroupName] = useState('')
  const [editingGroup, setEditingGroup] = useState<string | null>(null)
  const [addMemberInput, setAddMemberInput] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Fetch groups
  const { data: groupsData, isLoading, error } = useQuery({
    queryKey: ['workstation-groups', activeConnection?.id],
    queryFn: async ({ signal }) => {
      if (!client) throw new Error('No client')
      const results = await client.get<WorkstationGroups>(
        'Broadcaster.Replication.WorkstationGroups',
        undefined,
        undefined,
        signal
      )
      return results[0] ?? {}
    },
    enabled: !!client
  })

  // Fetch workstation IDs for member autocomplete
  const { data: allWorkstations } = useWorkstationIds()

  const groups = groupsData ?? {}
  const groupNames = Object.keys(groups).sort()

  // Create group mutation
  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!client) throw new Error('No client')
      if (groups[name]) throw new Error(`Group "${name}" already exists`)
      await client.patch('Broadcaster.Replication.WorkstationGroups', { [name]: [] })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workstation-groups'] })
      queryClient.invalidateQueries({ queryKey: ['replication-filter-groups'] })
      setNewGroupName('')
    }
  })

  // Delete group mutation
  const deleteMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!client) throw new Error('No client')
      await client.patch('Broadcaster.Replication.WorkstationGroups', { [name]: null })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workstation-groups'] })
      queryClient.invalidateQueries({ queryKey: ['replication-filter-groups'] })
      setDeleteConfirm(null)
      if (editingGroup === deleteConfirm) setEditingGroup(null)
    }
  })

  // Update members mutation
  const updateMembersMutation = useMutation({
    mutationFn: async ({ name, members }: { name: string; members: string[] }) => {
      if (!client) throw new Error('No client')
      await client.patch('Broadcaster.Replication.WorkstationGroups', { [name]: members })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workstation-groups'] })
      queryClient.invalidateQueries({ queryKey: ['replication-filter-groups'] })
    }
  })

  const handleCreateGroup = (): void => {
    const name = newGroupName.trim()
    if (!name) return
    createMutation.mutate(name)
  }

  const handleAddMember = (groupName: string): void => {
    const member = addMemberInput.trim()
    if (!member) return
    const current = groups[groupName] ?? []
    if (current.includes(member)) return
    updateMembersMutation.mutate({ name: groupName, members: [...current, member] })
    setAddMemberInput('')
  }

  const handleRemoveMember = (groupName: string, member: string): void => {
    const current = groups[groupName] ?? []
    updateMembersMutation.mutate({ name: groupName, members: current.filter((m) => m !== member) })
  }

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center text-muted">{t('state.loading', { ns: 'common' })}</div>
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-md bg-error/10 p-4 text-error">
          {error instanceof Error ? error.message : t('groups.error')}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="max-w-2xl space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t('groups.title')}</h2>
          <p className="mt-1 text-sm text-muted">
            {t('groups.description')}
          </p>
        </div>

        {/* Create group */}
        {canEdit && (
          <div className="flex gap-2">
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateGroup() }}
              placeholder={t('groups.newGroupPlaceholder')}
              className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
            />
            <button
              onClick={handleCreateGroup}
              disabled={!newGroupName.trim() || createMutation.isPending}
              className="flex items-center gap-2 rounded-md bg-accent px-4 pt-[7px] pb-[9px] text-sm font-medium text-white transition-colors hover:bg-accent/80 disabled:opacity-50"
            >
              <Plus size={16} />
              {t('groups.createGroup')}
            </button>
          </div>
        )}

        {createMutation.isError && (
          <div className="rounded-md bg-error/10 p-3 text-sm text-error">
            {createMutation.error instanceof Error ? createMutation.error.message : t('groups.createError')}
          </div>
        )}

        {/* Group list */}
        {groupNames.length === 0 ? (
          <div className="rounded-md border border-border p-8 text-center text-sm text-muted">
            {t('groups.empty')}
          </div>
        ) : (
          <div className="space-y-3">
            {groupNames.map((name) => {
              const members = groups[name] ?? []
              const isExpanded = editingGroup === name

              return (
                <div key={name} className="rounded-lg border border-border">
                  {/* Group header */}
                  <div
                    className="flex cursor-pointer items-center justify-between px-4 py-3 hover:bg-hover"
                    onClick={() => setEditingGroup(isExpanded ? null : name)}
                  >
                    <div className="flex items-center gap-3">
                      <Users size={16} className="text-accent" />
                      <span className="font-medium text-foreground">{name}</span>
                      <span className="text-xs text-muted">
                        {t('groups.memberCount', { count: members.length })}
                      </span>
                    </div>
                    {canEdit && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteConfirm(name)
                        }}
                        className="rounded p-1 text-muted transition-colors hover:bg-error/10 hover:text-error"
                        title={t('groups.deleteGroup')}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  {/* Expanded group detail */}
                  {isExpanded && (
                    <div className="border-t border-border px-4 py-3 space-y-3">
                      {/* Add member */}
                      {canEdit && (
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <input
                              type="text"
                              list={`ws-list-${name}`}
                              value={addMemberInput}
                              onChange={(e) => setAddMemberInput(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleAddMember(name) }}
                              placeholder={t('groups.addMemberPlaceholder')}
                              className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
                            />
                            {allWorkstations && (
                              <datalist id={`ws-list-${name}`}>
                                {allWorkstations
                                  .filter((ws) => !members.includes(ws))
                                  .map((ws) => <option key={ws} value={ws} />)}
                              </datalist>
                            )}
                          </div>
                          <button
                            onClick={() => handleAddMember(name)}
                            disabled={!addMemberInput.trim() || updateMembersMutation.isPending}
                            className="flex items-center gap-1 rounded-md bg-surface border border-border px-3 pt-[5px] pb-[7px] text-sm text-muted transition-colors hover:text-foreground disabled:opacity-50"
                          >
                            <UserPlus size={14} />
                            {t('button.add', { ns: 'common' })}
                          </button>
                        </div>
                      )}

                      {/* Member list */}
                      {members.length === 0 ? (
                        <div className="text-sm text-muted py-2">{t('groups.noMembers')}</div>
                      ) : (
                        <div className="max-h-48 overflow-y-auto rounded-md border border-border">
                          {members.sort().map((member) => (
                            <div
                              key={member}
                              className="flex items-center justify-between border-b border-border px-3 py-2 text-sm last:border-b-0"
                            >
                              <div className="flex items-center gap-2">
                                <Monitor size={14} className="text-muted" />
                                <span className="font-mono text-foreground">{member}</span>
                              </div>
                              {canEdit && (
                                <button
                                  onClick={() => handleRemoveMember(name, member)}
                                  disabled={updateMembersMutation.isPending}
                                  className="rounded p-1 text-muted transition-colors hover:bg-error/10 hover:text-error disabled:opacity-50"
                                  title={t('groups.removeMember')}
                                >
                                  <UserMinus size={14} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Delete confirmation dialog */}
        {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="mx-4 w-full max-w-sm rounded-lg border border-border bg-background p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-foreground">{t('groups.deleteTitle')}</h3>
              <p className="mt-2 text-sm text-muted">
                {t('groups.deleteMessage', { name: deleteConfirm })}
              </p>
              <div className="mt-4 flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  disabled={deleteMutation.isPending}
                  className="rounded-md border border-border px-4 pt-[7px] pb-[9px] text-sm font-medium text-muted transition-colors hover:text-foreground"
                >
                  {t('button.cancel', { ns: 'common' })}
                </button>
                <button
                  onClick={() => deleteMutation.mutate(deleteConfirm)}
                  disabled={deleteMutation.isPending}
                  className="rounded-md bg-error px-4 pt-[7px] pb-[9px] text-sm font-medium text-white transition-colors hover:bg-error/80 disabled:opacity-50"
                >
                  {deleteMutation.isPending ? t('state.deleting', { ns: 'common' }) : t('button.delete', { ns: 'common' })}
                </button>
              </div>
              {deleteMutation.isError && (
                <div className="mt-3 rounded-md bg-error/10 p-3 text-sm text-error">
                  {deleteMutation.error instanceof Error ? deleteMutation.error.message : t('groups.deleteError')}
                </div>
              )}
            </div>
          </div>
        )}

        {updateMembersMutation.isError && (
          <div className="rounded-md bg-error/10 p-3 text-sm text-error">
            {updateMembersMutation.error instanceof Error ? updateMembersMutation.error.message : t('groups.updateError')}
          </div>
        )}

        {!canEdit && (
          <div className="rounded-md bg-warning/10 p-3 text-sm text-warning">
            {t('groups.noPermission')}
          </div>
        )}
      </div>
    </div>
  )
}
