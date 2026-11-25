import dns from "dns";

/**
 * MongoDB Atlas uses SRV records (_mongodb._tcp.<cluster>.mongodb.net) to
 * discover its shard hosts. Some ISP/router DNS servers either can't resolve
 * those SRV records or resolve them over IPv6 first, which makes the Mongo
 * driver fail with "Could not connect to any servers in your MongoDB Atlas
 * cluster" even though the cluster is up.
 *
 * Use well-known resolvers by default (the same fix that was already applied
 * to the admin seed script). Set DNS_SERVERS=system in .env to keep using the
 * OS DNS servers instead.
 */
const rawServers = process.env.DNS_SERVERS ?? "8.8.8.8,1.1.1.1";

if (rawServers.trim().toLowerCase() !== "system") {
  const servers = rawServers
    .split(",")
    .map((server) => server.trim())
    .filter(Boolean);

  if (servers.length > 0) {
    try {
      dns.setServers(servers);
      console.log(`[DNS] Using resolvers: ${servers.join(", ")}`);
    } catch (error) {
      console.warn(`[DNS] Could not set resolvers: ${error.message}`);
    }
  }
}

// Prefer IPv4 - Atlas SRV targets are reachable over IPv4 on most networks.
if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

export default dns;
