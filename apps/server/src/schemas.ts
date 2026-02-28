import { z } from 'zod';

export const newGameSchema = z.object({
  playerNames: z.array(z.string().min(1).max(30)).min(2).max(6).optional(),
  playerCount: z.number().int().min(2).max(6).optional().default(4),
  seed: z.number().int().optional(),
});

const gameActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ROLL_DICE') }),
  z.object({ type: z.literal('BUY') }),
  z.object({ type: z.literal('PASS') }),
  z.object({
    type: z.literal('SUBMIT_AUCTION_BIDS'),
    bids: z.record(z.string(), z.number().int().min(0)),
  }),
  z.object({ type: z.literal('PAY_JAIL_FINE') }),
  z.object({ type: z.literal('ROLL_JAIL_DOUBLES') }),
  z.object({ type: z.literal('END_TURN') }),
  z.object({ type: z.literal('BUILD_HOUSE'), cellIndex: z.number().int().min(0).max(39) }),
  z.object({ type: z.literal('SELL_HOUSE'), cellIndex: z.number().int().min(0).max(39) }),
]);

export const actionRequestSchema = z.object({
  gameId: z.string().uuid(),
  playerId: z.string().uuid(),
  action: gameActionSchema,
});

const chatSenderSchema = z.object({
  kind: z.enum(['player', 'dealer', 'system']),
  id: z.string().optional(),
  name: z.string().optional(),
});

export const chatRequestSchema = z.object({
  gameId: z.string().uuid(),
  from: chatSenderSchema,
  scope: z.enum(['public', 'tabletalk', 'private']),
  toPlayerId: z.string().uuid().optional(),
  text: z.string().min(1).max(1000),
});
