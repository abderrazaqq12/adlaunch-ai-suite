import { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { ZodError } from 'zod'

export interface BrainErrorResponse {
    error: string
    message: string
    context?: Record<string, any>
}

export class BrainError extends HTTPException {
    public context?: Record<string, any>

    constructor(message: string, context?: Record<string, any>, status: 400 | 401 | 403 | 500 = 400) {
        super(status, { message })
        this.context = context
    }
}

export const errorHandler = (err: Error, c: Context) => {
    let status = 500
    let error = 'Internal Server Error'
    let message = 'An unexpected error occurred'
    let context: Record<string, any> | undefined

    if (err instanceof BrainError) {
        status = err.status
        error = status === 400 ? 'Bad Request' : status === 401 ? 'Unauthorized' : status === 403 ? 'Forbidden' : 'Internal Server Error'
        message = err.message
        context = err.context
    } else if (err instanceof ZodError) {
        status = 400
        error = 'Validation Error'
        message = 'Input validation failed'
        context = { issues: err.errors }
    } else if (err instanceof HTTPException) {
        status = err.status
        message = err.message
    }

    return c.json({
        error,
        message,
        context
    } as BrainErrorResponse, status as any)
}
