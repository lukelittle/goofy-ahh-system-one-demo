import type { Guild, GuildMember } from "discord.js";

import { HOIST_ROLES } from "@/config/discord";

import { ALL_ROLE_KEYS, roleName, type RoleKey } from "./decide";

/** role key -> role id, per guild. */
const roleIds = new Map<string, Map<RoleKey, string>>();

/** Find the five archetype roles by name, creating any that are missing. */
export async function ensureRoles(guild: Guild): Promise<Map<RoleKey, string>> {
  const roles = await guild.roles.fetch();
  const map = new Map<RoleKey, string>();
  for (const key of ALL_ROLE_KEYS) {
    const name = roleName(key);
    let role = roles.find((r) => r.name === name);
    if (!role) {
      role = await guild.roles.create({ name, hoist: HOIST_ROLES, mentionable: false, reason: "Goofy Ahh System One: archetype role" });
      console.log(`[${guild.name}] created role ${name}`);
    }
    if (!role.editable) {
      console.warn(`[${guild.name}] can't manage role "${name}": move the bot's own role above it in Server Settings > Roles.`);
    }
    map.set(key, role.id);
  }
  roleIds.set(guild.id, map);
  return map;
}

async function rolesFor(guild: Guild) {
  return roleIds.get(guild.id) ?? ensureRoles(guild);
}

export type ApplyOutcome = "unchanged" | "changed";

/** Give the member exactly one archetype role: add the target, remove the other four. */
export async function applyRole(member: GuildMember, key: RoleKey): Promise<ApplyOutcome> {
  const map = await rolesFor(member.guild);
  const target = map.get(key)!;
  const stale = [...map.values()].filter((id) => id !== target && member.roles.cache.has(id));
  const hasTarget = member.roles.cache.has(target);
  if (hasTarget && stale.length === 0) return "unchanged";
  const reason = `Goofy Ahh System One: Circuit-VL says ${roleName(key)}`;
  if (stale.length) await member.roles.remove(stale, reason);
  if (!hasTarget) await member.roles.add(target, reason);
  return "changed";
}
