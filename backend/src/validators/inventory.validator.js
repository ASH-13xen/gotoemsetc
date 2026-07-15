const { z } = require('zod');
const { INVENTORY_BOOKING_CONTEXT } = require('../config/constants');

const idParam = z.object({ id: z.string().min(1) });

// Multipart bodies arrive as strings — z.coerce handles the numeric field.
const itemBodyBase = {
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  totalQuantity: z.coerce.number().int().positive().optional(),
  categoryId: z.string().min(1).optional(),
  newCategoryName: z.string().min(1).optional(),
};

const createItem = {
  body: z.object({ ...itemBodyBase, name: z.string().min(1), totalQuantity: z.coerce.number().int().positive() }),
};

const updateItem = {
  params: idParam,
  body: z.object(itemBodyBase),
};

const getOrDeleteItem = { params: idParam };

const createBooking = {
  params: idParam,
  body: z
    .object({
      quantity: z.coerce.number().int().positive(),
      startDate: z.coerce.date(),
      endDate: z.coerce.date(),
      context: z.enum(Object.values(INVENTORY_BOOKING_CONTEXT)),
      event: z.string().min(1).optional(),
      clientTask: z.string().min(1).optional(),
      notes: z.string().optional(),
    })
    .refine((d) => d.context !== INVENTORY_BOOKING_CONTEXT.EVENT || Boolean(d.event), {
      message: 'event is required when context is "event"',
      path: ['event'],
    })
    .refine((d) => d.context !== INVENTORY_BOOKING_CONTEXT.CLIENT_TASK || Boolean(d.clientTask), {
      message: 'clientTask is required when context is "client_task"',
      path: ['clientTask'],
    }),
};

const releaseBooking = { params: idParam };

module.exports = { createItem, updateItem, getOrDeleteItem, createBooking, releaseBooking };
