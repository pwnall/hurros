import * as fs from 'fs';
import * as util from 'util';

import fetch from 'node-fetch';
import { throttledAsyncMap } from './throttled_async_map';

const readFileAsync = util.promisify(fs.readFile);

// Extracts a list of IPs from an Ansible OpenStack inventory dump.
async function readOpenStackIPs(
    inventoryDumpPath : string, osPrefixes : string[]) : Promise<string[]> {
  let data;
  try {
    const jsonText =
        await readFileAsync(inventoryDumpPath, { encoding: 'utf8' });
    data = JSON.parse(jsonText);
  } catch(e) {
    return [];
  }

  const ips = [];
  for (let osPrefix of osPrefixes) {
    const hostNames = data[`meta-system_role_${osPrefix}_worker`] || [];
    for (let hostName of hostNames) {
      const hostVars = data._meta.hostvars[hostName];
      if (hostVars && hostVars.ansible_ssh_host)
        ips.push(hostVars.ansible_ssh_host);
    }
  }

  return ips;
}

// Fetches the WebSocket address from a Chrome remote debugging server.
//
// serverAddress must have the server's IP and port, such as "1.2.3.4:9222"
async function fetchChromeWsUrl(serverAddress: string)
    : Promise<string | null> {
  const versionUrl = `http://${serverAddress}/json/version`;

  try {
    console.log(`Fetching Chrome WS URL: ${versionUrl}`);
    const versionData = await (await fetch(versionUrl)).json();
    console.log(`Fetched  Chrome WS URL: ${versionData.webSocketDebuggerUrl}`);
    return versionData.webSocketDebuggerUrl;
  } catch (e) {
    console.log('found error');
    console.error(e);
    return null;
  }
}

// Finds Chrome remote debugging servers in an Ansible OpenStack inventory dump.
//
// The inventory dump must be obtained via:
//    deploy/ansible/inventory/openstack.py --list
// where openstack.py is downloaded from contrib/inventory in the Ansible GitHub
// repository.
//
// The servers must have been created by the Ansible playbooks in this
// repository. osPrefixes must be an array of os_prefix values used to create
// the clusters.
export async function readChromeWsUrls(
    inventoryDumpPath : string, osPrefixes: string[]) : Promise<string[]> {
  const ips = await readOpenStackIPs(inventoryDumpPath, osPrefixes);

  const chromiumPort = 11229;
  const maxParallelConnections = 4;
  const serverAddresses = ips.map((ip) => `${ip}:${chromiumPort}`);

  return (await throttledAsyncMap(serverAddresses, maxParallelConnections,
      fetchChromeWsUrl)).filter(address => address !== null);
}