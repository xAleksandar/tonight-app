import { NextResponse } from 'next/server';

const STATUS_CODE_TO_DEFAULT_CODE: Record<number, string> = {
  400: 'bad_request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
  422: 'unprocessable_entity',
  429: 'too_many_requests',
  500: 'internal_server_error',
  502: 'bad_gateway',
  503: 'service_unavailable',
};

export type ErrorResponseOptions = {
  message: string;
  status?: number;
  code?: string;
  context?: string;
  errors?: Record<string, string>;
  details?: Record<string, unknown>;
  cause?: unknown;
  log?: boolean;
};

const inferErrorCode = (status: number) => {
  return STATUS_CODE_TO_DEFAULT_CODE[status] ?? 'error';
};

const logApiError = (options: {
  context?: string;
  message: string;
  status: number;
  code: string;
  errors?: Record<string, string>;
  details?: Record<string, unknown>;
  cause?: unknown;
}) => {
  const { context, message, status, code, errors, details, cause } = options;
  const logContext = context ? `[${context}] ` : '';
  const payload: Record<string, unknown> = {
    status,
    code,
    message,
  };

  if (errors) {
    payload.errors = errors;
  }

  if (details) {
    payload.details = details;
  }

  if (cause instanceof Error) {
    console.error(`${logContext}${message}`, {
      ...payload,
      stack: cause.stack ?? cause.message,
    });
    return;
  }

  if (cause) {
    console.error(`${logContext}${message}`, {
      ...payload,
      cause,
    });
    return;
  }

  console.error(`${logContext}${message}`, payload);
};

export const createErrorResponse = (options: ErrorResponseOptions) => {
  const status = options.status ?? 500;
  const code = options.code ?? inferErrorCode(status);
  const shouldLog = typeof options.log === 'boolean' ? options.log : status >= 500;

  if (shouldLog) {
    logApiError({
      context: options.context,
      message: options.message,
      status,
      code,
      errors: options.errors,
      details: options.details,
      cause: options.cause,
    });
  }

  return NextResponse.json(
    {
      success: false,
      error: options.message,
      code,
      ...(options.errors ? { errors: options.errors } : {}),
      ...(options.details ? { details: options.details } : {}),
    },
    { status }
  );
};

export const handleRouteError = (
  error: unknown,
  context: string,
  message = 'Unable to complete the request.',
  status = 500,
  code?: string
) => {
  return createErrorResponse({
    status,
    message,
    context,
    code,
    cause: error,
  });
};
