import assert from 'node:assert/strict';
import test from 'node:test';
import { Channel, ConsoleChannel, DeviceToken, ExpoPushService, FakeExpoDriver, InMemoryChannel, NotificationDispatcher, createChannelFromEnv, isQuietHour, renderTemplate } from '../src/index.mjs';

test('lane 23: channel is selected by configuration, template is localized and duplicate events are ignored', async () => {
  const email = new ConsoleChannel(); const dispatcher = new NotificationDispatcher({ channels: { [Channel.EMAIL]: email }, clock: () => new Date('2026-10-11T15:00:00Z') });
  const event = { id: 'e1', recipientId: 'u1', channel: Channel.EMAIL, template: 'invitation', locale: 'en-US', data: { celebration: 'Wedding' }, celebrationTimeZone: 'America/La_Paz' };
  assert.equal((await dispatcher.consume(event)).status, 'sent'); assert.equal((await dispatcher.consume(event)).status, 'duplicate'); assert.equal(email.sent[0].body, 'You have an invitation to Wedding'); assert.equal(createChannelFromEnv({ NOTIFICATION_CHANNEL: 'console' }, { console: email }), email);
});

test('lane 23: quiet hours defer and channel preference suppresses without provider calls', async () => {
  const channel = new InMemoryChannel(); const dispatcher = new NotificationDispatcher({ channels: { [Channel.SMS]: channel }, preferences: new Map([['u1:SMS', false]]), clock: () => new Date('2026-10-11T06:00:00Z') });
  assert.equal(isQuietHour(new Date('2026-10-11T06:00:00Z'), 'America/La_Paz'), true); assert.equal((await dispatcher.consume({ id: 'a', recipientId: 'u1', channel: Channel.SMS, template: 'rsvpConfirmed', celebrationTimeZone: 'America/La_Paz' })).status, 'suppressed');
  const deferred = new NotificationDispatcher({ channels: { [Channel.SMS]: channel }, clock: () => new Date('2026-10-11T06:00:00Z') }); assert.equal((await deferred.consume({ id: 'b', recipientId: 'u2', channel: Channel.SMS, template: 'rsvpConfirmed', celebrationTimeZone: 'America/La_Paz' })).status, 'deferred'); assert.equal(deferred.deferred.length, 1); assert.equal(renderTemplate('rsvpConfirmed', 'es-BO', {}), 'Tu asistencia fue confirmada');
});

test('lane 24: device tokens batch at 100, unregister permanently invalid tokens and retry transient failures', async () => {
  const driver = new FakeExpoDriver({ receipts: [{ status: 'error', error: 'DeviceNotRegistered' }, { status: 'error', transient: true }, { status: 'ok' }] }); const service = new ExpoPushService({ driver, maxRetries: 1 });
  const users = []; for (let i = 0; i < 250; i += 1) { const id = `u${i}`; users.push(id); service.register({ userId: id, platform: i % 2 ? 'ios' : 'android', token: `ExponentPushToken[${i}]` }); }
  await service.sendToUsers(users, { title: 'Hi', body: 'Body' }); assert.deepEqual(driver.batches.filter((group) => group.length > 1).map((group) => group.length), [100, 100, 50]); assert.equal([...service.tokens.values()].find((token) => token.token === 'ExponentPushToken[0]').disabledAt instanceof Date, true); assert.equal(service.attempts.some((attempt) => attempt.attempt === 2), true); assert.throws(() => new DeviceToken({ userId: 'u', platform: 'web', token: 'no' }));
});
