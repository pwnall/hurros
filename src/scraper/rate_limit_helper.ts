import * as puppeteer from 'puppeteer';
import { RateLimitError } from '../cluster/errors';

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

// Throws a RateLimitError if the page appears not to be an HTML document.
//
// hotslogs currently renders a non-HTML document when rate-limiting.
export async function throwUnlessHtmlDocument(page : puppeteer.Page)
    : Promise<void> {

  if (!(await isHtmlDocument(page)))
    throw new RateLimitError(nonHtmlErrorMessage);
}