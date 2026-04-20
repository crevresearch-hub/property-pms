/**
 * Removes demo / seed data from the database, leaving only real Alwaan data.
 *
 *   node cleanup-demo-data.js              # DRY RUN — counts only, no writes
 *   node cleanup-demo-data.js --confirm    # actually delete
 *
 * Seed markers the script keys off:
 *   - Unit.notes           starts with "BUILDING:"
 *   - Tenant.email         ends with "@demo.tenant"
 *   - PropertyOwner.email  ends with "@cre.demo"
 *   - TenancyContract.createdBy = "demo-seed"
 */

const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

const CONFIRM = process.argv.includes('--confirm')

async function main() {
  const mode = CONFIRM ? 'DELETE' : 'DRY RUN'
  console.log(`\n=== Alwaan demo-data cleanup · ${mode} ===\n`)

  // 1. Discover targets
  const seedOwners = await p.propertyOwner.findMany({
    where: { email: { endsWith: '@cre.demo' } },
    select: { id: true, ownerName: true, email: true },
  })
  const seedUnits = await p.unit.findMany({
    where: { notes: { startsWith: 'BUILDING:' } },
    select: { id: true, unitNo: true, tenantId: true, notes: true },
  })
  const seedTenants = await p.tenant.findMany({
    where: { email: { endsWith: '@demo.tenant' } },
    select: { id: true, name: true, email: true },
  })
  const seedContracts = await p.tenancyContract.findMany({
    where: { createdBy: 'demo-seed' },
    select: { id: true, contractNo: true },
  })

  const seedUnitIds = seedUnits.map((u) => u.id)
  const seedTenantIds = seedTenants.map((t) => t.id)
  const seedOwnerIds = seedOwners.map((o) => o.id)
  const seedContractIds = seedContracts.map((c) => c.id)

  // 2. Count cascaded dependents
  const orByTenantOrUnit = {
    OR: [
      ...(seedTenantIds.length ? [{ tenantId: { in: seedTenantIds } }] : []),
      ...(seedUnitIds.length ? [{ unitId: { in: seedUnitIds } }] : []),
    ],
  }

  const invoiceCount = await p.invoice.count({ where: orByTenantOrUnit })
  const invoiceIds = (
    await p.invoice.findMany({ where: orByTenantOrUnit, select: { id: true } })
  ).map((i) => i.id)
  const paymentCount = invoiceIds.length
    ? await p.payment.count({ where: { invoiceId: { in: invoiceIds } } })
    : 0
  const chequeCount = await p.cheque.count({ where: orByTenantOrUnit })
  const maintCount = await p.maintenanceTicket.count({ where: orByTenantOrUnit })
  const renewalCount = await p.renewalRequest.count({ where: orByTenantOrUnit })
  const complaintCount = await p.complaint.count({ where: orByTenantOrUnit })
  const violationCount = await p.violation.count({ where: orByTenantOrUnit })
  const parkingCount = await p.parkingSlot.count({ where: orByTenantOrUnit })
  const dewaCount = await p.dewaReading.count({ where: orByTenantOrUnit })
  const docCount = seedTenantIds.length
    ? await p.tenantDocument.count({ where: { tenantId: { in: seedTenantIds } } })
    : 0
  const notifCount = seedTenantIds.length
    ? await p.notification.count({ where: { recipientId: { in: seedTenantIds } } })
    : 0
  const historyCount = await p.contractHistory.count({ where: orByTenantOrUnit })
  const feeCount = await p.feeLedger.count({ where: orByTenantOrUnit })
  const ownerContractCount = seedOwnerIds.length
    ? await p.ownerContract.count({ where: { ownerId: { in: seedOwnerIds } } })
    : 0
  const buildingImgCount = seedOwnerIds.length
    ? await p.buildingImage.count({ where: { ownerId: { in: seedOwnerIds } } })
    : 0

  // Demo income/expense (seed created "<Month> rent collection" / "<Month> expenses")
  const incomeCount = await p.income.count({
    where: {
      OR: [
        { notes: { contains: 'rent collection' } },
        { category: { equals: 'Rent' }, notes: { contains: 'collection' } },
      ],
    },
  })
  const expenseCount = await p.expense.count({
    where: { notes: { contains: 'expenses' } },
  })

  console.log('Records to remove:')
  console.log('  Property owners       :', seedOwners.length, '  (emails @cre.demo)')
  console.log('  Units                 :', seedUnits.length, '  (notes starts with BUILDING:)')
  console.log('  Tenants               :', seedTenants.length, '  (emails @demo.tenant)')
  console.log('  Tenancy contracts     :', seedContracts.length, '  (createdBy=demo-seed)')
  console.log('  Invoices              :', invoiceCount)
  console.log('  Payments              :', paymentCount)
  console.log('  Cheques               :', chequeCount)
  console.log('  Maintenance tickets   :', maintCount)
  console.log('  Renewal requests      :', renewalCount)
  console.log('  Complaints            :', complaintCount)
  console.log('  Violations            :', violationCount)
  console.log('  Parking slots         :', parkingCount)
  console.log('  DEWA readings         :', dewaCount)
  console.log('  Tenant documents      :', docCount)
  console.log('  Notifications         :', notifCount)
  console.log('  Contract history      :', historyCount)
  console.log('  Fee ledger            :', feeCount)
  console.log('  Owner contracts       :', ownerContractCount)
  console.log('  Building images       :', buildingImgCount)
  console.log('  Demo income rows      :', incomeCount, '  (seed monthly income)')
  console.log('  Demo expense rows     :', expenseCount, '  (seed monthly expenses)')

  if (!CONFIRM) {
    console.log('\nDRY RUN complete. Re-run with --confirm to apply.\n')
    await p.$disconnect()
    return
  }

  console.log('\nDeleting... (will happen in one transaction per step)\n')

  // 3. Delete in FK-safe order
  await p.$transaction(async (tx) => {
    // Payments cascade on Invoice, but delete explicitly for clarity
    if (invoiceIds.length) {
      await tx.payment.deleteMany({ where: { invoiceId: { in: invoiceIds } } })
    }
    if (invoiceCount) await tx.invoice.deleteMany({ where: orByTenantOrUnit })
    if (chequeCount) await tx.cheque.deleteMany({ where: orByTenantOrUnit })
    if (maintCount) {
      const tickets = await tx.maintenanceTicket.findMany({
        where: orByTenantOrUnit,
        select: { id: true },
      })
      const ticketIds = tickets.map((t) => t.id)
      if (ticketIds.length) {
        await tx.workOrder.deleteMany({ where: { ticketId: { in: ticketIds } } })
        // TicketComment cascades on ticket delete
        await tx.maintenanceTicket.deleteMany({ where: { id: { in: ticketIds } } })
      }
    }
    if (renewalCount) await tx.renewalRequest.deleteMany({ where: orByTenantOrUnit })
    if (complaintCount) await tx.complaint.deleteMany({ where: orByTenantOrUnit })
    if (violationCount) await tx.violation.deleteMany({ where: orByTenantOrUnit })
    if (parkingCount) await tx.parkingSlot.deleteMany({ where: orByTenantOrUnit })
    if (dewaCount) await tx.dewaReading.deleteMany({ where: orByTenantOrUnit })
    if (docCount && seedTenantIds.length)
      await tx.tenantDocument.deleteMany({ where: { tenantId: { in: seedTenantIds } } })
    if (notifCount && seedTenantIds.length)
      await tx.notification.deleteMany({ where: { recipientId: { in: seedTenantIds } } })
    if (historyCount) await tx.contractHistory.deleteMany({ where: orByTenantOrUnit })
    if (feeCount) await tx.feeLedger.deleteMany({ where: orByTenantOrUnit })
    if (seedContractIds.length)
      await tx.tenancyContract.deleteMany({ where: { id: { in: seedContractIds } } })

    // Units: clear tenant link, then delete
    if (seedUnitIds.length) {
      await tx.unit.updateMany({
        where: { id: { in: seedUnitIds } },
        data: { tenantId: null },
      })
    }
    if (seedTenants.length) {
      await tx.tenant.deleteMany({ where: { id: { in: seedTenantIds } } })
    }
    if (seedUnitIds.length) {
      await tx.unit.deleteMany({ where: { id: { in: seedUnitIds } } })
    }
    if (seedOwnerIds.length) {
      // OwnerContract + BuildingImage cascade on PropertyOwner delete
      await tx.propertyOwner.deleteMany({ where: { id: { in: seedOwnerIds } } })
    }
    if (incomeCount) {
      await tx.income.deleteMany({
        where: {
          OR: [
            { notes: { contains: 'rent collection' } },
            { category: { equals: 'Rent' }, notes: { contains: 'collection' } },
          ],
        },
      })
    }
    if (expenseCount) {
      await tx.expense.deleteMany({ where: { notes: { contains: 'expenses' } } })
    }
  })

  console.log('✓ Cleanup complete.\n')

  // 4. After-state sanity check
  const remainingUnits = await p.unit.count()
  const occupied = await p.unit.count({ where: { status: 'Occupied' } })
  const vacant = await p.unit.count({ where: { status: 'Vacant' } })
  console.log('Units remaining:', remainingUnits, `(Occupied ${occupied} / Vacant ${vacant})`)

  await p.$disconnect()
}

main().catch(async (e) => {
  console.error('\n✗ Cleanup failed:', e)
  await p.$disconnect()
  process.exit(1)
})
