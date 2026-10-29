const mongoose = require('mongoose');
const Item = require('../models/Item');
const StockMovement = require('../models/StockMovement');
const AppError = require('../utils/AppError');

/**
 * Normalize quantity to max 2 decimal places.
 * @param {number} val
 * @returns {number}
 */
const roundQty = (val) => Math.round(val * 100) / 100;

/**
 * Get inventory list — all Products with stock status.
 */
const getInventoryList = async (businessId) => {
  const products = await Item.find({ businessId, type: 'Product' })
    .select('name sku unit currentStock lowStockThreshold isActive')
    .sort({ name: 1 });

  return products.map(p => {
    const stock = p.currentStock ?? 0;
    const threshold = p.lowStockThreshold ?? 0;
    let stockStatus = 'IN_STOCK';
    if (stock <= 0) stockStatus = 'OUT_OF_STOCK';
    else if (threshold > 0 && stock <= threshold) stockStatus = 'LOW_STOCK';

    return {
      _id: p._id,
      name: p.name,
      sku: p.sku,
      unit: p.unit,
      currentStock: stock,
      lowStockThreshold: threshold,
      isActive: p.isActive,
      stockStatus
    };
  });
};

/**
 * Get single product inventory details.
 */
const getItemInventory = async (businessId, itemId) => {
  const item = await Item.findOne({ _id: itemId, businessId, type: 'Product' });
  if (!item) throw new AppError('Product not found', 404);

  const stock = item.currentStock ?? 0;
  const threshold = item.lowStockThreshold ?? 0;
  let stockStatus = 'IN_STOCK';
  if (stock <= 0) stockStatus = 'OUT_OF_STOCK';
  else if (threshold > 0 && stock <= threshold) stockStatus = 'LOW_STOCK';

  return {
    _id: item._id,
    name: item.name,
    sku: item.sku,
    unit: item.unit,
    currentStock: stock,
    lowStockThreshold: threshold,
    isActive: item.isActive,
    stockStatus
  };
};

/**
 * Stock In — atomically increase stock with transaction.
 * Creates an IN movement record in the same transaction.
 */
const stockIn = async (businessId, itemId, quantity, note) => {
  quantity = roundQty(quantity);
  if (quantity <= 0) throw new AppError('Quantity must be positive', 400);

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      // 1. Load and verify product
      const item = await Item.findOne({ _id: itemId, businessId, type: 'Product' }).session(session);
      if (!item) throw new AppError('Product not found', 404);

      const balanceBefore = roundQty(item.currentStock ?? 0);
      const balanceAfter = roundQty(balanceBefore + quantity);

      // 2. Update stock
      await Item.updateOne(
        { _id: itemId, businessId },
        { $set: { currentStock: balanceAfter } },
        { session }
      );

      // 3. Create movement
      await StockMovement.create([{
        businessId,
        itemId,
        movementType: 'IN',
        quantity,
        balanceBefore,
        balanceAfter,
        referenceType: 'Manual',
        note: note || undefined
      }], { session });

      result = { balanceBefore, balanceAfter, quantity };
    });

    return result;
  } finally {
    session.endSession();
  }
};

/**
 * Stock Adjustment — set stock to a physical count value, atomically.
 * Calculates delta from current stock within a transaction.
 */
const stockAdjust = async (businessId, itemId, newStock, note) => {
  newStock = roundQty(newStock);
  if (newStock < 0) throw new AppError('New stock cannot be negative', 400);

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      // 1. Load product inside the session
      const item = await Item.findOne({ _id: itemId, businessId, type: 'Product' }).session(session);
      if (!item) throw new AppError('Product not found', 404);

      const balanceBefore = roundQty(item.currentStock ?? 0);
      const balanceAfter = newStock;
      const delta = roundQty(balanceAfter - balanceBefore);

      if (delta === 0) {
        result = { balanceBefore, balanceAfter, delta: 0 };
        return; // No change needed
      }

      // 2. Update stock
      await Item.updateOne(
        { _id: itemId, businessId },
        { $set: { currentStock: balanceAfter } },
        { session }
      );

      // 3. Create adjustment movement
      await StockMovement.create([{
        businessId,
        itemId,
        movementType: 'ADJUSTMENT',
        quantity: Math.abs(delta),
        balanceBefore,
        balanceAfter,
        referenceType: 'Manual',
        note: note || `Adjustment: ${balanceBefore} → ${balanceAfter}`
      }], { session });

      result = { balanceBefore, balanceAfter, delta };
    });

    return result;
  } finally {
    session.endSession();
  }
};

/**
 * Deduct stock for a finalized invoice — called inside the finalization transaction.
 * For each Product line item, performs a guarded atomic decrement.
 * Creates OUT movements with invoice-line-level uniqueness.
 *
 * @param {string} businessId
 * @param {object} invoice - The invoice document (must have items array and _id)
 * @param {object} session - The active MongoDB session
 */
const deductStockForInvoice = async (businessId, invoice, session) => {
  for (let lineIndex = 0; lineIndex < invoice.items.length; lineIndex++) {
    const lineItem = invoice.items[lineIndex];

    // Skip Services — they have no inventory
    if (lineItem.type !== 'Product') continue;

    const quantity = roundQty(lineItem.quantity);
    if (quantity <= 0) continue;

    // Guarded atomic decrement: only succeeds if currentStock >= quantity
    const updatedItem = await Item.findOneAndUpdate(
      {
        _id: lineItem.itemId,
        businessId,
        type: 'Product',
        currentStock: { $gte: quantity }
      },
      { $inc: { currentStock: -quantity } },
      { session, returnDocument: 'after' }
    );

    if (!updatedItem) {
      // Check if item exists to give appropriate error
      const existingItem = await Item.findOne({ _id: lineItem.itemId, businessId }).session(session);
      if (!existingItem) {
        throw new AppError(`Product not found (ID: ${lineItem.itemId})`, 400);
      }
      throw new AppError(
        `Insufficient stock for "${lineItem.name}". Available: ${existingItem.currentStock ?? 0}, Required: ${quantity}`,
        400
      );
    }

    const balanceAfter = roundQty(updatedItem.currentStock);
    const balanceBefore = roundQty(balanceAfter + quantity);

    // Create OUT movement — the unique index prevents duplicates on retry
    await StockMovement.create([{
      businessId,
      itemId: lineItem.itemId,
      movementType: 'OUT',
      quantity,
      balanceBefore,
      balanceAfter,
      referenceType: 'Invoice',
      referenceId: invoice._id,
      invoiceLineIndex: lineIndex,
      note: `Invoice ${invoice.invoiceNumber}`
    }], { session });
  }
};

/**
 * Get movement history for a product.
 */
const getMovements = async (businessId, itemId) => {
  // Verify product exists and belongs to business
  const item = await Item.findOne({ _id: itemId, businessId, type: 'Product' }).select('_id');
  if (!item) throw new AppError('Product not found', 404);

  const movements = await StockMovement.find({ businessId, itemId })
    .sort({ createdAt: -1, _id: -1 });

  return movements;
};

module.exports = {
  getInventoryList,
  getItemInventory,
  stockIn,
  stockAdjust,
  deductStockForInvoice,
  getMovements
};
