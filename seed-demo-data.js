/* Seed dummy data so the CEO dashboard, owner portal and PM views look populated.
 * Run: node seed-demo-data.js
 *
 * Idempotent-ish: skips owners/units if they already exist for the same names.
 */
const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

const OWNERS = [
  { ownerName: 'Khalifa Zayed Al Nehayan',  email: 'k.alnehayan@cre.demo', phone: '+971 4 111 1111', buildingName: 'Oasis Tower',     area: 'Trade Center 2',  totalUnits: 12, baseRent: 75000  },
  { ownerName: 'Maryam Saeed Al Maktoum',   email: 'm.almaktoum@cre.demo', phone: '+971 4 222 2222', buildingName: 'Marina Heights',  area: 'Dubai Marina',    totalUnits: 18, baseRent: 110000 },
  { ownerName: 'Ahmed Hassan Al Falasi',    email: 'a.alfalasi@cre.demo',  phone: '+971 4 333 3333', buildingName: 'Greens Plaza',    area: 'The Greens',      totalUnits: 10, baseRent: 65000  },
]

const FIRST_NAMES  = ['Mohammed','Fatima','Ali','Aisha','Omar','Layla','Khalid','Mariam','Yusuf','Hana','Tariq','Noura','Salim','Reem','Hamza','Rania','Bilal','Sara','Imran','Zainab']
const LAST_NAMES   = ['Khan','Al Suwaidi','Hassan','Mansoor','Hussain','Patel','Sharma','Al Marri','El Sayed','Ibrahim','Rahman','Khoury','Naji','Said','Hijazi','Younis']
const BANKS        = ['Emirates NBD','ADCB','Mashreq','RAK Bank','HSBC UAE','FAB','Dubai Islamic Bank']
const NATIONALITIES = ['Emirati','Indian','Pakistani','Egyptian','Filipino','British','Lebanese','Syrian','Jordanian']

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function randomName() { return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}` }
function pad(n, w) { return String(n).padStart(w, '0') }
function isoDate(d) { return d.toISOString().slice(0,10) }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate()+n); return x }
function addMonths(d, n) { const x = new Date(d); x.setMonth(x.getMonth()+n); return x }
function aedRound(n) { return Math.round(n) }

async function main() {
  // Find / create the demo organization (use the first one in the DB)
  const org = await p.organization.findFirst()
  if (!org) {
    console.error('No Organization found. Run the app once and sign in as admin to create one.')
    process.exit(1)
  }
  console.log('Seeding into organization:', org.name)

  for (const o of OWNERS) {
    const existing = await p.propertyOwner.findFirst({ where: { organizationId: org.id, ownerName: o.ownerName } })
    let owner
    if (existing) {
      owner = existing
      console.log(' - Owner exists:', o.ownerName)
    } else {
      owner = await p.propertyOwner.create({
        data: {
          organizationId: org.id,
          ownerName: o.ownerName,
          email: o.email,
          phone: o.phone,
          ownerType: 'Individual',
          nationality: 'Emirati',
          buildingName: o.buildingName,
          buildingType: 'Residential',
          area: o.area,
          plotNo: pad(Math.floor(Math.random()*900)+100, 3) + '-0',
          makaniNo: pad(Math.floor(Math.random()*99999), 5) + ' ' + pad(Math.floor(Math.random()*99999), 5),
          totalUnits: o.totalUnits,
          totalFloors: Math.ceil(o.totalUnits / 4),
          serviceType: 'Full Property Management',
          emirate: 'Dubai',
        },
      })
      console.log(' + Owner created:', owner.ownerName)
    }

    // Create units (skip duplicates)
    const existingUnits = await p.unit.findMany({
      where: { organizationId: org.id, notes: { contains: `BUILDING:${o.buildingName}` } },
    })
    const existingNos = new Set(existingUnits.map((u) => u.unitNo))

    // Prefix unit numbers per building so they're globally unique.
    const bldCode = o.buildingName.split(' ').map((w) => w[0]).join('').toUpperCase()
    let createdUnits = 0
    for (let i = 0; i < o.totalUnits; i++) {
      const floor = Math.floor(i / 4) + 1
      const unitNo = `${bldCode}-${floor}${pad((i%4)+1, 2)}`
      if (existingNos.has(unitNo)) continue

      // ~70% occupied, 30% vacant
      const isOccupied = Math.random() < 0.7
      const rent = aedRound(o.baseRent + (Math.random()-0.5) * o.baseRent * 0.2)
      let tenantId = null
      let contractStart = ''
      let contractEnd = ''

      if (isOccupied) {
        const startMonthsAgo = Math.floor(Math.random() * 10) + 1
        const start = addMonths(new Date(), -startMonthsAgo)
        const end = addMonths(start, 12)
        contractStart = isoDate(start)
        contractEnd = isoDate(end)

        const tName = randomName()
        const tEmail = `${tName.toLowerCase().replace(/[^a-z]/g, '.')}@demo.tenant`
        const tenant = await p.tenant.create({
          data: {
            organizationId: org.id,
            name: tName,
            email: tEmail,
            phone: '+971 5' + pad(Math.floor(Math.random()*10000000), 7),
            emiratesId: `784-${1980+Math.floor(Math.random()*40)}-${pad(Math.floor(Math.random()*9999999),7)}-${Math.floor(Math.random()*10)}`,
            nationality: pick(NATIONALITIES),
            status: 'Active',
            familySize: Math.floor(Math.random()*5),
            occupation: pick(['Engineer','Teacher','Doctor','Sales Manager','Accountant','Designer','Consultant']),
          },
        })
        tenantId = tenant.id

        // Tenancy contract
        const numCheques = pick([1,2,4,6,12])
        const perCheque = aedRound(rent / numCheques)
        const contractNo = `TC-${new Date().getFullYear()}-${pad(Math.floor(Math.random()*9999), 4)}`
        const contract = await p.tenancyContract.create({
          data: {
            organizationId: org.id,
            tenantId,
            unitId: '', // set below after unit insert (we'll use a 2-step; or fill placeholder + update)
            contractNo,
            version: 1,
            status: 'Active',
            contractStart,
            contractEnd,
            rentAmount: rent,
            numberOfCheques: numCheques,
            securityDeposit: aedRound(rent * 0.05),
            ejariFee: 250,
            municipalityFee: 210,
            commissionFee: aedRound(rent * 0.05),
            contractType: 'Residential',
            purpose: 'Family Residence',
            reason: 'Initial',
            createdBy: 'demo-seed',
            signatureToken: 'seed-' + Math.random().toString(36).slice(2),
            htmlBody: '<p>Demo seed contract.</p>',
          },
        })

        // Create unit + back-link tenant
        const unit = await p.unit.create({
          data: {
            organizationId: org.id,
            unitNo,
            unitType: pick(['Studio','1 BHK','2 BHK','3 BHK']),
            status: 'Occupied',
            tenantId,
            currentRent: rent,
            contractStart,
            contractEnd,
            notes: `BUILDING:${o.buildingName}`,
          },
        })
        await p.tenancyContract.update({ where: { id: contract.id }, data: { unitId: unit.id } })

        // Cheques
        for (let j = 0; j < numCheques; j++) {
          const seq = j + 1
          const dueDate = isoDate(addMonths(start, j * Math.round(12 / numCheques)))
          const cleared = dueDate < isoDate(new Date())
          await p.cheque.create({
            data: {
              organizationId: org.id,
              tenantId,
              unitId: unit.id,
              chequeNo: pad(Math.floor(Math.random()*900000)+100000, 6),
              chequeDate: dueDate,
              amount: perCheque,
              bankName: pick(BANKS),
              status: cleared ? 'Cleared' : 'Pending',
              clearedDate: cleared ? dueDate : '',
              sequenceNo: seq,
              totalCheques: numCheques,
              paymentType: 'Rent',
            },
          })
        }

        // 1-3 invoices per tenant
        const invCount = Math.floor(Math.random()*3) + 1
        for (let k = 0; k < invCount; k++) {
          const inv = await p.invoice.create({
            data: {
              organizationId: org.id,
              tenantId,
              unitId: unit.id,
              invoiceNo: `INV-${new Date().getFullYear()}-${pad(Math.floor(Math.random()*99999), 5)}`,
              type: pick(['Maintenance','Service Charges','Late Fee','Utilities']),
              amount: aedRound(Math.random()*1500 + 200),
              vatAmount: 0,
              totalAmount: 0,
              dueDate: isoDate(addDays(new Date(), Math.floor(Math.random()*60)-30)),
              periodStart: isoDate(start),
              periodEnd: contractEnd,
              status: pick(['Sent','Paid','Sent','Overdue']),
              paidAmount: 0,
            },
          })
          // Set totalAmount = amount for simplicity
          await p.invoice.update({ where: { id: inv.id }, data: { totalAmount: inv.amount } })
        }

        createdUnits++
      } else {
        // Vacant unit
        await p.unit.create({
          data: {
            organizationId: org.id,
            unitNo,
            unitType: pick(['Studio','1 BHK','2 BHK','3 BHK']),
            status: 'Vacant',
            currentRent: rent,
            notes: `BUILDING:${o.buildingName}`,
          },
        })
        createdUnits++
      }
    }
    console.log(`   → ${createdUnits} unit(s) added for ${o.buildingName}`)
  }

  // Income + expense for the dashboard charts
  const today = new Date()
  for (let m = 5; m >= 0; m--) {
    const d = addMonths(today, -m)
    await p.income.create({
      data: {
        organizationId: org.id,
        category: 'Rent',
        amount: aedRound(180000 + Math.random()*50000),
        date: isoDate(d),
        description: `${d.toLocaleString('en-GB',{month:'short'})} rent collection`,
      },
    }).catch(() => {})
    await p.expense.create({
      data: {
        organizationId: org.id,
        category: pick(['Maintenance','Utilities','Salaries','Marketing']),
        amount: aedRound(40000 + Math.random()*30000),
        date: isoDate(d),
        description: `${d.toLocaleString('en-GB',{month:'short'})} expenses`,
      },
    }).catch(() => {})
  }

  console.log('\n✓ Demo data seeded.')
  await p.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
