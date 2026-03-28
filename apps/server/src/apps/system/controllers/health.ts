import type { ApiResponse, WebApplication } from '../../../types.js'

export const HealthController = (app: WebApplication) => {
  app.get('/', async () => {
    const response: ApiResponse<{ status: string }> = {
      success: true,
      data: {
        status: 'ok',
      },
    }

    return response
  })
}
