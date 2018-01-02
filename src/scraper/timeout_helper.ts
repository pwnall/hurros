// True if the given error is a puppeteer navigation timeout error.
function isNavigationTimeoutError(error : Error) : boolean {
  return error.message.indexOf('Navigation Timeout Exceeded') !== -1;
}

// True if the given error is a puppeteer wait timeout error.
function isWaitTimeoutError(error : Error) : boolean {
  return error.message.indexOf('waiting failed: timeout') !== -1;
}

// Catch navigation timeout errors.
//
// The errors are probably due to the fact that ads are still loading.
export async function catchNavigationTimeout<T>(f : () => Promise<T>)
    : Promise<T | null> {
  try {
    return await f();
  } catch (e) {
    if (isNavigationTimeoutError(e as Error)) {
      console.error(e);
      return null;
    } else {
      throw e;
    }
  }
}

// Catch waiting timeout errors.
//
// The errors are probably due to the fact that ads are still loading.
//
// Returns null if a timeout error is caught and suppressed.
export async function catchWaitingTimeout<T>(f : () => Promise<T>)
    : Promise<T | null> {
  try {
    return await f();
  } catch (e) {
    if (isWaitTimeoutError(e as Error)) {
      console.error(e);
      return null;
    } else {
      throw e;
    }
  }
}

function delay(milliseconds : number) : Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, milliseconds); } );
}

export async function retryWhileNavigationTimeout<T>(f: () => Promise<T>)
    : Promise<T> {
  let backoff = 30 * 1000;  //  30 seconds
  const maxBackoff = 5 * 60 * 1000;  // 5 minutes

  while (true) {
    try {
      return await f();
    } catch (e) {
      if (!isNavigationTimeoutError(e))
        throw e;

      console.log('Navigation timeout; may be Internet connection troubles');
      await delay(backoff);
      backoff = Math.min(maxBackoff, backoff * 2);
    }
  }
}