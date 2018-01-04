// Signal that the puppeteer target is sending rate-limit exceeded responses.
//
// For example, this class (or a subclass of it) should be thrown when a HTTP
// 429 code is received.
//
// ResourceManager gives special treatment to this exception class, such as
// exponentially increasing wait periods between retrying the function that
// errored out.
export class RateLimitError extends Error {
  constructor(message : string) {
    super(message);
  }
}

// Signal that the puppeteer target is experiencing a temporary error.
//
// For example, this class (or a subclass of it) should be thrown when a HTTP
// 500 code is received, or when a timeout is exceeded.
//
// ResourceManager gives special treatment to this exception class, such as
// retrying the function that errored out.
//
// ResourceManager also uses isNavigationTimeoutError() and isWaitTimeoutError()
// to recognize puppeteer's timeout exceptions as temporary exceptions, so it
// shouldn't be necessary to wrap puppeteer's functions and remap their errors.
export class TemporaryError extends Error {
  constructor(message : string) {
    super(message);
  }
}

// True if the given error is a puppeteer navigation timeout error.
export function isNavigationTimeoutError(error : Error) : boolean {
  return error.message.includes('Navigation Timeout Exceeded');
}

// True if the given error is a puppeteer wait timeout error.
export function isWaitTimeoutError(error : Error) : boolean {
  return error.message.includes('waiting failed: timeout');
}

// True if the given error is a rate-limiting exception.
//
// ResourceManager gives special treatment to exceptions recognized by this,
// such as exponentially increasing wait periods between retrying the function that
// errored out.
export function isRateLimitedError(error : Error) : boolean {
  return error instanceof RateLimitError;
}

// True if the given error is a temporary exception.
//
// ResourceManager gives special treatment to exceptions recognized by this,
// such as retrying the function that errored out.
export function isTemporaryError(error : Error) : boolean {
  return (error instanceof TemporaryError) || isNavigationTimeoutError(error) ||
         isWaitTimeoutError(error);
}

// Mask temporary exceptions thrown by the given async function.
//
// This should be used when it might still be possible to construct a partial
// answer in the presence of a timeout error, and the partial answer is
// preferable to retrying and to not having an answer at all.
//
// If successful, forwards the return value of the given asynchronous function.
// If an exception is masked
export async function catchTemporaryError<T>(f : () => Promise<T>)
    : Promise<T | null> {
  try {
    return await f();
  } catch (e) {
    if (isTemporaryError(e as Error)) {
      console.error(e);
      return null;
    } else {
      throw e;
    }
  }
}