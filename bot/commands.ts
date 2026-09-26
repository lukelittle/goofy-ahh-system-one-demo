import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

import { OPTIONS, QUESTION } from "@/config/decision";
import { MIN_ROLE_PROBABILITY, UNCLASSIFIABLE_NAME } from "@/config/discord";

export const trueupCommand = new SlashCommandBuilder()
  .setName("trueup")
  .setDescription("Re-check every member's PFP and fix their archetype role")
  .addBooleanOption((o) => o.setName("force").setDescription("Ask Circuit-VL again even for PFPs it has already judged"))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .setDMPermission(false);

export const howItWorksCommand = new SlashCommandBuilder()
  .setName("howitworks")
  .setDescription("How the bot decides your role: generation vs. decision")
  .setDMPermission(false);

export const COMMANDS = [trueupCommand, howItWorksCommand].map((c) => c.toJSON());

/** The /howitworks explainer. Same facts as the website's "Okay, but what actually happened?" section. */
export function howItWorksEmbeds(): EmbedBuilder[] {
  const demoUrl = process.env.DEMO_URL?.trim();
  const options = OPTIONS.map((o) => `\`${o.id}\``).join(" · ");
  return [
    new EmbedBuilder()
      .setTitle("How this bot picks your role: Generation vs. Decision")
      .setDescription(
        [
          "**A normal AI chatbot** would be sent your PFP with a prompt like *\"reply with one of architect, apple_guy, femboy, furry\"*. It generates an answer one token at a time, and then code parses the text and hopes it's one of the four words.",
          "",
          "**This bot doesn't do that.** It sends [Circuit-VL](https://huggingface.co/jbarney/circuit-vl-4b) (a 4B vision model) three things:",
          `> **state:** your PFP\n> **question:** "${QUESTION}"\n> **options:** ${options}`,
          "",
          "The model reads all of it in **one forward pass**. A small *pointer head* compares the hidden state at a special decide token with the hidden state at the end of each option and gives each option one score. A softmax turns the four scores into four probabilities. The response literally reports `output_tokens: 0`: nothing was generated, and it can't answer anything that isn't on the list.",
          "",
          `**Then plain code picks the role:** the top option, or **${UNCLASSIFIABLE_NAME}** if the top option is under ${Math.round(MIN_ROLE_PROBABILITY * 100)}% or you have no PFP. The threshold is ours, not the model's.`,
        ].join("\n"),
      ),
    new EmbedBuilder().setTitle("Fine print").setDescription(
      [
        "- It judges the **visual presentation of a picture**, not who you are.",
        "- Circuit-VL was trained on receipts, charts, forms and a set of photos, not internet archetypes, so these numbers are far outside what it was calibrated on.",
        "- The model's author documents that it's overconfident on ambiguous images. A high percentage isn't proof.",
        "- Change your PFP and the bot looks again.",
        demoUrl ? `\nThe full explainer, with Nerd Mode: ${demoUrl}` : "",
      ].join("\n"),
    ),
  ];
}
