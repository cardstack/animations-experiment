import { getReasonPhrase } from 'http-status-codes';
import { createResponse } from './create-response';
import { Realm } from './realm';
export interface ErrorDetails {
  status?: number;
  title?: string;
  responseText?: string;
  source?: {
    pointer?: string;
    header?: string;
    parameter?: string;
  };
}

export interface SerializedError {
  detail: string;
  status: number;
  title?: string;
  source?: ErrorDetails['source'];
  additionalErrors: any[] | null;
  isCardError?: true;
  deps?: string[];
  stack?: string;
}

export type ErrorReporter = (error: Error) => void;

let globalWithErrorReporter = global as typeof globalThis & {
  __boxelErrorReporter: ErrorReporter;
};

export function setErrorReporter(reporter: ErrorReporter) {
  globalWithErrorReporter.__boxelErrorReporter = reporter;
}

export function reportSentryError(error: Error) {
  console.error('====> attempting to report error', error);
  if (globalWithErrorReporter.__boxelErrorReporter) {
    globalWithErrorReporter.__boxelErrorReporter(error);
  }
}

export class CardError extends Error implements SerializedError {
  detail: string;
  status: number;
  title?: string;
  source?: ErrorDetails['source'];
  responseText?: string;
  isCardError: true = true;
  additionalErrors: (CardError | Error)[] | null = null;
  deps?: string[];

  constructor(
    detail: string,
    { status, title, source, responseText }: ErrorDetails = {},
  ) {
    super(detail);
    this.detail = detail;
    this.status = status || 500;
    this.title = title || getReasonPhrase(this.status);
    this.responseText = responseText;
    this.source = source;
  }
  toJSON() {
    return {
      title: this.title,
      detail: this.detail,
      code: this.status,
      source: this.source,
      stack: this.stack,
    };
  }

  static fromSerializableError(err: any): any {
    if (!err || typeof err !== 'object' || !isCardError(err)) {
      return err;
    }
    let result = new CardError(err.detail, {
      status: err.status,
      title: err.title,
      source: err.source,
    });
    result.stack = err.stack;
    if (err.additionalErrors) {
      result.additionalErrors = err.additionalErrors.map((inner) =>
        CardError.fromSerializableError(inner),
      );
    }
    return result;
  }

  static async fromFetchResponse(
    url: string,
    response: Response,
  ): Promise<CardError> {
    if (!response.ok) {
      let text = await response.text();
      let maybeErrorJSON: any;
      try {
        maybeErrorJSON = text ? JSON.parse(text) : undefined;
      } catch (err) {
        /* it's ok if we can't parse it*/
      }
      if (
        maybeErrorJSON &&
        typeof maybeErrorJSON === 'object' &&
        'errors' in maybeErrorJSON &&
        Array.isArray(maybeErrorJSON.errors) &&
        maybeErrorJSON.errors.length > 0
      ) {
        return CardError.fromSerializableError(maybeErrorJSON.errors[0]);
      }
      return new CardError(
        `unable to fetch ${url}${!maybeErrorJSON ? ': ' + text : ''}`,
        {
          title: response.statusText,
          status: response.status,
          responseText: text,
        },
      );
    }
    throw new CardError(
      `tried to create a card error from a successful fetch response from ${url}, status ${
        response.status
      }, with body: ${await response.text()}`,
    );
  }
}

export function isCardError(err: any): err is CardError {
  return err != null && typeof err === 'object' && err.isCardError;
}

export function printCompilerError(err: any) {
  if (isAcceptableError(err)) {
    return String(err);
  }

  return `${err.message}\n\n${err.stack}`;
}

function isAcceptableError(err: any) {
  return err.isCardstackError || err.code === 'BABEL_PARSE_ERROR';
}

export function serializableError(err: any): any {
  if (!err || typeof err !== 'object' || !isCardError(err)) {
    // rely on the best-effort serialization that we'll get from, for example,
    // "pg" as it puts this object into jsonb
    return err;
  }

  let result = Object.assign({}, err, { stack: err.stack });
  result.additionalErrors =
    result.additionalErrors?.map((inner) => serializableError(inner)) ?? null;
  return result;
}

export function responseWithError(realm: Realm, error: CardError): Response {
  return createResponse(
    realm,
    JSON.stringify({ errors: [serializableError(error)] }),
    {
      status: error.status,
      statusText: error.title,
      headers: { 'content-type': 'application/json' },
    },
  );
}

export function methodNotAllowed(realm: Realm, request: Request): Response {
  return responseWithError(
    realm,
    new CardError(`${request.method} not allowed for ${request.url}`, {
      status: 405,
    }),
  );
}

export function notFound(
  realm: Realm,
  request: Request,
  message = `Could not find ${request.url}`,
): Response {
  return responseWithError(realm, new CardError(message, { status: 404 }));
}

export function badRequest(realm: Realm, message: string): Response {
  return responseWithError(realm, new CardError(message, { status: 400 }));
}

export function systemUnavailable(realm: Realm, message: string): Response {
  return responseWithError(realm, new CardError(message, { status: 503 }));
}

export function systemError(
  realm: Realm,
  message: string,
  additionalError?: CardError | Error,
): Response {
  let err = new CardError(message, { status: 500 });
  if (additionalError) {
    err.additionalErrors = [additionalError];
  }
  return responseWithError(realm, err);
}
