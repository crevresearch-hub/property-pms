/**
 * Wipes all application data from the database, leaving only:
 *   - Organization rows (so you can still sign in)
 *   - User rows          (so your admin login still works)
 *
 * Everything else — units, tenants, contracts, invoices, cheques, owners,
 * maintenance, documents, etc. — is deleted.
 *
 *   node reset-org-data.js              # DRY RUN  (counts only, no writes)
 *   node reset-org-data.js --confirm    # actually delete
 */

const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

const CONFIRM = process.argv.includes('--confirm')

// Ordered so children are deleted before their parents.
const TABLES = [
  'payment',
  'invoice',
  'cheque',
  'ticketComment',
  'workOrder',
  'maintenanceTicket',
  'renewalRequest',
  'contractHistory',
  'complaint',
  'violation',
  'parkingSlot',
  'dewaReading',
  'tenantDocument',
  'notification',
  'feeLedger',
  'tenancyContract',
  'buildingImage',
  'ownerContract',
  'propertyOwner',
  'vendor',
  'emailLog',
  'activityLog',
  'income',
  'expense',
  'unit',
  'tenant',
]

async function main() {
  const mode = CONFIRM ? 'DELETE' : 'DRY RUN'
  console.log(`\n=== Reset org data · ${mode} ===\n`)

  const counts = {}
  for (const t of TABLES) {
    counts[t] = await p[t].count()
  }
  const orgCount = await p.organization.count()
  const userCount = await p.user.count()

  console.log('Tables to WIPE:')
  for (const t of TABLES) console.log(`  ${t.padEnd(22)} ${counts[t]}`)
  console.log('\nTables to KEEP:')
  console.log(`  organization          ${orgCount}`)
  console.log(`  user                  ${userCount}`)

  if (!CONFIRM) {
    console.log('\nDRY RUN complete. Re-run with --confirm to apply.\n')
    await p.$disconnect()
    return
  }

  console.log('\nDeleting...\n')
  // Neon's default interactive-transaction timeout is 5 s, which isn't enough
  // across a cross-region link. Run each deleteMany as its own atomic call.
  await p.unit.updateMany({ data: { tenantId: null } })
  for (const t of TABLES) {
    const r = await p[t].deleteMany({})
    console.log(`  ${t.padEnd(22)} deleted ${r.count}`)
  }

  console.log('✓ Reset complete.\n')
  const after = {}
  for (const t of TABLES) after[t] = await p[t].count()
  console.log('Post-reset counts:', after)
  await p.$disconnect()
}

main().catch(async (e) => {
  console.error('\n✗ Reset failed:', e)
  await p.$disconnect()
  process.exit(1)
})
