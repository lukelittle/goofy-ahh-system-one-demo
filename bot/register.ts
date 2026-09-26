import { REST, Routes } from "discord.js";

import { COMMANDS } from "./commands";

/**
 * Registers /trueup and /howitworks. Run once, and again whenever the
 * commands change. With DISCORD_GUILD_ID set they appear in that server
 * immediately; without it they're global and can take up to an hour.
 */
const token = process.env.DISCORD_TOKEN;
const appId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID?.trim();
if (!token || !appId) {
  console.error("Set DISCORD_TOKEN and DISCORD_CLIENT_ID (the application id from the Developer Portal).");
  process.exit(1);
}

async function main(token: string, appId: string) {
  const rest = new REST().setToken(token);
  const route = guildId ? Routes.applicationGuildCommands(appId, guildId) : Routes.applicationCommands(appId);
  await rest.put(route, { body: COMMANDS });
  console.log(`Registered ${COMMANDS.map((c) => `/${c.name}`).join(", ")} ${guildId ? `in guild ${guildId}` : "globally"}.`);
}

main(token, appId).catch((e) => {
  console.error(e);
  process.exit(1);
});
