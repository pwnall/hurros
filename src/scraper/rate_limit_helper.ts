import * as puppeteer from 'puppeteer';

// Resolves to true if the page appears to be an HTML document.
//
// Rate-limiting currently results in a non-HTML document.
async function isHtmlDocument(page : puppeteer.Page)
    : Promise<boolean> {
  const title = await page.mainFrame().title();
  if (title && title !== '')
      return true;

  return await page.evaluate(() => {
    if (document.styleSheets.length !== 0)
      return true;
    if (document.doctype)
      return true;

    return false;
  });
}

const nonHtmlErrorMessage = "Non-HTML document received while crawling";

function delay(milliseconds : number) : Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, milliseconds); } );
}

// Throws an error if the page appears not to be an HTML document.
//
// Rate-limiting currently results in a non-HTML document.
export async function throwUnlessHtmlDocument(page : puppeteer.Page)
    : Promise<void> {

  if (!(await isHtmlDocument(page)))
    throw new Error(nonHtmlErrorMessage);
}

export async function retryWhileNonHtmlDocumentErrors<T>(f : () => Promise<T>)
    : Promise<T> {

  let backoff = 10 * 60 * 1000;  // 10 minutes
  const maxBackoff = 60 * 60 * 1000;  // 1 hour

  while (true) {
    try {
      return await f();
    } catch (e) {
      if ((e as Error).message !== nonHtmlErrorMessage)
        throw e;

      console.log('Non-HTML document received; most likely rate-limited');
      await delay(backoff);
      backoff = Math.min(maxBackoff, backoff * 2);
    }
  }
}