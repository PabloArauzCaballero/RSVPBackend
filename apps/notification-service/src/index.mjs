import { randomUUID } from 'node:crypto';

export class NotificationError extends Error { constructor(code, message) { super(message); this.code = code; } }
export const Channel = Object.freeze({ EMAIL: 'EMAIL', SMS: 'SMS', WHATSAPP: 'WHATSAPP', PUSH: 'PUSH' });

/** The only outbound port exposed to the notification application. Provider SDKs stay in adapters. */
export class NotificationChannelPort { async send(_message) { throw new Error('Adapter must implement send'); } }
export class NotificationRequest {
  constructor({ id = randomUUID(), recipientId, locale = 'es-BO', channel, template, data = {}, celebrationTimeZone = 'UTC', createdAt = new Date() }) {
    if (!Object.values(Channel).includes(channel)) throw new NotificationError('ValidationFailed', 'Unsupported notification channel');
    this.id = id; this.recipientId = recipientId; this.locale = locale; this.channel = channel; this.template = template; this.data = data; this.celebrationTimeZone = celebrationTimeZone; this.createdAt = createdAt;
  }
}
const messages = Object.freeze({
  invitation: { 'es-BO': 'Tienes una invitación para {celebration}', 'en-US': 'You have an invitation to {celebration}' },
  rsvpConfirmed: { 'es-BO': 'Tu asistencia fue confirmada', 'en-US': 'Your attendance was confirmed' }
});
export function renderTemplate(template, locale, data) { const text = messages[template]?.[locale] ?? messages[template]?.['es-BO']; if (!text) throw new NotificationError('TemplateNotFound', `Unknown template ${template}`); return text.replace(/\{(\w+)\}/gu, (_, key) => String(data[key] ?? '')); }
export function localHour(at, timeZone) { return Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone }).format(at)); }
export function isQuietHour(at, timeZone, { start = 22, end = 8 } = {}) { const hour = localHour(at, timeZone); return start > end ? hour >= start || hour < end : hour >= start && hour < end; }

export class InMemoryChannel extends NotificationChannelPort { constructor() { super(); this.sent = []; } async send(message) { this.sent.push(message); return { id: `sent-${this.sent.length}` }; } }
export class ConsoleChannel extends InMemoryChannel {}
/** Mailhog is an HTTP adapter boundary; tests use InMemoryChannel and never network. */
export class MailhogChannel extends InMemoryChannel {}
export class SesChannel extends InMemoryChannel {}
export class WhatsAppChannel extends InMemoryChannel {}
export class TwilioChannel extends InMemoryChannel {}

export class NotificationDispatcher {
  constructor({ channels, preferences = new Map(), processed = new Set(), clock = () => new Date() }) { this.channels = channels; this.preferences = preferences; this.processed = processed; this.clock = clock; this.deferred = []; }
  async consume(event) {
    if (this.processed.has(event.id)) return { status: 'duplicate' }; this.processed.add(event.id);
    const request = new NotificationRequest(event);
    if (this.preferences.get(`${request.recipientId}:${request.channel}`) === false) return { status: 'suppressed' };
    if (isQuietHour(this.clock(), request.celebrationTimeZone, event.quietHours)) { this.deferred.push(request); return { status: 'deferred' }; }
    const channel = this.channels[request.channel]; if (!channel) throw new NotificationError('ChannelUnavailable', `No adapter for ${request.channel}`);
    const rendered = { ...request, body: renderTemplate(request.template, request.locale, request.data) };
    await channel.send(rendered); return { status: 'sent', request: rendered };
  }
}

export class DeviceToken {
  constructor({ token, userId, platform }) { if (!['ios', 'android'].includes(platform)) throw new NotificationError('ValidationFailed', 'platform must be ios or android'); if (!token?.startsWith('ExponentPushToken[')) throw new NotificationError('ValidationFailed', 'invalid Expo push token'); this.token = token; this.userId = userId; this.platform = platform; this.disabledAt = undefined; }
  disable(at = new Date()) { this.disabledAt = at; }
}
export class FakeExpoDriver {
  constructor({ receipts = [] } = {}) { this.receipts = receipts; this.batches = []; }
  async send(messages) { this.batches.push(messages); return messages.map((_message, index) => this.receipts.shift() ?? { status: 'ok', id: `receipt-${index}` }); }
}
export const batch = (items, size = 100) => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));
export class ExpoPushService {
  constructor({ driver, clock = () => new Date(), maxRetries = 2 }) { this.driver = driver; this.clock = clock; this.maxRetries = maxRetries; this.tokens = new Map(); this.attempts = []; }
  register(input) { const token = new DeviceToken(input); this.tokens.set(`${token.userId}:${token.token}`, token); return token; }
  unregister(userId, rawToken) { this.tokens.delete(`${userId}:${rawToken}`); }
  async sendToUsers(userIds, payload) {
    const targets = [...this.tokens.values()].filter((token) => userIds.includes(token.userId) && !token.disabledAt);
    for (const group of batch(targets, 100)) await this.sendBatch(group, payload, 1);
    return this.attempts;
  }
  async sendBatch(targets, payload, attempt) {
    const receipts = await this.driver.send(targets.map((token) => ({ to: token.token, ...payload })));
    const retry = [];
    receipts.forEach((receipt, index) => { const token = targets[index]; this.attempts.push({ token: token.token, attempt, status: receipt.status, at: this.clock() }); if (receipt.error === 'DeviceNotRegistered') token.disable(this.clock()); else if (receipt.status === 'error' && receipt.transient && attempt <= this.maxRetries) retry.push(token); });
    if (retry.length) await this.sendBatch(retry, payload, attempt + 1);
  }
}
export function createChannelFromEnv(env, adapters) { const selected = env.NOTIFICATION_CHANNEL ?? 'console'; const map = { console: adapters.console, mailhog: adapters.mailhog, ses: adapters.ses, whatsapp: adapters.whatsapp, twilio: adapters.twilio, expo: adapters.expo }; const adapter = map[selected]; if (!adapter) throw new NotificationError('Configuration', `Unknown NOTIFICATION_CHANNEL ${selected}`); return adapter; }
