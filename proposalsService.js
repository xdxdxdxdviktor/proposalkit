import { supabase } from './supabase.js'

export const proposalsService = {
  async getAll(userId) {
    const { data, error } = await supabase
      .from('proposals')
      .select('data')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data.map(row => row.data)
  },

  async save(userId, proposal) {
    const { error } = await supabase
      .from('proposals')
      .upsert({
        id: proposal.id,
        user_id: userId,
        data: proposal
      })

    if (error) throw error
  },

  async delete(proposalId) {
    const { error } = await supabase
      .from('proposals')
      .delete()
      .eq('id', proposalId)

    if (error) throw error
  },

  async getBySlug(slug) {
    const { data, error } = await supabase
      .from('proposals')
      .select('data')
      .eq('data->>slug', slug)
      .single()

    if (error) throw error
    return data.data
  },

  async updateStatus(proposalId, newStatus, extraData = {}) {
    const { data, error } = await supabase
      .from('proposals')
      .select('data')
      .eq('id', proposalId)
      .single()

    if (error) throw error

    const updated = { ...data.data, status: newStatus, ...extraData }

    const { error: updateError } = await supabase
      .from('proposals')
      .update({ data: updated })
      .eq('id', proposalId)

    if (updateError) throw updateError
  }
}
