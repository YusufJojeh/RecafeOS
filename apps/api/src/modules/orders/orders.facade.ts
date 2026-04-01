/**
 * Allowed entry points for other Nest modules that must coordinate with orders
 * (e.g. kitchen). Prefer importing from here over deep orders internals.
 */
export { OrderLifecycleService } from './order-lifecycle.service';
