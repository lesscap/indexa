export type KnowledgeBaseListItem = {
  id: string
  name: string
  documents: number
}

export const KnowledgeBaseService = () => {
  const list = async (): Promise<KnowledgeBaseListItem[]> => {
    return []
  }

  return {
    list,
  }
}
