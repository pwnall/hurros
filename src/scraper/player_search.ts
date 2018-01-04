// (unfinished) The URL of a page with the results of a name search.
//
// If the given name uniquely identifies a hotslogs profile, the URL redirects
// to the player profile. Otherwise, the URL renders a search results page.
//
export function profileSearchURL(playerName : string) : string {
  return `https://hotslogs.com/PlayerSearch?Name=${playerName}`;
}

// TODO(pwnall): Distinguish between profile and search results, and parse the
//               search results.