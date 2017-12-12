import * as puppeteer from 'puppeteer';

// The low-level workhorse of data extraction.
//
// This iterates over an HTML table and extracts its textual information.
//
// The includeHeading argument should be set to true whenever the table's content
// does not include cell descriptions. Conditioning parsing on cell descriptions
// makes the code resilient to cell reordering.
//
// The information is usually stored directly in table cells. In some cases, the
// information is actually displayed as icons. Fortunately, in all the cases we
// care about, the icons are not accompanied by any text. So, for each cell
// without text, the alt text of the cell's image is extracted instead.
export async function extractTableText(
    table : puppeteer.ElementHandle, includeHeading : boolean)
    : Promise<string[][]> {
  return await table.executionContext().evaluate(
      (chromeTable : HTMLTableElement, withTh : boolean) => {
    const rowsData : string[][] = [];
    const pullRow = (tr : HTMLTableRowElement) => {
      const rowData: string[] = [];
      rowsData.push(rowData);
      for (let element of tr.querySelectorAll('td, th')) {
        if (element.parentElement !== tr)
          continue;

        let text = element.textContent;
        if (text.trim().length === 0) {
          const img = element.querySelector('img[alt]');
          if (img)
            text = img.getAttribute('alt');
        }
        rowData.push(text);
      }
    };
    if (withTh) {
      for (let row of chromeTable.querySelectorAll('thead > tr'))
        pullRow(row as HTMLTableRowElement);
    }
    for (let row of chromeTable.querySelectorAll('tbody > tr'))
      pullRow(row as HTMLTableRowElement);
    return rowsData;
  }, table, includeHeading);
}
