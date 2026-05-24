/**
 * API router — mounts all v2 route modules under /api/v2
 *
 * Route structure:
 *   /api/v2/auth         — authentication (register, login, refresh, logout, /me)
 *   /api/v2/branches     — branch management + working hours + appt config + chairs + statuses
 *   /api/v2/staff        — staff CRUD
 *   /api/v2/patients     — patients + all sub-resources
 *   /api/v2/appointments — appointments + slots + custom fields
 *   /api/v2/billing      — invoices + payments + ledger + summary
 *   /api/v2/inventory    — inventory items + transactions + alerts + reports
 *   /api/v2/settings      — clinic settings + treatment catalogue + patient custom fields + audit log
 *   /api/v2/analytics     — revenue, appointments, patients, procedures, doctors (Business+ plan)
 *   /api/v2/customisation — tooth notation, currency/tax, payment methods, modules, regional templates
 */
import { Router } from 'express'
import authRouter          from './auth'
import branchesRouter      from './branches'
import staffRouter         from './staff'
import patientsRouter      from './patients'
import appointmentsRouter  from './appointments'
import billingRouter       from './billing'
import inventoryRouter     from './inventory'
import settingsRouter      from './settings'
import analyticsRouter     from './analytics'
import customisationRouter from './customisation'

const apiRouter = Router()

apiRouter.use('/auth',          authRouter)
apiRouter.use('/branches',      branchesRouter)
apiRouter.use('/staff',         staffRouter)
apiRouter.use('/patients',      patientsRouter)
apiRouter.use('/appointments',  appointmentsRouter)
apiRouter.use('/billing',       billingRouter)
apiRouter.use('/inventory',     inventoryRouter)
apiRouter.use('/settings',      settingsRouter)
apiRouter.use('/analytics',     analyticsRouter)
apiRouter.use('/customisation', customisationRouter)

export default apiRouter
