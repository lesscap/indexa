import type { ApiResponse, WebApplication } from '../../../types.js'
import { KnowledgeBaseService } from '../services/knowledge-base.js'

export const KnowledgeBaseController = (app: WebApplication) => {
  const service = KnowledgeBaseService()

  app.get('/', async () => {
    const list = await service.list()

    const response: ApiResponse<{ list: typeof list }> = {
      success: true,
      data: {
        list,
      },
    }

    return response
  })
}
