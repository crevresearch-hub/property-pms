import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { createNotification } from '@/lib/notifications'
import { buildContractHTML, type PropertyOwnerRecord } from '@/lib/contract-builder'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

/**
 * Public (unauthenticated) e-signature endpoint.
 * The signatureToken acts as the bearer credential.
 *
 * Handles BOTH:
 *   - OwnerContract (Property Management Agreement) → kind: "owner"
 *   - TenancyContract (Unified Tenancy / DLD)        → kind: "tenant"
 */

type SignKind = 'owner' | 'tenant'

async function resolveContract(token: string): Promise<
  | { kind: 'owner'; contract: Awaited<ReturnType<typeof prisma.ownerContract.findFirst>> & { owner: NonNullable<unknown> } }
  | { kind: 'tenant'; contract: Awaited<ReturnType<typeof prisma.tenancyContract.findFirst>> }
  | null
> {
  const owner = await prisma.ownerContract.findFirst({
    where: { signatureToken: token },
    include: {
      owner: { include: { organization: { select: { name: true } } } },
    },
  })
  if (owner) return { kind: 'owner', contract: owner as never }

  const tenant = await prisma.tenancyContract.findFirst({
    where: { signatureToken: token },
  })
  if (tenant) return { kind: 'tenant', contract: tenant as never }

  return null
}

