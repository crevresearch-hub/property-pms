import prisma from '@/lib/prisma'
import { buildContractHTML, type PropertyOwnerRecord } from '@/lib/contract-builder'
import SignatureForm from './SignatureForm'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '—'
  const dt = typeof d === 'string' ? new Date(d) : d
  if (isNaN(dt.getTime())) return String(d)
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtAED(n: number): string {
  return `AED ${Number(n || 0).toLocaleString('en-AE')}`
}

export default async function SignPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  // ----- Try OwnerContract first -----
  const ownerContract = await prisma.ownerContract.findFirst({
    where: { signatureToken: token },
    include: {
      owner: { include: { organization: { select: { name: true } } } },
    },
  })

  // ----- Else TenancyContract -----
  const tenancyContract = ownerContract
    ? null
    : await prisma.tenancyContract.findFirst({
        where: { signatureToken: token },
      })

  if (!ownerContract && !tenancyContract) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-xl shadow-md p-8 text-center">
          <div className="text-[#E30613] text-5xl mb-4">⚠</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Invalid Signature Link</h1>
          <p className="text-gray-600">
            This signature link is invalid or has expired. Please contact Continental Real Estate
            for a new link.
          </p>
          <p className="mt-4 text-xs text-gray-400">info@cre.ae</p>
        </div>
      </div>
    )
  }

  /* ================= OWNER (PM AGREEMENT) ================= */
  if (ownerContract) {
    const contract = ownerContract
    const alreadySigned =
      !!contract.ownerSignedAt || !['Draft', 'Sent'].includes(contract.status)

    let htmlBody = contract.htmlBody || ''
    try {
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

      htmlBody = buildContractHTML(
        ownerForBuilder,
        contract.owner.organization?.name || 'Continental Real Estate',
        baseUrl,
        primaryImagePath
      )
    } catch (e) {
      console.error('sign page: failed to regenerate HTML, using snapshot', e)
    }

    return (
      <div className="min-h-screen bg-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
          <div className="flex flex-col items-center text-center mb-6">
            <img src="/cre-logo.png" alt="Continental Real Estate" className="h-16 w-auto mb-4" />
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Property Management Agreement Signature
            </h1>
            <p dir="rtl" className="mt-1 text-lg text-gray-700" style={{ fontFamily: 'Tahoma, Arial, sans-serif' }}>
              توقيع اتفاقية إدارة العقار
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sm:p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Agreement Details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div><div className="text-gray-500">Contract No</div><div className="font-mono font-semibold text-gray-900">{contract.contractNo} <span className="text-xs text-gray-500">v{contract.version}</span></div></div>
              <div><div className="text-gray-500">Service Type</div><div className="font-medium text-gray-900">{contract.serviceType}</div></div>
              <div><div className="text-gray-500">Owner</div><div className="font-medium text-gray-900">{contract.owner.ownerName}</div></div>
              <div><div className="text-gray-500">Building</div><div className="font-medium text-gray-900">{contract.owner.buildingName}</div></div>
              <div><div className="text-gray-500">Contract Period</div><div className="font-medium text-gray-900">{fmtDate(contract.startDate)} — {fmtDate(contract.endDate)}</div></div>
              <div><div className="text-gray-500">Term</div><div className="font-medium text-gray-900">{contract.contractTerm}</div></div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
            <div className="border-b border-gray-200 bg-gray-50 px-5 py-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Agreement Preview</h2>
              <span className="text-xs text-gray-500">Scroll to review all terms</span>
            </div>
            <div style={{ maxHeight: 600, overflow: 'auto' }}>
              <iframe
                srcDoc={htmlBody}
                title="Contract"
                sandbox="allow-same-origin"
                style={{ width: '100%', height: 600, border: 0, display: 'block', background: '#fff' }}
              />
            </div>
          </div>

          {alreadySigned ? (
            <div className="bg-white rounded-xl shadow-sm border border-emerald-200 p-6 sm:p-8 text-center">
              <div className="text-emerald-600 text-5xl mb-3">✓</div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">This Agreement Has Already Been Signed</h2>
              <p className="text-gray-600">
                Thank you. Your signature has been recorded. CRE will counter-sign and send you the final executed copy.
              </p>
              {contract.ownerSignedAt && (
                <p className="mt-3 text-xs text-gray-500">Signed on {new Date(contract.ownerSignedAt).toLocaleString('en-GB')}</p>
              )}
            </div>
          ) : (
            <SignatureForm
              kind="owner"
              token={token}
              contractNo={contract.contractNo}
              version={contract.version}
              defaultName={contract.owner.ownerName}
            />
          )}

          <p className="text-center text-xs text-gray-500 mt-8">
            Continental Real Estate &middot; Dubai, UAE &middot;{' '}
            <Link href="mailto:info@cre.ae" className="underline">info@cre.ae</Link>
          </p>
        </div>
      </div>
    )
  }

  /* ================= TENANCY CONTRACT ================= */
  const tc = tenancyContract!
  const tenant = await prisma.tenant.findFirst({
    where: { id: tc.tenantId, organizationId: tc.organizationId },
    select: { id: true, name: true, email: true },
  })
  const alreadySigned = !!tc.signedByTenantAt || !['Draft', 'Sent'].includes(tc.status)
  const htmlBody = tc.htmlBody || ''

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        <div className="flex flex-col items-center text-center mb-6">
          <img src="/cre-logo.png" alt="Continental Real Estate" className="h-16 w-auto mb-4" />
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Tenancy Contract Signature</h1>
          <p dir="rtl" className="mt-1 text-lg text-gray-700" style={{ fontFamily: 'Tahoma, Arial, sans-serif' }}>
            توقيع عقد الإيجار
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sm:p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Lease Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div><div className="text-gray-500">Contract No</div><div className="font-mono font-semibold text-gray-900">{tc.contractNo} <span className="text-xs text-gray-500">v{tc.version}</span></div></div>
            <div><div className="text-gray-500">Type</div><div className="font-medium text-gray-900">{tc.contractType}</div></div>
            <div><div className="text-gray-500">Tenant</div><div className="font-medium text-gray-900">{tenant?.name || '—'}</div></div>
            <div><div className="text-gray-500">Annual Rent</div><div className="font-medium text-gray-900">{fmtAED(tc.rentAmount)}</div></div>
            <div><div className="text-gray-500">Lease Period</div><div className="font-medium text-gray-900">{fmtDate(tc.contractStart)} — {fmtDate(tc.contractEnd)}</div></div>
            <div><div className="text-gray-500">Cheques</div><div className="font-medium text-gray-900">{tc.numberOfCheques} installment{tc.numberOfCheques === 1 ? '' : 's'}</div></div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
          <div className="border-b border-gray-200 bg-gray-50 px-5 py-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Contract Preview</h2>
            <span className="text-xs text-gray-500">Scroll to review all terms</span>
          </div>
          <div style={{ maxHeight: 600, overflow: 'auto' }}>
            <iframe
              srcDoc={htmlBody}
              title="Tenancy Contract"
              sandbox="allow-same-origin"
              style={{ width: '100%', height: 600, border: 0, display: 'block', background: '#fff' }}
            />
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
          <p className="font-semibold">What happens after I sign?</p>
          <p className="mt-1 text-blue-800">
            After signing, the CRE team will review your documents and complete
            your tenancy setup. You&rsquo;ll receive a welcome email with your
            portal login credentials within <strong>24 hours</strong>.
          </p>
        </div>

        {alreadySigned ? (
          <div className="bg-white rounded-xl shadow-sm border border-emerald-200 p-6 sm:p-8 text-center">
            <div className="text-emerald-600 text-5xl mb-3">✓</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">This Contract Has Already Been Signed</h2>
            <p className="text-gray-600">
              Thank you. CRE will complete the Ejari registration and send you the final executed copy shortly.
            </p>
            {tc.signedByTenantAt && (
              <p className="mt-3 text-xs text-gray-500">Signed on {new Date(tc.signedByTenantAt).toLocaleString('en-GB')}</p>
            )}
          </div>
        ) : (
          <SignatureForm
            kind="tenant"
            token={token}
            contractNo={tc.contractNo}
            version={tc.version}
            defaultName={tenant?.name || ''}
          />
        )}

        <p className="text-center text-xs text-gray-500 mt-8">
          Continental Real Estate &middot; Dubai, UAE &middot;{' '}
          <Link href="mailto:info@cre.ae" className="underline">info@cre.ae</Link>
        </p>
      </div>
    </div>
  )
}
