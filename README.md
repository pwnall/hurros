# hotslogs.com Scraper

## Setup

```bash
npm install
createdb hurros
```

### Dependencies

This uses [node.js](https://nodejs.org/) and [npm](https://www.npmjs.com/),
[PostgreSQL](https://www.postgresql.org/), and
[puppeteer](https://github.com/GoogleChrome/puppeteer). The latter downloads its
own version of [Google Chrome](https://www.google.com/chrome), but still needs
the libraries required by Chrome.

The following commands set up the dependencies on Fedora.

```bash
sudo dnf install -y chromium nodejs npm postgresql-devel postgresql-server
sudo systemctl enable postgresql
sudo systemctl start postgresql
```
