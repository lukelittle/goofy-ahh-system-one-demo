import { Client, Events, GatewayIntentBits, type Guild, type GuildMember, type Interaction, MessageFlags, PermissionFlagsBits } from "discord.js";

import { serviceInfo } from "@/lib/circuit";

import { classifyMember } from "./classifier";
import { howItWorksEmbeds } from "./commands";
import { logLine, roleName, welcomeMessage } from "./decide";
import { applyRole, ensureRoles } from "./roles";

/**
 * Goofy Ahh System One, the Discord bot.
 *
 *   member joins        -> classify PFP -> set archetype role -> public welcome
 *   member changes PFP  -> classify PFP -> set archetype role (quietly)
 *   /trueup             -> every member, same as above, summary to the caller
 *   /howitworks         -> posts the generation-vs-decision explainer
 *
 * If Circuit-VL can't be reached, roles are left as they are. The bot never
 * assigns a role from a decision the model didn't make.
 */

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error("DISCORD_TOKEN is not set. See the README, section \"Discord bot\".");
  process.exit(1);
}

// GuildMembers is a privileged intent: turn on "Server Members Intent" in the Developer Portal.
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

const who = (m: GuildMember) => `[${m.guild.name}] ${m.user.tag}`;

async function classifyAndApply(member: GuildMember, opts: { force?: boolean } = {}) {
  const decision = await classifyMember(member, opts);
  const outcome = await applyRole(member, decision.key);
  console.log(`${logLine(who(member), decision)}${outcome === "unchanged" ? " (already had it)" : ""}`);
  return { decision, outcome };
}

async function welcomeChannel(guild: Guild) {
  const id = process.env.DISCORD_WELCOME_CHANNEL_ID?.trim();
  const channel = id ? await guild.channels.fetch(id).catch(() => null) : guild.systemChannel;
  return channel?.isTextBased() && channel.isSendable() ? channel : null;
}

client.once(Events.ClientReady, async (c) => {
  const info = serviceInfo();
  console.log(`Logged in as ${c.user.tag}. Circuit: ${info.mode} ${info.endpoint} (${info.model})${info.mode === "mock" ? "  ⚠️ MOCK MODE: fake numbers" : ""}`);
  for (const guild of c.guilds.cache.values()) await ensureRoles(guild).catch((e) => console.error(`[${guild.name}] ensureRoles failed:`, e));
});

client.on(Events.GuildCreate, (guild) => {
  ensureRoles(guild).catch((e) => console.error(`[${guild.name}] ensureRoles failed:`, e));
});

client.on(Events.GuildMemberAdd, async (member) => {
  if (member.user.bot) return;
  try {
    const { decision } = await classifyAndApply(member);
    const channel = await welcomeChannel(member.guild);
    if (channel) await channel.send({ content: welcomeMessage(member.id, decision), allowedMentions: { users: [member.id] } });
  } catch (e) {
    console.error(`${who(member)}: not classified, roles left alone:`, e);
  }
});

// A server-specific avatar changed.
client.on(Events.GuildMemberUpdate, async (before, after) => {
  if (after.user.bot || before.partial || before.avatar === after.avatar) return;
  await classifyAndApply(after).catch((e) => console.error(`${who(after)}: re-classify failed:`, e));
});

// The global avatar changed: re-check every server where that avatar is what people see.
client.on(Events.UserUpdate, async (before, after) => {
  if (after.bot || before.partial || before.avatar === after.avatar) return;
  for (const guild of client.guilds.cache.values()) {
    const member = await guild.members.fetch(after.id).catch(() => null);
    if (member && !member.avatar) await classifyAndApply(member).catch((e) => console.error(`${who(member)}: re-classify failed:`, e));
  }
});

const trueupRunning = new Set<string>();

async function trueup(interaction: Interaction) {
  if (!interaction.isChatInputCommand() || !interaction.inCachedGuild()) return;
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.reply({ content: "You need Manage Roles to run this.", flags: MessageFlags.Ephemeral });
    return;
  }
  const guild = interaction.guild;
  if (trueupRunning.has(guild.id)) {
    await interaction.reply({ content: "A true-up is already running here.", flags: MessageFlags.Ephemeral });
    return;
  }
  trueupRunning.add(guild.id);
  const force = interaction.options.getBoolean("force") ?? false;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    await ensureRoles(guild);
    const members = [...(await guild.members.fetch()).values()].filter((m) => !m.user.bot);
    const counts = new Map<string, number>();
    let changed = 0;
    const failed: string[] = [];
    let lastUpdate = Date.now();
    for (const [i, member] of members.entries()) {
      try {
        const { decision, outcome } = await classifyAndApply(member, { force });
        counts.set(decision.key, (counts.get(decision.key) ?? 0) + 1);
        if (outcome === "changed") changed++;
      } catch (e) {
        failed.push(member.user.tag);
        console.error(`${who(member)}: true-up failed, roles left alone:`, e);
      }
      if (Date.now() - lastUpdate > 10_000) {
        lastUpdate = Date.now();
        await interaction.editReply(`True-up: ${i + 1} / ${members.length} members checked, ${changed} roles changed so far…`).catch(() => undefined);
      }
    }
    const tally = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${roleName(k)}: ${n}`).join("\n");
    await interaction.editReply(
      [
        `**True-up done.** ${members.length} members checked, ${changed} roles changed.`,
        tally,
        failed.length ? `\nCouldn't classify ${failed.length} (Circuit-VL unreachable or bad answer, roles left alone): ${failed.slice(0, 20).join(", ")}${failed.length > 20 ? "…" : ""}` : "",
      ].join("\n"),
    );
  } catch (e) {
    await interaction.editReply(`True-up failed: ${String(e)}`).catch(() => undefined);
  } finally {
    trueupRunning.delete(guild.id);
  }
}

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  try {
    if (interaction.commandName === "trueup") await trueup(interaction);
    else if (interaction.commandName === "howitworks") await interaction.reply({ embeds: howItWorksEmbeds() });
  } catch (e) {
    console.error(`/${interaction.commandName} failed:`, e);
  }
});

client.login(token);
