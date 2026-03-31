import { DocumentsController } from './controllers/documents.js'
import { LibrariesController } from './controllers/libraries.js'
import { SessionController } from './controllers/session.js'
import { TusUploadsController } from './controllers/tus-uploads.js'
import { UploadSessionsController } from './controllers/uploads.js'

export const Routes = {
  '/api/console/session': SessionController,
  '/api/console/libraries': LibrariesController,
  '/api/console/libraries/:libraryId/documents': DocumentsController,
  '/api/console/libraries/:libraryId/uploads': UploadSessionsController,
  '/api/console/uploads': TusUploadsController,
}
