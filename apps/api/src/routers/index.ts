/**
 * API router — mounts all v2 route modules under /api/v2
 *
 * Route structure:
 *   /api/v2/auth          — Clerk-based authentication + staff profile
 *   /api/v2/branches      — branch management + working hours + appt config + chairs
 *   /api/v2/staff         — staff CRUD + invites
 *   /api/v2/patients      — patients + allergies + medications + dental chart
 *   /api/v2/appointments  — appointments + slots + custom fields
 *   /api/v2/billing       — invoices + payments + ledger
 *   /api/v2/inventory     — items + transactions + alerts
 *   /api/v2/settings      — clinic settings + treatment catalogue + audit log
 *   /api/v2/analytics     — revenue, appointments, patients, procedures, doctors (Business+)
 *   /api/v2/customisation — notation, currency/tax, payment methods, modules, templates
 */
import { Hono } from 'hono'
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

export const apiRouter = new Hono()

apiRouter.route('/auth',          authRouter)
apiRouter.route('/branches',      branchesRouter)
apiRouter.route('/staff',         staffRouter)
apiRouter.route('/patients',      patientsRouter)
apiRouter.route('/appointments',  appointmentsRouter)
apiRouter.route('/billing',       billingRouter)
apiRouter.route('/inventory',     inventoryRouter)
apiRouter.route('/settings',      settingsRouter)
apiRouter.route('/analytics',     analyticsRouter)
apiRouter.route('/customisation', customisationRouter)