/* ------------------------------------------------------------------ */
/* GET                                                                */
/* ------------------------------------------------------------------ */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    }

    const resolved = await resolveContract(token)
    if (!resolved) {
      return NextResponse.json({ error: 'Invalid or expired signature link' }, { status: 404 })
    }

    if (resolved.kind === 'owner') {
      const contract = resolved.contract as NonNullable<Awaited<ReturnType<typeof prisma.ownerContract.findFirst>>> & {
        owner: { organization: { name: string } | null } & Record<string, unknown>
      }
      if (contract.ownerSignedAt) {
        return NextResponse.json({ error: 'This contract has already been signed.' }, { status: 410 })
      }
      if (!['Draft', 'Sent'].includes(contract.status)) {
        return NextResponse.json(
          { error: `This contract is no longer available for signing (status: ${contract.status}).` },
          { status: 410 }
        )
      }

      const baseUrl = process.env.NEXTAUTH_URL || ''
      const primaryImage = await prisma.buildingImage.findFirst({
        where: { ownerId: contract.ownerId, organizationId: contract.organizationId, isPrimary: true },
        select: { id: true },
      })
      const primaryImagePath = primaryImage
        ? `/api/owners/${contract.ownerId}/images/${primaryImage.id}/file`
        : undefined

      const ownerForBuilder = {
        ...contract.owner,
        signatureToken: contract.signatureToken,
        ownerSignatureImage: contract.ownerSignatureImage || undefined,
        creSignatureImage: contract.creSignatureImage || undefined,
        ownerSignedAt: contract.ownerSignedAt,
        creSignedAt: contract.creSignedAt,
        ownerIpAddress: contract.ownerIpAddress,
        signedByOwnerName: contract.signedByOwnerName,
        signedByCREName: contract.signedByCREName,
      } as unknown as PropertyOwnerRecord

      const htmlBody = buildContractHTML(
        ownerForBuilder,
        contract.owner.organization?.name || 'CRE',
        baseUrl,
        primaryImagePath
      )

      return NextResponse.json({
        kind: 'owner' as SignKind,
        contract: {
          id: contract.id,
          contractNo: contract.contractNo,
          version: contract.version,
          status: contract.status,
          serviceType: contract.serviceType,
          startDate: contract.startDate,
          endDate: contract.endDate,
          contractTerm: contract.contractTerm,
          ownerName: (contract.owner as unknown as { ownerName: string })?.ownerName || '',
          ownerEmail: (contract.owner as unknown as { email: string })?.email || '',
          buildingName: (contract.owner as unknown as { buildingName: string })?.buildingName || '',
          ownerSigned: !!contract.ownerSignedAt,
          creSigned: !!contract.creSignedAt,
        },
        htmlBody,
      })
    }

    // tenancy
    const tc = resolved.contract as NonNullable<Awaited<ReturnType<typeof prisma.tenancyContract.findFirst>>>
    if (tc.signedByTenantAt) {
      return NextResponse.json({ error: 'This contract has already been signed.' }, { status: 410 })
    }
    if (!['Draft', 'Sent'].includes(tc.status)) {
      return NextResponse.json(
        { error: `This contract is no longer available for signing (status: ${tc.status}).` },
        { status: 410 }
      )
    }

    const tenant = await prisma.tenant.findFirst({
      where: { id: tc.tenantId, organizationId: tc.organizationId },
      select: { id: true, name: true, email: true },
    })

    return NextResponse.json({
      kind: 'tenant' as SignKind,
      contract: {
        id: tc.id,
        contractNo: tc.contractNo,
        version: tc.version,
        status: tc.status,
        contractStart: tc.contractStart,
        contractEnd: tc.contractEnd,
        rentAmount: tc.rentAmount,
        contractType: tc.contractType,
        tenantName: tenant?.name || '',
        tenantEmail: tenant?.email || '',
        signed: !!tc.signedByTenantAt,
      },
      htmlBody: tc.htmlBody,
    })
  } catch (error) {
    console.error('GET /api/sign/[token] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/* ------------------------------------------------------------------ */
/* POST                                                               */
/* ------------------------------------------------------------------ */

function extFromDataUrl(dataUrl: string): string {
  const m = /^data:([^;]+);base64,/.exec(dataUrl)
  if (!m) return 'bin'
  const mime = m[1].toLowerCase()
  if (mime === 'image/png') return 'png'
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpg'
  if (mime === 'application/pdf') return 'pdf'
  if (mime === 'image/webp') return 'webp'
  return 'bin'
}

async function saveEidAttachment(
  organizationId: string,
  tenantId: string,
  dataUrl: string
): Promise<void> {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl)
  if (!m) return
  const mime = m[1].toLowerCase()
  const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf', 'image/webp']
  if (!allowed.includes(mime)) return
  const base64 = m[2]
  const buffer = Buffer.from(base64, 'base64')
  if (buffer.length === 0 || buffer.length > 5 * 1024 * 1024) return // 5MB cap

  const ext = extFromDataUrl(dataUrl)
  const timestamp = Date.now()
  const filename = `emirates-id-${timestamp}.${ext}`

  const uploadDir = path.join(process.cwd(), 'uploads', `tenant_${tenantId}`)
  await mkdir(uploadDir, { recursive: true })
  const fullPath = path.join(uploadDir, filename)
  await writeFile(fullPath, buffer)

  await prisma.tenantDocument.create({
    data: {
      organizationId,
      tenantId,
      docType: 'Emirates ID',
      filename,
      originalFilename: `Emirates ID (self-uploaded).${ext}`,
      filePath: `uploads/tenant_${tenantId}/${filename}`,
      fileSize: buffer.length,
      status: 'Uploaded', // CRE must verify before approving
    },
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    const signatureImage = String(body?.signatureImage || '')
    const signedByName = String(body?.signedByName || '').trim()
    const agreed = body?.agreed === true
    const emiratesIdAttachment =
      typeof body?.emiratesIdAttachment === 'string' ? body.emiratesIdAttachment : ''
    const familySizeRaw = Number(body?.familySize)
    const familySize =
      Number.isFinite(familySizeRaw) && familySizeRaw >= 1 ? Math.floor(familySizeRaw) : null
    const emergencyContactName =
      typeof body?.emergencyContactName === 'string'
        ? body.emergencyContactName.trim()
        : ''
    const emergencyContactPhone =
      typeof body?.emergencyContactPhone === 'string'
        ? body.emergencyContactPhone.trim()
        : ''

    if (!agreed) {
      return NextResponse.json({ error: 'You must agree to the terms.' }, { status: 400 })
    }
    if (!signedByName || signedByName.length < 2) {
      return NextResponse.json({ error: 'Please enter your full name.' }, { status: 400 })
    }
    if (!signatureImage.startsWith('data:image/png;base64,')) {
      return NextResponse.json({ error: 'Invalid signature image.' }, { status: 400 })
    }

    const resolved = await resolveContract(token)
    if (!resolved) {
      return NextResponse.json({ error: 'Invalid or expired signature link' }, { status: 404 })
    }

    const forwarded = request.headers.get('x-forwarded-for') || ''
    const ip = (forwarded.split(',')[0] || request.headers.get('x-real-ip') || '').trim()
    const userAgent = request.headers.get('user-agent') || ''
    const now = new Date()

    /* --------------------------- OWNER CONTRACT --------------------------- */
    if (resolved.kind === 'owner') {
      const contract = resolved.contract as NonNullable<Awaited<ReturnType<typeof prisma.ownerContract.findFirst>>> & {
        owner: { ownerName: string; buildingName: string; id: string; email: string; contractSignedAt: Date | null }
      }
      if (contract.ownerSignedAt) {
        return NextResponse.json({ error: 'This contract has already been signed.' }, { status: 410 })
      }
      if (!['Draft', 'Sent'].includes(contract.status)) {
        return NextResponse.json(
          { error: `This contract is no longer available for signing (status: ${contract.status}).` },
          { status: 410 }
        )
      }

      const bothSigned = !!contract.creSignedAt
      const newStatus = bothSigned ? 'Active' : 'Sent'

      if (bothSigned) {
        await prisma.ownerContract.updateMany({
          where: {
            organizationId: contract.organizationId,
            ownerId: contract.ownerId,
            status: 'Active',
            id: { not: contract.id },
          },
          data: { status: 'Superseded', supersededById: contract.id },
        })
      }

      await prisma.ownerContract.update({
        where: { id: contract.id },
        data: {
          ownerSignatureImage: signatureImage,
          signedByOwnerName: signedByName,
          ownerIpAddress: ip || '',
          ownerUserAgent: userAgent,
          ownerSignedAt: now,
          status: newStatus,
          signedAt: bothSigned ? now : contract.signedAt,
        },
      })

      await prisma.propertyOwner.update({
        where: { id: contract.ownerId },
        data: {
          signedByOwner: true,
          contractSignedAt: bothSigned ? now : contract.owner.contractSignedAt,
          stage: bothSigned ? 'Contract Signed' : 'Proposal Sent',
        },
      })

      const baseUrl = process.env.NEXTAUTH_URL || ''
      await createNotification(
        contract.organizationId,
        'staff',
        '',
        'Owner Signed Contract',
        `Owner ${signedByName} signed ${contract.contractNo} v${contract.version} – awaiting CRE counter-signature`,
        'system'
      )

      try {
        const admins = await prisma.user.findMany({
          where: { organizationId: contract.organizationId, role: 'admin', isActive: true },
        })
        const dashboardUrl = `${baseUrl}/dashboard/owners/${contract.owner.id}/edit`
        for (const admin of admins) {
          await sendEmail({
            organizationId: contract.organizationId,
            to: admin.email,
            toName: admin.name,
            subject: `✓ Owner Signed: ${contract.contractNo} — ${contract.owner.buildingName}`,
            html: `
              <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
                <div style="background:#fff;border-left:4px solid #E30613;padding:12px 16px;border-radius:4px;margin-bottom:20px;">
                  <h2 style="color:#E30613;margin:0 0 6px 0;">Owner Has Signed the Agreement</h2>
                  <p style="margin:0;color:#000;">Action required: Counter-sign to activate the contract.</p>
                </div>
                <p>Dear ${admin.name || 'Alwaan Admin'},</p>
                <p><strong>${contract.owner.ownerName}</strong> has signed the Property Management Agreement for <strong>${contract.owner.buildingName}</strong>.</p>
                <table style="border-collapse:collapse;margin:16px 0;">
                  <tr><td style="padding:6px 12px 6px 0;color:#6b7280;">Contract No:</td><td><strong>${contract.contractNo}</strong></td></tr>
                  <tr><td style="padding:6px 12px 6px 0;color:#6b7280;">Version:</td><td>v${contract.version}</td></tr>
                  <tr><td style="padding:6px 12px 6px 0;color:#6b7280;">Signed At:</td><td>${now.toLocaleString('en-GB')}</td></tr>
                  <tr><td style="padding:6px 12px 6px 0;color:#6b7280;">Signed By:</td><td>${signedByName}</td></tr>
                  <tr><td style="padding:6px 12px 6px 0;color:#6b7280;">IP Address:</td><td>${ip || 'n/a'}</td></tr>
                </table>
                <p style="margin:24px 0;">
                  <a href="${dashboardUrl}" style="background:#E30613;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600;display:inline-block;">
                    Review &amp; Counter-Sign
                  </a>
                </p>
                <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"/>
                <p style="color:#6b7280;font-size:12px;">CRE · CRE System · Dubai, UAE</p>
              </div>
            `,
            template: 'admin_owner_signed',
            refType: 'contract',
            refId: contract.id,
          })
        }
      } catch (e) {
        console.error('admin notification email failed:', e)
      }

      return NextResponse.json({
        kind: 'owner',
        message: 'Signature recorded',
        signedAt: now.toISOString(),
        bothSigned,
      })
    }

    /* --------------------------- TENANCY CONTRACT ------------------------- */
    const tc = resolved.contract as NonNullable<Awaited<ReturnType<typeof prisma.tenancyContract.findFirst>>>
    if (tc.signedByTenantAt) {
      return NextResponse.json({ error: 'This contract has already been signed.' }, { status: 410 })
    }
    if (!['Draft', 'Sent'].includes(tc.status)) {
      return NextResponse.json(
        { error: `This contract is no longer available for signing (status: ${tc.status}).` },
        { status: 410 }
      )
    }

    // Embed the tenant signature image directly inside BOTH "Tenant Signature"
    // boxes of the contract snapshot (top and bottom), so the signed contract
    // looks properly signed in place rather than having a trailing footer.
    let updatedHtml = tc.htmlBody || ''
    const dateStr = now.toLocaleDateString('en-GB')
    const safeName = signedByName.replace(/[<>]/g, '')
    const sigImg = `<img src="${signatureImage}" alt="Signed" style="max-height:46px;display:block;margin:4px 0 2px 0;"/>`
    const sigMeta = `<div style="font-size:9px;color:#666;margin-top:2px;">Signed electronically · IP ${(ip || 'n/a').replace(/[<>]/g, '')}</div>`

    // Replace unsigned tenant signature blocks (both occurrences in the template)
    const tenantBoxRe = /(<div class="label">Tenant Signature \/ توقيع المستأجر<\/div>)\s*<div class="line">([^<]*<span>[^<]*<\/span>)<span>Date: ____________<\/span><\/div>/g
    updatedHtml = updatedHtml.replace(tenantBoxRe, (_m, label) => {
      return `${label}
        <div style="min-height:50px;padding:2px 0;">${sigImg}</div>
        <div class="line"><span>${safeName}</span><span>Date: ${dateStr}</span></div>
        ${sigMeta}`
    })

    // Fallback: if nothing matched (template drift), append a footer block so
    // the signature is still visible.
    if (!updatedHtml.includes(signatureImage)) {
      const sigHtml = `
        <div style="padding:14px 24px;border-top:3px solid #E30613;background:#fff;margin-top:10px;">
          <p style="margin:0 0 6px 0;font-size:11px;color:#E30613;font-weight:700;">TENANT ELECTRONIC SIGNATURE</p>
          <img src="${signatureImage}" alt="Tenant signature" style="max-height:60px;display:block;"/>
          <div style="font-size:10px;color:#555;margin-top:4px;">${safeName} · ${now.toLocaleString('en-GB')} · IP ${(ip || 'n/a').replace(/[<>]/g, '')}</div>
        </div>`
      if (updatedHtml.includes('</div>\n</body>')) {
        updatedHtml = updatedHtml.replace('</div>\n</body>', `${sigHtml}\n</div>\n</body>`)
      } else {
        updatedHtml = updatedHtml + sigHtml
      }
    }

    await prisma.tenancyContract.update({
      where: { id: tc.id },
      data: {
        signedByTenantAt: now,
        status: 'Sent',
        sentAt: tc.sentAt ?? now,
        htmlBody: updatedHtml,
        notes: [
          tc.notes || '',
          `Signed electronically by ${signedByName} at ${now.toISOString()} from IP ${ip || 'n/a'} (UA: ${userAgent.slice(0, 120)})`,
        ]
          .filter(Boolean)
          .join('\n'),
      },
    })

    // Save tenant-provided fields + flip status.
    const tenantUpdate: Record<string, unknown> = { status: 'Signed' }
    if (familySize) tenantUpdate.familySize = familySize
    if (emergencyContactName) tenantUpdate.emergencyContactName = emergencyContactName
    if (emergencyContactPhone) tenantUpdate.emergencyContactPhone = emergencyContactPhone

    // Identity fields typed by the tenant on the sign page
    const tenantNameAr = typeof body?.tenantNameAr === 'string' ? body.tenantNameAr.trim() : ''
    const tenantEidNumberRaw = typeof body?.tenantEidNumber === 'string' ? body.tenantEidNumber.trim() : ''
    const tenantEidExpiry = typeof body?.tenantEidExpiry === 'string' ? body.tenantEidExpiry.trim() : ''
    const tenantNationality = typeof body?.tenantNationality === 'string' ? body.tenantNationality.trim() : ''

    if (signedByName) tenantUpdate.name = signedByName
    if (signedByName) tenantUpdate.eidNameEn = signedByName
    if (tenantNameAr) tenantUpdate.eidNameAr = tenantNameAr
    if (tenantEidNumberRaw) {
      tenantUpdate.eidNumber = tenantEidNumberRaw
      tenantUpdate.emiratesId = tenantEidNumberRaw
    }
    if (tenantEidExpiry) {
      tenantUpdate.eidExpiry = tenantEidExpiry
      tenantUpdate.emiratesIdExpiry = tenantEidExpiry
    }
    if (tenantNationality) tenantUpdate.nationality = tenantNationality
    if (signedByName || tenantNameAr || tenantEidNumberRaw) {
      tenantUpdate.eidVerifiedAt = new Date()
      tenantUpdate.eidVerifiedBy = 'tenant (self-declared)'
    }

    await prisma.tenant.update({ where: { id: tc.tenantId }, data: tenantUpdate }).catch((e) => {
      console.warn('Failed to save tenant self-provided fields:', e)
    })

    // Rebuild contract HTML with the real identity filled in, preserving signature.
    try {
      const freshTenant = await prisma.tenant.findUnique({ where: { id: tc.tenantId } })
      const fresh = await prisma.tenancyContract.findUnique({ where: { id: tc.id } })
      if (freshTenant && fresh) {
        const unit = await prisma.unit.findUnique({ where: { id: fresh.unitId } })
        const owner = fresh.ownerId
          ? await prisma.propertyOwner.findUnique({ where: { id: fresh.ownerId } })
          : null
        if (unit) {
          const { buildDldTenancyContractHTML } = await import('@/lib/dld-tenancy-contract-builder')
          const baseUrl = process.env.NEXTAUTH_URL || ''
          let newHtml = buildDldTenancyContractHTML({
            tenant: {
              name: freshTenant.name,
              email: freshTenant.email,
              phone: freshTenant.phone,
              emiratesId: freshTenant.emiratesId,
              occupants: freshTenant.familySize,
              isCompany: freshTenant.isCompany,
              companyName: freshTenant.companyName,
              companyTradeLicense: freshTenant.companyTradeLicense,
            },
            unit: {
              unitNo: unit.unitNo,
              unitType: unit.unitType,
              currentRent: fresh.rentAmount,
              contractStart: fresh.contractStart,
              contractEnd: fresh.contractEnd,
            },
            owner: {
              ownerName: owner?.ownerName || '',
              buildingName: owner?.buildingName || '',
              area: owner?.area || '',
              plotNo: owner?.plotNo || '',
              makaniNo: owner?.makaniNo || '',
              dewaPremiseNo: '',
            },
            contractValue: fresh.rentAmount,
            securityDeposit: fresh.securityDeposit,
            numCheques: fresh.numberOfCheques,
            date: new Date().toISOString().slice(0, 10),
          }, baseUrl)

          const dateStr = now.toLocaleDateString('en-GB')
          const safeName = (freshTenant.name || signedByName).replace(/[<>]/g, '')
          const sigImg = `<img src="${signatureImage}" alt="Signed" style="max-height:46px;display:block;margin:4px 0 2px 0;"/>`
          const tenantBoxRe = /(<div class="label">Tenant Signature \/ توقيع المستأجر<\/div>)\s*<div class="line">([^<]*<span>[^<]*<\/span>)<span>Date: ____________<\/span><\/div>/g
          newHtml = newHtml.replace(tenantBoxRe, (_m, label) => {
            return `${label}
              <div style="min-height:50px;padding:2px 0;">${sigImg}</div>
              <div class="line"><span>${safeName}</span><span>Date: ${dateStr}</span></div>`
          })
          await prisma.tenancyContract.update({
            where: { id: tc.id },
            data: { htmlBody: newHtml },
          })
        }
      }
    } catch (e) {
      console.warn('Contract HTML rebuild failed:', e)
    }

    // Optional Emirates ID attachment → save as TenantDocument (status Uploaded)
    if (emiratesIdAttachment && emiratesIdAttachment.startsWith('data:')) {
      try {
        await saveEidAttachment(tc.organizationId, tc.tenantId, emiratesIdAttachment)
      } catch (e) {
        console.error('Failed to save Emirates ID attachment:', e)
      }
    }

    await createNotification(
      tc.organizationId,
      'staff',
      '',
      'Tenant Signed Contract',
      `Tenant ${signedByName} signed tenancy contract ${tc.contractNo} v${tc.version}${
        emiratesIdAttachment ? ' (+ Emirates ID attached)' : ''
      }`,
      'system'
    )

    try {
      const baseUrl = process.env.NEXTAUTH_URL || ''
      const admins = await prisma.user.findMany({
        where: { organizationId: tc.organizationId, role: 'admin', isActive: true },
      })
      const dashboardUrl = `${baseUrl}/dashboard/tenants/${tc.tenantId}/edit`
      for (const admin of admins) {
        await sendEmail({
          organizationId: tc.organizationId,
          to: admin.email,
          toName: admin.name,
          subject: `✓ Tenant Signed: ${tc.contractNo}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#000;">
              <div style="background:#fff;border-left:4px solid #E30613;padding:12px 16px;border-radius:4px;margin-bottom:20px;">
                <h2 style="color:#E30613;margin:0 0 6px 0;">Tenant Has Signed the Tenancy Contract</h2>
                <p style="margin:0;">Review documents and activate the tenant when ready.</p>
              </div>
              <p>Dear ${admin.name || 'Alwaan Admin'},</p>
              <p><strong>${signedByName}</strong> has signed tenancy contract <strong>${tc.contractNo}</strong> v${tc.version}.</p>
              ${
                emiratesIdAttachment
                  ? '<p style="background:#ecfdf5;border:1px solid #a7f3d0;padding:10px 12px;border-radius:6px;">The tenant also attached a copy of their Emirates ID. Please verify it in the tenant profile.</p>'
                  : '<p style="color:#6b7280;">No Emirates ID was attached at signing time — request it during follow-up.</p>'
              }
              <p style="margin:24px 0;">
                <a href="${dashboardUrl}" style="background:#E30613;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600;display:inline-block;">
                  Open Tenant File
                </a>
              </p>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"/>
              <p style="color:#6b7280;font-size:12px;">CRE · CRE System · Dubai, UAE</p>
            </div>
          `,
          template: 'admin_tenant_signed',
          refType: 'tenancy_contract',
          refId: tc.id,
        })
      }
    } catch (e) {
      console.error('admin notification email (tenant signed) failed:', e)
    }

    return NextResponse.json({
      kind: 'tenant',
      message: 'Signature recorded',
      signedAt: now.toISOString(),
      emiratesIdSaved: !!emiratesIdAttachment,
    })
  } catch (error) {
    console.error('POST /api/sign/[token] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
