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

### Scraping Cluster

hotslogs.com uses rate-limiting, and the limits are low enough that scraping
using a single Chrome tab gets rate-limited (HTTP 429) responses fairly quickly.
Speeding up scraping requires a cluster of machines with different public IPs.

This project has built-in support for deploying and using a cluster on
OpenStack. Some of the support should still work under other platforms.

First, copy `deploy/ansible/cloud.yaml.example` to `deploy/ansible/cloud.yaml`,
and replace the fake credentials with working credentials for an OpenStack
setup. Then follow the steps below to bring up and use a cluster.

Bring up VMs.

```bash
ansible-playbook -e worker_count=5 deploy/ansible/openstack_up.yml
```

Set up the software on the VMs.

```bash
ansible-playbook deploy/ansible/prod.yml
```

Create an entire cluster map.

```bash
deploy/ansible/inventory/openstack.py --list > os_cluster.json
```

## Operations

Run the system.

```bash
npm start
```

Start up a local scraping cluster for development.

```bash
vagrant up
vagrant provision
```