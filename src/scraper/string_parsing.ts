import * as moment from 'moment';

// Parses durations expressed as "3 days 02 hours 10 minutes".
export function parseDaysDuration(value : string) : number | null {
  const match =
      /(\d+)\s*days.*\D(\d+)\s*hours.*\D(\d+)\s*minutes/i.exec(value);
  if (!match) return null;
  const days = parseInt(match[1]);
  const hours = parseInt(match[2]);
  const minutes = parseInt(match[3]);
  return (days * 24 + hours) * 60 + minutes;
};

// Parses comma-separated numbers, like "1,234,567".
export function parseFormattedNumber(value : string) : number | null {
  value = value.replace(',', '').trim();
  if (value.length == 0)
    return null;
  return parseFloat(value);
}

// Parses durations expressed as "03:59:59".
export function parseHoursDuration(value : string) : number | null {
  const match =
    /(\d+)\s*:\s*(\d+)\s*:\s*(\d+)\s*/.exec(value);
  if (!match) return null;
  const hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const seconds = parseInt(match[3]);
  return (hours * 60 + minutes) * 60 + seconds;
};

// Extracts an MMR rating from text that looks like "... (MMR: 1234)".
export function parseMmr(value : string) : number | null {
  const match = /mmr:\s*(\d+)/i.exec(value);
  if (!match) return null;
  return parseInt(match[1]);
}

// Parses a percentage such as "12.34 %" as 0.1234.
export function parsePercentage(value : string) : number | null {
  const match = /(\d+\.?\d*)\s*\%/i.exec(value);
  if (!match) return null;
  return parseFloat(match[1]) / 100.0;
}

// Parses a date-and-time such as "	5/14/2015 3:43:38 AM".
//
// The input's time zone is assumed to be UTC.
export function parseTimestamp(value : string) : Date | null {
  return moment.utc(value, 'M/D/YYYY h:m:s a').toDate();
}
