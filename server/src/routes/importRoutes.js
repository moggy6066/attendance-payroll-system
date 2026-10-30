const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { z } = require('zod');
const { verifyToken, authorize } = require('../middleware/auth');
const { parseWorkbook, commitImport } = require('../services/excelImport');

const router = express.Router();
const prisma = new PrismaClient();

const periodSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100)
});

// The workbook is sent as the raw request body (no multipart dependency needed).
const rawFile = express.raw({ type: () => true, limit: '10mb' });

async function load(req, res) {
  const period = periodSchema.safeParse(req.query);
  if (!period.success) {
    res.status(400).json({ message: 'month and year are required' });
    return null;
  }
  if (!Buffer.isBuffer(req.body) || req.body.length < 100) {
    res.status(400).json({ message: 'Send the Excel file as the request body' });
    return null;
  }
  try {
    return await parseWorkbook(req.body, period.data);
  } catch (error) {
    res.status(400).json({ message: `Could not read the Excel file: ${error.message}` });
    return null;
  }
}

const guard = [verifyToken, authorize(['SUPER_ADMIN', 'ADMIN']), rawFile];

router.post('/preview', ...guard, async (req, res) => {
  const parsed = await load(req, res);
  if (!parsed) return;
  res.json({
    summary: parsed.summary,
    errors: parsed.errors,
    warnings: parsed.warnings,
    employees: parsed.employees.slice(0, 100)
  });
});

router.post('/commit', ...guard, async (req, res) => {
  const parsed = await load(req, res);
  if (!parsed) return;
  if (parsed.errors.length) {
    return res.status(422).json({ message: 'Fix the errors in the file first', errors: parsed.errors });
  }
  try {
    const result = await commitImport(prisma, parsed);
    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: `Excel import ${parsed.month}/${parsed.year}: ${result.created} new, ${result.updated} updated employees`,
        ipAddress: req.ip
      }
    });
    res.json({ message: 'Import completed', ...result });
  } catch (error) {
    res.status(500).json({ message: 'Import failed; nothing was saved', error: error.message });
  }
});

module.exports = router;
