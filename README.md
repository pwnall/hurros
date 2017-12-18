# hotslogs.com Scraper

## Setup

```bash
npm install
createdb hurros
```

### Dependencies

The scraping and serving code uses [node.js](https://nodejs.org/) and
[npm](https://www.npmjs.com/), [PostgreSQL](https://www.postgresql.org/), and
[puppeteer](https://github.com/GoogleChrome/puppeteer). The latter downloads its
own version of [Google Chrome](https://www.google.com/chrome), but still needs
the libraries required by Chrome.

The cluster bringup code uses [Ansible](https://github.com/ansible/ansible) for
deployment and [Vagrant](https://github.com/hashicorp/vagrant) for testing.

The following commands set up the dependencies on Fedora. Vagrant has to be
downloaded from [its site](https://www.vagrantup.com/downloads.html) and
installed manually.

```bash
sudo dnf install -y ansible libselinux-python libvirt-devel python2-shade
sudo dnf install -y chromium nodejs npm postgresql-devel postgresql-server
sudo systemctl enable postgresql
sudo systemctl start postgresql

# After installing Vagrant.

sudo gpasswd -a ${USER} libvirt
newgrp libvirt
vagrant plugin install vagrant-libvirt
```

## Operations

Run the system.

```bash
npm start
```