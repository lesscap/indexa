import { DocumentsController } from './controllers/documents.js'
import { LibrariesController } from './controllers/libraries.js'
import { SessionController } from './controllers/session.js'

export const Routes = {
  '/api/console/session': SessionController,
  '/api/console/libraries': LibrariesController,
  '/api/console/libraries/:libraryId/documents': DocumentsController,
}
