// Catch navigation timeout errors.
//
// The errors are probably due to the fact that ads are still loading.
export async function catchNavigationTimeout(f : () => Promise<void>)
    : Promise<void> {
  try {
    await f();
    return;
  } catch (e) {
    if ((e as Error).message.indexOf('Navigation Timeout Exceeded') !== -1) {
      console.error(e);
      return;
    } else {
      throw e;
    }
  }
}

// Catch waiting timeout errors.
//
// The errors are probably due to the fact that ads are still loading.
export async function catchWaitingTimeout(f : () => Promise<void>)
    : Promise<void> {
  try {
    await f();
    return;
  } catch (e) {
    if ((e as Error).message.indexOf('waiting failed: timeout') !== -1) {
      console.error(e);
      return;
    } else {
      throw e;
    }
  }
}
