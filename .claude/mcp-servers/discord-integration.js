#!/usr/bin/env node

/**
 * Discord Integration MCP Server for Miyabi
 *
 * Provides Discord community integration for Claude Code:
 * - Post announcements to Discord channels
 * - Send issue/PR notifications
 * - Query community stats
 * - Manage roles and permissions
 * - Schedule events
 * - Monitor user questions
 *
 * Required Environment Variables:
 * - DISCORD_BOT_TOKEN: Discord bot token
 * - DISCORD_GUILD_ID: Discord server (guild) ID
 * - DISCORD_ANNOUNCE_CHANNEL: Channel ID for announcements
 * - DISCORD_GITHUB_CHANNEL: Channel ID for GitHub updates
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Discord.js integration (would need: npm install discord.js)
// For now, we'll use fetch API to Discord REST API

const DISCORD_API_BASE = 'https://discord.com/api/v10';

class DiscordMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'discord-integration',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.botToken = process.env.DISCORD_BOT_TOKEN;
    this.guildId = process.env.DISCORD_GUILD_ID;
    this.announceChannelId = process.env.DISCORD_ANNOUNCE_CHANNEL;
    this.githubChannelId = process.env.DISCORD_GITHUB_CHANNEL;

    this.setupHandlers();
  }

  setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'discord_send_message',
          description: 'Send a message to a Discord channel',
          inputSchema: {
            type: 'object',
            properties: {
              channel_id: {
                type: 'string',
                description: 'Discord channel ID (or use "announce" for announcement channel)',
              },
              content: {
                type: 'string',
                description: 'Message content (supports Discord markdown)',
              },
              embed: {
                type: 'object',
                description: 'Optional rich embed',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  color: { type: 'number', description: 'Hex color as integer' },
                  fields: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        value: { type: 'string' },
                        inline: { type: 'boolean' },
                      },
                    },
                  },
                  footer: {
                    type: 'object',
                    properties: {
                      text: { type: 'string' },
                    },
                  },
                  timestamp: { type: 'string' },
                },
              },
            },
            required: ['content'],
          },
        },
        {
          name: 'discord_announce_release',
          description: 'Announce a new release to the community',
          inputSchema: {
            type: 'object',
            properties: {
              version: { type: 'string', description: 'Version number (e.g., v0.8.0)' },
              title: { type: 'string', description: 'Release title' },
              changelog: { type: 'string', description: 'Release notes/changelog' },
              download_url: { type: 'string', description: 'Download/release URL' },
            },
            required: ['version', 'title', 'changelog'],
          },
        },
        {
          name: 'discord_notify_github_event',
          description: 'Send GitHub issue/PR notification to Discord',
          inputSchema: {
            type: 'object',
            properties: {
              event_type: {
                type: 'string',
                enum: ['issue_opened', 'issue_closed', 'pr_opened', 'pr_merged', 'pr_closed'],
                description: 'Type of GitHub event',
              },
              number: { type: 'number', description: 'Issue or PR number' },
              title: { type: 'string', description: 'Issue/PR title' },
              author: { type: 'string', description: 'Author username' },
              url: { type: 'string', description: 'GitHub URL' },
              labels: {
                type: 'array',
                items: { type: 'string' },
                description: 'Labels',
              },
            },
            required: ['event_type', 'number', 'title', 'author', 'url'],
          },
        },
        {
          name: 'discord_get_stats',
          description: 'Get Discord server statistics',
          inputSchema: {
            type: 'object',
            properties: {
              stat_type: {
                type: 'string',
                enum: ['members', 'online', 'channels', 'roles', 'all'],
                description: 'Type of statistics to retrieve',
              },
            },
            required: ['stat_type'],
          },
        },
        {
          name: 'discord_create_event',
          description: 'Create a scheduled event in Discord',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Event name' },
              description: { type: 'string', description: 'Event description' },
              start_time: { type: 'string', description: 'ISO 8601 datetime' },
              end_time: { type: 'string', description: 'ISO 8601 datetime (optional)' },
              channel_id: { type: 'string', description: 'Voice channel ID (optional)' },
              location: { type: 'string', description: 'External location (if not voice)' },
            },
            required: ['name', 'description', 'start_time'],
          },
        },
        {
          name: 'discord_get_recent_messages',
          description: 'Get recent messages from a channel (for Q&A monitoring)',
          inputSchema: {
            type: 'object',
            properties: {
              channel_id: {
                type: 'string',
                description: 'Channel ID (or "support" for support channel)',
              },
              limit: {
                type: 'number',
                description: 'Number of messages to retrieve (max 100)',
                default: 10,
              },
            },
            required: ['channel_id'],
          },
        },
        {
          name: 'discord_add_reaction',
          description: 'Add a reaction emoji to a message',
          inputSchema: {
            type: 'object',
            properties: {
              channel_id: { type: 'string' },
              message_id: { type: 'string' },
              emoji: { type: 'string', description: 'Emoji (e.g., "👍", "✅")' },
            },
            required: ['channel_id', 'message_id', 'emoji'],
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'discord_send_message':
            return await this.sendMessage(args);

          case 'discord_announce_release':
            return await this.announceRelease(args);

          case 'discord_notify_github_event':
            return await this.notifyGitHubEvent(args);

          case 'discord_get_stats':
            return await this.getStats(args);

          case 'discord_create_event':
            return await this.createEvent(args);

          case 'discord_get_recent_messages':
            return await this.getRecentMessages(args);

          case 'discord_add_reaction':
            return await this.addReaction(args);

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  async discordFetch(endpoint, options = {}) {
    if (!this.botToken) {
      throw new Error('DISCORD_BOT_TOKEN not set');
    }

    const response = await fetch(`${DISCORD_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bot ${this.botToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Discord API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  async sendMessage(args) {
    let channelId = args.channel_id;

    // Handle shortcuts
    if (channelId === 'announce') channelId = this.announceChannelId;
    if (channelId === 'github') channelId = this.githubChannelId;

    if (!channelId) {
      throw new Error('Channel ID not specified or not configured');
    }

    const payload = {
      content: args.content,
    };

    if (args.embed) {
      payload.embeds = [args.embed];
    }

    const result = await this.discordFetch(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return {
      content: [
        {
          type: 'text',
          text: `✅ Message sent to Discord channel ${channelId}\nMessage ID: ${result.id}`,
        },
      ],
    };
  }

  async announceRelease(args) {
    const embed = {
      title: `🎉 ${args.title}`,
      description: args.changelog,
      color: 0xFF79C6, // Miyabi pink
      fields: [
        {
          name: '📦 Version',
          value: args.version,
          inline: true,
        },
      ],
      footer: {
        text: 'Miyabi - AI Autonomous Development',
      },
      timestamp: new Date().toISOString(),
    };

    if (args.download_url) {
      embed.fields.push({
        name: '🔗 Download',
        value: `[GitHub Release](${args.download_url})`,
        inline: true,
      });
    }

    const payload = {
      content: `@everyone 新バージョンがリリースされました！ / New version released!`,
      embeds: [embed],
    };

    const result = await this.discordFetch(
      `/channels/${this.announceChannelId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );

    return {
      content: [
        {
          type: 'text',
          text: `✅ Release announcement sent!\nVersion: ${args.version}\nMessage ID: ${result.id}`,
        },
      ],
    };
  }

  async notifyGitHubEvent(args) {
    const eventEmojis = {
      issue_opened: '🆕',
      issue_closed: '✅',
      pr_opened: '🔀',
      pr_merged: '🎉',
      pr_closed: '❌',
    };

    const eventColors = {
      issue_opened: 0x00D9FF,
      issue_closed: 0x00FF00,
      pr_opened: 0xFF79C6,
      pr_merged: 0x50FA7B,
      pr_closed: 0xFF5555,
    };

    const eventTitles = {
      issue_opened: 'New Issue',
      issue_closed: 'Issue Closed',
      pr_opened: 'New Pull Request',
      pr_merged: 'PR Merged',
      pr_closed: 'PR Closed',
    };

    const emoji = eventEmojis[args.event_type];
    const color = eventColors[args.event_type];
    const eventTitle = eventTitles[args.event_type];

    const embed = {
      title: `${emoji} ${eventTitle} #${args.number}`,
      description: args.title,
      color: color,
      fields: [
        {
          name: '👤 Author',
          value: args.author,
          inline: true,
        },
        {
          name: '🔗 Link',
          value: `[View on GitHub](${args.url})`,
          inline: true,
        },
      ],
      timestamp: new Date().toISOString(),
    };

    if (args.labels && args.labels.length > 0) {
      embed.fields.push({
        name: '🏷️ Labels',
        value: args.labels.join(', '),
        inline: false,
      });
    }

    const result = await this.discordFetch(
      `/channels/${this.githubChannelId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({ embeds: [embed] }),
      }
    );

    return {
      content: [
        {
          type: 'text',
          text: `✅ GitHub notification sent: ${eventTitle} #${args.number}`,
        },
      ],
    };
  }

  async getStats(args) {
    const guild = await this.discordFetch(`/guilds/${this.guildId}?with_counts=true`);

    const stats = {
      members: guild.approximate_member_count,
      online: guild.approximate_presence_count,
      name: guild.name,
      description: guild.description,
    };

    if (args.stat_type === 'all' || args.stat_type === 'channels') {
      const channels = await this.discordFetch(`/guilds/${this.guildId}/channels`);
      stats.channels = {
        total: channels.length,
        text: channels.filter((c) => c.type === 0).length,
        voice: channels.filter((c) => c.type === 2).length,
      };
    }

    if (args.stat_type === 'all' || args.stat_type === 'roles') {
      const roles = await this.discordFetch(`/guilds/${this.guildId}/roles`);
      stats.roles = roles.length;
    }

    return {
      content: [
        {
          type: 'text',
          text: `Discord Server Stats:\n${JSON.stringify(stats, null, 2)}`,
        },
      ],
    };
  }

  async createEvent(args) {
    const eventData = {
      name: args.name,
      description: args.description,
      scheduled_start_time: args.start_time,
      privacy_level: 2, // GUILD_ONLY
      entity_type: args.channel_id ? 2 : 3, // 2=VOICE, 3=EXTERNAL
    };

    if (args.end_time) {
      eventData.scheduled_end_time = args.end_time;
    }

    if (args.channel_id) {
      eventData.channel_id = args.channel_id;
    } else if (args.location) {
      eventData.entity_metadata = { location: args.location };
    }

    const result = await this.discordFetch(
      `/guilds/${this.guildId}/scheduled-events`,
      {
        method: 'POST',
        body: JSON.stringify(eventData),
      }
    );

    return {
      content: [
        {
          type: 'text',
          text: `✅ Event created: "${args.name}"\nEvent ID: ${result.id}\nStarts: ${args.start_time}`,
        },
      ],
    };
  }

  async getRecentMessages(args) {
    let channelId = args.channel_id;
    if (channelId === 'support') {
      // Would need to configure support channel ID
      throw new Error('Support channel ID not configured');
    }

    const limit = Math.min(args.limit || 10, 100);

    const messages = await this.discordFetch(
      `/channels/${channelId}/messages?limit=${limit}`
    );

    const formattedMessages = messages.map((msg) => ({
      id: msg.id,
      author: msg.author.username,
      content: msg.content,
      timestamp: msg.timestamp,
      reactions: msg.reactions?.map((r) => r.emoji.name) || [],
    }));

    return {
      content: [
        {
          type: 'text',
          text: `Recent messages from channel ${channelId}:\n${JSON.stringify(
            formattedMessages,
            null,
            2
          )}`,
        },
      ],
    };
  }

  async addReaction(args) {
    const emoji = encodeURIComponent(args.emoji);

    await this.discordFetch(
      `/channels/${args.channel_id}/messages/${args.message_id}/reactions/${emoji}/@me`,
      { method: 'PUT' }
    );

    return {
      content: [
        {
          type: 'text',
          text: `✅ Added reaction ${args.emoji} to message ${args.message_id}`,
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Discord Integration MCP Server running on stdio');
  }
}

const server = new DiscordMCPServer();
server.run().catch(console.error);
